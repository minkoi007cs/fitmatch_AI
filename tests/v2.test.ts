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
    name: "Shirt",
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
  assert.match(looks[0].reason, /a shirt/);
  assert.match(looks[0].reason, /not inferred from the quiz/);
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
    /previously liked/,
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

test("full look: three owned top+jeans outfits, varied, never invented; occasion changes the ranking", () => {
  const owned = [
    { id: "t1", name: "Tee trắng", category: "t-shirt", color: "white", style: "minimal", pattern: "plain" },
    { id: "t2", name: "Shirt xanh", category: "shirt", color: "blue", style: "formal", pattern: "plain" },
    { id: "t3", name: "Tee đỏ", category: "t-shirt", color: "red", style: "casual", pattern: "plain" },
    { id: "j1", name: "Jeans xanh", category: "jeans", color: "blue", style: "casual", pattern: "plain" },
    { id: "j2", name: "Jeans đen", category: "jeans", color: "black", style: "minimal", pattern: "plain" },
    { id: "p1", name: "Bottom tây", category: "pants", color: "gray", style: "formal", pattern: "plain" },
  ];
  const looks = recommend(owned, profile);
  assert.equal(looks.length, 3);
  assert.ok(looks.every((l) => l.renderScope === "full-look" && l.bottomItemId && ["j1", "j2"].includes(l.bottomItemId)));
  assert.ok(looks.every((l) => ["t1", "t2", "t3"].includes(l.itemId)), "only owned tops");
  assert.equal(new Set(looks.map((l) => l.itemId)).size, 3, "each outfit uses a different top first");
  assert.equal(new Set(looks.map((l) => `${l.itemId}+${l.bottomItemId}`)).size, 3);
  assert.ok(looks.every((l) => !("itemColor" in l)));
  assert.match(looks[0].reason, /paired with/);
  // One top and one jeans: exactly one outfit, not three.
  assert.equal(recommend([owned[0], owned[3]], profile).length, 1);
  // Two tops, one jeans: two outfits.
  assert.equal(recommend([owned[0], owned[1], owned[3]], profile).length, 2);
  // Skipped jeans are not used; with no jeans left the result falls back to top-only cards.
  const fallback = recommend(owned, profile, { j1: "skip", j2: "skip" });
  assert.ok(fallback.every((l) => l.renderScope === "top-only" && !l.bottomItemId));
  // Occasion is an input each time: work favours the shirt.
  const casual = { ...profile, style: "casual" as const, favoriteColors: ["red" as const] };
  const work = recommend(owned, { ...casual, occasion: "work" });
  const daily = recommend(owned, { ...casual, occasion: "daily" });
  assert.equal(work[0].itemId, "t3");
  assert.equal(work[1].itemId, "t2", "work moves the shirt up");
  assert.equal(daily[1].itemId, "t1");
  assert.deepEqual(recommend(owned, profile), looks, "deterministic");
});

test("photo normalization flattens transparent pixels onto white, keeps opaque colors", async () => {
  const { normalizePhoto } = await import("../src/lib/v2/image");
  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 600, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 200, height: 200, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }, left: 200, top: 200 }])
    .png()
    .toBuffer();
  const out = await normalizePhoto(png);
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  assert.ok(px(10, 10).every((v) => v > 250), "transparent → white, not black");
  const [r, g, b] = px(300, 300);
  assert.ok(r > 180 && g < 60 && b < 60, "garment color kept");
  await assert.rejects(normalizePhoto(await sharp({ create: { width: 300, height: 300, channels: 3, background: "#fff" } }).png().toBuffer()));
});
