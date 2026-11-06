// GC DRY RUN: prints what a future collector could remove after the grace period. Deletes nothing.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/gc-dry-run.mjs [graceDays=7]
// Run only against a test project; never paste the service key into the browser or a report.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (test project). Nothing was done.");
  process.exit(2);
}
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
