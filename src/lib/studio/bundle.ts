export type StudioBundle = {
  version: 1;
  avatar: { id: string; name: string; file: string };
  garments: Array<{ id: string; name: string; file: string; category: "t-shirt" | "shirt"; avatarId: string }>;
};
export const MAX_GLB_BYTES = 40 * 1024 * 1024;
const filename = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,100}\.glb$/.test(v);
const label = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 100;
export function parseBundle(value: unknown): StudioBundle {
  if (!value || typeof value !== "object") throw new Error("Manifest không hợp lệ.");
  const b = value as StudioBundle;
  if (b.version !== 1 || !b.avatar || !label(b.avatar.id) || !label(b.avatar.name) || !filename(b.avatar.file) || !Array.isArray(b.garments) || b.garments.length > 12) throw new Error("Cần manifest v1, avatar và tối đa 12 áo.");
  const ids = new Set<string>();
  const files = new Set([b.avatar.file]);
  for (const g of b.garments) {
    if (!g || (!label(g.id) || g.id === "avatar") || !label(g.name) || !filename(g.file) || !["t-shirt", "shirt"].includes(g.category) || g.avatarId !== b.avatar.id || ids.has(g.id) || files.has(g.file)) throw new Error("Áo phải có ID riêng và được chuẩn bị cho đúng avatar.");
    ids.add(g.id); files.add(g.file);
  }
  return b;
}
/** Reject external resources: PC exports self-contained, uncompressed GLB v2. */
export function validateGlb(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES) throw new Error("GLB phải nhỏ hơn 40 MB và có nội dung hợp lệ.");
  const v = new DataView(buffer);
  if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2 || v.getUint32(8, true) !== buffer.byteLength || v.getUint32(16, true) !== 0x4e4f534a) throw new Error("Chỉ hỗ trợ GLB phiên bản 2.");
  const size = v.getUint32(12, true);
  if (size > buffer.byteLength - 20 || size % 4 !== 0) throw new Error("GLB bị hỏng.");
  const json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + size)));
  const resources = [...(json.buffers ?? []), ...(json.images ?? [])];
  if (resources.some((r: { uri?: unknown }) => r.uri !== undefined && (typeof r.uri !== "string" || !r.uri.startsWith("data:")))) throw new Error("GLB phải nhúng texture/buffer, không tham chiếu tài nguyên bên ngoài.");
  const supported = new Set(["KHR_materials_unlit", "KHR_materials_ior", "KHR_materials_specular", "KHR_materials_clearcoat", "KHR_materials_transmission", "KHR_materials_volume", "KHR_materials_sheen", "KHR_materials_emissive_strength", "KHR_texture_transform", "KHR_mesh_quantization"]);
  if ((json.extensionsRequired ?? []).some((e: string) => !supported.has(e))) throw new Error("Hãy xuất GLB không nén Draco/KTX2 và không dùng extension bắt buộc chưa hỗ trợ.");
}
