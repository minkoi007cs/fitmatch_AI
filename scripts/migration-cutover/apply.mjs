#!/usr/bin/env node
/**
 * CL-MIGRATION-26 — audited cutover runner for the canonical fitmatch-ai project. DRY RUN by default.
 *
 *   DATABASE_URL=<private connection string> node scripts/migration-cutover/apply.mjs \
 *     --plan docs/infrastructure/canonical-cutover/cutover-plan.json --expected-ref gohczmqykjkrgdblgbog \
 *     --audit <private dir> [--execute]
 *
 * It never prints the connection string. For every planned step, in order:
 *   1. checks the file bytes against the reviewed sha256 in the plan;
 *   2. takes a READ-ONLY inventory and checks the step's precondition against
 *      docs/infrastructure/schema-manifest.json: every object it adds is absent (no same-name or equivalent
 *      object) and every object it changes still has its expected prior definition. A step that already reads
 *      applied, or any conflict, is REFUSED unless the plan marks the step rerunnable (its own SQL guards);
 *      these files are not all rerunnable — never replay blindly. In a dry run, objects that an earlier
 *      planned step would create are accepted as pending;
 *   3. with --execute only: runs the file through psql with ON_ERROR_STOP, lock_timeout and
 *      statement_timeout (each file is one BEGIN..COMMIT transaction: all or nothing);
 *   4. re-inventories and requires "applied" (or "applied-with-differences" limited to the keys the plan
 *      allows, e.g. legacy fm_outfits columns that keep NOT NULL);
 *   5. appends a JSON line to the private audit log (file, sha256, timestamps, exit code, pre/post state).
 * It stops at the first refusal/failure; later steps are not attempted. History adoption is NOT automatic:
 * at the end it prints the exact `supabase migration repair` commands for versions that were executed and
 * verified in this run (plus versions the plan marks verify-only and that verified present), for the
 * operator to run deliberately. psql is `psql` unless --psql "<command words>" is given (tests use docker).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compareInventory, flattenInventory, stepPrecondition } from "../schema-inventory-lib.mjs";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(name);
const fail = (message, code = 2) => {
  console.error("REFUSED: " + message);
  process.exit(code);
};

const plan = JSON.parse(readFileSync(arg("--plan") ?? fail("--plan required"), "utf8"));
const manifestBytes = readFileSync(plan.manifest);
if (plan.manifestSha256 && createHash("sha256").update(manifestBytes).digest("hex") !== plan.manifestSha256)
  fail(`${plan.manifest} differs from the reviewed manifestSha256 in the plan`);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const expectedRef = arg("--expected-ref") ?? fail("--expected-ref required");
const auditDir = arg("--audit") ?? fail("--audit <private dir> required");
const execute = flag("--execute");
const isolated = flag("--isolated-test");
const psqlWords = (arg("--psql") ?? "psql").split(" ").filter(Boolean);
const url = process.env.DATABASE_URL ?? fail("DATABASE_URL is not set");

// Target identity: the URL host/user must name the expected project; loopback only in isolated tests.
let parsed;
try {
  parsed = new URL(url);
} catch {
  fail("DATABASE_URL is not a URL");
}
const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname);
if (expectedRef === "wqbwwusrhertqktwsxsl") fail("retired project (smoke-supabase)");
if (isolated) {
  if (!loopback) fail("--isolated-test accepts only a loopback database");
} else if (expectedRef !== plan.projectRef) {
  fail("expected ref differs from the plan's projectRef");
} else if (!(parsed.hostname === `db.${expectedRef}.supabase.co` || decodeURIComponent(parsed.username).endsWith(`.${expectedRef}`))) {
  fail("DATABASE_URL does not target the expected project (host db.<ref>.supabase.co or pooler user postgres.<ref>)");
}

const psql = (input, extraEnv = {}) => {
  const [cmd, ...rest] = psqlWords;
  return spawnSync(cmd, [...rest, "-X", "-v", "ON_ERROR_STOP=1", "-At", url], {
    input, encoding: "utf8", env: { ...process.env, ...extraEnv }, maxBuffer: 64 * 1024 * 1024,
  });
};
const inventorySql = readFileSync("scripts/schema-inventory.sql", "utf8");
const bucketSql = "select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id),'[]') from storage.buckets;";
const inventory = () => {
  const r = psql(`begin read only;\n${inventorySql}\n${bucketSql}\nrollback;\n`);
  if (r.status !== 0) fail("read-only inventory failed: " + (r.stderr || "").split("\n")[0], 3);
  const lines = r.stdout.trim().split("\n").filter((l) => l.startsWith("{") || l.startsWith("["));
  const raw = JSON.parse(lines[0]);
  raw.buckets = JSON.parse(lines[1]);
  return flattenInventory(raw);
};
const stepState = (actual, file) => compareInventory(manifest, actual).steps.find((s) => s.file === file);

mkdirSync(auditDir, { recursive: true, mode: 0o700 });
const audit = join(auditDir, `cutover-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
const record = (entry) => appendFileSync(audit, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 });

const server = psql("select current_setting('server_version_num');");
if (server.status !== 0) fail("cannot connect: " + (server.stderr || "").split("\n")[0], 3);
const major = Math.floor(Number(server.stdout.trim()) / 10000);
if (plan.serverMajor && major !== plan.serverMajor) fail(`server major ${major} differs from the plan (${plan.serverMajor})`);
record({ event: "start", mode: execute ? "execute" : "dry-run", plan: plan.id, serverMajor: major, target: isolated ? "isolated-test" : expectedRef });
console.log(`${execute ? "EXECUTE" : "DRY RUN"} plan ${plan.id} on ${isolated ? "isolated test database" : `project ${expectedRef}`} (PostgreSQL ${major}); audit: ${audit}`);

const adopt = [];
for (const v of plan.verifyOnly ?? []) {
  const state = stepState(inventory(), v.path);
  const ok = ["applied", "applied-with-differences"].includes(state?.status) &&
    (state.status === "applied" || state.different.every((k) => (v.allowDifferences ?? []).includes(k)));
  record({ event: "verify-only", path: v.path, status: state?.status ?? "unknown", ok });
  console.log(`${ok ? "VERIFIED PRESENT" : "NOT VERIFIED"}  ${v.path} (${state?.status})`);
  if (!ok) fail(`${v.path} is expected to be present already; reconcile before cutover`);
  adopt.push({ version: v.path.split("/").pop().split("_")[0], how: "verified-present" });
}

for (const step of plan.steps) {
  const bytes = readFileSync(step.path);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== step.sha256) fail(`${step.path} bytes differ from the reviewed sha256`);
  const before = stepState(inventory(), step.path);
  if (!before) fail(`${step.path} is not in the schema manifest`);
  const pending = new Set(execute ? [] : plan.steps.slice(0, plan.steps.indexOf(step)).map((x) => x.path));
  const pre = stepPrecondition(manifest, inventory(), step.path, pending);
  if (pre.state !== "ready" && !step.rerunnable) {
    record({ event: "refused", path: step.path, reason: pre.state, conflicts: pre.conflicts.slice(0, 20) });
    if (pre.state === "applied") fail(`${step.path} is already applied; it is not rerunnable — reconcile, do not replay`, 4);
    fail(`${step.path} precondition failed (${pre.conflicts.length} conflict(s), e.g. ${pre.conflicts.slice(0, 3).map((c) => `${c.key}: ${c.reason}`).join("; ")}) — reconcile, do not replay`, 4);
  }
  if (!execute) {
    console.log(`would apply   ${step.path}  (pre: ${step.rerunnable ? `${before.status}, rerunnable` : pre.state})`);
    continue;
  }
  const started = Date.now();
  const run = psql(bytes.toString("utf8"), {
    PGOPTIONS: `-c lock_timeout=${plan.lockTimeout ?? "5s"} -c statement_timeout=${plan.statementTimeout ?? "120s"}`,
  });
  const after = stepState(inventory(), step.path);
  const allowed = step.allowDifferences ?? [];
  const ok = run.status === 0 && (after.status === "applied" ||
    (after.status === "applied-with-differences" && after.different.every((k) => allowed.includes(k))));
  record({ event: "apply", path: step.path, sha256: sha, ms: Date.now() - started, exit: run.status,
    pre: before.status, post: after.status, unexpected: after.different.filter((k) => !allowed.includes(k)),
    error: run.status === 0 ? null : (run.stderr || "").split("\n").find((l) => l.includes("ERROR")) ?? "psql failed" });
  if (!ok) fail(`${step.path} did not verify (exit ${run.status}, post ${after.status}); stopping`, 5);
  console.log(`APPLIED+VERIFIED ${step.path}  (${Date.now() - started} ms, post: ${after.status})`);
  adopt.push({ version: step.path.split("/").pop().split("_")[0], how: "executed-and-verified" });
}

record({ event: "end", mode: execute ? "execute" : "dry-run", adopt });
if (execute && adopt.length) {
  console.log("\nHistory adoption (run deliberately, only after reviewing the audit log):");
  console.log(`  npx supabase@3.0.0 migration repair --status applied ${adopt.map((a) => a.version).join(" ")} --remote=${isolated ? "<isolated-test>" : expectedRef}`);
}
