import { validateGlb } from "../studio/bundle";
/** Publication gate beyond the local import check: require a scene with actual embedded mesh data. */
export function validateOutputGlb(buffer: ArrayBuffer) {
  validateGlb(buffer);
  const view = new DataView(buffer),
    jsonSize = view.getUint32(12, true);
  const doc = JSON.parse(
    new TextDecoder().decode(buffer.slice(20, 20 + jsonSize)),
  );
  if (
    doc.asset?.version !== "2.0" ||
    !Array.isArray(doc.scenes) ||
    !doc.scenes.length ||
    !Array.isArray(doc.nodes) ||
    !Array.isArray(doc.meshes) ||
    !doc.meshes.length
  )
    throw new Error("Scene and mesh required");
  const offset = 20 + jsonSize;
  if (
    offset + 8 > buffer.byteLength ||
    view.getUint32(offset + 4, true) !== 0x004e4942
  )
    throw new Error("Embedded binary buffer required");
  const binSize = view.getUint32(offset, true);
  if (
    offset + 8 + binSize !== buffer.byteLength ||
    binSize % 4 ||
    doc.buffers?.length !== 1 ||
    doc.buffers[0].uri !== undefined ||
    !Number.isInteger(doc.buffers[0].byteLength) ||
    doc.buffers[0].byteLength > binSize ||
    binSize - doc.buffers[0].byteLength > 3
  )
    throw new Error("Invalid binary buffer");
  if (!Array.isArray(doc.bufferViews) || !Array.isArray(doc.accessors))
    throw new Error("Mesh buffers required");
  for (const b of doc.bufferViews) {
    if (
      b.buffer !== 0 ||
      !Number.isInteger(b.byteLength) ||
      b.byteLength <= 0 ||
      !Number.isInteger(b.byteOffset ?? 0) ||
      (b.byteOffset ?? 0) < 0 ||
      (b.byteOffset ?? 0) + b.byteLength > doc.buffers[0].byteLength
    )
      throw new Error("Invalid buffer view");
  }
  const scene = doc.scenes[doc.scene ?? 0];
  if (!scene || !Array.isArray(scene.nodes) || !scene.nodes.length)
    throw new Error("Empty scene");
  const visited = new Set<number>();
  let meshCount = 0;
  function visit(index: number) {
    if (!Number.isInteger(index) || !doc.nodes[index])
      throw new Error("Invalid scene node");
    if (visited.has(index)) return;
    visited.add(index);
    const node = doc.nodes[index];
    if (node.mesh !== undefined) {
      const mesh = doc.meshes[node.mesh];
      if (!mesh || !Array.isArray(mesh.primitives) || !mesh.primitives.length)
        throw new Error("Empty mesh");
      for (const p of mesh.primitives) {
        const a = doc.accessors[p.attributes?.POSITION],
          b = a && doc.bufferViews[a.bufferView];
        if (
          !a ||
          !b ||
          a.type !== "VEC3" ||
          a.componentType !== 5126 ||
          !Number.isInteger(a.count) ||
          a.count < 3 ||
          a.count > 3_000_000
        )
          throw new Error("POSITION data required");
        const stride = b.byteStride ?? 12,
          start = a.byteOffset ?? 0;
        if (
          !Number.isInteger(stride) ||
          stride < 12 ||
          stride > 252 ||
          stride % 4 ||
          !Number.isInteger(start) ||
          start < 0 ||
          start % 4 ||
          start + (a.count - 1) * stride + 12 > b.byteLength
        )
          throw new Error("Invalid position buffer");
        for (let i = 0; i < a.count; i++) {
          for (let axis = 0; axis < 3; axis++) {
            if (
              !Number.isFinite(
                view.getFloat32(
                  offset +
                    8 +
                    (b.byteOffset ?? 0) +
                    start +
                    i * stride +
                    axis * 4,
                  true,
                ),
              )
            )
              throw new Error("Nonfinite position");
          }
        }
        meshCount++;
      }
    }
    for (const child of node.children ?? []) visit(child);
  }
  for (const index of scene.nodes) visit(index);
  if (!meshCount) throw new Error("No reachable mesh");
  for (const image of doc.images ?? []) {
    if (
      !Number.isInteger(image.bufferView) ||
      !doc.bufferViews[image.bufferView] ||
      !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)
    )
      throw new Error("Embedded texture required");
  }
}
