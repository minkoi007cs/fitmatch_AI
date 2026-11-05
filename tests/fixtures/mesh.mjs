/** Synthetic triangle for transport/render tests, never an AI avatar. */
export function mesh(color = [0.8, 0.8, 0.8, 1]) {
  const positions = Buffer.from(
    new Float32Array([-0.4, 0, 0, 0.4, 0, 0, 0, 1.8, 0]).buffer,
  );
  const doc = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: color,
          metallicFactor: 0,
          roughnessFactor: 0.9,
        },
      },
    ],
    buffers: [{ byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-0.4, 0, 0],
        max: [0.4, 1.8, 0],
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(doc));
  const json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const out = Buffer.alloc(28 + json.length + positions.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  out.writeUInt32LE(positions.length, 20 + json.length);
  out.writeUInt32LE(0x004e4942, 24 + json.length);
  positions.copy(out, 28 + json.length);
  return out;
}
