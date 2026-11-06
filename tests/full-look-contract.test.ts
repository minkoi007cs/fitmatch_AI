import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assetManifest, jobEnvelope } from "../src/lib/v2/schemas";
import { lookRequest, modelRequest, slotForCategory, workerKinds, workerHeartbeat } from "../src/lib/v2/contracts";
import { validateGlb } from "../src/lib/studio/bundle";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url));

test("committed v1-r2 schemas and fixture match the code that generates them", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/export-contract.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("fixture body/top/bottom: valid GLBs, hashes match, one shared frame", () => {
  const manifest = assetManifest.parse(JSON.parse(read("fixtures/full-look/manifest.json").toString()));
  assert.equal(manifest.animation_ready, false);
  assert.match(manifest.provenance, /synthetic/);
  const a = manifest.assets as Record<string, { file: string; bytes: number; sha256: string; bounds: { min: number[]; max: number[] } }>;
  for (const slot of ["body", "top", "bottom"]) {
    const bytes = read("fixtures/full-look/" + a[slot].file);
    assert.equal(bytes.length, a[slot].bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), a[slot].sha256);
    validateGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  }
  const { body, top, bottom } = a;
  // Feet on the floor at the origin; no item normalized on its own (no item starts at y=0 except the body/legs).
  assert.ok(Math.abs(body.bounds.min[1]) < 1e-6, "body stands on y=0");
  assert.ok(top.bounds.min[1] > 0.8 && top.bounds.max[1] < 1.6, "top sits on the torso, not re-centred");
  assert.ok(bottom.bounds.min[1] > 0 && bottom.bounds.max[1] < top.bounds.max[1], "bottom sits below the top");
  assert.ok(bottom.bounds.max[1] > top.bounds.min[1], "top and bottom overlap at the waist (layering zone)");
  for (const item of [top, bottom])
    for (const k of [0, 2]) assert.ok(item.bounds.min[k] < 0 && item.bounds.max[k] > 0, "items centred on the body axis");
});

test("jeans are a bottom with their own kinds; tops keep v1 kinds", () => {
  assert.equal(slotForCategory.jeans, "bottom");
  assert.equal(slotForCategory["t-shirt"], "top");
  assert.equal(slotForCategory.pants, undefined, "trousers/shorts not opened yet");
  assert.ok(workerKinds.includes("bottom.reconstruct") && workerKinds.includes("bottom.drape"));
  assert.ok(workerHeartbeat.safeParse({ capabilities: { "bottom.drape": { model: "m", revision: "r" } } }).success);
  assert.ok(!workerHeartbeat.safeParse({ capabilities: { "pants.drape": { model: "m", revision: "r" } } }).success);
});

test("look request: both slots, camera, legacy fittingId", () => {
  const u = () => crypto.randomUUID();
  const camera = { position: [0, 1.2, 3.2], target: [0, 1, 0], autoOrbit: false };
  assert.ok(lookRequest.safeParse({ name: "Cafe", avatarId: u(), topFittingId: u(), bottomFittingId: u(), camera }).success);
  assert.ok(lookRequest.safeParse({ name: "Old", avatarId: u(), fittingId: u() }).success);
  const t = u();
  assert.ok(!lookRequest.safeParse({ name: "x", avatarId: u(), fittingId: u(), topFittingId: t }).success, "conflicting top");
  assert.ok(!lookRequest.safeParse({ name: "x", avatarId: u(), camera: { ...camera, position: [999, 0, 0] } }).success);
  assert.ok(!lookRequest.safeParse({ name: "x", avatarId: u(), slot: "top" }).success, "strict");
  // Garment requests never carry a client-side slot or category: the server derives it from the wardrobe item.
  assert.ok(!modelRequest.safeParse({ kind: "garment", name: "J", inputAssetIds: [u(), u()], wardrobeItemId: u(), slot: "bottom" }).success);
});

test("job envelope schema accepts a bottom drape job and rejects an unknown content type", () => {
  const u = () => crypto.randomUUID();
  const job = {
    protocolVersion: 1,
    protocolRevision: "v1-r2",
    redelivered: false,
    jobId: u(),
    kind: "bottom.drape",
    modelId: u(),
    modelRevision: { model: "m", revision: "r" },
    lease: { token: u(), expiresAt: new Date().toISOString(), attempt: 1 },
    input: {
      params: { pose: "a-pose-v1" },
      avatarVersionId: u(),
      garmentVersionId: u(),
      slot: "bottom",
      category: "jeans",
      assets: [{ assetId: u(), role: "garment", url: "https://x", sha256: "a".repeat(64), bytes: 10 }],
    },
    outputContract: {
      format: "glb-v2",
      units: "meters",
      up: "+Y",
      front: "+Z",
      embeddedTextures: true,
      content: "bottom-only-aligned-to-avatar",
      maxFileBytes: 41943040,
      sharedFrame: { units: "meters", up: "+Y", front: "+Z", origin: "floor-between-feet", pose: "a-pose-v1", note: "n" },
    },
  };
  assert.ok(jobEnvelope.safeParse(job).success, JSON.stringify(jobEnvelope.safeParse(job).error?.issues));
  assert.ok(!jobEnvelope.safeParse({ ...job, outputContract: { ...job.outputContract, content: "shirt-on-legs" } }).success);
});
