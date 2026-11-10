import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPlanPoolerHosts, checkTarget, sanitizedPsqlEnv } from "../scripts/migration-cutover/target.mjs";

// APP-CLOSE-30 / R-MIGTARGET-29: the cutover runner must refuse an unverified target before any psql call.
const REF = "gohczmqykjkrgdblgbog";
const POOLER = "aws-0-us-east-1.pooler.supabase.com"; // synthetic allowlist entry for tests only
const opts = { expectedRef: REF, planRef: REF, trustedPoolerHosts: [POOLER] };

const refused: Array<[string, string]> = [
  ["original repro: suffix user on arbitrary host", `postgresql://postgres.${REF}@example.invalid/postgres`],
  ["suffix user on attacker pooler-looking host not in plan", `postgresql://postgres.${REF}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`],
  ["suffix user on a lookalike domain", `postgresql://postgres.${REF}@db.${REF}.supabase.co.evil.test/postgres`],
  ["other project's direct host", "postgresql://postgres@db.aaaaaaaaaaaaaaaaaaaa.supabase.co/postgres"],
  ["direct host but pooler-style user", `postgresql://postgres.${REF}@db.${REF}.supabase.co/postgres`],
  ["direct host with another role", `postgresql://supabase_admin@db.${REF}.supabase.co/postgres`],
  ["direct host wrong port", `postgresql://postgres@db.${REF}.supabase.co:6543/postgres`],
  ["trusted pooler wrong project user", "postgresql://postgres.aaaaaaaaaaaaaaaaaaaa@" + POOLER + ":5432/postgres"],
  ["trusted pooler bare postgres user", `postgresql://postgres@${POOLER}:5432/postgres`],
  ["trusted pooler transaction mode", `postgresql://postgres.${REF}@${POOLER}:6543/postgres`],
  ["host query override", `postgresql://postgres@db.${REF}.supabase.co/postgres?host=example.invalid`],
  ["hostaddr query override", `postgresql://postgres@db.${REF}.supabase.co/postgres?hostaddr=203.0.113.9`],
  ["service query", `postgresql://postgres@db.${REF}.supabase.co/postgres?service=evil`],
  ["options query", `postgresql://postgres@db.${REF}.supabase.co/postgres?options=-csearch_path%3Devil`],
  ["weak sslmode", `postgresql://postgres@db.${REF}.supabase.co/postgres?sslmode=disable`],
  ["multi-host", `postgresql://postgres@db.${REF}.supabase.co,example.invalid/postgres`],
  ["other database", `postgresql://postgres@db.${REF}.supabase.co/template1`],
  ["unsupported scheme", `mysql://postgres@db.${REF}.supabase.co/postgres`],
  ["key=value string", `host=db.${REF}.supabase.co user=postgres dbname=postgres`],
  ["no host", "postgresql:///postgres"],
  ["loopback without isolated flag", "postgresql://postgres@127.0.0.1/postgres"],
  ["malformed", "postgresql://%zz@/"],
  ["empty", ""],
];

for (const [name, url] of refused) {
  test(`target guard refuses: ${name}`, () => {
    const r = checkTarget(url, opts);
    assert.equal(r.ok, false, `${name} must be refused`);
  });
}

