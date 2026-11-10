export type StudioBundle = {
  version: 1;
  avatar: { id: string; name: string; file: string };
  /** `preset: true` marks a labelled sample outfit piece prepared for this avatar, not a wardrobe item. */
  garments: Array<{ id: string; name: string; file: string; category: GarmentCategory; avatarId: string; preset?: boolean }>;
};
export type GarmentCategory = "t-shirt" | "shirt" | "jeans";
export const CATEGORY_SLOT: Record<GarmentCategory, "top" | "bottom"> = { "t-shirt": "top", shirt: "top", jeans: "bottom" };
export const CATEGORY_LABEL: Record<GarmentCategory, string> = { "t-shirt": "T-shirt", shirt: "Shirt", jeans: "Jeans" };
export const MAX_GLB_BYTES = 40 * 1024 * 1024;
const filename = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,100}\.glb$/.test(v);
const label = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 100;
export function parseBundle(value: unknown): StudioBundle {
  if (!value || typeof value !== "object") throw new Error("Invalid manifest.");
  const b = value as StudioBundle;
  if (b.version !== 1 || !b.avatar || !label(b.avatar.id) || !label(b.avatar.name) || !filename(b.avatar.file) || !Array.isArray(b.garments) || b.garments.length > 12) throw new Error("A v1 manifest, an avatar and up to 12 garments are required.");
  const ids = new Set<string>();
  const files = new Set([b.avatar.file]);
  for (const g of b.garments) {
    if (!g || (!label(g.id) || g.id === "avatar") || !label(g.name) || !filename(g.file) || typeof g.category !== "string" || !Object.hasOwn(CATEGORY_SLOT, g.category) || (g.preset !== undefined && typeof g.preset !== "boolean") || g.avatarId !== b.avatar.id || ids.has(g.id) || files.has(g.file)) throw new Error("Each garment needs a unique ID, a valid category (T-shirt, shirt or jeans) and preparation for the correct avatar.");
    ids.add(g.id); files.add(g.file);
  }
  return b;
}
/** Reject external resources: PC exports self-contained, uncompressed GLB v2. */
export function validateGlb(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES) throw new Error("GLB files must be under 40 MB with valid content.");
  const v = new DataView(buffer);
  if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2 || v.getUint32(8, true) !== buffer.byteLength || v.getUint32(16, true) !== 0x4e4f534a) throw new Error("Only GLB version 2 is supported.");
  const size = v.getUint32(12, true);
  if (size > buffer.byteLength - 20 || size % 4 !== 0) throw new Error("Corrupt GLB file.");
  const json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + size)));
  const resources = [...(json.buffers ?? []), ...(json.images ?? [])];
  if (resources.some((r: { uri?: unknown }) => r.uri !== undefined && (typeof r.uri !== "string" || !r.uri.startsWith("data:")))) throw new Error("GLB textures and buffers must be embedded, with no external resource references.");
  const supported = new Set(["KHR_materials_unlit", "KHR_materials_ior", "KHR_materials_specular", "KHR_materials_clearcoat", "KHR_materials_transmission", "KHR_materials_volume", "KHR_materials_sheen", "KHR_materials_emissive_strength", "KHR_texture_transform", "KHR_mesh_quantization"]);
  if ((json.extensionsRequired ?? []).some((e: string) => !supported.has(e))) throw new Error("Export GLB without Draco/KTX2 compression or unsupported required extensions.");
}
