import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { InputError } from "@/lib/validation";
import { normalizeAnalysisImage } from "./image";
import { bucket, digest, required, result, signedAsset } from "./server";
import type { JobRow, WorkerRow } from "./contracts";
import { readAnalyses, readAnalysis, type AnalysisReader, type AnalysisRow } from "./analysis-read";
import {
  ANALYSIS_KIND,
  ANALYSIS_CONTRACT,
  POLICY_REVISION,
  RESULT_VERSION,
  analysisLimits,
  analysisResult,
  analysisConfirmRequest,
  wardrobeMapping,
  canonicalJson,
} from "./qwen";
import type { z } from "zod";

/** QINT-C feature flag, server-side only and OFF unless a dedicated test config turns it on. */
export function analysisEnabled() {
  return process.env.QWEN_ANALYSIS_ENABLED === "1";
}
const WARDROBE_BUCKET = "fitmatch-wardrobe";

export type { AnalysisView } from "./analysis-read";

/** Supabase adapter for the pure, skew-safe read model in analysis-read.ts. */
const COLUMNS = "id,item_id,status,result,result_sha256,confirmed_fields,created_at";
function reader(): AnalysisReader {
  const db = createAdminClient();
  return {
    analysesForOwner: async (owner) =>
      result(
        await db.from("fm_v2_analyses").select(COLUMNS).eq("user_id", owner).order("created_at", { ascending: false }).limit(200),
      ) as AnalysisRow[],
    analysesByIds: async (owner, ids) =>
      result(await db.from("fm_v2_analyses").select(COLUMNS).eq("user_id", owner).in("id", ids)) as AnalysisRow[],
    jobsFor: async (owner, ids) =>
      result(
        await db
          .from("fm_v2_jobs")
          .select("analysis_id,state,error_code,attempt,stage,deferrals")
          .eq("user_id", owner)
          .in("analysis_id", ids),
      ) as (JobRow & { analysis_id: string; deferrals: number })[],
  };
}

export async function listAnalyses(owner: string) {
  return readAnalyses(reader(), owner);
}

/**
 * True when one of the owner's enabled workers is granted AND currently declares garment.analyze
 * with a heartbeat in the last 90 s (same window claim_r1 uses). Lets the UI say "PC offline" or
 * "PC busy with other GPU work" instead of pretending a queued job is about to run.
 */
export async function analysisWorkerStatus(owner: string) {
  const since = new Date(Date.now() - 90_000).toISOString();
  const rows = result(
    await createAdminClient()
      .from("fm_v2_workers")
      .select("capabilities,allowed_capabilities,gpu_busy")
      .eq("user_id", owner)
      .eq("enabled", true)
      .gte("last_seen", since),
  ) as { capabilities: Record<string, unknown> | null; allowed_capabilities: string[] | null; gpu_busy: boolean | null }[];
  const usable = rows.filter(
    (w) => !!w.capabilities && ANALYSIS_KIND in w.capabilities && (w.allowed_capabilities ?? []).includes(ANALYSIS_KIND),
  );
  // QREV-STATUS: "busy" only when every one of the owner's own online analysis workers reported the shared
  // GPU taken at its last heartbeat. It never says whose work holds the GPU.
  return { workerOnline: usable.length > 0, gpuBusy: usable.length > 0 && usable.every((w) => w.gpu_busy === true) };
}

async function analysisOf(owner: string, id: string) {
  const a = await readAnalysis(reader(), owner, id);
  if (!a) throw new InputError(404, "ANALYSIS_NOT_FOUND");
  return a;
}

/**
 * Owner asks to analyze one of their wardrobe items. The photo is copied once into an immutable,
 * normalized private snapshot; the worker only ever sees that snapshot through a short signed URL.
 */
