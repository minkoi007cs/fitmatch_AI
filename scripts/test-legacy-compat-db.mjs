/**
 * CL-MIGRATION-26 — legacy (canonical-shaped) and fresh baselines on disposable PostgreSQL 17 (hosted major),
 * no network, synthetic identities only. Exercises the real cutover runner, the compatibility migration and
 * the reviewed SQL chain; proves existing data survives and the app's legacy-sensitive paths work.
 * This is NOT a cloud restore, hosted Auth/Storage or real-Qwen proof.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareInventory, flattenInventory } from "./schema-inventory-lib.mjs";

const container = `fitmatch-legacy-compat-${process.pid}`;
const psqlArgs = (db) => ["exec", "-i", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (db, s) => execFileSync("docker", psqlArgs(db), { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const tryDb = (db, s) => {
  const r = spawnSync("docker", psqlArgs(db), { input: s, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: r.stderr || "" };
};
const as = (db, role, user, s) => sql(db, `set role ${role}; select set_config('request.jwt.claim.sub','${user}',false); ${s}`);
const service = (db, s) => sql(db, `set role service_role; ${s}`);
const sha = (t) => createHash("sha256").update(t).digest("hex");
const file = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const manifest = JSON.parse(file("docs/infrastructure/schema-manifest.json"));
const plan = JSON.parse(file("docs/infrastructure/canonical-cutover/cutover-plan.json"));
const inventorySql = file("scripts/schema-inventory.sql");
const inventory = (db) => {
  const raw = JSON.parse(sql(db, inventorySql));
  raw.buckets = JSON.parse(sql(db, "select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id),'[]') from storage.buckets;"));
  return flattenInventory(raw);
};
const steps = (db) => Object.fromEntries(compareInventory(manifest, inventory(db)).steps.map((s) => [s.file.split("/").pop(), s]));
const runner = (db, extra = []) => spawnSync(process.execPath, ["scripts/migration-cutover/apply.mjs", "--plan", "docs/infrastructure/canonical-cutover/cutover-plan.json",
  "--expected-ref", "gohczmqykjkrgdblgbog", "--isolated-test", "--audit", mkdtempSync(join(tmpdir(), "cutover-audit-")),
  "--psql", `docker exec -i ${container} psql -U postgres`, ...extra], {
  encoding: "utf8", env: { ...process.env, DATABASE_URL: `postgresql://postgres@127.0.0.1/${db}` },
});

const U1 = "a1a1a1a1-0000-4000-a000-000000000001", U2 = "a1a1a1a1-0000-4000-a000-000000000002";
const NEW = "a1a1a1a1-0000-4000-a000-000000000003", ORPHAN = "a1a1a1a1-0000-4000-a000-000000000004";
const W1 = "b1b1b1b1-0000-4000-a000-000000000001", W2 = "b1b1b1b1-0000-4000-a000-000000000002";
const O1 = "c1c1c1c1-0000-4000-a000-000000000001";
const SEED = `
set session_replication_role = replica; -- existing users were provisioned before the table rename
insert into auth.users(id,email) values ('${U1}','u1@example.test'),('${U2}','u2@example.test'),('${ORPHAN}','orphan@example.test');
set session_replication_role = origin;
insert into fm_users(id,email,style_profile,quiz_answers) values ('${U1}','u1@example.test','{"primaryStyle":"minimal"}','{"ageRange":"18-24"}'),('${U2}','u2@example.test',null,null);
insert into fm_wardrobe_items(id,user_id,name,category,color,style,image_path) values
  ('${W1}','${U1}','Old tee','t-shirt',null,null,'${U1}/tee.jpg'),('${W2}','${U2}','Jeans','jeans','blue','casual','${U2}/jeans.jpg');
insert into fm_outfits(id,user_id,source_item_id,data_json,style_category,is_saved) values
  ('${O1}','${U1}','${W1}','[{"id":"legacy","styleCategory":"minimal"}]','minimal',true),
  (gen_random_uuid(),'${U2}',null,'[{"id":"legacy2","styleCategory":"casual"}]','casual',false);
insert into fm_auth_identities(issuer,app_id,subject,user_id) values ('https://hub.example','fitmatch','sub-1','${U1}');
insert into fm_auth_refreshes(refresh_hash,owner_id,sealed_result) values ('${"e".repeat(64)}','${U1}','sealed');
insert into public.lifedashboard_entries(note) values ('unrelated sentinel');`;
const FINGERPRINT = `select md5(string_agg(t, '|' order by t)) from (
  select 'u:'||row(id,email,style_profile,quiz_answers,created_at,updated_at)::text t from fm_users
  union all select 'w:'||row(id,user_id,name,category,color,style,image_path,is_favorite,created_at,updated_at)::text from fm_wardrobe_items
  union all select 'o:'||row(id,user_id,source_item_id,data_json,style_category,is_saved,created_at)::text from fm_outfits
  union all select 'i:'||row(issuer,app_id,subject,user_id)::text from fm_auth_identities
  union all select 'r:'||row(refresh_hash,owner_id,sealed_result)::text from fm_auth_refreshes
  union all select 'l:'||row(id,note)::text from lifedashboard_entries) x;`;
const handleNewUserTriggers = "select count(*) from pg_trigger where tgfoid='public.handle_new_user()'::regprocedure and not tgisinternal;";
const signup = (db, id, email) => tryDb(db, `set role supabase_auth_admin; insert into auth.users(id,email) values ('${id}','${email}');`);

try {
  execFileSync("docker", ["run", "--rm", "--detach", "--network", "none", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], { stdio: "pipe" });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    ready = spawnSync("docker", ["exec", container, "psql", "-h", "127.0.0.1", "-U", "postgres", "-c", "select 1"], { stdio: "pipe" }).status === 0;
    if (!ready) await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(ready, "PostgreSQL 17 ready over TCP");
  assert.match(sql("postgres", "select version();"), /PostgreSQL 17\./);

  // ---------------- legacy baseline (canonical shape) ----------------
  sql("postgres", "create database legacy_base;");
  sql("legacy_base", file("scripts/fixtures/legacy-canonical-shape.sql"));
  sql("legacy_base", file("supabase/migrations/20261103_app_system_identity.sql")); // present on the cloud
  sql("legacy_base", SEED);
  for (const db of ["legacy", "refuse_trigger", "refuse_column", "refuse_forced", "refuse_partial"])
    sql("postgres", `create database ${db} template legacy_base;`);
  const before = sql("legacy", FINGERPRINT);
  const privilegesBefore = sql("legacy", "select string_agg(grantee||':'||privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_name='lifedashboard_entries';");

  // Reproduce the two observed defects on the untouched legacy shape.
  const broken = signup("legacy", NEW, "new@example.test");
  assert.equal(broken.ok, false);
  assert.match(broken.err, /relation "public\.users" does not exist/, "REPRODUCED: signup fails on the legacy trigger target");
  const noStyle = tryDb("legacy", `set role authenticated; select set_config('request.jwt.claim.sub','${U1}',false);
    insert into fm_outfits(user_id,data_json) values ('${U1}','[{"id":"x","styleCategory":"minimal"}]');`);
  assert.match(noStyle.err, /null value in column "style_category"/, "REPRODUCED: the old POST shape violates legacy NOT NULL");
  console.log("REPRODUCED on the legacy shape (PG17): signup -> public.users does not exist; outfit insert without style_category -> NOT NULL violation.");

  // Semantic comparison before cutover: aliases are equivalent, FK targets genuinely differ, pgcrypto placement noted.
  const pre = compareInventory(manifest, inventory("legacy"));
  const preSteps = Object.fromEntries(pre.steps.map((s) => [s.file.split("/").pop(), s]));
  const base = preSteps["schema.sql"];
  const finding = (k) => base.findings[k]?.state;
  assert.equal(finding("constraint:public.fm_users.fm_users_pkey"), "equivalent", JSON.stringify(base.findings["constraint:public.fm_users.fm_users_pkey"]));
  assert.equal(finding("index:public.fm_wardrobe_items.fm_wardrobe_items_user_id_idx"), "equivalent");
  assert.equal(finding("trigger:public.fm_users.set_fm_users_updated_at"), "equivalent");
  assert.equal(finding("policy:public.fm_users.fm_users_select_own"), "equivalent", "same effective SELECT policy under a legacy name");
  assert.equal(finding("constraint:public.fm_wardrobe_items.fm_wardrobe_items_user_id_fkey"), "different-target");
  assert.match(base.findings["constraint:public.fm_wardrobe_items.fm_wardrobe_items_user_id_fkey"].detail, /references fm_users instead of auth\.users/);
  assert.equal(finding("constraint:public.fm_outfits.fm_outfits_user_id_fkey"), "different-target");
  assert.equal(manifest.final["extension:pgcrypto"]?.schema, "extensions", "manifest stub mirrors hosted placement");
  assert.deepEqual(inventory("legacy")["extension:pgcrypto"], { schema: "extensions" });
  assert.ok(!pre.extra.includes("extension:pgcrypto"), "pgcrypto is not reported as an unknown extra");
  assert.equal(finding("column:public.fm_users.email"), "differs", "legacy email has no default: kept");
  assert.equal(finding("column:public.fm_wardrobe_items.color"), "differs", "legacy nullable color: kept");
  assert.ok(!Object.keys(inventory("legacy")).some((k) => k.startsWith("function:public.gen_random_uuid") || k.startsWith("function:extensions.")), "extension-owned functions are not FitMatch objects");
  assert.equal(preSteps["20261103_app_system_identity.sql"].status, "applied");
  for (const s of plan.steps.slice(0, 11)) assert.equal(preSteps[s.path.split("/").pop()].status, "absent", s.path);
  assert.ok(pre.extra.includes("table:public.lifedashboard_entries") && pre.rlsOff.includes("table:public.lifedashboard_entries"));
  assert.ok(pre.anonWritable.includes("grant:public.lifedashboard_entries"));
  assert.ok(pre.overlappingPolicies.some((o) => o.slot === "public.fm_wardrobe_items|SELECT" && o.policies.length === 2), "overlapping permissive SELECT policies reported");
  assert.ok(!pre.extra.includes("constraint:public.fm_users.users_pkey"), "matched legacy aliases are not listed as unknown extras");
  console.log(`PASS comparator on legacy shape: base ${base.status} (aliases equivalent, owner FKs different-target, pgcrypto in extensions equal), identity applied, 11 absent, unrelated table/anon writes/overlapping policies reported.`);

  // Dry run refuses nothing and changes nothing; then the audited runner applies 11 + compat in order.
  const dry = runner("legacy");
  assert.equal(dry.status, 0, dry.stderr + dry.stdout);
  assert.match(dry.stdout, /VERIFIED PRESENT\s+supabase\/migrations\/20261103_app_system_identity\.sql/);
  assert.equal((dry.stdout.match(/would apply/g) ?? []).length, 12);
  assert.equal(sql("legacy", FINGERPRINT), before, "dry run changed nothing");
  const run = runner("legacy", ["--execute"]);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal((run.stdout.match(/APPLIED\+VERIFIED/g) ?? []).length, 12);
  assert.match(run.stdout, /migration repair --status applied 20261103 20261104 20261105 20261106025506 20261106035951 20261106042143 20261106044040 20261106053812 20261106150000 20261107120000 20261108090000 20261108150000 20261109093355 --remote=<isolated-test>/);
  assert.equal(sql("legacy", "select to_regclass('supabase_migrations.schema_migrations') is null;"), "t", "runner never writes CLI history by itself");
  // A second execute refuses at the first non-rerunnable step instead of replaying it.
  const again = runner("legacy", ["--execute"]);
  assert.equal(again.status, 4, again.stdout + again.stderr);
  assert.match(again.stderr, /20261104_ai_daily_quota\.sql is already applied; it is not rerunnable/);

  // Postconditions on the legacy baseline.
  assert.equal(sql("legacy", FINGERPRINT), before, "every existing profile/wardrobe/outfit/identity/refresh/sentinel row unchanged");
  assert.equal(sql("legacy", "select string_agg(grantee||':'||privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_name='lifedashboard_entries';"), privilegesBefore, "unrelated table grants untouched");
  assert.equal(sql("legacy", "select relrowsecurity from pg_class where oid='public.lifedashboard_entries'::regclass;"), "f", "unrelated table RLS untouched (separate owner decision)");
  const post = steps("legacy");
  for (const s of plan.steps.slice(0, 11)) assert.equal(post[s.path.split("/").pop()].status, "applied", s.path);
  const compat = post["20261109093355_legacy_compat_auth_outfits.sql"];
  assert.equal(compat.status, "applied-with-differences");
  assert.deepEqual(compat.different, ["column:public.fm_outfits.style_category"], "only the legacy NOT NULL style_category differs (kept)");
  assert.equal(sql("legacy", "select string_agg(conname||'>'||confrelid::regclass::text||':'||confdeltype::text, ',' order by conname) from pg_constraint where conrelid in ('public.fm_wardrobe_items'::regclass,'public.fm_outfits'::regclass) and contype='f';"),
    "outfits_source_item_id_fkey>fm_wardrobe_items:n,outfits_user_id_fkey>fm_users:c,wardrobe_items_user_id_fkey>fm_users:c", "FK targets/cascades preserved, none duplicated");
  assert.equal(sql("legacy", "select count(*) from pg_indexes where tablename='fm_wardrobe_items' and indexdef like '%(user_id)';"), "1", "no duplicate index");
  assert.equal(sql("legacy", "select attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'none') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.fm_outfits'::regclass and a.attname='style_category';"), "true:none", "legacy NOT NULL, no default kept");
  assert.equal(sql("legacy", handleNewUserTriggers), "1", "existing trigger reused, no duplicate");
  assert.equal(sql("legacy", "select prosecdef::text||':'||array_to_string(proconfig,',')||':'||has_function_privilege('anon',oid,'EXECUTE')::text||':'||has_function_privilege('authenticated',oid,'EXECUTE')::text from pg_proc where oid='public.handle_new_user()'::regprocedure;"),
    'true:search_path="":false:false');
  assert.equal(sql("legacy", "select string_agg(id||':'||public, ',' order by id) from storage.buckets;"), "fitmatch-v2:false,fitmatch-wardrobe:false", "both buckets private");

  // Auth provisioning now works through the existing trigger (auth admin role has no EXECUTE on it).
  assert.equal(signup("legacy", NEW, "new@example.test").ok, true);
  assert.equal(sql("legacy", `select email from fm_users where id='${NEW}';`), "new@example.test");
  assert.equal(sql("legacy", `select count(*) from fm_auth_identities;`), "1", "existing identity mapping untouched");
  // Wardrobe: FK to fm_users means an auth user without profile cannot own items; a provisioned one can.
  const orphanItem = tryDb("legacy", `set role authenticated; select set_config('request.jwt.claim.sub','${ORPHAN}',false);
    insert into fm_wardrobe_items(user_id,name,category) values ('${ORPHAN}','x','t-shirt');`);
  assert.match(orphanItem.err, /wardrobe_items_user_id_fkey/, "legacy FK target fm_users enforced");
  const item = as("legacy", "authenticated", NEW, `insert into fm_wardrobe_items(user_id,name,category,image_path) values ('${NEW}','New tee','t-shirt','${NEW}/tee.jpg') returning id;`).split("\n").pop();
  as("legacy", "authenticated", NEW, `update fm_wardrobe_items set color='white', style='minimal' where id='${item}';`);
  assert.equal(sql("legacy", `select coalesce(color,'-')||':'||coalesce(style,'-')||':'||(updated_at>created_at) from fm_wardrobe_items where id='${item}';`), "white:minimal:true", "upload with NULL attributes then update (trigger kept)");
  assert.equal(as("legacy", "authenticated", U2, `select count(*) from fm_wardrobe_items where id='${item}';`).split("\n").pop(), "0", "cross-owner wardrobe hidden");
  // Legacy outfit save/reopen exactly as the fixed route writes it.
  const saved = as("legacy", "authenticated", U1, `insert into fm_outfits(user_id,source_item_id,data_json,style_category,is_saved) values ('${U1}','${W1}','[{"id":"n1","styleCategory":"minimal"}]','minimal',true) returning id;`).split("\n").pop();
  assert.equal(as("legacy", "authenticated", U1, `select string_agg(style_category||':'||is_saved, ',' order by created_at) from fm_outfits where user_id='${U1}';`).split("\n").pop(), "minimal:true,minimal:true", "legacy row and new row reopen");
  assert.equal(as("legacy", "authenticated", U2, `select count(*) from fm_outfits where id in ('${saved}','${O1}');`).split("\n").pop(), "0", "cross-owner outfits hidden");
  const forged = tryDb("legacy", `set role authenticated; select set_config('request.jwt.claim.sub','${U2}',false);
    insert into fm_outfits(user_id,data_json,style_category) values ('${U1}','[]','casual');`);
  assert.match(forged.err, /row-level security/, "cannot write another owner's outfit");
  console.log("PASS legacy cutover (PG17): runner applied 11 + compat with per-step verification and refused a replay; data fingerprint unchanged; FK targets/cascades/legacy NOT NULL kept, no duplicates; signup provisions fm_users via the existing trigger; wardrobe NULL attributes + update; outfit save/reopen; cross-owner denied; buckets private; unrelated table untouched.");

  // Per-owner analysis on the legacy shape (NULL wardrobe attributes): reserve/enqueue/claim/result/confirm,
  // stale fencing, quota, cleanup claim and cross-owner denial.
  const snap = (n) => `d1d1d1d1-0000-4000-a000-00000000000${n}`;
  const shaA = "a".repeat(64), shaB = "b".repeat(64);
  const reserve = (user, it, src, s, asset) => service("legacy", `select fm_v2_analysis_reserve('${user}','${it}','${src}','${s}','qint.1','${asset}',100);`);
  const enq = (user, it, src, s, asset, a, j) => service("legacy", `select fm_v2_analysis_enqueue('${user}','${it}','${src}','${asset}','${s}','qint.1','${a}','${j}');`);
  assert.equal(JSON.parse(reserve(U1, W1, `${U1}/tee.jpg`, shaA, snap(1))).deduped, false);
  assert.throws(() => reserve(U2, W1, `${U1}/tee.jpg`, shaB, snap(2)), /ITEM_NOT_FOUND/, "another owner cannot reserve");
  const A1 = "e1e1e1e1-0000-4000-a000-000000000001", J1 = "f1f1f1f1-0000-4000-a000-000000000001";
  enq(U1, W1, `${U1}/tee.jpg`, shaA, snap(1), A1, J1);
  const caps = '{"garment.analyze":{"model":"Qwen/Qwen3-VL-4B-Instruct","revision":"r1"}}';
  const WK = "99999999-0000-4000-a000-000000000001", WK2 = "99999999-0000-4000-a000-000000000002";
  sql("legacy", `insert into fm_v2_workers(id,user_id,token_hash,name,last_seen,capabilities,allowed_capabilities) values
    ('${WK}','${U1}','h1','Q1',now(),'${caps}','{garment.analyze}'),('${WK2}','${U2}','h2','Q2',now(),'${caps}','{garment.analyze}');`);
  assert.equal(service("legacy", `select fm_v2_claim_r1('${WK2}',gen_random_uuid(),gen_random_uuid());`), "", "other owner's worker sees nothing");
  const job = JSON.parse(service("legacy", `select fm_v2_claim_r1('${WK}',gen_random_uuid(),gen_random_uuid());`));
  assert.equal(job.id, J1);
  const result = { contractVersion: "fitmatch.garment-analysis.result.v1",
    binding: { jobId: J1, analysisId: A1, itemId: W1, imageAssetId: snap(1), imageSha256: shaA },
    modelRevision: JSON.parse(caps)["garment.analyze"], policyRevision: "qint.1", rawOutputSha256: "c".repeat(64),
    outcome: "proposal", abstainReason: null,
    attributes: { category: "tshirt", dominantColors: ["white"], pattern: "solid", logoPresence: "none", neckline: "crew", sleeves: "short" },
    candidateLogoTexts: [], ocrStatus: "not_applicable", approvedForAutoApply: false,
    evidence: { attempts: 1, outputTokens: 50, durationMs: 1000, gpuMiB: null } };
  const text = JSON.stringify(result);
  const lit = (v) => "'" + v.replaceAll("'", "''") + "'";
  assert.equal(service("legacy", `select fm_v2_analysis_result('${WK}','${J1}','${job.lease_token}','${sha(text)}',${lit(text)},${lit(text)}::jsonb);`), "ok");
  assert.throws(() => service("legacy", `select fm_v2_analysis_confirm('${U2}','${A1}',gen_random_uuid(),'d','${sha(text)}','approve','{}','{"color":"white"}');`), /ANALYSIS_NOT_FOUND/, "another owner cannot confirm");
  assert.equal(JSON.parse(service("legacy", `select fm_v2_analysis_confirm('${U1}','${A1}',gen_random_uuid(),'d','${sha(text)}','approve','{}','{"color":"white"}');`)).status, "confirmed");
  assert.equal(sql("legacy", `select coalesce(color,'-')||':'||coalesce(style,'-') from fm_wardrobe_items where id='${W1}';`), "white:-", "only the approved column changed; NULL style kept");
  // Stale: item image edited while the second job runs -> result never applied.
  sql("legacy", `update fm_wardrobe_items set image_path='${U1}/tee2.jpg' where id='${W1}';`);
  reserve(U1, W1, `${U1}/tee2.jpg`, shaB, snap(3));
  const A2 = "e1e1e1e1-0000-4000-a000-000000000002", J2 = "f1f1f1f1-0000-4000-a000-000000000002";
  enq(U1, W1, `${U1}/tee2.jpg`, shaB, snap(3), A2, J2);
  const job2 = JSON.parse(service("legacy", `select fm_v2_claim_r1('${WK}',gen_random_uuid(),gen_random_uuid());`));
  sql("legacy", `update fm_wardrobe_items set image_path='${U1}/tee3.jpg' where id='${W1}';`);
  const r2 = { ...result, binding: { jobId: J2, analysisId: A2, itemId: W1, imageAssetId: snap(3), imageSha256: shaB } };
  const t2 = JSON.stringify(r2);
  assert.equal(service("legacy", `select fm_v2_analysis_result('${WK}','${job2.id}','${job2.lease_token}','${sha(t2)}',${lit(t2)},${lit(t2)}::jsonb);`), "stale");
  // Quota (20 active, shared) and cleanup claim on an aborted reservation.
  sql("legacy", `with m as (insert into fm_v2_models(id,user_id,kind,name) select gen_random_uuid(),'${U2}','avatar','q' from generate_series(1,20) returning id)
    insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash) select gen_random_uuid(),'${U2}',id,'avatar.reconstruct',id::text,id::text from m;`);
  assert.throws(() => reserve(U2, W2, `${U2}/jeans.jpg`, shaB, snap(4)), /QUOTA_EXCEEDED/);
  reserve(U1, W1, `${U1}/tee3.jpg`, "d".repeat(64), snap(5));
  assert.deepEqual(JSON.parse(service("legacy", `select fm_v2_analysis_abort('${U1}','${snap(5)}');`)), [`${U1}/analysis/${snap(5)}.jpg`]);
  const claimed = JSON.parse(service("legacy", `select fm_v2_source_cleanup_claim(gen_random_uuid(),100,300);`)).map((x) => x.path);
  assert.ok(claimed.includes(`${U1}/analysis/${snap(5)}.jpg`) && !claimed.includes(`${U1}/analysis/${snap(1)}.jpg`), "aborted snapshot claimed, confirmed analysis snapshot never");
  for (const role of ["anon", "authenticated"])
    assert.equal(tryDb("legacy", `set role ${role}; select fm_v2_analysis_reserve('${U1}','${W1}','x','${shaA}','qint.1','${snap(6)}',1);`).ok, false, `${role} cannot call reserve`);
  console.log("PASS legacy per-owner analysis: reserve/enqueue/claim/result/confirm with NULL attributes, cross-owner reserve/claim/confirm denied, stale result fenced, shared quota, abort+cleanup claim (confirmed snapshot never claimed), browser roles denied.");

  // Refusals: guarded migration aborts (whole transaction) on unexpected shapes.
  const compatSql = file("supabase/migrations/20261109093355_legacy_compat_auth_outfits.sql");
  sql("refuse_trigger", "create table public.other_users(id uuid, email text); create trigger stray after insert on public.other_users for each row execute function public.handle_new_user();");
  sql("refuse_column", "alter table public.fm_users add column plan text not null default 'x'; alter table public.fm_users alter column plan drop default;");
  sql("refuse_forced", "alter table public.fm_users force row level security;");
  for (const [db, pattern] of [["refuse_trigger", /unexpected trigger callers: public\.other_users:stray/], ["refuse_column", /required columns without defaults: plan/],
    ["refuse_forced", /FORCE ROW LEVEL SECURITY/]]) {
    const r = tryDb(db, compatSql);
    assert.equal(r.ok, false, db);
    assert.match(r.err, pattern);
    assert.match(sql(db, "select prosrc from pg_proc where oid='public.handle_new_user()'::regprocedure;"), /public\.users/, `${db}: nothing changed`);
  }
  // Runner refuses a partially present step instead of replaying it.
  sql("refuse_partial", "create table public.fm_ai_daily_usage(user_id uuid, day date, units int);");
  const partial = runner("refuse_partial", ["--execute"]);
  assert.equal(partial.status, 4, partial.stdout + partial.stderr);
  assert.match(partial.stderr, /20261104_ai_daily_quota\.sql precondition failed .*table:public\.fm_ai_daily_usage: already exists/);
  // The compatibility migration itself is rerunnable: same function OID, still one trigger.
  const oid = sql("legacy", "select 'public.handle_new_user()'::regprocedure::oid;");
  sql("legacy", compatSql);
  assert.equal(sql("legacy", "select 'public.handle_new_user()'::regprocedure::oid;"), oid);
  assert.equal(sql("legacy", handleNewUserTriggers), "1");
  console.log("PASS refusals: unexpected trigger caller / required column / forced RLS abort the compat migration with nothing changed; runner refuses a partially present step; compat rerun is a no-op (same OID, one trigger).");

  // ---------------- fresh baseline (supabase/schema.sql + whole chain) ----------------
  sql("postgres", "create database fresh;");
  sql("fresh", `create schema extensions; create extension pgcrypto schema extensions;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role; -- hosted Supabase defaults
        create schema auth; grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb); grant insert, select on auth.users to supabase_auth_admin;
    create schema storage; grant usage on schema storage to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;`);
  sql("fresh", file("supabase/schema.sql"));
  sql("fresh", file("supabase/migrations/20261103_app_system_identity.sql"));
  const freshNoStyle = tryDb("fresh", `insert into auth.users(id,email) values ('${U1}','f1@example.test');
    set role service_role; insert into fm_outfits(user_id,data_json,style_category) values ('${U1}','[]','minimal');`);
  assert.match(freshNoStyle.err, /column "style_category" of relation "fm_outfits" does not exist/, "REPRODUCED: fresh schema lacks the column the fixed route writes");
  const freshRun = runner("fresh", ["--execute"]);
  assert.equal(freshRun.status, 0, freshRun.stdout + freshRun.stderr);
  assert.equal((freshRun.stdout.match(/APPLIED\+VERIFIED/g) ?? []).length, 12);
  const freshSteps = Object.values(steps("fresh")).filter((s) => !["applied", "no-objects"].includes(s.status));
  assert.deepEqual(freshSteps.map((s) => ({ file: s.file, status: s.status, missing: s.missing, different: s.different })), [], "fresh project reads applied for every step");
  assert.equal(signup("fresh", U2, "f2@example.test").ok, true);
  assert.equal(sql("fresh", `select count(*) from fm_users where id in ('${U1}','${U2}');`), "2", "fresh provisioning intact");
  as("fresh", "authenticated", U2, `insert into fm_outfits(user_id,data_json,style_category,is_saved) values ('${U2}','[{"id":"f","styleCategory":"formal"}]','formal',true);`);
  assert.equal(as("fresh", "authenticated", U2, `select style_category||':'||is_saved from fm_outfits where user_id='${U2}';`).split("\n").pop(), "formal:true");
  assert.equal(sql("fresh", "select attnotnull from pg_attribute where attrelid='public.fm_outfits'::regclass and attname='style_category';"), "f", "fresh column added nullable (no backfill)");
  assert.equal(sql("fresh", handleNewUserTriggers), "1");
  console.log("PASS fresh baseline (PG17): schema.sql + identity + runner (11 + compat) all applied; provisioning, outfit save with style_category/is_saved, one trigger.");
  console.log("PASS CL-MIGRATION-26 legacy/fresh compatibility on PostgreSQL 17 (synthetic data; not a cloud restore).");
} finally {
  spawnSync("docker", ["rm", "-f", container], { stdio: "pipe" });
}
