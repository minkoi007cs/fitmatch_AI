import assert from "node:assert/strict";
import { test } from "node:test";
import {
  styleAnswers,
  modelRequest,
  workerHeartbeat,
  type StyleAnswers,
} from "../src/lib/v2/contracts";
import { recommend } from "../src/lib/v2/recommend";
import { validateOutputGlb } from "../src/lib/v2/output";
import { mesh } from "./fixtures/mesh.mjs";
const profile: StyleAnswers = {
  occasion: "work",
  style: "minimal",
  fit: "regular",
  favoriteColors: ["white"],
  avoidPatterns: ["graphic"],
  climate: "mild",
};
const inventory = [
  {
    id: "a",
    name: "Tee",
    category: "t-shirt",
    color: "white",
    style: "casual",
    pattern: "plain",
  },
  {
    id: "b",
    name: "Sơ mi",
    category: "shirt",
    color: "white",
    style: "minimal",
    pattern: "plain",
  },
  {
    id: "c",
    name: "Logo",
    category: "t-shirt",
    color: "white",
    style: "minimal",
    pattern: "graphic",
  },
  {
    id: "d",
    name: "Pants",
    category: "pants",
    color: "white",
    style: "minimal",
    pattern: "plain",
  },
];
test("quiz selects real supported inventory, honors excluded patterns and gives transparent reasons", () => {
  const looks = recommend(inventory, profile);
  assert.deepEqual(
    looks.map((l) => l.itemId),
    ["b", "a"],
  );
  assert.ok(
    looks.every((l) => l.renderScope === "top-only" && l.engine === "rules-v1"),
  );
  assert.match(looks[0].reason, /sơ mi/);
  assert.match(looks[0].reason, /chưa được suy ra từ quiz/);
  assert.deepEqual(recommend([], profile), []);
  assert.deepEqual(recommend(inventory, profile), looks);
});
test("recommendations remain deterministic and never fabricate more items to fill three cards", () => {
  const look = recommend(inventory.slice(0, 1), profile);
  assert.equal(look.length, 1);
  assert.equal(look[0].itemId, "a");
  assert.equal(recommend(inventory.slice(2), profile).length, 0);
});
test("item feedback suppresses skipped inventory without inventing replacements", () => {
  assert.deepEqual(
    recommend(inventory, profile, { b: "skip" }).map((l) => l.itemId),
    ["a"],
  );
  assert.match(
    recommend(inventory, profile, { b: "like" })[0].reason,
    /từng thích/,
  );
});
test("strict input contracts reject ownership injection, duplicate photos and partial quizzes", () => {
  assert.equal(
    styleAnswers.safeParse({ ...profile, user_id: "victim" }).success,
    false,
  );
  assert.equal(
    styleAnswers.safeParse({ ...profile, favoriteColors: [] }).success,
    false,
  );
  const asset = "11111111-1111-4111-a111-111111111111";
  assert.equal(
    modelRequest.safeParse({
      kind: "avatar",
      name: "Me",
      heightCm: 170,
      inputAssetIds: [asset, asset, asset],
    }).success,
    false,
  );
  assert.equal(
    workerHeartbeat.safeParse({
      capabilities: { "run-shell": { model: "x", revision: "main" } },
    }).success,
    false,
  );
  assert.equal(
    workerHeartbeat.safeParse({ capabilities: {} }).success,
    true,
    "connected worker may honestly support no configured engines yet",
  );
});
test("output publication requires reachable geometry and valid embedded buffer ranges", () => {
  const raw = mesh();
  const valid = Uint8Array.from(raw).buffer;
  assert.doesNotThrow(() => validateOutputGlb(valid));
  const broken = valid.slice(0);
  new DataView(broken).setFloat32(broken.byteLength - 4, NaN, true);
  assert.throws(() => validateOutputGlb(broken), /Nonfinite/);
  const buffer = Buffer.from(valid);
  const text = buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString();
  const changed = text.replace('"count":3', '"count":9');
  Buffer.from(changed).copy(buffer, 20);
  assert.throws(
    () => validateOutputGlb(Uint8Array.from(buffer).buffer),
    /position buffer/,
  );
});

test("Vietnamese blue preference does not treat every xanh garment as blue", () => {
  const items = [
    { ...inventory[1], id: "a", name: "Olive shirt", color: "xanh rêu" },
    { ...inventory[1], id: "b", name: "Blue shirt", color: "xanh dương" },
  ];
  assert.equal(
    recommend(items, { ...profile, favoriteColors: ["blue"] })[0].itemId,
    "b",
  );
});