export async function createAnalysis(owner: string, itemId: string) {
  const db = createAdminClient();
  const item = result(
    await db.from("fm_wardrobe_items").select("id,image_path").eq("id", itemId).eq("user_id", owner).maybeSingle(),
  ) as { id: string; image_path: string | null } | null;
  if (!item) throw new InputError(404, "ITEM_NOT_FOUND");
  if (!item.image_path || !item.image_path.startsWith(owner + "/")) throw new InputError(400, "ITEM_HAS_NO_IMAGE");
  const download = await db.storage.from(WARDROBE_BUCKET).download(item.image_path);
  if (download.error || !download.data) throw new InputError(409, "ITEM_IMAGE_UNAVAILABLE");
  if (download.data.size > analysisLimits.maxImageBytes) throw new InputError(400, "IMAGE_TOO_LARGE");
  let bytes: Buffer;
  try {
    bytes = await normalizeAnalysisImage(Buffer.from(await download.data.arrayBuffer()));
  } catch {
    throw new InputError(400, "INVALID_IMAGE");
  }
  const sha = digest(bytes);
  // QREV-QUOTA/SNAPSHOT: one atomic step checks dedupe (no quota), the shared job and asset quotas and
  // durably reserves the snapshot path with a cleanup intent BEFORE any object exists.
  const assetId = randomUUID();
  const reserved = required(
    await db.rpc("fm_v2_analysis_reserve", {
      p_user: owner,
      p_item: itemId,
      p_source_path: item.image_path,
      p_sha: sha,
      p_policy: POLICY_REVISION,
      p_asset: assetId,
      p_bytes: bytes.length,
    }),
  ) as { deduped: true; analysisId: string } | { deduped: false; assetId: string; path: string };
  // Same item, same pixels, same policy: reuse (never re-run the GPU for a known snapshot).
  if (reserved.deduped) return { analysis: await analysisOf(owner, reserved.analysisId), deduped: true };
  if (reserved.path !== `${owner}/analysis/${assetId}.jpg`) throw new InputError(503, "DATA_UNAVAILABLE");
  const upload = await db.storage.from(bucket).upload(reserved.path, bytes, { contentType: "image/jpeg", upsert: false });
  if (upload.error) {
    await discardSnapshot(owner, assetId);
    throw new InputError(503, "DATA_UNAVAILABLE");
  }
  let r: { analysisId: string; deduped: boolean };
  try {
    r = required(
      await db.rpc("fm_v2_analysis_enqueue", {
        p_user: owner,
        p_item: itemId,
        p_source_path: item.image_path,
        p_asset: assetId,
        p_sha: sha,
        p_policy: POLICY_REVISION,
        p_analysis: randomUUID(),
        p_job: randomUUID(),
      }),
    ) as { analysisId: string; deduped: boolean };
  } catch (error) {
    // Quota taken meanwhile, item edited/deleted, expired reservation or a lost reply. If the enqueue
    // actually committed, abort sees the analysis and leaves the snapshot alone.
    await discardSnapshot(owner, assetId);
    throw error;
  }
  if (r.deduped) await discardSnapshot(owner, assetId); // lost a race; the winner's snapshot is kept
  return { analysis: await analysisOf(owner, r.analysisId), deduped: r.deduped };
}

/**
 * Compensation for a reservation that will not be used: tombstone it (only if no analysis references
 * it) and try the removal now. Whatever fails here stays a durable CL-PRIV-01 intent that the
 * collector retries, so a storage or database hiccup never leaves an untracked private copy.
 */
async function discardSnapshot(owner: string, assetId: string) {
  const db = createAdminClient();
  try {
    const paths = result(await db.rpc("fm_v2_analysis_abort", { p_user: owner, p_asset: assetId })) as string[];
    if (!paths?.length) return;
    const { error } = await db.storage.from(bucket).remove(paths);
    result(
      await db.rpc("fm_v2_source_cleanup_report", {
        p_user: owner,
        p_paths: paths,
        p_ok: !error,
        p_error: error ? "STORAGE_ERROR" : null,
      }),
    );
  } catch {
    // The reservation intent (due after its grace) remains; the collector removes the object.
  }
}

export async function analysisAction(owner: string, id: string, action: "cancel" | "retry") {
  const ok = result(
    await createAdminClient().rpc("fm_v2_analysis_action", { p_user: owner, p_analysis: id, p_action: action }),
  );
  if (!ok) throw new InputError(409, action === "retry" ? "RETRY_NOT_ALLOWED" : "CANCEL_NOT_ALLOWED");
  return analysisOf(owner, id);
}

