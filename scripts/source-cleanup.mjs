// CL-PRIV-01 collector. Retries ONLY storage removals the user already requested through
// "Xóa ảnh gốc" (fm_v2_source_cleanup intents in state pending, backoff elapsed, < 5 attempts).
// It never selects objects on its own and never touches derived avatars/fittings/looks.
// DRY RUN by default; pass --execute to claim and remove. Run against a test project first.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FITMATCH_EXPECTED_SUPABASE_REF=... node scripts/source-cleanup.mjs [--execute] [--limit=100]
import { randomUUID } from "node:crypto";
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
 *
 * Dry run uses the side-effect-free due read. Execute first CLAIMS the rows in the database
 * (QREV-CLEANUP-RACE): the claim tombstones an abandoned analysis reservation under the owner's locks so
 * a concurrent enqueue can no longer publish it, never selects a live/referenced asset, and leases the
 * rows to this pass's token. Only claimed paths are removed; the result is reported with the token.
 * A crash or lost report leaves the claim to expire and the rows are retried by a later pass.
 */
export async function collectSourceCleanup(db, { execute = false, limit = 100, leaseSeconds = 300 } = {}) {
  if (!execute) {
    const due = await db.rpc("fm_v2_source_cleanup_due", { p_limit: limit });
    if (due.error) throw new Error("Due query failed: " + due.error.message);
    const rows = (due.data ?? []).filter((r) => typeof r?.userId === "string" && typeof r?.path === "string");
    return { dryRun: true, due: (due.data ?? []).length, users: new Set(rows.map((r) => r.userId)).size, removed: 0, failed: 0 };
  }
  const token = randomUUID();
  const claim = await db.rpc("fm_v2_source_cleanup_claim", { p_token: token, p_limit: limit, p_lease_seconds: leaseSeconds });
  if (claim.error) throw new Error("Claim failed: " + claim.error.message);
  const byUser = new Map();
  for (const row of claim.data ?? []) {
    if (typeof row?.userId !== "string" || typeof row?.path !== "string") continue;
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push(row.path);
  }
  const summary = { dryRun: false, due: (claim.data ?? []).length, users: byUser.size, removed: 0, failed: 0 };
  for (const [user, paths] of byUser) {
    const { error } = await db.storage.from(BUCKET).remove(paths);
    const report = await db.rpc("fm_v2_source_cleanup_claim_report", {
      p_token: token,
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

/** ENV-CANON-01: the same backend identity rule as the app. Never smoke, never a mismatched URL/key. */
function operatorBackend(identityModule) {
  const env = { ...process.env };
  if (env.SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("BACKEND_IDENTITY_MISMATCH: SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL differ. Nothing was done.");
    process.exit(5);
  }
  env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  try {
    return identityModule.resolveBackendIdentity(env, { requireServiceKey: true });
  } catch (error) {
    console.error(`BACKEND_IDENTITY_MISMATCH: ${error.reason ?? "invalid configuration"}. Nothing was done.`);
    process.exit(5);
  }
}

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY and FITMATCH_EXPECTED_SUPABASE_REF. Nothing was done.");
    process.exit(2);
  }
  const { url } = operatorBackend(await import("../src/lib/backend-identity.mjs"));
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
