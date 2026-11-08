import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSourceCleanup, storageErrorCode } from "../scripts/source-cleanup.mjs";

type Call = { fn: string; args: Record<string, unknown> };
function fakeDb(due: unknown[], removeError: unknown = null, failClaim = false) {
  const calls: Call[] = [];
  const removes: string[][] = [];
  return {
    calls,
    removes,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "fm_v2_source_cleanup_claim" && failClaim) return { data: null, error: { message: "boom" } };
      return fn === "fm_v2_source_cleanup_due" || fn === "fm_v2_source_cleanup_claim"
        ? { data: due, error: null }
        : { data: { updated: 1 }, error: null };
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

test("source cleanup collector: claims before removing, one removal per owner, reports with the claim token", async () => {
  const db = fakeDb(due);
  const s = await collectSourceCleanup(db, { execute: true });
  assert.equal(s.removed, 3);
  assert.deepEqual(db.removes, [["u1/a", "u1/c"], ["u2/b"]]);
  assert.equal(db.calls[0].fn, "fm_v2_source_cleanup_claim", "QREV-CLEANUP-RACE: claim is the first call");
  assert.equal(db.calls.filter((c) => c.fn === "fm_v2_source_cleanup_due").length, 0, "execute never removes from the plain due read");
  const token = db.calls[0].args.p_token;
  assert.match(String(token), /^[0-9a-f-]{36}$/);
  assert.deepEqual(db.calls[0].args, { p_token: token, p_limit: 100, p_lease_seconds: 300 });
  const reports = db.calls.filter((c) => c.fn === "fm_v2_source_cleanup_claim_report").map((c) => c.args);
  assert.deepEqual(reports, [
    { p_token: token, p_user: "u1", p_paths: ["u1/a", "u1/c"], p_ok: true, p_error: null },
    { p_token: token, p_user: "u2", p_paths: ["u2/b"], p_ok: true, p_error: null },
  ]);
});

test("source cleanup collector: a failed claim removes nothing", async () => {
  const db = fakeDb(due, null, true);
  await assert.rejects(collectSourceCleanup(db, { execute: true }), /Claim failed/);
  assert.equal(db.removes.length, 0);
});

test("source cleanup collector: storage failure is reported as a code, not a message", async () => {
  const db = fakeDb(due.slice(0, 1), { status: 503, message: "bucket fitmatch-v2/u1/a unavailable" });
  const s = await collectSourceCleanup(db, { execute: true });
  assert.equal(s.failed, 1);
  const r = db.calls.find((c) => c.fn === "fm_v2_source_cleanup_claim_report")!.args;
  assert.equal(r.p_ok, false);
  assert.equal(r.p_error, "STORAGE_503");
  assert.equal(storageErrorCode({ statusCode: "InvalidJWT" }), "STORAGE_ERROR");
  assert.equal(storageErrorCode(null), "STORAGE_ERROR");
});