/** Human decision: only fields the user sent are mapped onto wardrobe columns; `unknown` never is. */
export async function confirmAnalysis(owner: string, id: string, body: z.infer<typeof analysisConfirmRequest>) {
  const f = body.fields;
  const columns: Record<string, string | null> = {};
  if (f.category) columns.category = wardrobeMapping.category[f.category];
  if (f.primaryColor) columns.color = f.primaryColor;
  if (f.secondaryColor !== undefined) columns.secondary_color = f.secondaryColor;
  if (f.pattern) columns.pattern = wardrobeMapping.pattern[f.pattern];
  if (body.decision === "approve" && Object.keys(columns).length === 0 && f.logoText === undefined)
    throw new InputError(400, "INVALID_INPUT");
  const r = required(
    await createAdminClient().rpc("fm_v2_analysis_confirm", {
      p_user: owner,
      p_analysis: id,
      p_confirmation: body.confirmationId,
      p_digest: digest(canonicalJson(body)),
      p_expected_sha: body.expectedResultSha256,
      p_decision: body.decision,
      p_fields: f,
      // A logo-text-only approval records the text on the analysis without touching wardrobe columns.
      p_columns: columns,
    }),
  ) as { status: string; replay: boolean };
  return { analysis: await analysisOf(owner, id), replay: r.replay };
}

// ---------------------------------------------------------------- worker side

/** Claim envelope for garment.analyze (see docs/qwen-contract-v1.md). */
export async function analysisEnvelope(w: WorkerRow, job: JobRow & { analysis_id: string; redelivered?: boolean }, protocolRevision: string) {
  const db = createAdminClient();
  const a = required(
    await db
      .from("fm_v2_analyses")
      .select("id,item_id,image_asset_id,image_sha256,policy_revision")
      .eq("id", job.analysis_id)
      .eq("user_id", w.user_id)
      .single(),
  ) as { id: string; item_id: string; image_asset_id: string; image_sha256: string; policy_revision: string };
  const asset = await signedAsset(w.user_id, a.image_asset_id);
  if (asset.sha256 !== a.image_sha256) throw new InputError(409, "SOURCE_CHANGED");
  return {
    protocolVersion: 1,
    protocolRevision,
    contract: ANALYSIS_CONTRACT,
    redelivered: job.redelivered === true,
    jobId: job.id,
    kind: job.kind,
    modelId: null,
    modelRevision: job.engine,
    lease: { token: job.lease_token, expiresAt: job.lease_until, attempt: job.attempt },
    input: {
      params: {},
      avatarVersionId: null,
      garmentVersionId: null,
      binding: { jobId: job.id, analysisId: a.id, itemId: a.item_id, imageAssetId: a.image_asset_id, imageSha256: a.image_sha256 },
      policy: {
        policyRevision: a.policy_revision,
        maxOutputTokens: analysisLimits.maxOutputTokens,
        maxSchemaAttempts: analysisLimits.maxSchemaAttempts,
        maxResultBytes: analysisLimits.maxResultBytes,
        timeoutSeconds: analysisLimits.timeoutSeconds,
        imageIsUntrustedData: true,
      },
      assets: [{ ...asset, role: "garment_image" }],
    },
    outputContract: { format: "json-v1", schema: RESULT_VERSION, maxBytes: analysisLimits.maxResultBytes },
  };
}

/** Bytes are hashed as received, parsed, validated and checked against the job inside one RPC. */
export async function analysisResultFromWorker(w: WorkerRow, jobId: string, body: { leaseToken: string; sha256: string; resultJson: string }) {
  if (Buffer.byteLength(body.resultJson, "utf8") > analysisLimits.maxResultBytes) throw new InputError(400, "RESULT_TOO_LARGE");
  if (digest(Buffer.from(body.resultJson, "utf8")) !== body.sha256) throw new InputError(400, "RESULT_HASH_MISMATCH");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.resultJson);
  } catch {
    throw new InputError(400, "INVALID_RESULT");
  }
  const checked = analysisResult.safeParse(parsed);
  if (!checked.success) throw new InputError(400, "INVALID_RESULT");
  const outcome = result(
    await createAdminClient().rpc("fm_v2_analysis_result", {
      p_worker: w.id,
      p_job: jobId,
      p_token: body.leaseToken,
      p_sha: body.sha256,
      p_json: body.resultJson,
      p_result: checked.data,
    }),
  ) as "ok" | "replay" | "lease_lost" | "mismatch" | "stale";
  if (outcome === "lease_lost") throw new InputError(409, "LEASE_LOST");
  if (outcome === "mismatch") throw new InputError(400, "RESULT_BINDING_MISMATCH");
  if (outcome === "stale") throw new InputError(409, "SOURCE_CHANGED");
  return { success: true, replay: outcome === "replay" };
}
