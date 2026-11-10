import assert from "node:assert/strict";
import { test } from "node:test";
import { readAnalyses, readAnalysis, view, type AnalysisReader, type AnalysisRow } from "../src/lib/v2/analysis-read";

// APP-CLOSE-30 / QINT-READSKEW: deterministic reproduction of the read skew behind the intermittent
// test:v2 timeout ("Đề xuất của AI" never appeared). The worker result commit lands between the poll's
// analysis read and its job read.
const OWNER = "11111111-1111-4111-8111-111111111111";
const row = (status: AnalysisRow["status"], extra: Partial<AnalysisRow> = {}): AnalysisRow => ({
  id: "a1", item_id: "i1", status, result: null, result_sha256: status === "pending" ? null : "f".repeat(64),
  confirmed_fields: null, created_at: "2026-11-09T00:00:00Z", ...extra,
});

/** Simulates fm_v2_analysis_result committing right after the first analyses read. */
function racingReader(): AnalysisReader & { calls: string[] } {
  let committed = false;
  const calls: string[] = [];
  return {
    calls,
    analysesForOwner: async () => { calls.push("analyses"); const r = [row(committed ? "review" : "pending")]; committed = true; return r; },
    analysesByIds: async () => { calls.push("analyses-by-id"); const r = [row(committed ? "review" : "pending")]; committed = true; return r; },
    jobsFor: async () => { calls.push("jobs"); return [{ analysis_id: "a1", state: committed ? "succeeded" : "running", error_code: null, attempt: 1, deferrals: 2 }]; },
  };
}

test("read skew hazard: (pending analysis, succeeded job) maps to a terminal, non-polling state", () => {
  // This is what the old two-query read produced when the commit fell between the reads.
  assert.equal(view(row("pending"), { state: "succeeded", error_code: null, attempt: 1 }).state, "failed");
});

test("readAnalyses re-reads analyses after jobs, so a result committed mid-poll shows as review", async () => {
  const db = racingReader();
  const [a] = await readAnalyses(db, OWNER);
  assert.deepEqual(db.calls, ["analyses", "jobs", "analyses-by-id"]);
  assert.equal(a.state, "review");
  assert.equal(a.resultSha256, "f".repeat(64));
});

test("readAnalysis (single) uses the same skew-safe order", async () => {
  const db = racingReader();
  const a = await readAnalysis(db, OWNER, "a1");
  assert.deepEqual(db.calls, ["analyses-by-id", "jobs", "analyses-by-id"]);
  assert.equal(a?.state, "review");
});

test("no commit in between: states unchanged (queued / waiting_gpu / running / canceled / stale)", async () => {
  const fixed = (status: AnalysisRow["status"], job: { state: string; deferrals?: number } | null): AnalysisReader => ({
    analysesForOwner: async () => [row(status)],
    analysesByIds: async () => [row(status)],
    jobsFor: async () => (job ? [{ analysis_id: "a1", error_code: null, attempt: 0, ...job }] : []),
  });
  assert.equal((await readAnalyses(fixed("pending", { state: "queued" }), OWNER))[0].state, "queued");
  assert.equal((await readAnalyses(fixed("pending", { state: "queued", deferrals: 1 }), OWNER))[0].state, "waiting_gpu");
  assert.equal((await readAnalyses(fixed("pending", { state: "running" }), OWNER))[0].state, "running");
  assert.equal((await readAnalyses(fixed("pending", { state: "canceled" }), OWNER))[0].state, "canceled");
  assert.equal((await readAnalyses(fixed("stale", { state: "canceled" }), OWNER))[0].state, "stale");
  assert.equal((await readAnalyses(fixed("pending", null), OWNER))[0].state, "failed");
});

test("latest analysis per item; analysis deleted between reads is dropped, not reported failed", async () => {
  const db: AnalysisReader = {
    analysesForOwner: async () => [row("review", { id: "new", item_id: "i1" }), row("confirmed", { id: "old", item_id: "i1" }), row("pending", { id: "gone", item_id: "i2" })],
    analysesByIds: async (_o, ids) => { assert.deepEqual(ids.sort(), ["gone", "new"]); return [row("review", { id: "new", item_id: "i1" })]; },
    jobsFor: async () => [],
  };
  const list = await readAnalyses(db, OWNER);
  assert.deepEqual(list.map((a) => [a.id, a.state]), [["new", "review"]]);
  assert.deepEqual(await readAnalyses({ analysesForOwner: async () => [], analysesByIds: async () => { throw new Error("not called"); }, jobsFor: async () => { throw new Error("not called"); } }, OWNER), []);
});
