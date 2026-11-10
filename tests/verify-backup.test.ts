import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { copyBlocks, verifyBackup } from "../scripts/migration-cutover/verify-backup.mjs";

// APP-RECOVERY-32: offline backup completeness checks (the Docker rehearsal exercises them on real dumps).
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const tee = Buffer.from("synthetic-bytes-1"), jeans = Buffer.from("synthetic-bytes-22");
const meta = (b: Buffer) => JSON.stringify({ size: b.length, eTag: `"${md5(b)}"` }).replace(/\\/g, "\\\\");

function makeBackup() {
  const d = mkdtempSync(join(tmpdir(), "verify-backup-"));
  const files: Record<string, string> = {
    "roles.sql": 'CREATE ROLE "custom_reader";\nRESET ALL;\n',
    "schema.sql": ["fm_users", "fm_wardrobe_items", "fm_outfits", "fm_auth_identities", "fm_auth_refreshes"]
      .map((t) => `CREATE TABLE IF NOT EXISTS "public"."${t}" ();`).join("\n") + '\nCREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS trigger AS $$ begin return new; end $$;\n',
    "data.sql": `SET session_replication_role = replica;\nCOPY "auth"."users" ("id", "email") FROM stdin;\nu1\tr1@example.test\n\\.\n`
      + `COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "metadata") FROM stdin;\n`
      + `o1\tfitmatch-wardrobe\tu1/tee.jpg\tu1\t${meta(tee)}\no2\tfitmatch-wardrobe\tu2/jeans.png\t\\N\t${meta(jeans)}\n\\.\n`
      + "\n--\n-- PostgreSQL database dump complete\n--\n\nRESET ALL;\n",
    "auth-storage-custom.sql": "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();\n",
  };
  for (const [f, t] of Object.entries(files)) writeFileSync(join(d, f), t);
  const storage = [["fitmatch-wardrobe/u1/tee.jpg", tee], ["fitmatch-wardrobe/u2/jeans.png", jeans]] as const;
  for (const [p, b] of storage) { mkdirSync(dirname(join(d, "storage", p)), { recursive: true }); writeFileSync(join(d, "storage", p), b); }
  writeFileSync(join(d, "BACKUP-MANIFEST.json"), JSON.stringify({
    files: Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sha(t)])),
    storage: storage.map(([path, b]) => ({ path, sha256: sha(b) })),
  }));
  return d;
}

test("copyBlocks parses COPY text format incl. NULL and escapes", () => {
  const [b] = copyBlocks('COPY "s"."t" ("a", "b") FROM stdin;\nx\\ty\t\\N\n\\.\n');
  assert.deepEqual(b.rows, [{ a: "x\ty", b: null }]);
  assert.equal(b.terminated, true);
  assert.equal(copyBlocks('COPY "s"."t" ("a") FROM stdin;\nx\n')[0].terminated, false);
});

test("a complete synthetic backup verifies", () => {
  const d = makeBackup();
  const r = verifyBackup(d);
  assert.deepEqual(r.problems, []);
  rmSync(d, { recursive: true });
});

test("defects are refused: truncation, missing file, bytes missing/extra/changed, auth trigger not captured", () => {
  const cases: Array<[string, (d: string) => void, RegExp]> = [
    ["truncated data", (d) => { const t = readFileSync(join(d, "data.sql")); writeFileSync(join(d, "data.sql"), t.subarray(0, 120)); }, /data\.sql/],
    ["missing schema", (d) => rmSync(join(d, "schema.sql")), /schema\.sql: missing/],
    ["bytes missing", (d) => rmSync(join(d, "storage/fitmatch-wardrobe/u2/jeans.png")), /bytes missing for fitmatch-wardrobe\/u2\/jeans\.png/],
    ["extra bytes", (d) => writeFileSync(join(d, "storage/fitmatch-wardrobe/stray.bin"), "x"), /unexpected file/],
    ["changed bytes same size", (d) => writeFileSync(join(d, "storage/fitmatch-wardrobe/u1/tee.jpg"), "synthetic-bytes-X"), /md5\/eTag\) differs for fitmatch-wardrobe\/u1\/tee\.jpg/],
    ["no auth trigger", (d) => writeFileSync(join(d, "auth-storage-custom.sql"), "-- nothing\n"), /on_auth_user_created/],
  ];
  for (const [name, mutate, expected] of cases) {
    const d = makeBackup();
    mutate(d);
    const r = verifyBackup(d);
    assert.equal(r.ok, false, name);
    assert.ok(r.problems.some((p: string) => expected.test(p)), `${name}: ${r.problems.join("; ")}`);
    const independent = verifyBackup(d, { trustManifestHashes: false }); // without relying on the manifest hashes
    if (name !== "missing schema") assert.equal(independent.ok, false, `${name} caught without manifest hashes`);
    rmSync(d, { recursive: true });
  }
});

test("restore-proof target guard refuses canonical/retired projects and redirecting parameters", async () => {
  const { checkRestoreTarget } = await import("../scripts/migration-cutover/check-restore-target.mjs");
  const C = "gohczmqykjkrgdblgbog";
  for (const url of [
    `postgresql://postgres@db.${C}.supabase.co/postgres`,
    `postgresql://postgres.${C}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    "postgresql://postgres@db.wqbwwusrhertqktwsxsl.supabase.co/postgres",
    "postgresql://postgres@127.0.0.1/postgres?host=db.other.example",
    "mysql://x@y/z", "not a url",
  ]) assert.equal(checkRestoreTarget(url, C).ok, false, url);
  assert.equal(checkRestoreTarget("postgresql://postgres.abcdefghijabcdefghij@aws-0-us-east-1.pooler.supabase.com:5432/postgres", C).ok, true);
  assert.equal(checkRestoreTarget("postgresql://postgres@127.0.0.1:54322/postgres", C).ok, true);
  assert.equal(checkRestoreTarget("postgresql://postgres@127.0.0.1/postgres", "bad").ok, false);
});
