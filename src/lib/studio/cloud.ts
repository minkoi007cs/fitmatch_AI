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

/** Downloads a verified GLB with a byte cap; hash and size must match the server record. */
export async function modelBytes(record: ModelResponse, signal?: AbortSignal) {
  if (!record.asset) throw new Error("Model chưa sẵn sàng. Theo dõi ở trang Chuẩn bị 3D.");
  if (record.asset.bytes > MAX_GLB_BYTES) throw new Error("Model vượt giới hạn 40 MB.");
  const response = await fetch(record.asset.url, { signal });
  if (!response.ok) throw new Error("Không tải được model. Hãy mở lại để lấy liên kết mới.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Kết quả 3D không có dữ liệu.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_GLB_BYTES) {
      await reader.cancel();
      throw new Error("Model vượt giới hạn 40 MB.");
    }
    chunks.push(value);
  }
  if (size !== record.asset.bytes) throw new Error("Kích thước model không khớp. Hãy tải lại.");
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== record.asset.sha256) throw new Error("Model không khớp bản đã xác minh.");
  validateGlb(buffer.buffer);
  return buffer.buffer;
}

export function categoryOf(model: ModelRow): GarmentCategory | null {
  const c = model.params?.category;
  return typeof c === "string" && c in CATEGORY_SLOT ? (c as GarmentCategory) : null;
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
      continue;
    }
    const fit = models.find((m) => m.kind === "fitting" && m.avatar_id === avatarId && m.garment_id === g.id);
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
