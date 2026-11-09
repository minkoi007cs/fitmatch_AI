import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { compareInventory, flattenInventory } from "../scripts/schema-inventory-lib.mjs";

// ENV-CANON-01: offline reconciliation logic against the committed manifest of the reviewed SQL chain.
const manifest = JSON.parse(readFileSync("docs/infrastructure/schema-manifest.json", "utf8"));
type Step = { status: string; file: string; missing: string[]; different: string[] };

test("schema reconciliation: a fully migrated project reads applied for every step, nothing extra", () => {
  const r = compareInventory(manifest, manifest.final);
  assert.deepEqual(r.steps.map((s: Step) => s.status).filter((x: string) => x !== "applied" && x !== "no-objects"), []);
  assert.deepEqual(r.extra, []);
  assert.deepEqual(r.publicBuckets, [], "both FitMatch buckets are private in the chain");
  assert.deepEqual(r.rlsOff, [], "every public table created by the chain has RLS");
});

test("schema reconciliation: base-only project, unrelated objects and drift are reported, never hidden", () => {
  const baseOnly = { ...manifest.steps[0].adds };
  const r = compareInventory(manifest, baseOnly);
  assert.equal(r.steps[0].status, "applied");
  assert.equal(r.steps.at(-1).status, "absent");
  assert.ok(r.steps.slice(1).every((s: Step) => s.status !== "applied"));
  const actual = { ...manifest.final, "table:public.lifedashboard_entries": { rls: false } };
  const fn = Object.keys(manifest.steps.at(-1).changes).find((k) => k.startsWith("function:"))!;
  actual[fn] = { ...actual[fn], bodyMd5: "0".repeat(32) };
  const drift = compareInventory(manifest, actual);
  assert.deepEqual(drift.extra, ["table:public.lifedashboard_entries"]);
  assert.deepEqual(drift.rlsOff, ["table:public.lifedashboard_entries"]);
  assert.ok(drift.steps.at(-1).different.includes(fn));
  assert.notEqual(drift.steps.at(-1).status, "applied");
});

test("schema reconciliation: inventory flattening keeps FitMatch schema shape only", () => {
  const flat = flattenInventory({
    format: "fitmatch.schema-inventory.v1",
    tables: [
      { schema: "auth", name: "users", rls: true, columns: [{ name: "email", type: "text" }] },
      { schema: "storage", name: "objects", rls: true, columns: [{ name: "name", type: "text" }] },
      { schema: "public", name: "t", rls: true, estRows: 999, columns: [{ name: "c", type: "text", notNull: true, hasDefault: false }] },
    ],
    buckets: [{ id: "fitmatch-v2", public: false }],
  });
  assert.deepEqual(Object.keys(flat).sort(), ["bucket:fitmatch-v2", "column:public.t.c", "table:public.t", "table:storage.objects"]);
  assert.ok(!JSON.stringify(flat).includes("999"), "row estimates are not part of the comparison");
  assert.throws(() => flattenInventory({ format: "other" }));
});
