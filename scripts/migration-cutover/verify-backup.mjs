#!/usr/bin/env node
/**
 * APP-RECOVERY-32 — offline completeness check of a private backup directory BEFORE any restore or cutover.
 * Reads only local files; never connects anywhere; prints no row contents.
 *
 *   node scripts/migration-cutover/verify-backup.mjs <backup-dir>        exit 0 = usable, 2 = refused
 *
 * Expected layout (README §2):  roles.sql  schema.sql  data.sql  auth-storage-custom.sql  BACKUP-MANIFEST.json
 *                               storage/<bucket>/<object name>   (bytes copied with `supabase storage cp`)
 * Checks: files present and non-empty; sha256 equal to the manifest; CLI completeness markers (data.sql ends
 * with the pg_dump trailer + RESET ALL, roles.sql with RESET ALL); every COPY block terminated; FitMatch core
 * objects present in schema.sql; the FitMatch auth trigger captured; storage.objects rows in data.sql ⇄ byte
 * files (one-to-one, size and plain-md5 eTag equal); storage manifest sha256 equal to the bytes on disk.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const md5 = (b) => createHash("md5").update(b).digest("hex");
const FILES = ["roles.sql", "schema.sql", "data.sql", "auth-storage-custom.sql"];
const CORE = ["fm_users", "fm_wardrobe_items", "fm_outfits", "fm_auth_identities", "fm_auth_refreshes"];

const unescapeCopy = (v) => (v === "\\N" ? null : v.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r", b: "\b", f: "\f", v: "\v", "\\": "\\" })[c] ?? c));

/** Parses `COPY "schema"."table" (cols) FROM stdin;` blocks of a text-format dump. */
export function copyBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^COPY "([^"]+)"\."([^"]+)" \(([^)]*)\) FROM stdin;$/);
    if (!m) continue;
    const cols = m[3].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rows = [];
    let j = i + 1;
    for (; j < lines.length && lines[j] !== "\\."; j++) rows.push(Object.fromEntries(lines[j].split("\t").map((v, k) => [cols[k], unescapeCopy(v)])));
    blocks.push({ schema: m[1], table: m[2], cols, rows, terminated: j < lines.length });
    i = j;
  }
  return blocks;
}

const listFiles = (root) => {
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else out.push(relative(root, p)); } };
  if (existsSync(root)) walk(root);
  return out.sort();
};

export function verifyBackup(dir, { trustManifestHashes = true } = {}) {
  const problems = [], checks = [];
  const check = (ok, what) => { checks.push(what); if (!ok) problems.push(what); return ok; };
  for (const f of [...FILES, "BACKUP-MANIFEST.json"]) {
    const p = join(dir, f);
    check(existsSync(p) && statSync(p).size > 0, `${f}: missing or empty`);
  }
  if (problems.length) return { ok: false, problems, checks };
  const manifest = JSON.parse(readFileSync(join(dir, "BACKUP-MANIFEST.json"), "utf8"));
  const text = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  if (trustManifestHashes) for (const f of FILES) check(sha(readFileSync(join(dir, f))) === manifest.files?.[f], `${f}: sha256 differs from BACKUP-MANIFEST.json`);
  const tail = (t) => t.trimEnd().split("\n").slice(-3).join("\n");
  check(/-- PostgreSQL database dump complete\n+RESET ALL;$/.test(tail(text["data.sql"])) || /dump complete[\s\S]*RESET ALL;$/.test(text["data.sql"].trimEnd().slice(-200)), "data.sql: missing pg_dump trailer + RESET ALL (truncated or not produced by `supabase db dump`)");
  check(/RESET ALL;$/.test(text["roles.sql"].trimEnd()), "roles.sql: missing RESET ALL (truncated?)");
  const blocks = copyBlocks(text["data.sql"]);
  check(blocks.length > 0 && blocks.every((b) => b.terminated), "data.sql: a COPY block is not terminated by \\.");
  for (const t of CORE) check(new RegExp(`CREATE TABLE IF NOT EXISTS "public"\\."${t}"`).test(text["schema.sql"]), `schema.sql: table public.${t} missing`);
  check(/CREATE OR REPLACE FUNCTION "public"\."handle_new_user"/.test(text["schema.sql"]), "schema.sql: public.handle_new_user missing");
  check(/CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth\.users/.test(text["auth-storage-custom.sql"]), "auth-storage-custom.sql: on_auth_user_created trigger not captured (signup would stop provisioning fm_users)");
  for (const t of ["users"]) check(blocks.some((b) => b.schema === "auth" && b.table === t), `data.sql: no COPY for auth.${t}`);

  // Storage: rows in the SQL dump vs bytes on disk, independent of the manifest.
  const objects = blocks.filter((b) => b.schema === "storage" && b.table === "objects").flatMap((b) => b.rows);
  const files = listFiles(join(dir, "storage"));
  const expected = new Set(objects.map((o) => `${o.bucket_id}/${o.name}`));
  for (const o of objects) {
    const rel = `${o.bucket_id}/${o.name}`;
    const p = join(dir, "storage", rel);
    if (!check(existsSync(p), `storage: bytes missing for ${rel}`)) continue;
    const bytes = readFileSync(p);
    let meta = {};
    try { meta = JSON.parse(o.metadata ?? "{}") ?? {}; } catch { check(false, `storage: unreadable metadata for ${rel}`); }
    if (meta.size !== undefined) check(Number(meta.size) === bytes.length, `storage: size differs for ${rel}`);
    const etag = String(meta.eTag ?? "").replace(/"/g, "");
    if (/^[0-9a-f]{32}$/.test(etag)) check(etag === md5(bytes), `storage: content (md5/eTag) differs for ${rel}`);
  }
  for (const f of files) check(expected.has(f), `storage: unexpected file without a storage.objects row: ${f}`);
  if (trustManifestHashes) {
    const listed = new Map((manifest.storage ?? []).map((s) => [s.path, s.sha256]));
    for (const f of files) check(listed.get(f) === sha(readFileSync(join(dir, "storage", f))), `storage: ${f} sha256 differs from manifest`);
    check(listed.size === files.length, `storage: manifest lists ${listed.size} objects, ${files.length} on disk`);
  }
  checks.push(`storage: ${objects.length} rows, ${files.length} files`);
  return { ok: problems.length === 0, problems, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: verify-backup.mjs <backup-dir>"); process.exit(2); }
  const r = verifyBackup(dir);
  for (const p of r.problems) console.error("REFUSED: " + p);
  console.log(r.ok ? `OK: ${r.checks.length} checks passed` : `NOT USABLE: ${r.problems.length} problem(s)`);
  process.exit(r.ok ? 0 : 2);
}
