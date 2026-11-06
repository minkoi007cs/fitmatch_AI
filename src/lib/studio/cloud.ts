import { api } from "@/lib/v2/client";
import { validateGlb, MAX_GLB_BYTES, CATEGORY_SLOT, type GarmentCategory } from "@/lib/studio/bundle";
import type { JobRow, ModelRow } from "@/lib/v2/contracts";
import type { Slot } from "@/lib/studio/outfit";

export type ModelResponse = {
  model: ModelRow;
  asset: { url: string; sha256: string; bytes: number } | null;
};
/** One selectable wardrobe item in the Studio, independent of where its 3D asset comes from. */
export type StudioItem = {
  /** cloud: garment model id (item version); local: bundle garment id */
  id: string;
  name: string;
  category: GarmentCategory;
  slot: Slot;
  preset: boolean;
  /** ready: fitting for this avatar version exists; pending: being prepared; prepare: can be requested */
  status: "ready" | "pending" | "prepare" | "failed" | "garment-pending";
  fittingId?: string;
};
export const SESSION_BYTES = 120 * 1024 * 1024;

/** Why a cloud model could not be shown. Only "expired" may be retried, once, with a new URL. */
export type DownloadFailure = "expired" | "missing" | "network" | "integrity" | "changed" | "unavailable";
export class ModelDownloadError extends Error {
  constructor(
    message: string,
    readonly reason: DownloadFailure,
  ) {
    super(message);
    this.name = "ModelDownloadError";
  }
}
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type ModelBytesOptions = {
  signal?: AbortSignal;
  /** Re-reads the same model through the authenticated route to get a freshly signed URL. */
  refresh?: () => Promise<ModelResponse>;
  /** Hash the caller pinned (e.g. a saved look snapshot); checked before any download. */
  expectedSha256?: string;
  fetch?: Fetch;
};

/** Signed download URLs are short-lived; Supabase answers an expired one with 400/401/403. */
const EXPIRED_STATUS = new Set([400, 401, 403]);

async function download(url: string, expected: { sha256: string; bytes: number }, signal: AbortSignal | undefined, doFetch: Fetch) {
  let response: Response;
  try {
    response = await doFetch(url, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ModelDownloadError("Mất kết nối khi tải model. Kiểm tra mạng rồi mở lại.", "network");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (EXPIRED_STATUS.has(response.status))
      throw new ModelDownloadError("Liên kết tải model đã hết hạn. Hãy mở lại để lấy liên kết mới.", "expired");
    if (response.status === 404) throw new ModelDownloadError("Không tìm thấy tệp model trên máy chủ.", "missing");
    throw new ModelDownloadError("Không tải được model. Hãy thử lại sau.", "network");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ModelDownloadError("Kết quả 3D không có dữ liệu.", "integrity");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_GLB_BYTES || size > expected.bytes) {
      await reader.cancel();
      throw new ModelDownloadError(size > MAX_GLB_BYTES ? "Model vượt giới hạn 40 MB." : "Kích thước model không khớp. Hãy tải lại.", "integrity");
    }
    chunks.push(value);
  }
  if (size !== expected.bytes) throw new ModelDownloadError("Kích thước model không khớp. Hãy tải lại.", "integrity");
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== expected.sha256) throw new ModelDownloadError("Model không khớp bản đã xác minh.", "integrity");
  try {
    validateGlb(buffer.buffer);
  } catch (e) {
    throw new ModelDownloadError((e as Error).message, "integrity");
  }
  return buffer.buffer;
}

/**
 * Downloads a verified GLB with a byte cap; hash and size must match the server record.
 * CL-URL-01: if the signed URL was refused as expired, the same model is re-read once through the
 * authenticated route and downloaded again only if it is still the identical asset (model id,
 * output asset id, sha256, bytes). Missing objects, network failures and integrity failures are
 * never retried here; nothing is inferred again and no job is created.
 */
