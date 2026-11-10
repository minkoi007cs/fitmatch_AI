/**
 * Pure read model for wardrobe analyses (no server-only imports, so it is unit-testable).
 *
 * APP-CLOSE-30 / QINT-READSKEW: the analysis row and its job are read with two separate queries. The worker's
 * result transaction (fm_v2_analysis_result) flips analysis pending→review AND job running→succeeded atomically,
 * but a poll whose analysis read lands before that commit and whose job read lands after it saw
 * (pending, succeeded) and mapped it to "failed". The browser stops polling on a non-active state, so the
 * proposal never appeared until a manual reload (the intermittent test:v2 15 s timeout). Fix: re-read the
 * analysis rows AFTER the job read. Any job change committed before the job read is then also visible in the
 * re-read analysis (same transaction), and a newer analysis status always takes precedence in view().
 */
import type { analysisResult } from "./qwen";
import type { z } from "zod";

export type AnalysisView = {
  id: string;
  itemId: string;
  /** Combined, user-facing state: what is really happening, never a guess. */
  state: "queued" | "waiting_gpu" | "running" | "review" | "confirmed" | "rejected" | "stale" | "failed" | "canceled";
  errorCode: string | null;
  attempts: number;
  createdAt: string;
  resultSha256: string | null;
  result: z.infer<typeof analysisResult> | null;
  confirmedFields: Record<string, unknown> | null;
};

export type AnalysisRow = {
  id: string;
  item_id: string;
  status: "pending" | "review" | "confirmed" | "rejected" | "stale";
  result: z.infer<typeof analysisResult> | null;
  result_sha256: string | null;
  confirmed_fields: Record<string, unknown> | null;
  created_at: string;
};

export type AnalysisJob = {
  state: string;
  error_code: string | null;
  attempt: number;
  stage?: string | null;
  deferrals?: number;
};

export function view(a: AnalysisRow, j: AnalysisJob | null): AnalysisView {
  let state: AnalysisView["state"];
  if (a.status !== "pending") state = a.status;
  else if (!j) state = "failed";
  else if (j.state === "queued") state = (j.deferrals ?? 0) > 0 ? "waiting_gpu" : "queued";
  else if (j.state === "running") state = "running";
  else if (j.state === "canceled") state = "canceled";
  else state = "failed";
  return {
    id: a.id,
    itemId: a.item_id,
    state,
    errorCode: a.status === "pending" ? (j?.error_code ?? null) : null,
    attempts: j?.attempt ?? 0,
    createdAt: a.created_at,
    resultSha256: a.status === "review" || a.status === "confirmed" || a.status === "rejected" ? a.result_sha256 : null,
    result: a.status === "review" || a.status === "confirmed" || a.status === "rejected" ? a.result : null,
    confirmedFields: a.confirmed_fields,
  };
}

export interface AnalysisReader {
  /** Newest first, bounded. */
  analysesForOwner(owner: string): Promise<AnalysisRow[]>;
  analysesByIds(owner: string, ids: string[]): Promise<AnalysisRow[]>;
  jobsFor(owner: string, analysisIds: string[]): Promise<(AnalysisJob & { analysis_id: string })[]>;
}

/** Latest analysis per item, joined with its job, read in the skew-safe order analyses → jobs → analyses. */
export async function readAnalyses(db: AnalysisReader, owner: string): Promise<AnalysisView[]> {
  const rows = await db.analysesForOwner(owner);
  const latest = new Map<string, AnalysisRow>();
  for (const r of rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r);
  const ids = [...latest.values()].map((r) => r.id);
  if (!ids.length) return [];
  const jobs = await db.jobsFor(owner, ids);
  const fresh = new Map((await db.analysesByIds(owner, ids)).map((r) => [r.id, r]));
  const byAnalysis = new Map(jobs.map((j) => [j.analysis_id, j]));
  return [...latest.values()]
    .filter((a) => fresh.has(a.id)) // deleted between reads: no longer exists, do not report "failed"
    .map((a) => view(fresh.get(a.id)!, byAnalysis.get(a.id) ?? null));
}

/** Single analysis, same skew-safe order. Returns null when it does not exist (or vanished meanwhile). */
export async function readAnalysis(db: AnalysisReader, owner: string, id: string): Promise<AnalysisView | null> {
  const first = await db.analysesByIds(owner, [id]);
  if (!first.length) return null;
  const jobs = await db.jobsFor(owner, [id]);
  const again = await db.analysesByIds(owner, [id]);
  if (!again.length) return null;
  return view(again[0], jobs[0] ?? null);
}
