import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSourceCleanup, storageErrorCode } from "../scripts/source-cleanup.mjs";

type Call = { fn: string; args: Record<string, unknown> };
function fakeDb(due: unknown[], removeError: unknown = null) {
  const calls: Call[] = [];
  const removes: string[][] = [];
  return {
    calls,
    removes,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return fn === "fm_v2_source_cleanup_due" ? { data: due, error: null } : { data: { updated: 1 }, error: null };
    },
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => { assert.equal(bucket, "fitmatch-v2"); removes.push(paths); return { data: [], error: removeError }; } }) },
  };
}
const due = [
  { userId: "u1", path: "u1/a", attempts: 0 },
  { userId: "u2", path: "u2/b", attempts: 3 },
  { userId: "u1", path: "u1/c", attempts: 1 },
  { userId: 7, path: "bogus" },
];

test("source cleanup collector: dry run never removes or reports", async () => {
  const db = fakeDb(due);
  const s = await collectSourceCleanup(db, { limit: 50 });
  assert.deepEqual(s, { dryRun: true, due: 4, users: 2, removed: 0, failed: 0 });
  assert.equal(db.removes.length, 0);
  assert.deepEqual(db.calls, [{ fn: "fm_v2_source_cleanup_due", args: { p_limit: 50 } }]);
});

test("source cleanup collector: one removal per owner, outcome reported with that owner only", async () => {
  const db = fakeDb(due);
  const s = await collectSourceCleanup(db, { execute: true });
  assert.equal(s.removed, 3);
  assert.deepEqual(db.removes, [["u1/a", "u1/c"], ["u2/b"]]);
  const reports = db.calls.filter((c) => c.fn === "fm_v2_source_cleanup_report").map((c) => c.args);
  assert.deepEqual(reports, [
    { p_user: "u1", p_paths: ["u1/a", "u1/c"], p_ok: true, p_error: null },
    { p_user: "u2", p_paths: ["u2/b"], p_ok: true, p_error: null },
  ]);
});

test("source cleanup collector: storage failure is reported as a code, not a message", async () => {
  const db = fakeDb(due.slice(0, 1), { status: 503, message: "bucket fitmatch-v2/u1/a unavailable" });
  const s = await collectSourceCleanup(db, { execute: true });
  assert.equal(s.failed, 1);
  const r = db.calls.find((c) => c.fn === "fm_v2_source_cleanup_report")!.args;
  assert.equal(r.p_ok, false);
  assert.equal(r.p_error, "STORAGE_503");
  assert.equal(storageErrorCode({ statusCode: "InvalidJWT" }), "STORAGE_ERROR");
  assert.equal(storageErrorCode(null), "STORAGE_ERROR");
});
