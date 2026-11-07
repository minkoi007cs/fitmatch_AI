import sharp from "sharp";

/**
 * Private photo normalization: decode-checked, EXIF-rotated, at most 2048 px, JPEG q95.
 * Transparent pixels (cut-out garment photos) are flattened onto white, not black, so the
 * garment's own colors and edges stay as photographed.
 */
export async function normalizePhoto(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.width ?? 0) < 512 || (meta.height ?? 0) < 512)
    throw new Error("INVALID_IMAGE");
  return image
    .rotate()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * QINT-C: immutable snapshot of a wardrobe photo for garment analysis. Smaller minimum than avatar
 * capture (wardrobe photos are often phone thumbnails); EXIF/metadata stripped by re-encoding.
 */
export async function normalizeAnalysisImage(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.width ?? 0) < 128 || (meta.height ?? 0) < 128)
    throw new Error("INVALID_IMAGE");
  return image
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
}
