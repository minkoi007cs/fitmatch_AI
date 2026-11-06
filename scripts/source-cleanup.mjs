// CL-PRIV-01 collector. Retries ONLY storage removals the user already requested through
// "Xóa ảnh gốc" (fm_v2_source_cleanup intents in state pending, backoff elapsed, < 5 attempts).
// It never selects objects on its own and never touches derived avatars/fittings/looks.
// DRY RUN by default; pass --execute to remove. Run against a test project first.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/source-cleanup.mjs [--execute] [--limit=100]
import { pathToFileURL } from "node:url";

const BUCKET = "fitmatch-v2";

/** Storage errors are recorded as a code only (messages can echo object paths). */
export function storageErrorCode(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(status) && status >= 100 && status < 600 ? `STORAGE_${status}` : "STORAGE_ERROR";
}

/**
 * One bounded pass. `db` is a service-role Supabase client (or a compatible fake in tests).
 * Returns counts only; paths contain user ids and are not reported.
 */
export async function collectSourceCleanup(db, { execute = false, limit = 100 } = {}) {
  const due = await db.rpc("fm_v2_source_cleanup_due", { p_limit: limit });
  if (due.error) throw new Error("Due query failed: " + due.error.message);
  const byUser = new Map();
  for (const row of due.data ?? []) {
    if (typeof row?.userId !== "string" || typeof row?.path !== "string") continue;
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push(row.path);
  }
  const summary = { dryRun: !execute, due: (due.data ?? []).length, users: byUser.size, removed: 0, failed: 0 };
  if (!execute) return summary;
  for (const [user, paths] of byUser) {
    const { error } = await db.storage.from(BUCKET).remove(paths);
    const report = await db.rpc("fm_v2_source_cleanup_report", {
      p_user: user,
      p_paths: paths,
      p_ok: !error,
      p_error: error ? storageErrorCode(error) : null,
    });
    if (report.error) throw new Error("Report failed: " + report.error.message);
    if (error) summary.failed += paths.length;
    else summary.removed += paths.length;
  }
  return summary;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (test project). Nothing was done.");
    process.exit(2);
  }
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice(8)) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    console.error("--limit must be 1..500");
    process.exit(2);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    console.log(JSON.stringify(await collectSourceCleanup(db, { execute: process.argv.includes("--execute"), limit }), null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