test("target guard accepts only the verified direct endpoint and a reviewed pooler", () => {
  assert.deepEqual(checkTarget(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres?sslmode=require`, opts), { ok: true, kind: "direct" });
  assert.deepEqual(checkTarget(`postgres://postgres@DB.${REF.toUpperCase()}.SUPABASE.CO/postgres`, opts), { ok: true, kind: "direct" });
  assert.deepEqual(checkTarget(`postgresql://postgres.${REF}:pw@${POOLER}:5432/postgres`, opts), { ok: true, kind: "pooler" });
  assert.equal(checkTarget(`postgresql://postgres.${REF}:pw@${POOLER}:5432/postgres`, { ...opts, trustedPoolerHosts: [] }).ok, false,
    "pooler is refused while the plan lists no reviewed pooler host");
});

test("target guard: refs, retired project and plan mismatch", () => {
  assert.equal(checkTarget(`postgresql://postgres@db.${REF}.supabase.co/postgres`, { ...opts, planRef: "aaaaaaaaaaaaaaaaaaaa" }).ok, false);
  assert.equal(checkTarget("postgresql://postgres@db.wqbwwusrhertqktwsxsl.supabase.co/postgres", { expectedRef: "wqbwwusrhertqktwsxsl", planRef: "wqbwwusrhertqktwsxsl" }).ok, false);
  assert.equal(checkTarget(`postgresql://postgres@db.${REF}.supabase.co/postgres`, { expectedRef: "not-a-ref" }).ok, false);
});

test("isolated tests stay loopback-only", () => {
  assert.equal(checkTarget("postgresql://postgres@127.0.0.1/fm_compat", { expectedRef: REF, isolated: true }).ok, true);
  assert.equal(checkTarget("postgresql://postgres@[::1]/x", { expectedRef: REF, isolated: true }).ok, true);
  assert.equal(checkTarget(`postgresql://postgres@db.${REF}.supabase.co/postgres`, { expectedRef: REF, isolated: true }).ok, false);
  assert.equal(checkTarget(`postgresql://postgres.${REF}@example.invalid/postgres`, { expectedRef: REF, isolated: true }).ok, false);
});

test("plan pooler allowlist must itself be well-formed", () => {
  assert.equal(checkPlanPoolerHosts(undefined).ok, true);
  assert.equal(checkPlanPoolerHosts([POOLER]).ok, true);
  assert.equal(checkPlanPoolerHosts(["example.invalid"]).ok, false);
  assert.equal(checkPlanPoolerHosts(["*.pooler.supabase.com"]).ok, false);
  assert.equal(checkPlanPoolerHosts("aws-0-us-east-1.pooler.supabase.com" as unknown as string[]).ok, false);
});

test("psql environment drops libpq variables that can retarget the connection", () => {
  const env = sanitizedPsqlEnv({ PATH: "/bin", PGHOST: "x", PGHOSTADDR: "203.0.113.9", PGPORT: "1", PGSERVICE: "s", PGSERVICEFILE: "f", PGDATABASE: "d", PGUSER: "u", PGPASSWORD: "kept" });
  assert.deepEqual(Object.keys(env).sort(), ["PATH", "PGPASSWORD"]);
});

// Offline end-to-end regression through the real runner with a fake psql that never touches the network.
const work = mkdtempSync(join(tmpdir(), "migtarget-"));
const fake = join(work, "fake-psql.mjs");
writeFileSync(fake, `import { appendFileSync } from "node:fs";
appendFileSync(process.env.FAKE_PSQL_MARKER, JSON.stringify({ argv: process.argv.slice(2), hostaddr: process.env.PGHOSTADDR ?? null }) + "\\n");
process.stderr.write("FAKE_PSQL_CALLED_NO_NETWORK\\n");
process.exit(7);
`);
const plan = JSON.parse(readFileSync("docs/infrastructure/canonical-cutover/cutover-plan.json", "utf8"));
const planWithPooler = join(work, "plan-pooler.json");
writeFileSync(planWithPooler, JSON.stringify({ ...plan, trustedPoolerHosts: [POOLER] }));
let n = 0;
const runRunner = (url: string, planPath = "docs/infrastructure/canonical-cutover/cutover-plan.json", extraEnv: Record<string, string> = {}, extraArgs: string[] = []) => {
  const marker = join(work, `marker-${n++}`);
  const r = spawnSync(process.execPath, ["scripts/migration-cutover/apply.mjs", "--plan", planPath, "--expected-ref", REF,
    "--audit", join(work, `audit-${n}`), "--psql", `${process.execPath} ${fake}`, ...extraArgs], {
    encoding: "utf8", env: { ...process.env, ...extraEnv, DATABASE_URL: url, FAKE_PSQL_MARKER: marker },
  });
  const calls = existsSync(marker) ? readFileSync(marker, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  return { status: r.status, stderr: r.stderr, stdout: r.stdout, calls };
};

test("runner (offline): original R-MIGTARGET-29 URL is refused with exit 2 and psql is never started", () => {
  const r = runRunner(`postgresql://postgres.${REF}@example.invalid/postgres`);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /REFUSED: target identity/);
  assert.equal(r.calls.length, 0);
  assert.doesNotMatch(r.stderr + r.stdout, /example\.invalid/, "the connection string is not echoed");
});

test("runner (offline): every refused form exits 2 before psql", () => {
  for (const [name, url] of refused) {
    if (!url) continue; // empty DATABASE_URL covered below
    const r = runRunner(url);
    assert.equal(r.status, 2, `${name}: ${r.stderr}`);
    assert.equal(r.calls.length, 0, `${name}: psql must not be called`);
  }
  const empty = runRunner("");
  assert.equal(empty.status, 2);
  assert.equal(empty.calls.length, 0);
  const isolatedRemote = runRunner(`postgresql://postgres.${REF}@example.invalid/postgres`, undefined, {}, ["--isolated-test"]);
  assert.equal(isolatedRemote.status, 2);
  assert.equal(isolatedRemote.calls.length, 0);
});

test("runner (offline): bad plan pooler allowlist is refused before psql", () => {
  const badPlan = join(work, "plan-bad.json");
  writeFileSync(badPlan, JSON.stringify({ ...plan, trustedPoolerHosts: ["example.invalid"] }));
  const r = runRunner(`postgresql://postgres@db.${REF}.supabase.co/postgres`, badPlan);
  assert.equal(r.status, 2);
  assert.equal(r.calls.length, 0);
});

test("runner (offline): accepted targets reach the fake psql once with a sanitized environment", () => {
  for (const [url, planPath] of [
    [`postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require`, "docs/infrastructure/canonical-cutover/cutover-plan.json"],
    [`postgresql://postgres.${REF}@${POOLER}:5432/postgres`, planWithPooler],
  ]) {
    const r = runRunner(url, planPath, { PGHOSTADDR: "203.0.113.9" });
    assert.equal(r.status, 3, r.stderr); // fake psql exits 7 → runner reports cannot connect
    assert.match(r.stderr, /cannot connect: FAKE_PSQL_CALLED_NO_NETWORK/);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].argv.at(-1), url, "psql receives exactly the verified URL");
    assert.equal(r.calls[0].hostaddr, null, "PGHOSTADDR must not reach psql");
  }
});
