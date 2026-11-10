#!/usr/bin/env node
/**
 * APP-RECOVERY-32 — LOCAL, DISPOSABLE, SYNTHETIC backup → restore → cutover rehearsal.
 *
 *   npm run test:restore-rehearsal            (needs Docker + image postgres:17-alpine; no network, no secrets)
 *   SUPABASE_CLI="npx -y supabase@3.0.0"      (default) — only `db dump --dry-run` is used, to obtain the
 *                                              CLI's own pg_dumpall/pg_dump scripts; nothing connects anywhere.
 *
 * Two throw-away PostgreSQL 17 containers (--network none): SOURCE = Supabase-like platform stub + the
 * canonical legacy FitMatch shape + synthetic users/wardrobe/outfits/identity/refresh + private storage
 * metadata; TARGET = a fresh Supabase-like project (platform stub only). Storage object BYTES live in a local
 * directory (stand-in for `supabase storage cp`), never in SQL.
 *
 * Stages (each prints PASS or throws):
 *   1 backup    roles.sql / schema.sql / data.sql produced by the CLI 3.0.0 dump scripts (pg_dump run in the
 *               source container), auth/storage customizations captured separately, storage bytes copied,
 *               BACKUP-MANIFEST.json (file sha256, storage sha256/size per object, business fingerprint).
 *   2 verify    verify-backup.mjs: completeness, hashes, storage rows ⇄ bytes, before any restore.
 *   3 restore   preflight (fresh target, role conflicts) → psql --single-transaction ON_ERROR_STOP
 *               roles → schema → session_replication_role=replica → data; then customizations; bytes copied.
 *   4 compare   business fingerprint, counts, storage rows+bytes, full catalog inventory source == restored.
 *   5 cutover   runner dry run (12 would apply) → --execute → preserved data / FKs / nullability /
 *               style_category / is_saved / identity / refresh / private buckets → signup, outfit save+reopen,
 *               cross-owner denial; storage bytes unchanged.
 *   6 faults    truncated/missing dump, missing or corrupted Storage bytes, pre-existing custom role, non-fresh
 *               target, restore SQL error (atomic rollback), forgotten auth/storage customizations.
 *
 * This is NOT a backup of the canonical project and NOT hosted Auth/Storage. It proves the procedure.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { flattenInventory } from "../schema-inventory-lib.mjs";
import { verifyBackup } from "./verify-backup.mjs";
import { writeManifest } from "./write-backup-manifest.mjs";

const IMAGE = process.env.REHEARSAL_PG_IMAGE ?? "postgres:17-alpine";
const CLI = (process.env.SUPABASE_CLI ?? "npx -y supabase@3.0.0").split(" ").filter(Boolean);
const tag = `${process.pid}`;
const SRC = `fm-rehearse-src-${tag}`, DST = `fm-rehearse-dst-${tag}`;
const containers = [];
const work = mkdtempSync(join(tmpdir(), "fm-restore-rehearsal-"));
chmodSync(work, 0o700);
const file = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const md5 = (b) => createHash("md5").update(b).digest("hex");

// ---------- docker / psql helpers (local containers only) ----------
const psqlArgs = (c, db = "postgres", extra = []) => ["exec", "-i", c, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-Atq", ...extra];
const sql = (c, s, db = "postgres") => execFileSync("docker", psqlArgs(c, db), { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const trySql = (c, s, db = "postgres") => {
  const r = spawnSync("docker", psqlArgs(c, db), { input: s, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: r.stderr || "" };
};
const last = (s) => s.split("\n").pop();
const as = (c, user, s) => last(sql(c, `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false); ${s}`));
async function startPg(name) {
  execFileSync("docker", ["run", "--rm", "--detach", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE], { stdio: "pipe" });
  containers.push(name);
  for (let i = 0; i < 100; i++) {
    if (spawnSync("docker", ["exec", name, "psql", "-h", "127.0.0.1", "-U", "postgres", "-c", "select 1"], { stdio: "pipe" }).status === 0) {
      assert.match(sql(name, "select version();"), /PostgreSQL 17\./);
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${name} not ready`);
}
const inventory = (c) => {
  const raw = JSON.parse(sql(c, file("scripts/schema-inventory.sql")));
  raw.buckets = JSON.parse(sql(c, "select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id),'[]') from storage.buckets;"));
  return flattenInventory(raw);
};

// ---------- synthetic data ----------
const U1 = "d1d1d1d1-0000-4000-a000-000000000001", U2 = "d1d1d1d1-0000-4000-a000-000000000002";
const NEW = "d1d1d1d1-0000-4000-a000-000000000003";
const W1 = "e1e1e1e1-0000-4000-a000-000000000001", W2 = "e1e1e1e1-0000-4000-a000-000000000002", W3 = "e1e1e1e1-0000-4000-a000-000000000003";
const O1 = "f1f1f1f1-0000-4000-a000-000000000001";
const objects = [ // private bucket, owner-prefixed paths, synthetic bytes only
  { name: `${U1}/tee.jpg`, owner: U1, size: 48_213, mime: "image/jpeg" },
  { name: `${U1}/analysis/snapshot.jpg`, owner: U1, size: 7_001, mime: "image/jpeg" },
  { name: `${U2}/jeans.png`, owner: U2, size: 131_072, mime: "image/png" },
].map((o) => ({ ...o, bytes: randomBytes(o.size) }));
const SEED = () => `
create role fitmatch_rehearsal_reader nologin;           -- a CUSTOM role: must travel in roles.sql
grant select on public.fm_users to fitmatch_rehearsal_reader;
set session_replication_role = replica;                  -- existing users predate the trigger rename
insert into auth.users(id,email) values ('${U1}','r1@example.test'),('${U2}','r2@example.test');
set session_replication_role = origin;
insert into fm_users(id,email,style_profile,quiz_answers) values
  ('${U1}','r1@example.test','{"primaryStyle":"minimal"}','{"ageRange":"18-24"}'),('${U2}','r2@example.test',null,null);
insert into fm_wardrobe_items(id,user_id,name,category,color,style,image_path) values
  ('${W1}','${U1}','Synthetic tee','t-shirt',null,null,'${objects[0].name}'),
  ('${W2}','${U2}','Synthetic jeans','jeans','blue','casual','${objects[2].name}'),
  ('${W3}','${U1}','No photo','shirt','white',null,null);
insert into fm_outfits(id,user_id,source_item_id,data_json,style_category,is_saved) values
  ('${O1}','${U1}','${W1}','[{"id":"legacy","styleCategory":"minimal"}]','minimal',true),
  (gen_random_uuid(),'${U2}',null,'[{"id":"legacy2","styleCategory":"casual"}]','casual',false);
insert into fm_auth_identities(issuer,app_id,subject,user_id) values ('https://hub.example','fitmatch','sub-r1','${U1}'),('https://hub.example','fitmatch','sub-r2','${U2}');
insert into fm_auth_refreshes(refresh_hash,owner_id,sealed_result) values ('${"a".repeat(64)}','${U1}','sealed-synthetic');
insert into public.lifedashboard_entries(note) values ('unrelated sentinel');
insert into storage.objects(bucket_id,name,owner,metadata) values
${objects.map((o) => `  ('fitmatch-wardrobe','${o.name}','${o.owner}','{"size":${o.size},"mimetype":"${o.mime}","eTag":"\\"${md5(o.bytes)}\\""}')`).join(",\n")};`;

/** Platform grant every Supabase project has (not in the shared stub, not in any dump): applied to source and targets. */
const PLATFORM_EXTRA = "grant select, insert, update, delete on storage.objects to authenticated, service_role;";
/** The runbook's own read-only queries (single source of truth for the real backup and this rehearsal). */
const business = (c) => { const [fingerprint, counts] = sql(c, file("scripts/migration-cutover/business-fingerprint.sql")).split("\n"); return { fingerprint, counts }; };
const fingerprintOf = (c) => business(c).fingerprint;

