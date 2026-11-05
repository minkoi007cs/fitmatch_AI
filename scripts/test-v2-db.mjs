/** Real PostgreSQL; isolated container, synthetic identities, no published ports. */
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
const run = promisify(execFile),
  container = `fitmatch-v2-test-${process.pid}`;
const owner = "11111111-1111-4111-a111-111111111111",
  other = "22222222-2222-4222-a222-222222222222",
  quota = "33333333-3333-4333-a333-333333333333";
const w1 = "44444444-4444-4444-a444-444444444444",
  w2 = "55555555-5555-4555-a555-555555555555";
const photo = (n) => `aaaaaaaa-aaaa-4aaa-aaaa-${String(n).padStart(12, "0")}`;
const args = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atq",
];
const sql = (s) =>
  execFileSync("docker", args, {
    input: s,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const service = (s) => sql(`set role service_role; ${s}`);
const parallel = async (statements) =>
  Promise.all(
    statements.map(async (s) => {
      try {
        const { stdout } = await run("docker", [
          ...args,
          "-c",
          `set role service_role; ${s}`,
        ]);
        return { ok: true, value: stdout.trim() };
      } catch {
        return { ok: false };
      }
    }),
  );
const enqueue = (key, kind = "avatar", opts = {}) =>
  `select fm_v2_enqueue('${opts.user ?? owner}','${key}','${opts.hash ?? key}','${kind}','Test ${kind}',${kind === "fitting" ? "'{}'" : `array['${photo(1)}','${photo(2)}','${photo(3)}']::uuid[]`},'{}',${opts.wardrobe ? `'${opts.wardrobe}'` : "null"},${opts.avatar ? `'${opts.avatar}'` : "null"},${opts.garment ? `'${opts.garment}'` : "null"});`;
const claim = (w) =>
  JSON.parse(service(`select fm_v2_claim('${w}');`) || "null");
const transition = (j, action, asset = null, token = j.lease_token) =>
  service(
    `select fm_v2_transition('${j.worker_id}','${j.id}','${token}','${action}',null,${asset ? `'${asset}'` : "null"});`,
  );
try {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--detach",
      "--network",
      "none",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    ],
    { stdio: "pipe" },
  );
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      execFileSync(
        "docker",
        ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
        { stdio: "pipe" },
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  assert.ok(ready);
  sql(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}'),('${quota}');create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant select on fm_wardrobe_items to service_role;`,
  );
  sql("insert into storage.buckets(id,name,public) values('fitmatch-v2','fitmatch-v2',true);");
  sql(
    readFileSync(
      new URL(
        "../supabase/migrations/20261105_studio_control_plane.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(sql("select public from storage.buckets where id='fitmatch-v2';"),'f','migration enforces private bucket even when an old bucket exists');
  for (let i = 1; i <= 3; i++)
    sql(
      `insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) values('${photo(i)}','${owner}','photo','ready','p${i}','s${i}',100);`,
    );
  // Same key in parallel creates exactly one job. A changed payload cannot reuse it.
  const same = await parallel(
    Array.from({ length: 8 }, () => enqueue("same-key-01")),
  );
  assert.equal(same.filter((r) => r.ok).length, 8);
  assert.equal(new Set(same.map((r) => JSON.parse(r.value).jobId)).size, 1);
  assert.throws(() =>
    service(enqueue("same-key-01", "avatar", { hash: "different" })),
  );
  assert.throws(
    () => service(enqueue("cross-owner", "avatar", { user: other })),
    /INVALID_ASSET/,
  );
  service(enqueue("second-key-02"));
  sql(
    `insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities) values('${w1}','${owner}','hash1','A',now(),'{"avatar.reconstruct":{}}'),('${w2}','${owner}','hash2','B',now(),'{"avatar.reconstruct":{}}');`,
  );
  const claims = await parallel([
    `select fm_v2_claim('${w1}');`,
    `select fm_v2_claim('${w2}');`,
  ]);
  const leased = claims.map((r) => JSON.parse(r.value));
  assert.equal(new Set(leased.map((j) => j.id)).size, 2);
  assert.equal(claim(w1), null, "one job per worker");
  const job = leased[0];
  assert.equal(
    transition(job, "complete", photo(1)),
    "f",
    "photos cannot complete a model",
  );
  sql(
    `update fm_v2_jobs set lease_until=now()-interval '1 second' where id='${job.id}';`,
  );
  const next = claim(job.worker_id);
  assert.equal(next.id, job.id);
  assert.notEqual(next.lease_token, job.lease_token);
  assert.equal(
    transition(job, "complete", photo(1)),
    "f",
    "old attempt fenced",
  );
  const output = photo(4);
  sql(
    `insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,job_id) values('${output}','${owner}','glb','ready','out','source-out',100,'${next.id}');`,
  );
  assert.equal(transition(next, "complete", output), "t");
  assert.equal(
    transition(next, "complete", output),
    "f",
    "cannot publish twice",
  );
  assert.equal(
    service(
      `select output_asset_id from fm_v2_models where id='${next.model_id}';`,
    ),
    output,
  );
  const canceled = leased[1];
  assert.equal(
    service(`select fm_v2_job_action('${other}','${canceled.id}','cancel');`),
    "f",
  );
  assert.equal(
    service(`select fm_v2_job_action('${owner}','${canceled.id}','cancel');`),
    "t",
  );
  assert.equal(transition(canceled, "complete", output), "f");
  assert.equal(
    service(`select fm_v2_job_action('${owner}','${canceled.id}','retry');`),
    "t",
  );
  // Capability filter; stale/revoked worker cannot claim or extend a lease.
  sql(`update fm_v2_workers set capabilities='{}' where id='${w2}';`);
  assert.equal(claim(w2), null);
  sql(`update fm_v2_workers set enabled=false where id='${next.worker_id}';`);
  assert.equal(claim(next.worker_id), null);
  // Fitting cache is version-pair specific; cross-owner parents rejected.
  const garment = photo(5),
    wardrobe = photo(6);
  sql(
    `insert into fm_wardrobe_items values('${wardrobe}','${owner}','shirt');insert into fm_v2_models(id,user_id,kind,name,output_asset_id,wardrobe_item_id) values('${garment}','${owner}','garment','shirt','${output}','${wardrobe}');`,
  );
  const f1 = JSON.parse(
      service(
        enqueue("fitting-01", "fitting", { avatar: next.model_id, garment }),
      ),
    ),
    f2 = JSON.parse(
      service(
        enqueue("fitting-02", "fitting", { avatar: next.model_id, garment }),
      ),
    );
  assert.equal(f1.modelId, f2.modelId);
  assert.equal(f2.reused, true);
  assert.throws(
    () =>
      service(
        enqueue("foreign-fit", "fitting", {
          user: other,
          avatar: next.model_id,
          garment,
        }),
      ),
    /MODEL_NOT_READY/,
  );
  // RLS and function grants: browser cannot read credentials/leases, write rows or invoke admin RPCs.
  const ownAssets = sql(
    `set role authenticated;set request.jwt.claim.sub='${owner}';select count(*) from fm_v2_assets;`,
  );
  assert.equal(ownAssets, "4");
  assert.equal(
    sql(
      `set role authenticated;set request.jwt.claim.sub='${other}';select count(*) from fm_v2_assets;`,
    ),
    "0",
  );
  for (const role of ["anon", "authenticated"]) {
    for (const q of [
      "select * from fm_v2_workers;",
      "select * from fm_v2_jobs;",
      `select fm_v2_claim('${w1}');`,
      `update fm_v2_models set name='oops';`,
    ])
      assert.throws(() => sql(`set role ${role};${q}`));
  }
  // Queue quota admits exactly 20 jobs under contention (fitting can use seeded ready parents).
  const q = await parallel(
    Array.from(
      { length: 25 },
      (_, i) =>
        `select fm_v2_enqueue('${quota}','quota-key-${i}','hash','garment','Quota','{}','{}');`,
    ),
  );
  assert.equal(
    q.filter((r) => r.ok).length,
    0,
    "invalid inputs never consume quota",
  );
  sql(
    `insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) select gen_random_uuid(),'${quota}','photo','ready','qp'||i,'qs'||i,10 from generate_series(1,3)i;`,
  );
  const qa = service(
    `select array_agg(id)::text from fm_v2_assets where user_id='${quota}';`,
  );
  const accepted = await parallel(
    Array.from(
      { length: 25 },
      (_, i) =>
        `select fm_v2_enqueue('${quota}','quota-key-${i}','hash','avatar','Quota','${qa}'::uuid[],'{}');`,
    ),
  );
  assert.equal(accepted.filter((r) => r.ok).length, 20);
  assert.equal(
    service(`select count(*) from fm_v2_jobs where user_id='${quota}';`),
    "20",
  );
  // Upload quotas are atomic too, including in-flight intents.
  sql(
    `insert into fm_v2_assets(id,user_id,kind,path,source_path,expected_bytes) select gen_random_uuid(),'${other}','photo','quota-p'||i,'quota-s'||i,10 from generate_series(1,98)i;`,
  );
  const uploads = await parallel(
    Array.from(
      { length: 6 },
      (_, i) =>
        `select fm_v2_asset_intent('${other}',gen_random_uuid(),'photo',100,'new-s${i}','new-p${i}');`,
    ),
  );
  assert.equal(uploads.filter((r) => r.ok).length, 2);
  console.log(
    "PASS S1 PostgreSQL: concurrent dedupe, cross-owner denial, capability claims, one worker/job, expired lease recovery, stale completion fencing, cancel/retry, revocation, immutable cache, RLS/grants, 20/25 queue quota, 2/6 upload quota.",
  );
} finally {
  try {
    execFileSync("docker", ["rm", "--force", container], { stdio: "pipe" });
  } catch {}
}
