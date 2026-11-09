import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { compareInventory, flattenInventory, stepPrecondition } from "../scripts/schema-inventory-lib.mjs";

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
  assert.equal(r.steps.at(-2).status, "absent");
  // The compatibility step re-defines the base auth trigger function: on a base-only project it is partial.
  assert.equal(r.steps.at(-1).status, "partial");
  assert.ok(r.steps.at(-1).different.includes("function:public.handle_new_user()"));
  assert.ok(r.steps.slice(1).every((s: Step) => s.status !== "applied"));
  const actual = { ...manifest.final, "table:public.lifedashboard_entries": { rls: false } };
  const qrev = manifest.steps.at(-2);
  const fn = Object.keys(qrev.changes).find((k) => k.startsWith("function:"))!;
  actual[fn] = { ...actual[fn], bodyMd5: "0".repeat(32) };
  const drift = compareInventory(manifest, actual);
  assert.deepEqual(drift.extra, ["table:public.lifedashboard_entries"]);
  assert.deepEqual(drift.rlsOff, ["table:public.lifedashboard_entries"]);
  assert.ok(drift.steps.at(-2).different.includes(fn));
  assert.notEqual(drift.steps.at(-2).status, "applied");
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

const step = (suffix: string) => manifest.steps.find((s: Step) => s.file.endsWith(suffix));
const renameKey = (obj: Record<string, unknown>, from: string, to: string) => {
  const out = { ...obj };
  out[to] = out[from];
  delete out[from];
  return out;
};

test("CL-MIGRATION-26 comparator: legacy names are equivalent, a different FK target is a real difference", () => {
  const base = manifest.steps[0].adds;
  const pk = Object.keys(base).find((k) => k.startsWith("constraint:public.fm_users.") && base[k].type === "p")!;
  const fk = Object.keys(base).find((k) => k.startsWith("constraint:public.fm_wardrobe_items.") && base[k].type === "f" && /auth\.users/.test(base[k].def))!;
  let actual = renameKey({ ...manifest.final }, pk, "constraint:public.fm_users.users_pkey");
  actual = renameKey(actual, fk, "constraint:public.fm_wardrobe_items.wardrobe_items_user_id_fkey");
  const legacyFk = actual["constraint:public.fm_wardrobe_items.wardrobe_items_user_id_fkey"] as { def: string };
  actual["constraint:public.fm_wardrobe_items.wardrobe_items_user_id_fkey"] = { ...legacyFk, def: legacyFk.def.replace("auth.users(id)", "fm_users(id)") };
  const r = compareInventory(manifest, actual);
  const findings = r.steps[0].findings;
  assert.equal(findings[pk].state, "equivalent");
  assert.equal(findings[fk].state, "different-target");
  assert.match(findings[fk].detail, /references fm_users instead of auth\.users/);
  assert.equal(r.steps[0].status, "applied-with-differences", "a different owner FK target is never hidden as applied");
  assert.ok(!r.extra.includes("constraint:public.fm_users.users_pkey"), "matched aliases are not unknown extras");
});

test("CL-MIGRATION-26 comparator: extension placement, forced RLS, permissive overlap and defaults are compared", () => {
  type Obj = { rlsForced?: boolean; default?: string | null; permissive?: string; cmd?: string; usingMd5?: string; using?: string; schema?: string };
  const actual = { ...manifest.final, "extension:pgcrypto": { schema: "public" } } as Record<string, Obj>;
  const table = "table:public.fm_v2_jobs";
  actual[table] = { ...actual[table], rlsForced: true };
  const col = Object.keys(actual).find((k) => k.startsWith("column:public.fm_users.") && actual[k].default)!;
  actual[col] = { ...actual[col], default: null };
  const pol = Object.keys(actual).find((k) => k.startsWith("policy:public.fm_wardrobe_items.") && actual[k].permissive === "PERMISSIVE")!;
  actual["policy:public.fm_wardrobe_items.extra_select"] = { ...actual[pol], cmd: "SELECT", usingMd5: "f".repeat(32), using: "true" };
  const r = compareInventory(manifest, actual);
  const all = Object.assign({}, ...r.steps.map((s: { findings: object }) => s.findings));
  assert.equal(manifest.final["extension:pgcrypto"].schema, "extensions", "manifest mirrors hosted placement");
  assert.deepEqual(r.extensions, [{ name: "pgcrypto", expected: "extensions", found: "public" }], "placement difference reported");
  assert.deepEqual(compareInventory(manifest, manifest.final).extensions, []);
  assert.ok(r.extra.includes("policy:public.fm_wardrobe_items.extra_select"));
  assert.ok(r.overlappingPolicies.some((o: { slot: string }) => o.slot === "public.fm_wardrobe_items|SELECT"));
  for (const k of [table, col]) assert.equal(all[k]?.state ?? "missing-finding", "differs", k);
  assert.ok(!Object.keys(manifest.final).some((k) => /^function:(public|extensions)\.(gen_salt|crypt|digest)\(/.test(k)), "extension-owned functions are not FitMatch objects");
  const flat = flattenInventory({ format: "fitmatch.schema-inventory.v1", extensions: [{ name: "pgcrypto", schema: "extensions" }, { name: "plpgsql", schema: "pg_catalog" }],
    functions: [{ schema: "extensions", name: "digest", args: "text, text", extension: "pgcrypto" }] });
  assert.deepEqual(flat, { "extension:pgcrypto": { schema: "extensions" } });
});

test("CL-MIGRATION-26 precondition: sequential apply requires added objects absent and changed objects at their prior definition", () => {
  const files = manifest.steps.map((s: Step) => s.file);
  const ai = step("20261104_ai_daily_quota.sql"), r1 = step("20261106025506_worker_recovery_r1.sql");
  // State right after the identity step: everything up to it present, nothing after.
  const upTo = (n: number) => {
    const state: Record<string, unknown> = {};
    for (const s of manifest.steps.slice(0, n + 1)) {
      Object.assign(state, s.adds, s.changes);
      for (const k of s.removes) delete state[k];
    }
    return state;
  };
  const identity = files.findIndex((f: string) => f.endsWith("20261103_app_system_identity.sql"));
  assert.equal(stepPrecondition(manifest, upTo(identity), ai.file).state, "ready");
  // r1 changes functions created by 20261105: with only identity present it conflicts unless 20261105 is pending.
  assert.equal(stepPrecondition(manifest, upTo(identity), r1.file).state, "conflict");
  assert.equal(stepPrecondition(manifest, upTo(identity), r1.file, new Set(files.slice(identity + 1, files.indexOf(r1.file)))).state, "ready");
  assert.equal(stepPrecondition(manifest, upTo(files.indexOf(r1.file) - 1), r1.file).state, "ready");
  assert.equal(stepPrecondition(manifest, upTo(files.indexOf(r1.file)), r1.file).state, "applied");
  // A same-name object of another shape blocks the step that would create it.
  const blocked = { ...upTo(identity), "table:public.fm_ai_daily_usage": { rls: false, rlsForced: false } };
  const pre = stepPrecondition(manifest, blocked, ai.file);
  assert.equal(pre.state, "conflict");
  assert.ok(pre.conflicts.some((c: { key: string; reason: string }) => c.key === "table:public.fm_ai_daily_usage" && c.reason === "already exists"));
});