// ---------- backup with the CLI's own dump scripts ----------
function cliDumpScript(flags) {
  const out = execFileSync(CLI[0], [...CLI.slice(1), "db", "dump", "--dry-run", "--remote=postgresql://postgres:rehearsal@127.0.0.1:5432/postgres", ...flags], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const script = out.slice(out.indexOf("#!/usr/bin/env bash"));
  assert.ok(script.startsWith("#!/usr/bin/env bash") && /pg_dump/.test(script), "CLI printed a dump script");
  return script;
}
function runDump(container, script, outFile) {
  const shim = `pg_dump() { docker exec -i -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE ${container} pg_dump "$@"; }
pg_dumpall() { docker exec -i -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE ${container} pg_dumpall "$@"; }
export -f pg_dump pg_dumpall`;
  const path = join(work, `dump-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(path, script, { mode: 0o700 });
  const r = spawnSync("bash", ["-c", `${shim}\nbash "${path}"`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  writeFileSync(outFile, r.stdout, { mode: 0o600 });
}
function backup(dir) {
  mkdirSync(join(dir, "storage"), { recursive: true, mode: 0o700 });
  runDump(SRC, scripts.roles, join(dir, "roles.sql"));
  runDump(SRC, scripts.schema, join(dir, "schema.sql"));
  runDump(SRC, scripts.data, join(dir, "data.sql"));
  writeFileSync(join(dir, "auth-storage-custom.sql"), sql(SRC, file("scripts/migration-cutover/capture-managed-customizations.sql")) + "\n", { mode: 0o600 });
  // Stand-in for `supabase storage cp -r ss:///<bucket> ./storage/<bucket> --remote=<ref>` (bytes, not SQL).
  for (const [rel, bytes] of srcStorage) {
    const p = join(dir, "storage", rel);
    mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
    writeFileSync(p, bytes, { mode: 0o600 });
  }
  writeManifest(dir, { business: business(SRC), tools: { cli: cliVersion, pgDump: execFileSync("docker", ["exec", SRC, "pg_dump", "--version"], { encoding: "utf8" }).trim(), synthetic: true } });
}
const listStorage = (root) => {
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else { const b = readFileSync(p); out.push({ path: relative(root, p), size: b.length, sha256: sha(b), md5: md5(b) }); }
  } };
  if (existsSync(root)) walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
};

