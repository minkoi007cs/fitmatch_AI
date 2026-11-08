import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { InputError } from "@/lib/validation";
import { normalizeAnalysisImage } from "./image";
import { bucket, digest, required, result, signedAsset } from "./server";
import type { JobRow, WorkerRow } from "./contracts";
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

export type AnalysisView = {
  id: string;
  itemId: string;
  /** Combined, user-facing state: what is really happening, never a guess. */
  state: "queued" | "waiting_gpu" | "running" | "review" | "confirmed" | "rejected" | "stale" | "failed" | "canceled";
  errorCode: string | null;
  attempts: number;
  createdAt: string;
  resultSha256: string | null;
  result: z.infer<typeof analysisResult> | null;
  confirmedFields: Record<string, unknown> | null;
};

type AnalysisRow = {
  id: string;
  item_id: string;
  status: "pending" | "review" | "confirmed" | "rejected" | "stale";
  result: z.infer<typeof analysisResult> | null;
  result_sha256: string | null;
  confirmed_fields: Record<string, unknown> | null;
  created_at: string;
};

function view(a: AnalysisRow, j: Pick<JobRow, "state" | "error_code" | "attempt"> & { stage?: string | null; deferrals?: number } | null): AnalysisView {
  let state: AnalysisView["state"];
  if (a.status !== "pending") state = a.status;
  else if (!j) state = "failed";
  else if (j.state === "queued") state = (j.deferrals ?? 0) > 0 ? "waiting_gpu" : "queued";
  else if (j.state === "running") state = "running";
  else if (j.state === "canceled") state = "canceled";
  else state = "failed";
  return {
    id: a.id,
    itemId: a.item_id,
    state,
    errorCode: a.status === "pending" ? (j?.error_code ?? null) : null,
    attempts: j?.attempt ?? 0,
    createdAt: a.created_at,
    resultSha256: a.status === "review" || a.status === "confirmed" || a.status === "rejected" ? a.result_sha256 : null,
    result: a.status === "review" || a.status === "confirmed" || a.status === "rejected" ? a.result : null,
    confirmedFields: a.confirmed_fields,
  };
}

/** Latest analysis per item for the owner (one query each, no N+1). */
export async function listAnalyses(owner: string) {
  const db = createAdminClient();
  const rows = result(
    await db
      .from("fm_v2_analyses")
      .select("id,item_id,status,result,result_sha256,confirmed_fields,created_at")
      .eq("user_id", owner)
      .order("created_at", { ascending: false })
      .limit(200),
  ) as AnalysisRow[];
  const latest = new Map<string, AnalysisRow>();
  for (const r of rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r);
  const ids = [...latest.values()].map((r) => r.id);
  const jobs = ids.length
    ? (result(
        await db
          .from("fm_v2_jobs")
          .select("analysis_id,state,error_code,attempt,stage,deferrals")
          .eq("user_id", owner)
          .in("analysis_id", ids),
      ) as (JobRow & { analysis_id: string; deferrals: number })[])
    : [];
  const byAnalysis = new Map(jobs.map((j) => [j.analysis_id, j]));
  return [...latest.values()].map((a) => view(a, byAnalysis.get(a.id) ?? null));
}

/**
 * True when one of the owner's enabled workers is granted AND currently declares garment.analyze
 * with a heartbeat in the last 90 s (same window claim_r1 uses). Lets the UI say "PC offline"
 * instead of pretending a queued job is about to run.
 */
export async function analysisWorkerOnline(owner: string) {
  const since = new Date(Date.now() - 90_000).toISOString();
  const rows = result(
    await createAdminClient()
      .from("fm_v2_workers")
      .select("capabilities,allowed_capabilities")
      .eq("user_id", owner)
      .eq("enabled", true)
      .gte("last_seen", since),
  ) as { capabilities: Record<string, unknown> | null; allowed_capabilities: string[] | null }[];
  return rows.some((w) => !!w.capabilities && ANALYSIS_KIND in w.capabilities && (w.allowed_capabilities ?? []).includes(ANALYSIS_KIND));
}

async function analysisOf(owner: string, id: string) {
  const db = createAdminClient();
  const a = result(
    await db
      .from("fm_v2_analyses")
      .select("id,item_id,status,result,result_sha256,confirmed_fields,created_at")
      .eq("id", id)
      .eq("user_id", owner)
      .maybeSingle(),
  ) as AnalysisRow | null;
  if (!a) throw new InputError(404, "ANALYSIS_NOT_FOUND");
  const j = result(
    await db.from("fm_v2_jobs").select("state,error_code,attempt,stage,deferrals").eq("analysis_id", id).eq("user_id", owner).maybeSingle(),
  ) as (JobRow & { deferrals: number }) | null;
  return view(a, j);
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
  // Same item, same pixels, same policy: reuse (never re-run the GPU for a known snapshot).
  const existing = result(
    await db
      .from("fm_v2_analyses")
      .select("id")
      .eq("user_id", owner)
      .eq("item_id", itemId)
      .eq("image_sha256", sha)
      .eq("policy_revision", POLICY_REVISION)
      .maybeSingle(),
  ) as { id: string } | null;
  if (existing) return { analysis: await analysisOf(owner, existing.id), deduped: true };
  const assetId = randomUUID();
  const path = `${owner}/analysis/${assetId}.jpg`;
  const upload = await db.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (upload.error) throw new InputError(503, "DATA_UNAVAILABLE");
  result(
    await db.from("fm_v2_assets").insert({
      id: assetId,
      user_id: owner,
      kind: "photo",
      state: "ready",
      path,
      source_path: path,
      expected_bytes: bytes.length,
      bytes: bytes.length,
      sha256: sha,
    }),
  );
  const r = required(
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
  return { analysis: await analysisOf(owner, r.analysisId), deduped: r.deduped };
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
