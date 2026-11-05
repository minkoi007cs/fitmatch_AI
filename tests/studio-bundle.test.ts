import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBundle, validateGlb } from "../src/lib/studio/bundle";
const manifest = () => ({ version: 1, avatar: { id: "person-v1", name: "Person", file: "avatar.glb" }, garments: [{ id: "tee-v1", name: "Tee", file: "tee.glb", category: "t-shirt", avatarId: "person-v1" }] });
function glb(json: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(json));
  const size = Math.ceil(data.length / 4) * 4;
  const result = new ArrayBuffer(20 + size); const v = new DataView(result);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, result.byteLength, true);
  v.setUint32(12, size, true); v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20).fill(32); new Uint8Array(result, 20).set(data); return result;
}
test("prepared garments must belong to the selected avatar version", () => {
  assert.equal(parseBundle(manifest()).garments.length, 1);
  const b = manifest(); b.garments[0].avatarId = "other-user-avatar"; assert.throws(() => parseBundle(b));
});
test("reject path traversal, duplicate names and reserved IDs", () => {
  const b = manifest(); b.garments[0].file = "../tee.glb"; assert.throws(() => parseBundle(b));
  b.garments[0].file = "avatar.glb"; assert.throws(() => parseBundle(b));
  b.garments[0].file = "tee.glb"; b.garments[0].id = "avatar"; assert.throws(() => parseBundle(b));
  for (const bad of [null, [], {}, { ...manifest(), garments: [null] }]) assert.throws(() => parseBundle(bad));
});
test("reject GLBs that could request arbitrary network or filesystem resources", () => {
  for (const uri of ["https://example.com/track.png", "file:///secret", "../image.png", 123]) {
    assert.throws(() => validateGlb(glb({ images: [{ uri }] })));
  }
  assert.doesNotThrow(() => validateGlb(glb({ asset: { version: "2.0" }, buffers: [{ byteLength: 8 }], images: [{ bufferView: 1 }] })));
});
test("reject corrupt GLB lengths and unsupported required decoders", () => {
  const bytes = glb({}); new DataView(bytes).setUint32(12, 9999999, true); assert.throws(() => validateGlb(bytes));
  assert.throws(() => validateGlb(glb({ extensionsRequired: ["KHR_draco_mesh_compression"] })));
  assert.throws(() => validateGlb(new ArrayBuffer(3)));
});