// ---------- restore ----------
const RESERVED = /^(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_.*|pgtle_admin)$/;
function restorePreflight(c, dir, allowExistingRoles = []) {
  const problems = [];
  const fresh = trySql(c, file("scripts/migration-cutover/restore-preflight.sql")); // the runbook's preflight
  if (!fresh.ok) problems.push((fresh.err.match(/ERROR:\s+(.*)/) ?? [, fresh.err])[1]);
  const roles = [...readFileSync(join(dir, "roles.sql"), "utf8").matchAll(/^CREATE ROLE "([^"]+)"/gm)].map((m) => m[1]);
  const reservedInFile = roles.filter((r) => RESERVED.test(r));
  if (reservedInFile.length) problems.push(`roles.sql creates reserved roles (CLI filter missing?): ${reservedInFile}`);
  const existing = roles.length ? sql(c, `select coalesce(string_agg(rolname, ',' order by rolname), '') from pg_roles where rolname in (${roles.map((r) => `'${r.replace(/'/g, "''")}'`).join(",")});`).split(",").filter(Boolean) : [];
  const conflicts = existing.filter((r) => !allowExistingRoles.includes(r));
  if (conflicts.length) problems.push(`custom role(s) already exist on target: ${conflicts.join(", ")} — verify they are equivalent, then pass them explicitly`);
  return { ok: problems.length === 0, problems, roles, existing };
}
/**
 * R-RESTORE-ACL-32: pg_dump writes each object's ACL relative to the built-in default, but a Supabase project
 * has ALTER DEFAULT PRIVILEGES (postgres, schema public) granting ALL to anon/authenticated/service_role. Objects
 * re-created by schema.sql would silently get those grants back although the source had REVOKEd them (e.g.
 * fm_auth_* tables and SECURITY DEFINER functions). The target's default ACLs are therefore switched off INSIDE
 * the restore transaction and restored exactly at its end, so restored ACLs equal the dumped ACLs.
 */
