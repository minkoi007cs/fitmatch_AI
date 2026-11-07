/** Real PostgreSQL; isolated container, synthetic identities, no published ports. */
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}'),('${quota}');create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text,color text not null default 'white',secondary_color text,pattern text,image_path text,updated_at timestamptz not null default now());create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant all on fm_wardrobe_items to service_role;`,
  );
  sql("insert into storage.buckets(id,name,public) values('fitmatch-v2','fitmatch-v2',true);");
  for (const migration of [
    "20261105_studio_control_plane.sql",
    "20261106025506_worker_recovery_r1.sql",
  ])
    sql(
      readFileSync(
        new URL("../supabase/migrations/" + migration, import.meta.url),
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
    `insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values('${w1}','${owner}','hash1','A',now(),'{"avatar.reconstruct":{}}','{avatar.reconstruct}'),('${w2}','${owner}','hash2','B',now(),'{"avatar.reconstruct":{}}','{avatar.reconstruct}');`,
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
  // R1: an identical replay (same worker, lease and asset) is idempotent; a different asset is not.
  assert.equal(
    transition(next, "complete", output),
    "t",
    "identical complete replay is idempotent",
  );
  assert.equal(
    transition(next, "complete", photo(5)),
    "f",
    "cannot publish a different output",
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
  // ---------------- R1 worker recovery (CL-RECOVERY-R1-20261105-01) ----------------
  const r1 = "66666666-6666-4666-a666-666666666666",
    r1x = "77777777-7777-4777-a777-777777777777";
  const wA = "88888888-8888-4888-a888-888888888888",
    wB = "99999999-9999-4999-a999-999999999999",
    wX = "aaaaaaaa-1111-4111-a111-111111111111";
  const I1 = "bbbbbbbb-1111-4111-a111-111111111111",
    I2 = "bbbbbbbb-2222-4222-a222-222222222222";
  const shaA = "a".repeat(64),
    shaB = "b".repeat(64);
  const u = (v) => (v ? `'${v}'` : "null");
  sql(`insert into auth.users values('${r1}'),('${r1x}');`);
  const r1photos = [21, 22, 23].map(photo);
  for (const id of r1photos)
    sql(
      `insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) values('${id}','${r1}','photo','ready','r1p-${id}','r1s-${id}',100);`,
    );
  const r1enqueue = (key) =>
    JSON.parse(
      service(
        `select fm_v2_enqueue('${r1}','${key}','${key}','avatar','R1',array[${r1photos.map((x) => `'${x}'`)}]::uuid[],'{}');`,
      ),
    ).jobId;
  const caps = '{"avatar.reconstruct":{"model":"m","revision":"r"}}';
  sql(
    `insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values('${wA}','${r1}','hA','A',now(),'${caps}','{avatar.reconstruct}'),('${wB}','${r1}','hB','B',now(),'${caps}','{}'),('${wX}','${r1x}','hX','X',now(),'${caps}','{avatar.reconstruct}');`,
  );
  const claimR1 = (w, inst, req = null) =>
    JSON.parse(
      service(`select fm_v2_claim_r1('${w}',${u(inst)},${u(req)});`) || "null",
    );
  const tr = (w, j, token, action, stage = null, asset = null) =>
    service(
      `select fm_v2_transition('${w}','${j}','${token}','${action}',${u(stage)},${u(asset)});`,
    );
  const intent = (w, j, token, sha, bytes = 100) =>
    JSON.parse(
      service(
        `select fm_v2_output_intent('${w}','${j}','${token}',gen_random_uuid(),${bytes},'${sha}','src-'||gen_random_uuid(),'dst-'||gen_random_uuid());`,
      ),
    );
  const markReady = (assetId) =>
    sql(
      `update fm_v2_assets set state='ready',bytes=expected_bytes,sha256=expected_sha256 where id='${assetId}';`,
    );
  // R1C default deny: declared but not granted never claims; grants restrict to known kinds.
  const J1 = r1enqueue("r1-job-0001");
  assert.equal(claimR1(wB, I1), null, "declared capability is not a grant");
  assert.throws(
    () =>
      sql(`update fm_v2_workers set allowed_capabilities='{evil}' where id='${wB}';`),
    "unknown capability cannot be granted",
  );
  // R1B redelivery: same instance gets the same assignment, same token, same attempt, no second job.
  const first = claimR1(wA, I1, I1);
  assert.equal(first.id, J1);
  assert.equal(first.attempt, 1);
  assert.equal(first.redelivered, false);
  r1enqueue("r1-job-0002");
  const again = await parallel(
    Array.from(
      { length: 8 },
      () => `select fm_v2_claim_r1('${wA}','${I1}',gen_random_uuid());`,
    ),
  );
  assert.ok(again.every((r) => r.ok));
  for (const r of again.map((r) => JSON.parse(r.value))) {
    assert.equal(r.id, J1, "redelivery never hands out a second job");
    assert.equal(r.lease_token, first.lease_token);
    assert.equal(r.attempt, 1, "redelivery does not consume an attempt");
    assert.equal(r.redelivered, true);
  }
  assert.equal(claimR1(wA, I2), null, "another process instance gets nothing");
  assert.equal(
    service(`select fm_v2_claim('${wA}');`) || "",
    "",
    "legacy claim never redelivers",
  );
  assert.equal(tr(wA, J1, first.lease_token, "heartbeat", "reconstructing"), "t");
  assert.equal(claimR1(wA, I1), null, "no redelivery after the worker reported progress");
  // Lease expiry: the job comes back as a new attempt with a new token.
  sql(`update fm_v2_jobs set lease_until=now()-interval '1 second' where id='${J1}';`);
  const second = claimR1(wA, I2);
  assert.equal(second.id, J1);
  assert.equal(second.attempt, 2);
  assert.notEqual(second.lease_token, first.lease_token);
  // R1A output intent: idempotent per job+sha, lease-checked, owner-scoped.
  const oi1 = intent(wA, J1, second.lease_token, shaA);
  assert.equal(oi1.created, true);
  assert.equal(oi1.state, "pending");
  const oi2 = intent(wA, J1, second.lease_token, shaA);
  assert.equal(oi2.assetId, oi1.assetId, "retry does not create a new logical artifact");
  assert.equal(oi2.created, false);
  assert.notEqual(intent(wA, J1, second.lease_token, shaB).assetId, oi1.assetId);
  assert.throws(() => intent(wA, J1, first.lease_token, shaA), /LEASE_LOST/);
  assert.throws(() => intent(wX, J1, second.lease_token, shaA), /LEASE_LOST/);
  markReady(oi1.assetId);
  assert.equal(
    tr(wA, J1, second.lease_token, "fail", "INFERENCE_FAILED"),
    "f",
    "an attempt with a published output cannot be failed",
  );
  assert.equal(
    tr(wA, J1, first.lease_token, "complete", null, oi1.assetId),
    "f",
    "stale token cannot publish",
  );
  // Concurrent identical completes: all succeed, one receipt, model gets that output.
  const completes = await parallel(
    Array.from(
      { length: 6 },
      () =>
        `select fm_v2_transition('${wA}','${J1}','${second.lease_token}','complete',null,'${oi1.assetId}');`,
    ),
  );
  assert.deepEqual(
    completes.map((r) => r.value),
    Array(6).fill("t"),
  );
  assert.equal(
    service(`select count(*) from fm_v2_job_receipts where job_id='${J1}';`),
    "1",
  );
  assert.equal(
    tr(wA, J1, second.lease_token, "complete", null, oi1.assetId),
    "t",
    "replay after reply loss",
  );
  assert.equal(tr(wA, J1, second.lease_token, "complete", null, r1photos[0]), "f");
  assert.equal(tr(wA, J1, first.lease_token, "complete", null, oi1.assetId), "f");
  assert.equal(tr(wX, J1, second.lease_token, "complete", null, oi1.assetId), "f");
  assert.throws(() => intent(wA, J1, second.lease_token, shaA), /LEASE_LOST/);
  sql(`update fm_v2_workers set enabled=false where id='${wA}';`);
  assert.equal(
    tr(wA, J1, second.lease_token, "complete", null, oi1.assetId),
    "f",
    "revoked credential cannot replay",
  );
  sql(`update fm_v2_workers set enabled=true where id='${wA}';`);
  // Cancel race: canceled job cannot be completed or replayed with its old token.
  const c1 = claimR1(wA, I2);
  const cOut = intent(wA, c1.id, c1.lease_token, shaA);
  markReady(cOut.assetId);
  assert.equal(
    service(`select fm_v2_job_action('${r1}','${c1.id}','cancel');`),
    "t",
  );
  assert.equal(tr(wA, c1.id, c1.lease_token, "complete", null, cOut.assetId), "f");
  assert.equal(
    service(`select state from fm_v2_jobs where id='${c1.id}';`),
    "canceled",
  );
  // Reclaim after lease loss reuses the already verified output (no second logical artifact).
  const J3 = r1enqueue("r1-job-0003");
  const a1 = claimR1(wA, I1);
  assert.equal(a1.id, J3);
  const out3 = intent(wA, J3, a1.lease_token, shaB);
  markReady(out3.assetId);
  sql(`update fm_v2_jobs set lease_until=now()-interval '1 second' where id='${J3}';`);
  const a2 = claimR1(wA, I2);
  assert.equal(a2.id, J3);
  assert.equal(a2.attempt, 2);
  const reuse = intent(wA, J3, a2.lease_token, shaB);
  assert.equal(reuse.assetId, out3.assetId);
  assert.equal(reuse.state, "ready");
  assert.equal(tr(wA, J3, a1.lease_token, "complete", null, out3.assetId), "f");
  assert.equal(tr(wA, J3, a2.lease_token, "complete", null, out3.assetId), "t");
  // Browser roles never see receipts or call the new RPCs.
  for (const role of ["anon", "authenticated"])
    for (const q of [
      "select * from fm_v2_job_receipts;",
      `select fm_v2_claim_r1('${wA}',null,null);`,
      `select fm_v2_output_intent('${wA}','${J3}','${a2.lease_token}',gen_random_uuid(),100,'${shaA}','s','p');`,
    ])
      assert.throws(() => sql(`set role ${role};${q}`));
  {
  // ---------------- C1 full look (CL-FULLLOOK-20261105-01) ----------------
  // Applied on a database that already holds legacy rows: garment/fitting without slot, single-fitting look.
  const legacyLook = "cccccccc-1111-4111-a111-111111111111";
  sql(`insert into fm_v2_looks(id,user_id,name,avatar_id,fitting_id) values('${legacyLook}','${owner}','Legacy','${next.model_id}','${f1.modelId}');`);
  assert.equal(service(`select count(*) from information_schema.columns where table_name='fm_v2_models' and column_name='slot';`), "0", "legacy schema before C1");
  sql(readFileSync(new URL("../supabase/migrations/20261106035951_full_look_c1.sql", import.meta.url), "utf8"));
  assert.equal(service(`select slot from fm_v2_models where id='${garment}';`), "top", "legacy garment backfilled to top");
  assert.equal(service(`select slot from fm_v2_models where id='${f1.modelId}';`), "top", "legacy fitting backfilled to top");
  assert.equal(service(`select fitting_id||'|'||coalesce(top_fitting_id::text,'null') from fm_v2_looks where id='${legacyLook}';`), `${f1.modelId}|null`, "legacy look untouched");
  assert.throws(() => sql(`insert into fm_v2_models(id,user_id,kind,name) values(gen_random_uuid(),'${owner}','garment','no slot');`), /fm_v2_models_slot_kind/);
  assert.throws(() => sql(`insert into fm_v2_models(id,user_id,kind,name,slot) values(gen_random_uuid(),'${owner}','avatar','a','top');`), /fm_v2_models_slot_kind/);
  const cu = "dddddddd-1111-4111-a111-111111111111",
    cuOther = "dddddddd-2222-4222-a222-222222222222";
  sql(`insert into auth.users values('${cu}'),('${cuOther}');`);
  const cp = [31, 32, 33].map(photo);
  for (const id of cp)
    sql(`insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) values('${id}','${cu}','photo','ready','c1p-${id}','c1s-${id}',100);`);
  const items = { tee: photo(41), jeans: photo(42), pants: photo(43), shirt: photo(44), foreign: photo(45) };
  sql(`insert into fm_wardrobe_items values('${items.tee}','${cu}','t-shirt'),('${items.jeans}','${cu}','jeans'),('${items.pants}','${cu}','pants'),('${items.shirt}','${cu}','shirt'),('${items.foreign}','${cuOther}','jeans');`);
  const c1enqueue = (key, kind, o = {}) =>
    JSON.parse(service(`select fm_v2_enqueue('${o.user ?? cu}','${key}','${key}','${kind}','C1 ${kind}',${kind === "fitting" ? "'{}'" : `array[${(kind === "avatar" ? cp : cp.slice(0, 2)).map((x) => `'${x}'`)}]::uuid[]`},'{}',${u(o.wardrobe)},${u(o.avatar)},${u(o.garment)});`));
  const kindOf = (r) => service(`select kind from fm_v2_jobs where id='${r.jobId}';`);
  const slotOf = (r) => service(`select slot from fm_v2_models where id='${r.modelId}';`);
  const av = c1enqueue("cu-avatar-01", "avatar");
  const tee = c1enqueue("cu-tee-0001", "garment", { wardrobe: items.tee });
  const jeans = c1enqueue("cu-jeans-001", "garment", { wardrobe: items.jeans });
  assert.equal(slotOf(tee), "top");
  assert.equal(kindOf(tee), "garment.reconstruct", "tops keep v1 kinds");
  assert.equal(slotOf(jeans), "bottom");
  assert.equal(jeans.slot, "bottom");
  assert.equal(kindOf(jeans), "bottom.reconstruct", "jeans never become a shirt job");
  assert.equal(service(`select params->>'category' from fm_v2_models where id='${jeans.modelId}';`), "jeans");
  assert.throws(() => c1enqueue("cu-pants-001", "garment", { wardrobe: items.pants }), /INVALID_GARMENT/, "trousers not opened yet");
  assert.throws(() => c1enqueue("cu-foreign-1", "garment", { wardrobe: items.foreign }), /INVALID_GARMENT/, "foreign wardrobe item");
  // Default deny per slot: a top-only worker never claims jeans.
  const wTop = "eeeeeeee-1111-4111-a111-111111111111",
    wAll = "eeeeeeee-2222-4222-a222-222222222222";
  const allCaps = JSON.stringify(Object.fromEntries(["avatar.reconstruct", "garment.reconstruct", "garment.drape", "bottom.reconstruct", "bottom.drape"].map((k) => [k, { model: "m", revision: "r" }])));
  sql(`insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values('${wTop}','${cu}','hTop','Top',now(),'${allCaps}','{garment.reconstruct}'),('${wAll}','${cu}','hAll','All',now(),'${allCaps}','{avatar.reconstruct,garment.reconstruct,garment.drape,bottom.reconstruct,bottom.drape}');`);
  assert.throws(() => sql(`update fm_v2_workers set allowed_capabilities='{pants.drape}' where id='${wTop}';`));
  const topClaim = claimR1(wTop, null);
  assert.equal(topClaim.id, tee.jobId, "top worker gets the tee");
  assert.equal(claimR1(wTop, null), null, "one job per worker");
  const finish = (w, job, sha) => {
    const out = intent(w, job.id, job.lease_token, sha);
    markReady(out.assetId);
    assert.equal(tr(w, job.id, job.lease_token, "complete", null, out.assetId), "t");
  };
  finish(wTop, topClaim, "1".repeat(64));
  assert.equal(claimR1(wTop, null), null, "jeans stay queued for the top-only worker");
  const seen = new Set();
  for (let i = 0; i < 2; i++) {
    const j = claimR1(wAll, null);
    seen.add(j.kind);
    finish(wAll, j, String(i + 2).repeat(64));
  }
  assert.deepEqual([...seen].sort(), ["avatar.reconstruct", "bottom.reconstruct"]);
  // Fittings: per item and avatar version, slot inherited, drape kind per slot, cached (no outfit combinations).
  const fitTop = c1enqueue("cu-fit-top-1", "fitting", { avatar: av.modelId, garment: tee.modelId });
  const fitBottom = c1enqueue("cu-fit-bot-1", "fitting", { avatar: av.modelId, garment: jeans.modelId });
  assert.equal(slotOf(fitTop), "top");
  assert.equal(slotOf(fitBottom), "bottom");
  assert.equal(kindOf(fitTop), "garment.drape");
  assert.equal(kindOf(fitBottom), "bottom.drape");
  const again = c1enqueue("cu-fit-bot-2", "fitting", { avatar: av.modelId, garment: jeans.modelId });
  assert.equal(again.modelId, fitBottom.modelId);
  assert.equal(again.reused, true);
  assert.equal(again.slot, "bottom");
  // save_look before fittings are ready: refused.
  const save = (o) =>
    JSON.parse(service(`select fm_v2_save_look('${o.user ?? cu}','${o.name ?? "Weekend"}','${o.avatar ?? av.modelId}',${u(o.top)},${u(o.bottom)},${o.camera ? `'${JSON.stringify(o.camera)}'` : "null"},${u(o.rec)});`));
  assert.throws(() => save({ top: fitTop.modelId, bottom: fitBottom.modelId }), /FITTING_NOT_READY/);
  for (let i = 0; i < 2; i++) {
    const j = claimR1(wAll, null);
    finish(wAll, j, String(i + 6).repeat(64));
  }
  const camera = { position: [0, 1.3, 3.1], target: [0, 1, 0], autoOrbit: true };
  const look = save({ top: fitTop.modelId, bottom: fitBottom.modelId, camera });
  assert.equal(look.top_fitting_id, fitTop.modelId);
  assert.equal(look.bottom_fitting_id, fitBottom.modelId);
  assert.equal(look.fitting_id, fitTop.modelId, "legacy readers still see the top");
  assert.deepEqual(look.camera, camera);
  assert.equal(look.snapshot.top.sha256, "6".repeat(64));
  assert.equal(look.snapshot.bottom.sha256, "7".repeat(64));
  assert.equal(look.snapshot.bottom.garmentId, jeans.modelId);
  assert.equal(look.snapshot.avatar.modelId, av.modelId);
  // Slot swap, wrong avatar, foreign owner: refused.
  assert.throws(() => save({ top: fitBottom.modelId }), /FITTING_NOT_READY/, "jeans cannot fill the top slot");
  assert.throws(() => save({ bottom: fitTop.modelId }), /FITTING_NOT_READY/, "tee cannot fill the bottom slot");
  assert.throws(() => save({ user: cuOther, top: fitTop.modelId }), /MODEL_NOT_READY/);
  assert.throws(() => save({ avatar: next.model_id, top: fitTop.modelId }), /MODEL_NOT_READY/);
  assert.throws(() => save({ name: " ", top: fitTop.modelId }), /INVALID_INPUT/);
  const bottomOnly = save({ bottom: fitBottom.modelId });
  assert.equal(bottomOnly.top_fitting_id, null, "one slot may stay on the labelled preset");
  for (const role of ["anon", "authenticated"])
    assert.throws(() => sql(`set role ${role};select fm_v2_save_look('${cu}','x','${av.modelId}',null,null,null,null);`));
  console.log(
    "PASS C1 PostgreSQL: migration on populated DB backfills legacy garments/fittings to top and keeps legacy looks; slot/kind constraint; jeans→bottom with bottom.* kinds; pants/foreign refused; top-only worker never claims jeans; per-item fitting cache with inherited slot; save_look checks readiness/slot/avatar/owner and snapshots camera + asset sha256; browser roles denied.",
  );
  }
  {
    // ---------------- C2 capture + retention (CL-FULLLOOK-20261105-01) ----------------
    sql(readFileSync(new URL("../supabase/migrations/20261106042143_capture_retention_c2.sql", import.meta.url), "utf8"));
    assert.equal(sql("select file_size_limit from storage.buckets where id='fitmatch-v2';"), "157286400");
    const cv = "ffffffff-1111-4111-a111-111111111111";
    sql(`insert into auth.users values('${cv}');`);
    const vid = photo(51), face = photo(52), body3 = [53, 54, 55].map(photo);
    sql(`insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) values('${vid}','${cv}','video','ready','v.mp4','vs',100000000),('${face}','${cv}','photo','ready','f','fs',100)` +
      body3.map((id, i) => `,('${id}','${cv}','photo','ready','b${i}','bs${i}',100)`).join("") + ";");
    assert.throws(() => sql(`insert into fm_v2_assets(id,user_id,kind,path,source_path,expected_bytes) values(gen_random_uuid(),'${cv}','video','big','bigs',157286401);`), /expected_bytes/);
    assert.throws(() => sql(`insert into fm_v2_assets(id,user_id,kind,path,source_path,expected_bytes) values(gen_random_uuid(),'${cv}','photo','p41','s41',41943041);`), /expected_bytes/, "photos keep the 40 MB cap");
    const avq = (key, inputs, roles) =>
      JSON.parse(service(`select fm_v2_enqueue('${cv}','${key}','${key}','avatar','Video avatar',array[${inputs.map((x) => `'${x}'`)}]::uuid[],'${JSON.stringify({ heightCm: 170, roles })}');`));
    const va = avq("c2-video-01", [face, vid], ["face", "video"]);
    assert.equal(service(`select params->'roles'->>1 from fm_v2_models where id='${va.modelId}';`), "video");
    assert.throws(() => avq("c2-video-only", [vid], ["video"]), /INVALID_INPUT/, "video alone needs a face/body photo");
    assert.throws(() => avq("c2-two-photos", body3.slice(0, 2), ["front", "side"]), /INVALID_INPUT/);
    assert.throws(() => avq("c2-roles-bad", [face, vid], ["face"]), /INVALID_INPUT/, "roles must align with inputs");
    assert.throws(() => service(`select fm_v2_enqueue('${cv}','c2-garment-vid','h','garment','G',array['${body3[0]}','${vid}']::uuid[],'{}');`), /INVALID_ASSET/, "videos only for avatars");
    const vb = avq("c2-photos-01", [...body3, face], ["front", "side", "back", "face"]);
    // A second model reads the same face photo; deleting the first avatar's source cancels both unfinished jobs.
    const wc = "ffffffff-2222-4222-a222-222222222222";
    sql(`insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values('${wc}','${cv}','hC','C',now(),'{"avatar.reconstruct":{"model":"m","revision":"r"}}','{avatar.reconstruct}');`);
    const running = claimR1(wc, null);
    assert.equal(running.id, va.jobId);
    assert.throws(() => service(`select fm_v2_source_retention('${other}','${va.modelId}','delete');`), /MODEL_NOT_FOUND/, "foreign owner");
    const del = JSON.parse(service(`select fm_v2_source_retention('${cv}','${va.modelId}','delete');`));
    assert.equal(del.retention, "deleted");
    assert.equal(del.canceledJobs, 2, "the running video job and the queued photo job that reads the same face photo");
    assert.equal(del.paths.length, 2);
    assert.equal(service(`select string_agg(state,',' order by id) from fm_v2_assets where id in ('${vid}','${face}');`), "deleted,deleted");
    assert.equal(service(`select state from fm_v2_assets where id='${body3[0]}';`), "ready", "other sources untouched");
    // Late completion of the canceled job cannot publish; retry cannot revive it; re-enqueue cannot reuse the tombstone.
    assert.throws(() => intent(wc, running.id, running.lease_token, "c".repeat(64)), /LEASE_LOST/, "no output intent after cancel");
    assert.equal(tr(wc, running.id, running.lease_token, "complete", null, photo(53)), "f");
    assert.equal(service(`select fm_v2_job_action('${cv}','${va.jobId}','retry');`), "f", "retry refused: source deleted");
    assert.equal(service(`select fm_v2_job_action('${cv}','${vb.jobId}','retry');`), "f", "dependent job also refused");
    assert.throws(() => avq("c2-reuse-del", [face, vid], ["face", "video"]), /INVALID_ASSET/);
    assert.throws(() => service(`select fm_v2_source_retention('${cv}','${va.modelId}','keep');`), /SOURCE_ALREADY_DELETED/);
    const again = JSON.parse(service(`select fm_v2_source_retention('${cv}','${va.modelId}','delete');`));
    assert.equal(again.paths.length, 0, "idempotent delete");
    // Keep on another avatar; accepted_at column for drafts.
    const vk = avq("c2-photos-02", body3, ["front", "side", "back"]);
    assert.equal(JSON.parse(service(`select fm_v2_source_retention('${cv}','${vk.modelId}','keep');`)).retention, "keep");
    assert.equal(service(`select source_retention from fm_v2_models where id='${vk.modelId}';`), "keep");
    for (const role of ["anon", "authenticated"])
      assert.throws(() => sql(`set role ${role};select fm_v2_source_retention('${cv}','${vk.modelId}','delete');`));
    console.log(
      "PASS C2 PostgreSQL: video asset kind with 150 MB cap (photos stay 40 MB), avatar inputs photos or video+photo with aligned roles, video only for avatars; source delete tombstones inputs, cancels every unfinished job that reads them, blocks late output/complete, retry and re-enqueue; keep choice; owner-only; browser roles denied.",
    );
  }
  {
    // ---------------- C3 GC dry run ----------------
    sql(readFileSync(new URL("../supabase/migrations/20261106044040_gc_dry_run_c3.sql", import.meta.url), "utf8"));
    const before = service("select count(*) from fm_v2_assets;");
    sql("update fm_v2_assets set created_at = now() - interval '10 days', deleted_at = case when state='deleted' then now() - interval '9 days' end;");
    const rows = JSON.parse(service("select coalesce(json_agg(t),'[]') from fm_v2_gc_candidates() t;"));
    const reasons = new Set(rows.map((r) => r.reason));
    for (const r of ["stale-pending", "deleted-source-objects", "verified-staging-copy", "unpublished-output"]) assert.ok(reasons.has(r), "candidate kind " + r);
    assert.ok(rows.filter((r) => r.reason === "deleted-source-objects").every((r) => r.state === "deleted"));
    // Published outputs (model.output_asset_id) are never candidates for removal of the verified object.
    const published = service("select string_agg(output_asset_id::text, ',') from fm_v2_models where output_asset_id is not null;").split(",");
    assert.ok(!rows.some((r) => r.reason !== "verified-staging-copy" && published.includes(r.asset_id)), "published outputs are kept");
    assert.equal(JSON.parse(service("select coalesce(json_agg(t),'[]') from fm_v2_gc_candidates(interval '30 days') t;")).length, 0, "grace period respected");
    assert.equal(service("select count(*) from fm_v2_assets;"), before, "dry run deletes nothing");
    for (const role of ["anon", "authenticated"]) assert.throws(() => sql(`set role ${role};select * from fm_v2_gc_candidates();`));
    console.log("PASS C3 PostgreSQL: GC dry run lists stale pending uploads, tombstoned source objects, unpublished outputs and staging copies after the grace period; published outputs kept; deletes nothing; browser roles denied.");
  }
  sql(readFileSync(new URL("../supabase/migrations/20261106053812_fitting_generations.sql", import.meta.url), "utf8"));
  const regenAvatar = photo(91);
  sql(`insert into fm_v2_models(id,user_id,kind,name,output_asset_id) select '${regenAvatar}',user_id,kind,'Regeneration',output_asset_id from fm_v2_models where id='${next.model_id}';`);
  const broken = JSON.parse(service(enqueue("regen-original", "fitting", {avatar:regenAvatar,garment})));
  const act = (user, job, action) => `select fm_v2_job_action('${user}','${job}','${action}');`;
  assert.equal(service(act(owner,broken.jobId,"regenerate")), "f", "queued job cannot regenerate");
  sql(`update fm_v2_jobs set state='failed',attempt=3 where id='${broken.jobId}';`);
  assert.equal(service(act(other,broken.jobId,"regenerate")), "f", "foreign owner denied");
  const concurrent = await parallel(Array.from({length:8},()=>act(owner,broken.jobId,"regenerate")));
  assert.ok(concurrent.every(r=>r.ok && r.value==='t'), JSON.stringify(concurrent));
  const successor = service(`select superseded_by from fm_v2_models where id='${broken.modelId}';`);
  assert.ok(successor && successor!==broken.modelId);
  assert.equal(service(`select count(*) from fm_v2_models where avatar_id='${regenAvatar}' and superseded_by is null;`),"1");
  assert.equal(service(`select attempt||'|'||state from fm_v2_jobs where model_id='${successor}';`),"0|queued");
  assert.equal(service(act(owner,broken.jobId,"retry")),"f", "superseded job cannot revive");
  assert.equal(JSON.parse(service(enqueue("regen-new-key","fitting",{avatar:regenAvatar,garment}))).modelId,successor);
  assert.equal(service(`select fitting_id from fm_v2_looks where name='Legacy';`),f1.modelId,"saved look stays pinned");
  const successorJob = service(`select id from fm_v2_jobs where model_id='${successor}';`);
  sql(`update fm_v2_jobs set state='failed',attempt=3,error_code='SOURCE_DELETED' where id='${successorJob}';`);
  assert.equal(service(act(owner,successorJob,"regenerate")),"f","source deleted denied");
  sql(`update fm_v2_jobs set error_code=null where id='${successorJob}';
    insert into fm_v2_models(id,user_id,kind,name) select gen_random_uuid(),'${owner}','avatar','quota-probe' from generate_series(1,20);
    insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash)
      select gen_random_uuid(),'${owner}',id,'avatar.reconstruct',id::text,id::text from fm_v2_models where name='quota-probe';`);
  assert.throws(()=>service(act(owner,successorJob,"regenerate")),/QUOTA_EXCEEDED/);
  assert.equal(service(`select superseded_by is null from fm_v2_models where id='${successor}';`),"t","quota refusal leaves current generation intact");
  for(const role of ['anon','authenticated']) assert.throws(()=>sql(`set role ${role};${act(owner,broken.jobId,'regenerate')}`));
  console.log('PASS fitting generations: eight concurrent requests create one successor; owner/source/active guards; old retry denied; new cache and saved look pinning.');
  {
    // ---------------- CL-PRIV-01 durable source cleanup ----------------
    // Reproduction on the C2 schema (already exercised above): the second delete of va returned
    // paths=[] although nothing recorded that its objects were removed. The migration must turn
    // those tombstones into outstanding intents instead of forgetting them.
    const cv = "ffffffff-1111-4111-a111-111111111111";
    const modelOf = (key) => service(`select model_id from fm_v2_jobs where user_id='${cv}' and idempotency_key='${key}';`);
    const va = modelOf("c2-video-01"), vb = modelOf("c2-photos-01");
    const sourceCount = service("select count(*) from fm_v2_assets where state='deleted';");
    assert.equal(JSON.parse(service(`select fm_v2_source_retention('${cv}','${va}','delete');`)).paths.length, 0, "C2 bug reproduced: retry returns no paths");
    const derivedBefore = service("select string_agg(id::text||':'||state, ',' order by id) from fm_v2_assets where kind='glb';");
    sql(readFileSync(new URL("../supabase/migrations/20261106150000_source_cleanup_priv01.sql", import.meta.url), "utf8"));
    const outstanding = (user, model) => JSON.parse(service(`select fm_v2_source_retention('${user}','${model}','delete');`));
    const report = (user, paths, ok, err = null) =>
      JSON.parse(service(`select fm_v2_source_cleanup_report('${user}',array[${paths.map((p) => `'${p}'`)}]::text[],${ok},${err ? `'${err}'` : "null"});`)).updated;
    const cleanup = (model) => service(`select coalesce(source_cleanup,'none') from fm_v2_models where id='${model}';`);
    assert.equal(service("select count(*) from fm_v2_source_cleanup where state='pending';"), String(sourceCount * 2), "backfill: every tombstoned verified+staging object pending");
    assert.equal(cleanup(va), "pending");
    assert.equal(cleanup(vb), "pending", "shared face photo: the other avatar sees outstanding cleanup too");
    let r = outstanding(cv, va);
    assert.deepEqual(r.paths, ["f", "fs", "v.mp4", "vs"], "retry after migration returns every outstanding path");
    assert.ok(r.affectedModels.includes(vb), "shared-source consumers reported");
    assert.equal(r.canceledJobs, 0, "repeat delete cancels nothing new");
    // Failed removal: stays pending with backoff, nothing lost on reload/repeat.
    assert.equal(report(cv, r.paths, false, "storage 503"), 4);
    assert.equal(service(`select string_agg(distinct state||':'||attempts,',') from fm_v2_source_cleanup where path in ('f','fs','v.mp4','vs');`), "pending:1");
    assert.equal(service("select count(*) from jsonb_array_elements(fm_v2_source_cleanup_due(500)) e where e->>'path' in ('f','fs','v.mp4','vs');"), "0", "backoff respected");
    sql("update fm_v2_source_cleanup set next_attempt_at=now() where path in ('f','fs','v.mp4','vs');");
    assert.equal(service("select count(*) from jsonb_array_elements(fm_v2_source_cleanup_due(500)) e where e->>'path' in ('f','fs','v.mp4','vs');"), "4");
    assert.deepEqual(outstanding(cv, va).paths, ["f", "fs", "v.mp4", "vs"], "repeated request keeps the paths");
    // Foreign owner cannot report on, or read, someone else's intents.
    assert.equal(report(other, ["f", "fs"], true), 0, "foreign report ignored");
    assert.throws(() => service(`select fm_v2_source_retention('${other}','${va}','delete');`), /MODEL_NOT_FOUND/);
    // Success for part; a racing late failure for the same paths cannot reopen them.
    assert.equal(report(cv, ["v.mp4", "vs"], true), 2);
    assert.equal(report(cv, ["v.mp4", "vs"], false, "late"), 0, "completed is final");
    assert.deepEqual(outstanding(cv, va).paths, ["f", "fs"]);
    assert.equal(cleanup(va), "pending");
    // Bounded automatic attempts -> failed; the user's explicit retry still covers failed intents.
    for (let i = 0; i < 4; i++) report(cv, ["f", "fs"], false, "storage 500");
    assert.equal(service("select string_agg(distinct state||':'||attempts,',') from fm_v2_source_cleanup where path in ('f','fs');"), "failed:5");
    assert.equal(cleanup(va), "failed");
    assert.equal(cleanup(vb), "failed");
    sql("update fm_v2_source_cleanup set next_attempt_at=now() - interval '1 day' where path in ('f','fs');");
    assert.equal(service("select count(*) from jsonb_array_elements(fm_v2_source_cleanup_due(500)) e where e->>'path' in ('f','fs');"), "0", "collector stops after 5 attempts");
    assert.deepEqual(outstanding(cv, va).paths, ["f", "fs"], "user retry still sees failed paths");
    assert.equal(report(cv, ["f", "fs"], true), 2);
    assert.equal(cleanup(va), "completed");
    assert.deepEqual(outstanding(cv, va).paths, [], "nothing outstanding once every object is removed");
    // vb shares the (now removed) face photo; deleting its own sources records only new objects.
    assert.equal(cleanup(vb), "completed", "vb's only tombstoned input was the shared face");
    r = outstanding(cv, vb);
    assert.deepEqual(r.paths, ["b0", "b1", "b2", "bs0", "bs1", "bs2"], "new intents for vb's own body photos, face already done");
    assert.ok(r.affectedModels.length >= 1, "other versions using the same body photos are listed");
    assert.equal(cleanup(vb), "pending");
    assert.throws(() => service(`select fm_v2_enqueue('${cv}','priv-reuse','h','avatar','Again',array['${photo(53)}','${photo(54)}','${photo(55)}']::uuid[],'{}');`), /INVALID_ASSET/, "tombstone still blocks re-enqueue");
    assert.equal(service("select string_agg(id::text||':'||state, ',' order by id) from fm_v2_assets where kind='glb';"), derivedBefore, "derived outputs untouched");
    for (const role of ["anon", "authenticated"]) {
      assert.throws(() => sql(`set role ${role};select * from fm_v2_source_cleanup;`));
      assert.throws(() => sql(`set role ${role};select fm_v2_source_cleanup_report('${cv}',array['b0'],true,null);`));
      assert.throws(() => sql(`set role ${role};select fm_v2_source_cleanup_due(1);`));
    }
    // Concurrent repeated deletes of a fresh avatar record each object exactly once.
    const p8 = [61, 62, 63].map(photo);
    sql(`insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes) values` + p8.map((id, i) => `('${id}','${cv}','photo','ready','c${i}','cs${i}',100)`).join(",") + ";");
    const vc = JSON.parse(service(`select fm_v2_enqueue('${cv}','priv-c','priv-c','avatar','Concurrent',array[${p8.map((x) => `'${x}'`)}]::uuid[],'{}');`)).modelId;
    const runs = await parallel(Array.from({ length: 6 }, () => `select fm_v2_source_retention('${cv}','${vc}','delete');`));
    assert.ok(runs.every((x) => x.ok), JSON.stringify(runs));
    assert.equal(service(`select count(*) from fm_v2_source_cleanup where asset_id = any(array[${p8.map((x) => `'${x}'`)}]::uuid[]);`), "6");
    assert.equal(service(`select state||':'||error_code from fm_v2_jobs where model_id='${vc}';`), "canceled:SOURCE_DELETED");
    console.log("PASS CL-PRIV-01 PostgreSQL: C2 retry-loses-paths reproduced then fixed; backfill of earlier tombstones; durable pending/failed/completed intents with backoff and 5-attempt collector bound; failed paths survive repeat requests; completed never reopened by late failures; per-model status for shared sources; foreign owner/browser roles denied; derived GLBs untouched; 6 concurrent deletes record each object once.");
  }
  {
    // ---------------- QINT-C garment analysis (JSON-result jobs) ----------------
    const qa = "abababab-1111-4111-a111-111111111111", qb = "abababab-2222-4222-a222-222222222222";
    const tee = "cdcdcdcd-1111-4111-a111-111111111111", jeansB = "cdcdcdcd-2222-4222-a222-222222222222";
    const snap = (n) => `efefefef-0000-4000-a000-${String(n).padStart(12, "0")}`;
    const wq = "fafafafa-1111-4111-a111-111111111111", wqb = "fafafafa-2222-4222-a222-222222222222", w3d = "fafafafa-3333-4333-a333-333333333333";
    const sha1 = "1".repeat(64), sha2 = "2".repeat(64);
    const jobsBefore = service("select count(*) from fm_v2_jobs;");
    sql(readFileSync(new URL("../supabase/migrations/20261107120000_qwen_analysis_qint.sql", import.meta.url), "utf8"));
    assert.equal(service("select count(*) from fm_v2_jobs where model_id is null;"), "0", "existing jobs keep their model");
    sql(`insert into auth.users values('${qa}'),('${qb}');
      insert into fm_wardrobe_items(id,user_id,category,color,image_path) values('${tee}','${qa}','shirt','white','${qa}/tee-1.jpg'),('${jeansB}','${qb}','jeans','blue','${qb}/j.jpg');
      insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256) values
        ('${snap(1)}','${qa}','photo','ready','${qa}/analysis/1.jpg','${qa}/analysis/1.jpg',100,100,'${sha1}'),
        ('${snap(2)}','${qa}','photo','ready','${qa}/analysis/2.jpg','${qa}/analysis/2.jpg',100,100,'${sha1}'),
        ('${snap(3)}','${qb}','photo','ready','${qb}/analysis/3.jpg','${qb}/analysis/3.jpg',100,100,'${sha2}');`);
    const enq = (user, item, path, asset, sha, a, j) =>
      JSON.parse(service(`select fm_v2_analysis_enqueue('${user}','${item}','${path}','${asset}','${sha}','qint.1','${a}','${j}');`));
    const A = "dededede-1111-4111-a111-111111111111", J = "dededede-2222-4222-a222-222222222222";
    let r = enq(qa, tee, `${qa}/tee-1.jpg`, snap(1), sha1, A, J);
    assert.deepEqual(r, { analysisId: A, jobId: J, deduped: false });
    assert.equal(service(`select kind||':'||state||':'||coalesce(model_id::text,'none') from fm_v2_jobs where id='${J}';`), "garment.analyze:queued:none");
    // Same item + pixels + policy from a racing request: one analysis, the extra snapshot is tombstoned.
    r = enq(qa, tee, `${qa}/tee-1.jpg`, snap(2), sha1, "dededede-3333-4333-a333-333333333333", "dededede-4444-4444-a444-444444444444");
    assert.deepEqual(r, { analysisId: A, jobId: J, deduped: true });
    assert.equal(service(`select state from fm_v2_assets where id='${snap(2)}';`), "deleted");
    assert.equal(service(`select count(*) from fm_v2_source_cleanup where asset_id='${snap(2)}';`), "1", "path=source_path recorded once");
    assert.throws(() => enq(qa, jeansB, `${qb}/j.jpg`, snap(1), sha1, "dededede-5555-4555-a555-555555555555", "dededede-6666-4666-a666-666666666666"), /ITEM_NOT_FOUND/, "foreign item");
    assert.throws(() => enq(qa, tee, `${qa}/other.jpg`, snap(1), sha1, "dededede-5555-4555-a555-555555555555", "dededede-6666-4666-a666-666666666666"), /ITEM_NOT_FOUND/, "image changed");
    assert.throws(() => enq(qa, tee, `${qa}/tee-1.jpg`, snap(3), sha2, "dededede-5555-4555-a555-555555555555", "dededede-6666-4666-a666-666666666666"), /INVALID_ASSET/, "foreign snapshot");
    assert.throws(() => sql(`insert into fm_v2_jobs(id,user_id,model_id,analysis_id,kind,idempotency_key,payload_hash) values(gen_random_uuid(),'${qa}',null,null,'avatar.reconstruct','x','x');`), /fm_v2_jobs_subject/);
    assert.throws(() => sql(`update fm_v2_jobs set kind='avatar.reconstruct' where id='${J}';`), /fm_v2_jobs_analysis_kind/);
    // Grants: a 3D-only worker never claims analysis; a Qwen worker of another owner never sees it.
    const qcaps = '{"garment.analyze":{"model":"Qwen/Qwen3-VL-4B-Instruct","revision":"r1"}}';
    sql(`insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values
      ('${w3d}','${qa}','hq3','3D',now(),'{"avatar.reconstruct":{}}','{avatar.reconstruct}'),
      ('${wqb}','${qb}','hqb','QB',now(),'${qcaps}','{garment.analyze}'),
      ('${wq}','${qa}','hqa','QA',now(),'${qcaps}','{}');`);
    const claimR1 = (w) => JSON.parse(service(`select fm_v2_claim_r1('${w}',gen_random_uuid(),gen_random_uuid());`) || "null");
    assert.equal(claimR1(w3d), null, "3D worker cannot claim analysis");
    assert.equal(claimR1(wqb), null, "other owner's worker sees nothing");
    assert.equal(claimR1(wq), null, "declared but not granted: default deny");
    sql(`update fm_v2_workers set allowed_capabilities='{garment.analyze}' where id='${wq}';`);
    let job = claimR1(wq);
    assert.equal(job.id, J);
    assert.equal(job.analysis_id, A);
    assert.deepEqual(job.engine, JSON.parse(qcaps)["garment.analyze"]);
    const result = (patch = {}) => ({
      contractVersion: "fitmatch.garment-analysis.result.v1",
      binding: { jobId: J, analysisId: A, itemId: tee, imageAssetId: snap(1), imageSha256: sha1 },
      modelRevision: JSON.parse(qcaps)["garment.analyze"], policyRevision: "qint.1", rawOutputSha256: "b".repeat(64),
      outcome: "proposal", abstainReason: null,
      attributes: { category: "tshirt", dominantColors: ["red"], pattern: "printed", logoPresence: "visible", neckline: "crew", sleeves: "short" },
      candidateLogoTexts: ["FITMATCH"], ocrStatus: "unverified", approvedForAutoApply: false,
      evidence: { attempts: 1, outputTokens: 100, durationMs: 5000, gpuMiB: null }, ...patch });
    const lit = (v) => "'" + v.replaceAll("'", "''") + "'";
    const post = (w, jobRow, value, token = jobRow.lease_token) => {
      const text = JSON.stringify(value);
      const sha = createHash("sha256").update(text).digest("hex");
      return service(`select fm_v2_analysis_result('${w}','${jobRow.id}','${token}','${sha}',${lit(text)},${lit(text)}::jsonb);`);
    };
    // Defer (GPU busy) does not consume an attempt and respects backoff; FIFO resumes after not_before.
    assert.equal(service(`select fm_v2_analysis_defer('${wq}','${J}','${job.lease_token}','GPU_BUSY');`), "t");
    assert.equal(service(`select state||':'||attempt||':'||deferrals||':'||stage from fm_v2_jobs where id='${J}';`), "queued:0:1:waiting_gpu");
    assert.equal(claimR1(wq), null, "backoff respected");
    assert.equal(service(`select fm_v2_analysis_defer('${wq}','${J}','${job.lease_token}','GPU_BUSY');`), "f", "stale lease cannot defer");
    sql(`update fm_v2_jobs set not_before=now() where id='${J}';`);
    job = claimR1(wq);
    assert.equal(job.attempt, 1, "first real attempt");
    // Fencing and identity: wrong token, wrong binding, wrong model revision, wrong digest all refused.
    assert.equal(post(wq, job, result(), "00000000-0000-4000-8000-000000000000"), "lease_lost");
    assert.equal(post(wq, job, result({ binding: { jobId: J, analysisId: A, itemId: jeansB, imageAssetId: snap(1), imageSha256: sha1 } })), "mismatch");
    assert.equal(post(wq, job, result({ modelRevision: { model: "Qwen/Qwen3-VL-4B-Instruct", revision: "r2" } })), "mismatch");
    assert.equal(post(wq, job, result({ policyRevision: "quality03.1" })), "mismatch");
    assert.equal(service(`select fm_v2_analysis_result('${wq}','${J}','${job.lease_token}','${"0".repeat(64)}','{}','{}'::jsonb);`), "mismatch", "sha of bytes checked");
    assert.equal(post(wqb, job, result()), "lease_lost", "other owner's worker");
    // Accepted once; identical replay after a lost reply is ok; a second different result is refused.
    assert.equal(post(wq, job, result()), "ok");
    assert.equal(post(wq, job, result()), "replay");
    assert.equal(post(wq, job, result({ evidence: { attempts: 2, outputTokens: 100, durationMs: 5000, gpuMiB: null } })), "lease_lost");
    assert.equal(service(`select status||':'||(result_json is not null) from fm_v2_analyses where id='${A}';`), "review:true");
    assert.equal(service(`select state||':'||stage from fm_v2_jobs where id='${J}';`), "succeeded:review");
    assert.equal(service(`select color||':'||category from fm_wardrobe_items where id='${tee}';`), "white:shirt", "model never writes wardrobe");
    // Human confirmation.
    const rsha = service(`select result_sha256 from fm_v2_analyses where id='${A}';`);
    const confirm = (user, cid, expected, decision, fields, cols, digest = "d1") =>
      JSON.parse(service(`select fm_v2_analysis_confirm('${user}','${A}','${cid}','${digest}','${expected}','${decision}','${JSON.stringify(fields)}'::jsonb,'${JSON.stringify(cols)}'::jsonb);`));
    const C1 = "c1c1c1c1-1111-4111-a111-111111111111";
    assert.throws(() => confirm(qb, C1, rsha, "approve", { primaryColor: "red" }, { color: "red" }), /ANALYSIS_NOT_FOUND/, "foreign confirm");
    assert.throws(() => confirm(qa, C1, "0".repeat(64), "approve", { primaryColor: "red" }, { color: "red" }), /RESULT_CHANGED/);
    assert.throws(() => confirm(qa, C1, rsha, "approve", { approved: true }, { material: "cotton" }), /INVALID_INPUT/, "unknown column");
    assert.throws(() => confirm(qa, C1, rsha, "approve", { category: "x" }, { category: "hoodie" }), /INVALID_INPUT/, "unmapped category");
    assert.throws(() => confirm(qa, C1, rsha, "approve", {}, {}), /INVALID_INPUT/, "nothing approved");
    sql(`update fm_wardrobe_items set image_path='${qa}/tee-2.jpg' where id='${tee}';`);
    assert.throws(() => confirm(qa, C1, rsha, "approve", { primaryColor: "red" }, { color: "red" }), /SOURCE_CHANGED/, "item photo changed after analysis");
    sql(`update fm_wardrobe_items set image_path='${qa}/tee-1.jpg' where id='${tee}';`);
    const ok = confirm(qa, C1, rsha, "approve", { category: "tshirt", primaryColor: "red", pattern: "printed" }, { category: "t-shirt", color: "red", pattern: "graphic" });
    assert.deepEqual(ok, { status: "confirmed", replay: false });
    assert.equal(service(`select category||':'||color||':'||pattern||':'||coalesce(secondary_color,'-') from fm_wardrobe_items where id='${tee}';`), "t-shirt:red:graphic:-", "only approved columns written");
    assert.deepEqual(confirm(qa, C1, rsha, "approve", {}, {}, "d1"), { status: "confirmed", replay: true }, "replay with same digest");
    assert.throws(() => confirm(qa, C1, rsha, "reject", {}, {}, "d2"), /CONFIRMATION_REUSED/);
    assert.throws(() => confirm(qa, "c1c1c1c1-2222-4222-a222-222222222222", rsha, "reject", {}, {}), /ALREADY_DECIDED/);
    // Late result after the source changed is never applied (new analysis on jeansB for qb).
    const B = "dededede-7777-4777-a777-777777777777", JB = "dededede-8888-4888-a888-888888888888";
    enq(qb, jeansB, `${qb}/j.jpg`, snap(3), sha2, B, JB);
    sql(`update fm_v2_workers set allowed_capabilities='{garment.analyze}' where id='${wqb}';`);
    const jb = claimR1(wqb);
    sql(`update fm_wardrobe_items set image_path='${qb}/j-new.jpg' where id='${jeansB}';`);
    const late = { ...result(), binding: { jobId: JB, analysisId: B, itemId: jeansB, imageAssetId: snap(3), imageSha256: sha2 } };
    assert.equal(post(wqb, jb, late), "stale");
    assert.equal(service(`select a.status||':'||j.state||':'||j.error_code||':'||(a.result_json is null) from fm_v2_analyses a join fm_v2_jobs j on j.analysis_id=a.id where a.id='${B}';`), "stale:canceled:SOURCE_CHANGED:true");
    // Owner actions: retry bounded by attempts and source; cancel only while pending.
    assert.equal(service(`select fm_v2_analysis_action('${qb}','${B}','retry');`), "f", "stale analysis cannot be retried");
    assert.throws(() => service(`select fm_v2_analysis_action('${qa}','${B}','cancel');`), /ANALYSIS_NOT_FOUND/);
    // Deleting the wardrobe item removes analysis + job and schedules removal of the snapshot.
    const C = "dededede-9999-4999-a999-999999999999", JC = "dededede-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    sql(`insert into fm_wardrobe_items(id,user_id,category,image_path) values('cdcdcdcd-3333-4333-a333-333333333333','${qa}','jeans','${qa}/j3.jpg');
      insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256) values('${snap(4)}','${qa}','photo','ready','${qa}/analysis/4.jpg','${qa}/analysis/4.jpg',100,100,'${"4".repeat(64)}');`);
    enq(qa, "cdcdcdcd-3333-4333-a333-333333333333", `${qa}/j3.jpg`, snap(4), "4".repeat(64), C, JC);
    assert.equal(service(`select fm_v2_analysis_action('${qa}','${C}','cancel');`), "t");
    assert.equal(service(`select fm_v2_analysis_action('${qa}','${C}','retry');`), "t");
    sql("grant select, delete on fm_wardrobe_items to authenticated;");
    sql(`set request.jwt.claim.sub='${qa}'; set role authenticated; delete from fm_wardrobe_items where id='cdcdcdcd-3333-4333-a333-333333333333';`);
    assert.equal(service(`select count(*) from fm_v2_analyses where id='${C}';`), "0");
    assert.equal(service(`select count(*) from fm_v2_jobs where id='${JC}';`), "0");
    assert.equal(service(`select state from fm_v2_assets where id='${snap(4)}';`), "deleted");
    assert.equal(service(`select count(*) from fm_v2_source_cleanup where asset_id='${snap(4)}' and state='pending';`), "1");
    // Browser roles never read analyses or call the RPCs.
    for (const role of ["anon", "authenticated"]) {
      assert.throws(() => sql(`set role ${role};select * from fm_v2_analyses;`));
      assert.throws(() => sql(`set role ${role};select fm_v2_analysis_confirm('${qa}','${A}','${C1}','d','x','reject','{}','{}');`));
      assert.throws(() => sql(`set role ${role};select fm_v2_analysis_result('${wq}','${J}','${J}','x','{}','{}');`));
    }
    // Concurrency: 8 parallel enqueues of the same snapshot make one analysis and one job.
    sql(`insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256) values('${snap(5)}','${qa}','photo','ready','${qa}/analysis/5.jpg','${qa}/analysis/5.jpg',100,100,'${"5".repeat(64)}');
      update fm_wardrobe_items set image_path='${qa}/tee-5.jpg' where id='${tee}';`);
    const runs = await parallel(Array.from({ length: 8 }, (_, i) =>
      `select fm_v2_analysis_enqueue('${qa}','${tee}','${qa}/tee-5.jpg','${snap(5)}','${"5".repeat(64)}','qint.1','e${i}e0e0e0-0000-4000-a000-000000000000','f${i}f0f0f0-0000-4000-a000-000000000000');`));
    assert.ok(runs.every((x) => x.ok), JSON.stringify(runs));
    assert.equal(service(`select count(*) from fm_v2_analyses where image_sha256='${"5".repeat(64)}';`), "1");
    assert.equal(Number(service("select count(*) from fm_v2_jobs;")) - Number(jobsBefore), 3, "A, B and the concurrent one (C deleted with its item)");
    console.log("PASS QINT-C PostgreSQL: additive migration on populated DB; analysis jobs bound to one subject; dedupe incl. racing snapshot tombstone; foreign item/asset/photo-change refused; default-deny grants, 3D-only and foreign workers never claim; GPU_BUSY deferral keeps the attempt and honours backoff; lease/binding/model/policy/digest fencing; result replay idempotent, second result refused; model never writes wardrobe; human confirm writes only approved mapped columns, replay/reuse/decided/photo-changed guarded; late result after source change stays unapplied; owner actions bounded; item delete cascades and schedules snapshot removal; browser roles denied; 8 parallel enqueues -> 1.");
  }
  console.log(
    "PASS R1 PostgreSQL: default-deny grants, same-instance claim redelivery (8 parallel, attempt unchanged), no redelivery after progress/other instance/legacy, lease expiry, idempotent output intent, fail refused after publish, concurrent idempotent complete with one receipt, stale/foreign/revoked/canceled refused, reclaim reuses verified output, browser roles denied.",
  );
  console.log(
    "PASS S1 PostgreSQL: concurrent dedupe, cross-owner denial, capability claims, one worker/job, expired lease recovery, stale completion fencing, cancel/retry, revocation, immutable cache, RLS/grants, 20/25 queue quota, 2/6 upload quota.",
  );
} finally {
  try {
    execFileSync("docker", ["rm", "--force", container], { stdio: "pipe" });
  } catch {}
}
