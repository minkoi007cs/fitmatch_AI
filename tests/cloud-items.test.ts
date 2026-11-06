import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudItems, categoryOf } from "../src/lib/studio/cloud";
import type { ModelRow, JobRow } from "../src/lib/v2/contracts";
const garment: ModelRow = { user_id: "owner", wardrobe_item_id: "item", avatar_id: null, garment_id: null, input_assets: [], created_at: "2026-11-06T00:00:00Z", id: "jeans", kind: "garment", name: "My jeans", slot: "bottom", params: { category: "jeans" }, output_asset_id: null };

test("failed or canceled reconstruction remains visible in Studio for recovery", () => {
  for (const state of ["failed", "canceled"] as const) {
    const items = cloudItems([garment], [{ model_id: garment.id, state } as JobRow], "avatar");
    assert.equal(items.length, 1);
    assert.equal(items[0].status, "failed");
    assert.equal(items[0].slot, "bottom");
    assert.equal(items[0].fittingId, undefined);
  }
});

test("queued reconstruction remains pending; unrelated jobs cannot label it failed", () => {
  assert.equal(cloudItems([garment], [{ model_id: garment.id, state: "queued" } as JobRow], "avatar")[0].status, "garment-pending");
  assert.deepEqual(cloudItems([garment], [{ model_id: "other", state: "failed" } as JobRow], "avatar"), []);
});

test("prototype names are not garment categories", () => {
  for (const category of ["constructor", "toString", "__proto__"]) {
    assert.equal(categoryOf({ ...garment, params: { category } }), null);
  }
});


test("superseded fitting is ignored regardless of response ordering", () => {
  const readyGarment = { ...garment, output_asset_id: "garment-glb" };
  const old: ModelRow = { ...garment, id: "old-fit", kind: "fitting", avatar_id: "avatar", garment_id: garment.id, superseded_by: "new-fit", output_asset_id: null };
  const current: ModelRow = { ...old, id: "new-fit", superseded_by: null, output_asset_id: "fitted-glb" };
  for (const models of [[readyGarment, old, current], [readyGarment, current, old]]) {
    const item = cloudItems(models, [], "avatar")[0];
    assert.equal(item.fittingId, "new-fit");
    assert.equal(item.status, "ready");
  }
});