export async function modelBytes(record: ModelResponse, options: ModelBytesOptions | AbortSignal = {}) {
  const opts: ModelBytesOptions = options instanceof AbortSignal ? { signal: options } : options;
  const doFetch: Fetch = opts.fetch ?? ((url, init) => fetch(url, init));
  if (!record.asset) throw new ModelDownloadError("Model chưa sẵn sàng. Theo dõi ở trang Chuẩn bị 3D.", "unavailable");
  if (record.asset.bytes > MAX_GLB_BYTES) throw new ModelDownloadError("Model vượt giới hạn 40 MB.", "integrity");
  if (opts.expectedSha256 && record.asset.sha256 !== opts.expectedSha256)
    throw new ModelDownloadError("Phiên bản 3D đã khác bản đã lưu.", "changed");
  const identity = { modelId: record.model.id, outputAssetId: record.model.output_asset_id, sha256: record.asset.sha256, bytes: record.asset.bytes };
  try {
    return await download(record.asset.url, identity, opts.signal, doFetch);
  } catch (e) {
    if (!(e instanceof ModelDownloadError) || e.reason !== "expired") throw e;
    const refresh = opts.refresh ?? (() => api<ModelResponse>(`models/${encodeURIComponent(identity.modelId)}`));
    let fresh: ModelResponse;
    try {
      fresh = await refresh();
    } catch (r) {
      if (opts.signal?.aborted) throw r;
      throw new ModelDownloadError((r as Error).message || "Không lấy lại được liên kết tải model.", "unavailable");
    }
    opts.signal?.throwIfAborted();
    if (
      !fresh.asset ||
      fresh.model.id !== identity.modelId ||
      fresh.model.output_asset_id !== identity.outputAssetId ||
      fresh.asset.sha256 !== identity.sha256 ||
      fresh.asset.bytes !== identity.bytes
    )
      throw new ModelDownloadError("Model đã đổi phiên bản trong lúc tải. Hãy mở lại.", "changed");
    return await download(fresh.asset.url, identity, opts.signal, doFetch);
  }
}

export function categoryOf(model: ModelRow): GarmentCategory | null {
  const c = model.params?.category;
  return typeof c === "string" && Object.hasOwn(CATEGORY_SLOT, c) ? (c as GarmentCategory) : null;
}

/** Wardrobe items for one avatar version. Fittings are per (avatar version, item version). */
export function cloudItems(models: ModelRow[], jobs: JobRow[], avatarId: string): StudioItem[] {
  const jobOf = (modelId: string) => jobs.find((j) => j.model_id === modelId);
  const items: StudioItem[] = [];
  for (const g of models) {
    if (g.kind !== "garment") continue;
    const category = categoryOf(g);
    if (!category) continue;
    const slot = (g.slot ?? CATEGORY_SLOT[category]) as Slot;
    if (!g.output_asset_id) {
      const j = jobOf(g.id);
      if (j && ["queued", "running"].includes(j.state))
        items.push({ id: g.id, name: g.name, category, slot, preset: false, status: "garment-pending" });
      else if (j && ["failed", "canceled"].includes(j.state))
        items.push({ id: g.id, name: g.name, category, slot, preset: false, status: "failed" });
      continue;
    }
    const fit = models.find((m) => !m.superseded_by && m.kind === "fitting" && m.avatar_id === avatarId && m.garment_id === g.id);
    const job = fit ? jobOf(fit.id) : undefined;
    const status: StudioItem["status"] = !fit
      ? "prepare"
      : fit.output_asset_id
        ? "ready"
        : job && ["queued", "running"].includes(job.state)
          ? "pending"
          : job && ["failed", "canceled"].includes(job.state)
            ? "failed"
            : "pending";
    items.push({ id: g.id, name: g.name, category, slot, preset: false, status, fittingId: fit?.id });
  }
  return items;
}

export async function cloudRows() {
  const [models, jobs] = await Promise.all([
    api<{ models: ModelRow[] }>("models"),
    api<{ jobs: JobRow[] }>("jobs"),
  ]);
  return { models: models.models, jobs: jobs.jobs };
}
