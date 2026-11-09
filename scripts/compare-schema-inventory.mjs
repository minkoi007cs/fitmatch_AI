/**
 * ENV-CANON-01: compare a PRIVATELY saved inventory of the canonical project (the JSON returned by
 * scripts/schema-inventory.sql, plus optionally the bucket query from docs/infrastructure/canonical-
 * schema-reconciliation.md merged as "buckets") with the expected manifest of the reviewed SQL chain.
 *   node scripts/compare-schema-inventory.mjs docs/infrastructure/schema-manifest.json <saved-inventory.json>
 * Prints a per-migration status (applied / partial / absent / present-differs), unrelated objects found
 * in the cloud, public tables without RLS and public buckets. Read-only, offline; writes nothing.
 * It is input to a human reconciliation plan, not permission to apply migrations.
 */
import { readFileSync } from "node:fs";
import { compareInventory, flattenInventory } from "./schema-inventory-lib.mjs";

const [manifestPath, actualPath] = process.argv.slice(2);
if (!manifestPath || !actualPath) {
  console.error("Usage: node scripts/compare-schema-inventory.mjs <schema-manifest.json> <saved-inventory.json>");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
let raw = JSON.parse(readFileSync(actualPath, "utf8"));
if (Array.isArray(raw)) raw = raw[0]; // dashboard exports a row array
if (raw && raw.inventory) raw = raw.inventory;
const result = compareInventory(manifest, flattenInventory(raw));
for (const s of result.steps)
  console.log(`${s.status.padEnd(16)} ${s.file}  (${s.equal}/${s.objects} equal${s.missing.length ? `, ${s.missing.length} missing` : ""}${s.different.length ? `, ${s.different.length} different` : ""})`);
const show = (title, list) => {
  console.log(`\n${title}: ${list.length}`);
  for (const k of list.slice(0, 200)) console.log("  " + k);
};
for (const s of result.steps.filter((s) => s.missing.length || s.different.length)) {
  show(`missing for ${s.file}`, s.missing);
  show(`different for ${s.file}`, s.different);
}
show("objects in the project that the reviewed chain does not create (do NOT drop; reconcile)", result.extra);
show("public tables with RLS disabled", result.rlsOff);
show("public buckets", result.publicBuckets);
