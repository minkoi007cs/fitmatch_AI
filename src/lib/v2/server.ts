import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { normalizePhoto } from "./image";
import { createAdminClient } from "@/lib/supabase/admin";
import { InputError } from "@/lib/validation";
import { validateOutputGlb } from "./output";
import type { AssetRow, JobRow, WorkerRow } from "./contracts";
export const bucket = "fitmatch-v2";
export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function result<T>(r: {
  data: T;
  error: { message: string } | null;
}): T {
  if (r.error) {
    const known = [
      "IDEMPOTENCY_CONFLICT",
      "QUOTA_EXCEEDED",
      "INVALID_ASSET",
      "INVALID_GARMENT",
      "MODEL_NOT_READY",
      "FITTING_NOT_READY",
      "LOOK_NOT_FOUND",
      "MODEL_NOT_FOUND",
      "SOURCE_ALREADY_DELETED",
      "INVALID_INPUT",
      "LEASE_LOST",
    ].find((c) => r.error!.message.includes(c));
    if (known)
      throw new InputError(
        known === "QUOTA_EXCEEDED" ? 429 : known === "LOOK_NOT_FOUND" || known === "MODEL_NOT_FOUND" ? 404 : 409,
        known,
      );
    throw new InputError(503, "DATA_UNAVAILABLE");
  }
  return r.data;
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function required<T>(r: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  const value = result(r);
  if (value == null) throw new InputError(503, "DATA_UNAVAILABLE");
  return value as NonNullable<T>;
}
export async function workerAuth(request: Request): Promise<WorkerRow> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (fmw_[A-Za-z0-9_-]{40,100})$/)?.[1];
  if (!token) throw new InputError(401, "WORKER_AUTH_REQUIRED");
  const row = result(
    await createAdminClient()
      .from("fm_v2_workers")
      .select("id,user_id,capabilities,allowed_capabilities,enabled,last_seen")
      .eq("token_hash", digest(token))
      .eq("enabled", true)
      .maybeSingle(),
  ) as WorkerRow | null;
  if (!row) throw new InputError(401, "WORKER_AUTH_REQUIRED");
  return row;
}
export async function ownedJob(
  worker: WorkerRow,
  jobId: string,
  token: string,
) {
  const job = result(
    await createAdminClient()
      .from("fm_v2_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", worker.user_id)
      .eq("worker_id", worker.id)
      .maybeSingle(),
  ) as JobRow | null;
  if (
    !job ||
    job.state !== "running" ||
    job.lease_token !== token ||
    !job.lease_until ||
    Date.parse(job.lease_until) <= Date.now()
  )
    throw new InputError(409, "LEASE_LOST");
  return job;
}
const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
export async function assetIntent(
  userId: string,
  kind: "photo" | "glb" | "video",
  bytes: number,
  jobId: string | null = null,
  contentType?: string,
) {
  const db = createAdminClient();
  const assetId = randomUUID();
  const sourcePath = `${userId}/staging/${assetId}`;
  const ext = kind === "photo" ? "jpg" : kind === "glb" ? "glb" : VIDEO_EXT[contentType ?? ""];
  if (!ext) throw new InputError(400, "INVALID_INPUT");
  const path = `${userId}/verified/${assetId}.${ext}`;
  result(
    await db.rpc("fm_v2_asset_intent", {
      p_id: assetId,
      p_user: userId,
      p_kind: kind,
      p_source: sourcePath,
      p_path: path,
      p_bytes: bytes,
      p_job: jobId,
    }),
  );
  const signed = required(
    await db.storage
      .from(bucket)
      .createSignedUploadUrl(sourcePath, { upsert: false }),
  );
  return { assetId, uploadUrl: signed.signedUrl };
}
export async function finalizeAsset(
  userId: string,
  assetId: string,
  jobId: string | null = null,
) {
  const db = createAdminClient();
  const row = result(
    await db
      .from("fm_v2_assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", userId)
      .maybeSingle(),
  ) as AssetRow | null;
  if (!row || row.job_id !== jobId)
    throw new InputError(404, "ASSET_NOT_FOUND");
  if (row.state === "ready") return { assetId: row.id, sha256: row.sha256 };
  if (row.state === "rejected") throw new InputError(400, "ASSET_REJECTED");
  if (row.state === "deleted") throw new InputError(410, "ASSET_DELETED");
  // A job output that fails verification is marked rejected so the worker's next
  // output-intent creates a fresh logical asset instead of reusing bad staging bytes.
  const reject = async (code: string): Promise<never> => {
    if (row.job_id && row.kind === "glb")
      result(
        await db
          .from("fm_v2_assets")
          .update({ state: "rejected" })
          .eq("id", row.id)
          .eq("user_id", userId)
          .eq("state", "pending"),
      );
    throw new InputError(400, code);
  };
  const info = await db.storage.from(bucket).info(row.source_path);
  if (info.error) {
    const e = info.error as { status?: number; statusCode?: string; message?: string };
    // Not uploaded yet (or the upload never landed): the worker re-requests an upload URL.
    if (e.status === 404 || e.statusCode === "404" || /not.?found|missing/i.test(e.message ?? ""))
      throw new InputError(404, "ASSET_NOT_UPLOADED");
    throw new InputError(503, "DATA_UNAVAILABLE");
  }
  if (Number(info.data?.size) !== row.expected_bytes)
    await reject("ASSET_SIZE_MISMATCH");
  const blob = required(
    await db.storage.from(bucket).download(row.source_path),
  );
  if (blob.size !== row.expected_bytes)
    throw new InputError(400, "ASSET_SIZE_MISMATCH");
  let bytes = Buffer.from(await blob.arrayBuffer());
  if (row.kind === "photo") {
    try {
      bytes = Buffer.from(await normalizePhoto(bytes));
    } catch {
      throw new InputError(400, "INVALID_IMAGE");
    }
  } else if (row.kind === "video") {
    // Container signature only; the server never decodes video. Duration/codec is checked by the adapter.
    const ext = row.path.split(".").pop();
    const iso = bytes.length > 12 && bytes.toString("latin1", 4, 8) === "ftyp";
    const webm = bytes.length > 4 && bytes.readUInt32BE(0) === 0x1a45dfa3;
    if (!((ext === "mp4" || ext === "mov") ? iso : ext === "webm" ? webm : false))
      throw new InputError(400, "INVALID_VIDEO");
  } else {
    try {
      validateOutputGlb(Uint8Array.from(bytes).buffer);
    } catch {
      return await reject("INVALID_GLB");
    }
  }
  const hash = digest(bytes);
  if (row.expected_sha256 && row.expected_sha256 !== hash)
    await reject("ASSET_HASH_MISMATCH");
  const upload = await db.storage.from(bucket).upload(row.path, bytes, {
    contentType:
      row.kind === "photo"
        ? "image/jpeg"
        : row.kind === "video"
          ? ({ mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[row.path.split(".").pop()!]
          : "model/gltf-binary",
    upsert: false,
  });
  if (upload.error) {
    // Parallel finalize may have published identical immutable bytes; never overwrite.
    const existing = await db.storage.from(bucket).download(row.path);
    if (
      existing.error ||
      digest(new Uint8Array(await existing.data.arrayBuffer())) !== hash
    )
      throw new InputError(409, "ASSET_FINALIZE_CONFLICT");
  }
  result(
    await db
      .from("fm_v2_assets")
      .update({ state: "ready", bytes: bytes.length, sha256: hash })
      .eq("id", row.id)
      .eq("user_id", userId),
  );
  return { assetId: row.id, sha256: hash };
}
/** R1 idempotent output intent. Lease is checked inside the database transaction. */
export async function outputIntent(
  worker: WorkerRow,
  jobId: string,
  leaseToken: string,
  bytes: number,
  sha256: string,
) {
  const db = createAdminClient();
  const assetId = randomUUID();
  const r = required(
    await db.rpc("fm_v2_output_intent", {
      p_worker: worker.id,
      p_job: jobId,
      p_token: leaseToken,
      p_id: assetId,
      p_bytes: bytes,
      p_sha: sha256,
      p_source: `${worker.user_id}/staging/${assetId}`,
      p_path: `${worker.user_id}/verified/${assetId}.glb`,
    }),
  ) as { assetId: string; state: "pending" | "ready"; sourcePath: string; created: boolean };
  if (r.state === "ready")
    return { assetId: r.assetId, state: r.state, uploadUrl: null, created: false };
  // Fresh URL on every call: an expired URL is refreshed without a new logical asset.
  const signed = required(
    await db.storage
      .from(bucket)
      .createSignedUploadUrl(r.sourcePath, { upsert: false }),
  );
  return { assetId: r.assetId, state: r.state, uploadUrl: signed.signedUrl, created: r.created };
}
export function mediaType(row: Pick<AssetRow, "kind" | "path">) {
  if (row.kind === "photo") return "image/jpeg";
  if (row.kind === "glb") return "model/gltf-binary";
  return ({ mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[row.path.split(".").pop() ?? ""] ?? "application/octet-stream";
}
export async function signedAsset(userId: string, assetId: string) {
  const db = createAdminClient();
  const row = result(
    await db
      .from("fm_v2_assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", userId)
      .eq("state", "ready")
      .maybeSingle(),
  ) as AssetRow | null;
  if (!row) throw new InputError(404, "ASSET_NOT_READY");
  const signed = required(
    await db.storage.from(bucket).createSignedUrl(row.path, 300),
  );
  return {
    assetId: row.id,
    url: signed.signedUrl,
    sha256: row.sha256,
    bytes: row.bytes,
    mediaType: mediaType(row),
  };
}
