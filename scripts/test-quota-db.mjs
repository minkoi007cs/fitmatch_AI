/** Isolated PostgreSQL integration test. No published ports or live credentials. */
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const run = promisify(execFile);
const name = `fitmatch-quota-test-${process.pid}`;
const user = "11111111-1111-4111-a111-111111111111";
const other = "22222222-2222-4222-a222-222222222222";
const sql = statement => execFileSync("docker", ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
try {
  execFileSync("docker", ["run", "--rm", "--detach", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"], { stdio: "pipe" });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { execFileSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { stdio: "pipe" }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  assert.ok(ready, "isolated database must start");
  sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}'),('${other}');`);
  const migration = readFileSync(new URL("../supabase/migrations/20261104_ai_daily_quota.sql", import.meta.url), "utf8");
  sql(migration); sql(migration); // Additive/re-runnable without resetting counters.
  const results = await Promise.all(Array.from({ length: 20 }, async () => {
    const { stdout } = await run("docker", ["exec", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", `set role service_role; select public.fm_consume_ai_units('${user}',1,10);`]);
    return stdout.trim().split("\n").at(-1);
  }));
  assert.equal(results.filter(result => result === "t").length, 10);
  assert.equal(results.filter(result => result === "f").length, 10);
  assert.equal(sql(`select units from public.fm_ai_daily_usage where user_id='${user}';`), "10");
  assert.equal(sql(`set role service_role; select public.fm_consume_ai_units('${other}',5,10);`).split("\n").at(-1), "t");
  assert.equal(sql(`set role service_role; select public.fm_consume_ai_units('${other}',6,10);`).split("\n").at(-1), "f");
  assert.equal(sql(`select units from public.fm_ai_daily_usage where user_id='${other}';`), "5");
  for (const role of ["anon", "authenticated"]) {
    assert.throws(() => sql(`set role ${role}; select public.fm_consume_ai_units('${user}',1,100000);`));
    assert.throws(() => sql(`set role ${role}; select * from public.fm_ai_daily_usage;`));
    assert.throws(() => sql(`set role ${role}; update public.fm_ai_daily_usage set units=0;`));
  }
  assert.equal(sql("select relrowsecurity from pg_class where oid='public.fm_ai_daily_usage'::regclass;"), "t");
  console.log("PASS: PostgreSQL atomic quota admits 10/20 concurrent requests; users isolated; rejected charges unchanged; browser roles denied; RLS enabled; migration re-runnable");
} finally {
  try { execFileSync("docker", ["rm", "--force", name], { stdio: "pipe" }); } catch { /* no container was created */ }
}