function defaultAclSql(c, mode) { // the runbook's generator, run against the target
  return execFileSync("docker", [...psqlArgs(c), "-v", `mode=${mode}`], { input: file("scripts/migration-cutover/default-acl.sql"), encoding: "utf8" }) + "\n";
}
function restore(c, dir, { allowExistingRoles = [], skipCustom = false, neutralizeDefaultAcl = true } = {}) {
  const pre = restorePreflight(c, dir, allowExistingRoles);
  if (!pre.ok) return { ok: false, stage: "preflight", problems: pre.problems };
  // Only the CREATE ROLE line of an explicitly allowed, pre-existing role is skipped; ALTER/GRANT lines still run.
  let roles = readFileSync(join(dir, "roles.sql"), "utf8");
  for (const r of pre.existing) roles = roles.replace(new RegExp(`^CREATE ROLE "${r}";$`, "m"), `-- already present, verified equivalent: CREATE ROLE "${r}";`);
  const staged = join(dir, ".roles-for-restore.sql");
  writeFileSync(staged, roles, { mode: 0o600 });
  // Official restore command shape (Supabase backup/restore guide): one transaction, stop at the first error,
  // triggers off while loading data. Files are copied into the throw-away container and run with -f.
  const inC = `/tmp/restore-${Math.random().toString(36).slice(2)}`;
  execFileSync("docker", ["exec", c, "mkdir", "-p", inC]);
  const off = join(dir, ".default-acl-off.sql"), on = join(dir, ".default-acl-on.sql");
  writeFileSync(off, neutralizeDefaultAcl ? defaultAclSql(c, "off") : "\n", { mode: 0o600 });
  writeFileSync(on, neutralizeDefaultAcl ? defaultAclSql(c, "on") : "\n", { mode: 0o600 });
  for (const [src, dst] of [[staged, "roles.sql"], [off, "acl-off.sql"], [join(dir, "schema.sql"), "schema.sql"], [on, "acl-on.sql"], [join(dir, "data.sql"), "data.sql"]])
    execFileSync("docker", ["cp", src, `${c}:${inC}/${dst}`]);
  rmSync(off); rmSync(on);
  const r = spawnSync("docker", ["exec", c, "psql", "-U", "postgres", "-d", "postgres", "--single-transaction", "--variable", "ON_ERROR_STOP=1", "-q",
    "--file", `${inC}/roles.sql`, "--file", `${inC}/acl-off.sql`, "--file", `${inC}/schema.sql`, "--file", `${inC}/acl-on.sql`,
    "--command", "SET session_replication_role = replica", "--file", `${inC}/data.sql`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  rmSync(staged);
  if (r.status !== 0) return { ok: false, stage: "sql", error: (r.stderr || "").split("\n").find((l) => l.includes("ERROR")) ?? r.stderr };
  if (/ERROR/.test(r.stderr || "")) return { ok: false, stage: "sql", error: r.stderr };
  if (!skipCustom) {
    const custom = trySql(c, readFileSync(join(dir, "auth-storage-custom.sql"), "utf8"));
    if (!custom.ok) return { ok: false, stage: "custom", error: custom.err };
  }
  return { ok: true };
}

// ---------- main ----------
const log = [];
const pass = (m) => { log.push(m); console.log("PASS " + m); };
let scripts, cliVersion, srcStorage;
try {
  cliVersion = execFileSync(CLI[0], [...CLI.slice(1), "--version"], { encoding: "utf8" }).trim();
  assert.equal(cliVersion, "3.0.0", "Supabase CLI 3.0.0 (the version the runbook pins)");
  scripts = { roles: cliDumpScript(["--role-only"]), schema: cliDumpScript([]), data: cliDumpScript(["--data-only", "--use-copy"]) };
  assert.match(scripts.data, /--exclude-schema "[^"]*\bextensions\b[^"]*"/, "data dump skips platform schemas");
  assert.doesNotMatch(scripts.data.match(/--exclude-schema "([^"]*)"/)[1], /(^|\|)(auth|storage)(\||$)/, "data dump INCLUDES auth and storage rows");
  assert.match(scripts.schema.match(/--exclude-schema "([^"]*)"/)[1], /(^|\|)auth\|/, "schema dump EXCLUDES auth/storage objects");
  pass(`CLI ${cliVersion} dump scripts obtained with --dry-run: data dump includes auth/storage rows, schema dump excludes auth/storage/extensions objects`);

  await startPg(SRC);
  sql(SRC, file("scripts/fixtures/legacy-canonical-shape.sql"));
  sql(SRC, PLATFORM_EXTRA);
  sql(SRC, file("supabase/migrations/20261103_app_system_identity.sql"));
  sql(SRC, SEED());
  srcStorage = new Map(objects.map((o) => [`fitmatch-wardrobe/${o.name}`, o.bytes]));
  const { fingerprint: srcFingerprint, counts: srcCounts } = business(SRC), srcInventory = inventory(SRC);

  // 1 backup
  const B = join(work, "backup");
  backup(B);
  const roles = readFileSync(join(B, "roles.sql"), "utf8");
  assert.match(roles, /^CREATE ROLE "fitmatch_rehearsal_reader";$/m, "custom role is in roles.sql");
  assert.doesNotMatch(roles, /^CREATE ROLE "(anon|authenticated|service_role|postgres|supabase_auth_admin)"/m, "reserved roles filtered by the CLI script");
  const schemaSql = readFileSync(join(B, "schema.sql"), "utf8");
  assert.doesNotMatch(schemaSql, /on_auth_user_created/, "auth trigger NOT in schema.sql (auth schema excluded)");
  assert.doesNotMatch(schemaSql, /wardrobe_storage_own/, "storage policy NOT in schema.sql (storage schema excluded)");
  assert.match(readFileSync(join(B, "data.sql"), "utf8"), /COPY "auth"\."users"/, "auth.users rows ARE in data.sql");
  const custom = readFileSync(join(B, "auth-storage-custom.sql"), "utf8");
  assert.match(custom, /CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth\.users/);
  assert.match(custom, /create policy wardrobe_storage_own on storage\.objects/);
  pass("backup: roles/schema/data via CLI scripts, auth/storage customizations captured separately (absent from schema.sql), 3 storage objects copied as bytes, manifest written");

  // 2 verify
  const v = verifyBackup(B);
  assert.equal(v.ok, true, v.problems.join("; "));
  pass(`verify-backup: ${v.checks.length} checks (hashes, completeness markers, storage rows ⇄ bytes ⇄ metadata size/eTag)`);

  // 3 restore into a fresh Supabase-like target
  await startPg(DST);
  sql(DST, file("scripts/fixtures/supabase-platform-stub.sql") + PLATFORM_EXTRA);
  const r = restore(DST, B);
  assert.equal(r.ok, true, JSON.stringify(r));
  const dstStorage = join(work, "restored-storage");
  for (const o of listStorage(join(B, "storage"))) { // stand-in for uploading bytes to the new project's Storage
    mkdirSync(dirname(join(dstStorage, o.path)), { recursive: true, mode: 0o700 });
    copyFileSync(join(B, "storage", o.path), join(dstStorage, o.path));
  }
  pass("restore: preflight (fresh target, no role conflicts) → single transaction roles+schema+replica data → auth/storage customizations → bytes");

  // 4 compare
  assert.equal(fingerprintOf(DST), srcFingerprint, "business fingerprint identical after restore");
  assert.equal(business(DST).counts, srcCounts);
  const restoredInv = inventory(DST);
  const diff = [...new Set([...Object.keys(srcInventory), ...Object.keys(restoredInv)])].filter((k) => JSON.stringify(srcInventory[k]) !== JSON.stringify(restoredInv[k]));
  assert.deepEqual(diff, [], "catalog inventory (public/auth/storage incl. triggers, policies, grants, buckets) identical");
  assert.deepEqual(listStorage(dstStorage).map(({ path, sha256 }) => [path, sha256]), [...srcStorage].map(([p, b]) => [p, sha(b)]).sort((a, b) => a[0].localeCompare(b[0])));
  const metaRows = JSON.parse(sql(DST, "select json_agg(json_build_object('path',bucket_id||'/'||name,'size',(metadata->>'size')::int,'etag',metadata->>'eTag') order by bucket_id||'/'||name) from storage.objects;"));
  for (const m of metaRows) {
    const bytes = readFileSync(join(dstStorage, m.path));
    assert.equal(bytes.length, m.size); assert.equal(m.etag, `"${md5(bytes)}"`);
  }
  pass(`compare: fingerprint ${srcFingerprint} and counts (${srcCounts}) equal, full catalog inventory equal (${Object.keys(srcInventory).length} keys), storage bytes sha256 equal and match restored metadata`);

  // 5 cutover on the restored copy
  const runner = (extra = []) => spawnSync(process.execPath, ["scripts/migration-cutover/apply.mjs", "--plan", "docs/infrastructure/canonical-cutover/cutover-plan.json",
    "--expected-ref", "gohczmqykjkrgdblgbog", "--isolated-test", "--audit", join(work, "audit"), "--psql", `docker exec -i ${DST} psql -U postgres`, ...extra],
  { encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://postgres@127.0.0.1/postgres" } });
  const dry = runner();
  assert.equal(dry.status, 0, dry.stderr + dry.stdout);
  assert.equal((dry.stdout.match(/would apply/g) ?? []).length, 12);
  assert.equal(fingerprintOf(DST), srcFingerprint, "dry run changed nothing");
  const run = runner(["--execute"]);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal((run.stdout.match(/APPLIED\+VERIFIED/g) ?? []).length, 12);
  assert.equal(fingerprintOf(DST), srcFingerprint, "business data unchanged by the cutover");
  assert.equal(sql(DST, "select string_agg(conname||'>'||confrelid::regclass::text||':'||confdeltype::text, ',' order by conname) from pg_constraint where conrelid in ('public.fm_wardrobe_items'::regclass,'public.fm_outfits'::regclass) and contype='f';"),
    "outfits_source_item_id_fkey>fm_wardrobe_items:n,outfits_user_id_fkey>fm_users:c,wardrobe_items_user_id_fkey>fm_users:c", "owner FKs to fm_users kept");
  assert.equal(sql(DST, "select attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'none') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.fm_outfits'::regclass and a.attname='style_category';"), "true:none");
  assert.equal(sql(DST, "select string_agg(attname||':'||attnotnull, ',' order by attname) from pg_attribute where attrelid='public.fm_wardrobe_items'::regclass and attname in ('color','style');"), "color:false,style:false");
  assert.equal(sql(DST, `select count(*) from fm_auth_identities where user_id in ('${U1}','${U2}');`), "2");
  assert.equal(sql(DST, `select owner_id||':'||sealed_result from fm_auth_refreshes;`), `${U1}:sealed-synthetic`);
  assert.equal(sql(DST, "select string_agg(id||':'||public, ',' order by id) from storage.buckets;"), "fitmatch-v2:false,fitmatch-wardrobe:false");
  // App paths on the restored + migrated copy. The new signup is excluded from the preserved-data fingerprint.
  assert.equal(trySql(DST, `set role supabase_auth_admin; insert into auth.users(id,email) values ('${NEW}','new@example.test');`).ok, true);
  assert.equal(sql(DST, `select email from fm_users where id='${NEW}';`), "new@example.test", "signup provisions fm_users (restored trigger + compat fix)");
  const saved = as(DST, U1, `insert into fm_outfits(user_id,source_item_id,data_json,style_category,is_saved) values ('${U1}','${W1}','[{"id":"n1","styleCategory":"minimal"}]','minimal',true) returning id;`);
  assert.equal(as(DST, U1, `select string_agg(style_category||':'||is_saved, ',' order by created_at) from fm_outfits where user_id='${U1}';`), "minimal:true,minimal:true", "legacy + new outfit reopen");
  assert.equal(as(DST, U2, `select count(*) from fm_outfits where id in ('${saved}','${O1}');`), "0", "cross-owner outfits hidden");
  assert.equal(as(DST, U2, `select count(*) from storage.objects where owner='${U1}';`), "0", "cross-owner storage rows hidden");
  assert.equal(sql(DST, `select md5(string_agg(t,'|' order by t)) from (select 'u:'||row(id,email,style_profile,quiz_answers,created_at,updated_at)::text t from fm_users where id<>'${NEW}') x;`),
    sql(SRC, "select md5(string_agg(t,'|' order by t)) from (select 'u:'||row(id,email,style_profile,quiz_answers,created_at,updated_at)::text t from fm_users) x;"), "pre-existing profiles unchanged after signup");
  assert.deepEqual(listStorage(dstStorage).map((o) => o.sha256), listStorage(join(B, "storage")).map((o) => o.sha256), "bytes unchanged by cutover");
  pass("cutover on restored copy: dry run 12 pending/no change → execute 12 applied+verified → business fingerprint unchanged; owner FKs→fm_users, nullable color/style, legacy style_category NOT NULL kept; identity+refresh kept; buckets private; signup provisions fm_users; outfit save/reopen; cross-owner denied; bytes unchanged");

  // 6 faults — each must be caught BEFORE the canonical cutover would proceed
  const variant = (name, mutate) => { // copy of the good backup with one defect
    const d = join(work, `fault-${name}`);
    execFileSync("cp", ["-a", B, d]);
    mutate(d);
    return d;
  };
  const truncated = variant("truncated", (d) => { const t = readFileSync(join(d, "data.sql")); writeFileSync(join(d, "data.sql"), t.subarray(0, Math.floor(t.length * 0.6))); });
  let fv = verifyBackup(truncated);
  assert.equal(fv.ok, false); assert.ok(fv.problems.some((p) => /data\.sql.*(sha256|RESET ALL)/.test(p)), fv.problems.join("; "));
  const truncatedNoManifestCheck = verifyBackup(truncated, { trustManifestHashes: false }); // even if the manifest were regenerated
  assert.equal(truncatedNoManifestCheck.ok, false, "completeness marker alone catches truncation");
  const missing = variant("missing", (d) => rmSync(join(d, "data.sql")));
  fv = verifyBackup(missing); assert.equal(fv.ok, false); assert.ok(fv.problems.some((p) => /data\.sql.*missing/.test(p)));
  const noBytes = variant("no-bytes", (d) => rmSync(join(d, "storage", `fitmatch-wardrobe/${objects[2].name}`)));
  fv = verifyBackup(noBytes); assert.equal(fv.ok, false); assert.ok(fv.problems.some((p) => p.includes(objects[2].name)), fv.problems.join("; "));
  const corrupt = variant("corrupt-bytes", (d) => { const p = join(d, "storage", `fitmatch-wardrobe/${objects[0].name}`); const b = readFileSync(p); b[100] ^= 0xff; writeFileSync(p, b); });
  fv = verifyBackup(corrupt); assert.equal(fv.ok, false); assert.ok(fv.problems.some((p) => p.includes(objects[0].name)));
  const notCopied = variant("storage-not-copied", (d) => { rmSync(join(d, "storage"), { recursive: true }); mkdirSync(join(d, "storage")); const m = JSON.parse(readFileSync(join(d, "BACKUP-MANIFEST.json"))); m.storage = []; writeFileSync(join(d, "BACKUP-MANIFEST.json"), JSON.stringify(m)); });
  fv = verifyBackup(notCopied); assert.equal(fv.ok, false, "storage rows in data.sql without any bytes are caught even with a consistent (empty) storage manifest");
  pass("faults (backup): truncated data.sql, missing data.sql, missing object bytes, corrupted object bytes, Storage never copied — all refused by verify-backup before restore");

  // restore-side faults on fresh disposable targets
  const T1 = `fm-rehearse-t1-${tag}`; await startPg(T1); sql(T1, file("scripts/fixtures/supabase-platform-stub.sql") + PLATFORM_EXTRA);
  sql(T1, "create role fitmatch_rehearsal_reader nologin;");
  let rr = restore(T1, B);
  assert.equal(rr.ok, false); assert.equal(rr.stage, "preflight"); assert.match(rr.problems.join(" "), /fitmatch_rehearsal_reader/);
  const raw = trySql(T1, readFileSync(join(B, "roles.sql"), "utf8") + readFileSync(join(B, "schema.sql"), "utf8"));
  assert.equal(raw.ok, false); assert.match(raw.err, /role "fitmatch_rehearsal_reader" already exists/, "without preflight the restore stops on the role");
  assert.equal(sql(T1, "select count(*) from pg_tables where schemaname='public';"), "0", "ON_ERROR_STOP left the target untouched");
  rr = restore(T1, B, { allowExistingRoles: ["fitmatch_rehearsal_reader"] });
  assert.equal(rr.ok, true, JSON.stringify(rr));
  assert.equal(fingerprintOf(T1), srcFingerprint, "explicitly allowed equivalent role: only its CREATE line skipped, grants applied");
  assert.equal(sql(T1, "select has_table_privilege('fitmatch_rehearsal_reader','public.fm_users','select');"), "t");
  rr = restore(T1, B); // now non-fresh
  assert.equal(rr.ok, false); assert.match(rr.problems.join(" "), /not fresh/);
  const T2 = `fm-rehearse-t2-${tag}`; await startPg(T2); sql(T2, file("scripts/fixtures/supabase-platform-stub.sql") + PLATFORM_EXTRA);
  const badData = variant("sql-error", (d) => writeFileSync(join(d, "data.sql"), readFileSync(join(d, "data.sql"), "utf8").replace(/^COPY "public"\."fm_outfits".*$/m, (l) => l + "\nnot-a-valid-row")));
  rr = restore(T2, badData);
  assert.equal(rr.ok, false); assert.equal(rr.stage, "sql");
  assert.equal(sql(T2, "select count(*) from pg_tables where schemaname='public';") + ":" + sql(T2, "select count(*) from pg_roles where rolname='fitmatch_rehearsal_reader';") + ":" + sql(T2, "select count(*) from auth.users;"), "0:0:0", "single transaction: nothing half-restored");
  rr = restore(T2, B, { skipCustom: true }); // operator forgets the auth/storage customizations
  assert.equal(rr.ok, true);
  const T3 = `fm-rehearse-t3-${tag}`; await startPg(T3); sql(T3, file("scripts/fixtures/supabase-platform-stub.sql") + PLATFORM_EXTRA);
  const defaultsBefore = sql(T3, "select md5(coalesce(string_agg(defaclacl::text, ',' order by defaclobjtype), '')) from pg_default_acl;");
  rr = restore(T3, B, { neutralizeDefaultAcl: false }); // literal official command
  assert.equal(rr.ok, true);
  const regranted = Object.keys(srcInventory).filter((k) => JSON.stringify(srcInventory[k]) !== JSON.stringify(inventory(T3)[k]));
  assert.ok(regranted.includes("grant:public.fm_auth_identities") && regranted.some((k) => k.startsWith("function:public.fm_begin_auth_refresh")), regranted.join(","));
  assert.equal(sql(SRC, "select has_function_privilege('anon','public.fm_begin_auth_refresh(text,uuid)','execute')::text || has_table_privilege('anon','public.fm_auth_identities','select')::text"), "falsefalse");
  assert.equal(sql(T3, "select has_function_privilege('anon','public.fm_begin_auth_refresh(text,uuid)','execute')::text || has_table_privilege('anon','public.fm_auth_identities','select')::text"), "truetrue",
    "R-RESTORE-ACL-32: literal restore re-grants revoked privileges to anon via the target's default ACLs");
  assert.equal(sql(DST, "select has_function_privilege('anon','public.fm_begin_auth_refresh(text,uuid)','execute')::text || has_table_privilege('anon','public.fm_auth_identities','select')::text"), "falsefalse", "neutralized restore keeps the source ACLs");
  assert.equal(sql(DST, "select md5(coalesce(string_agg(defaclacl::text, ',' order by defaclobjtype), '')) from pg_default_acl;"), defaultsBefore, "target default ACLs restored exactly at the end of the restore transaction");
  const missingCustom = Object.keys(srcInventory).filter((k) => !(k in inventory(T2)));
  assert.ok(missingCustom.some((k) => k.includes("on_auth_user_created")) && missingCustom.some((k) => k.includes("wardrobe_storage_own")), missingCustom.join(","));
  pass(`faults (restore): pre-existing custom role refused by preflight (raw restore aborts atomically; explicit allow of a verified role works), non-fresh target refused, restore SQL error rolls back everything, forgotten auth/storage customizations detected by inventory diff (${missingCustom.join(", ")}); R-RESTORE-ACL-32 literal official restore re-grants anon/authenticated on ${regranted.length} objects (${regranted.join(", ")}), caught by inventory diff and prevented by default-ACL neutralization`);

  if (process.env.REHEARSAL_EVIDENCE) { // synthetic, secret-free artefacts for the review report
    const e = process.env.REHEARSAL_EVIDENCE;
    mkdirSync(e, { recursive: true });
    for (const [k, v] of Object.entries(scripts)) writeFileSync(join(e, `cli-3.0.0-dump-${k}.sh`), v);
    for (const f of ["BACKUP-MANIFEST.json", "auth-storage-custom.sql", "roles.sql"]) copyFileSync(join(B, f), join(e, `synthetic-${f}`));
    writeFileSync(join(e, "synthetic-acl-off.sql"), defaultAclSql(T2, "off"));
    writeFileSync(join(e, "synthetic-acl-on.sql"), defaultAclSql(T2, "on"));
    writeFileSync(join(e, "synthetic-schema-sql-head.txt"), readFileSync(join(B, "schema.sql"), "utf8").split("\n").slice(0, 40).join("\n"));
  }
  console.log(`PASS APP-RECOVERY-32 local synthetic restore rehearsal (${IMAGE}; not a canonical backup/restore proof)${process.env.KEEP_REHEARSAL ? `; kept ${work}` : ""}`);
} finally {
  for (const c of containers) spawnSync("docker", ["rm", "-f", c], { stdio: "pipe" });
  if (!process.env.KEEP_REHEARSAL) rmSync(work, { recursive: true, force: true });
}
