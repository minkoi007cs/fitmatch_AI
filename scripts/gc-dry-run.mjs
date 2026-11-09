// GC DRY RUN: prints what a future collector could remove after the grace period. Deletes nothing.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FITMATCH_EXPECTED_SUPABASE_REF=... node scripts/gc-dry-run.mjs [graceDays=7]
// Run only against a test project; never paste the service key into the browser or a report.
import { createClient } from "@supabase/supabase-js";

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

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY and FITMATCH_EXPECTED_SUPABASE_REF. Nothing was done.");
  process.exit(2);
}
const { url } = operatorBackend(await import("../src/lib/backend-identity.mjs"));
const days = Number(process.argv[2] ?? 7);
if (!Number.isFinite(days) || days < 1) {
  console.error("graceDays must be >= 1");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.rpc("fm_v2_gc_candidates", { p_grace: `${days} days` });
if (error) {
  console.error("Dry run failed:", error.message);
  process.exit(1);
}
const summary = {};
for (const row of data) summary[row.reason] = (summary[row.reason] ?? 0) + 1;
// Counts only: paths contain user ids and are not printed by default.
console.log(JSON.stringify({ dryRun: true, graceDays: days, candidates: data.length, byReason: summary }, null, 2));
