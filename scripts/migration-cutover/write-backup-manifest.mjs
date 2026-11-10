#!/usr/bin/env node
/**
 * APP-RECOVERY-32 — writes BACKUP-MANIFEST.json for a private backup directory (offline; no row contents).
 *   node scripts/migration-cutover/write-backup-manifest.mjs <backup-dir> [--business <file with the 2-line
 *   output of business-fingerprint.sql run against the SOURCE at backup time>]
 * Records sha256 of roles/schema/data/auth-storage-custom.sql and sha256/size of every object under storage/.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sha = (b) => createHash("sha256").update(b).digest("hex");
export const FILES = ["roles.sql", "schema.sql", "data.sql", "auth-storage-custom.sql"];
export function listStorage(root) {
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else { const b = readFileSync(p); out.push({ path: relative(root, p), size: b.length, sha256: sha(b) }); }
  } };
  if (existsSync(root)) walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
export function writeManifest(dir, { business = null, tools = {} } = {}) {
  const missing = FILES.filter((f) => !existsSync(join(dir, f)));
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  const manifest = {
    format: "fitmatch.backup-manifest.v1", createdAt: new Date().toISOString(),
    files: Object.fromEntries(FILES.map((f) => [f, sha(readFileSync(join(dir, f)))])),
    storage: listStorage(join(dir, "storage")), business, tools,
  };
  writeFileSync(join(dir, "BACKUP-MANIFEST.json"), JSON.stringify(manifest, null, 1), { mode: 0o600 });
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const i = process.argv.indexOf("--business");
  let business = null;
  if (i !== -1) { const [fingerprint, counts] = readFileSync(process.argv[i + 1], "utf8").trim().split("\n"); business = { fingerprint, counts }; }
  if (!dir) { console.error("usage: write-backup-manifest.mjs <backup-dir> [--business <file>]"); process.exit(2); }
  const m = writeManifest(dir, { business });
  console.log(`BACKUP-MANIFEST.json: ${Object.keys(m.files).length} files, ${m.storage.length} storage objects`);
}
