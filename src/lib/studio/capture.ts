export type CaptureKind = "avatar" | "t-shirt" | "shirt" | "jeans";
export type CaptureSlot = "front" | "side" | "back" | "detail" | "face";
export function requiredSlots(kind: CaptureKind): CaptureSlot[] {
  return kind === "avatar" ? ["front", "side", "back"] : ["front", "back"];
}
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];
/** Container/size check only; the PC adapter decodes and rejects unusable footage. */
export function inspectVideo(file: File): VideoType {
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type) || file.size === 0 || file.size > 150 * 1024 * 1024)
    throw new Error("Chọn video MP4, WebM hoặc MOV không quá 150 MB.");
  return file.type as VideoType;
}
export async function inspectPhoto(file: File): Promise<void> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size === 0 ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP không quá 12 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Không đọc được ảnh. Hãy xuất lại ảnh JPG/PNG/WebP và thử lại.",
    );
  }
  try {
    if (bitmap.width < 512 || bitmap.height < 512)
      throw new Error("Ảnh cần rộng và cao ít nhất 512 px để giữ chi tiết.");
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("Ảnh quá lớn; hãy giảm xuống dưới 40 megapixel.");
  } finally {
    bitmap.close();
  }
}
export async function captureArchive(
  kind: CaptureKind,
  name: string,
  height: number | null,
  photos: Partial<Record<CaptureSlot, File>>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!name.trim() || name.trim().length > 80)
    throw new Error("Tên cần từ 1–80 ký tự.");
  if (kind === "avatar" && (!height || height < 100 || height > 230))
    throw new Error("Nhập chiều cao từ 100–230 cm.");
  for (const slot of requiredSlots(kind))
    if (!photos[slot]) throw new Error("Hãy thêm đủ các góc ảnh bắt buộc.");
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const views: Array<{ view: CaptureSlot; file: string }> = [];
  for (const [slot, file] of Object.entries(photos) as [CaptureSlot, File][]) {
    if (!file) continue;
    await inspectPhoto(file);
    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";
    const path = `photos/${slot}.${extension}`;
    files[path] = new Uint8Array(await file.arrayBuffer());
    views.push({ view: slot, file: path });
  }
  files["capture.json"] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        kind,
        name: name.trim(),
        heightCm: kind === "avatar" ? height : null,
        createdAt: new Date().toISOString(),
        status: "input_only",
        views,
      },
      null,
      2,
    ),
  );
  files["PC-README.txt"] = strToU8(
    "Fitmatch capture v1 — INPUT ONLY, not a completed GPU job.\nRead capture.json and photos/. Photos are user-provided; no model inference has run.\nFor avatar: estimate body and appearance; do not treat source clothes as clean body.\nFor garment: preserve observed colors/logo, front/back and fixed dimensions.\nExport the prepared result separately as manifest.json + avatar.glb + garment GLBs, sharing origin/scale/pose, in meters (+Y up, front +Z). Embed textures, no Draco/KTX2.\nDo not upload these source photos or licensed body models to GitHub.\n",
  );
  return zipSync(files, { level: 0 });
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
