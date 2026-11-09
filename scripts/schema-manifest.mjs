/**
 * ENV-CANON-01: build the EXPECTED schema manifest from the reviewed SQL chain, in a disposable Docker
 * PostgreSQL 17 (hosted major) with a minimal Supabase-like stub (roles, pgcrypto in schema extensions, auth.uid/users, storage.buckets/objects/foldername)
 * and no network. Applies supabase/schema.sql then every migration in filename order, running the same
 * read-only inventory query (scripts/schema-inventory.sql) after each step, and records which objects each
 * step adds or changes. Output contains schema shape only (no data, no secrets):
 *   node scripts/schema-manifest.mjs [--out docs/infrastructure/schema-manifest.json] [--check]
 * Compare with a privately saved inventory of the canonical project via scripts/compare-schema-inventory.mjs.
 * This proves nothing about the cloud database by itself.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { compareInventory, flattenInventory } from "./schema-inventory-lib.mjs";

const root = new URL("../", import.meta.url);
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "docs/infrastructure/schema-manifest.json";
const check = process.argv.includes("--check");
const container = `fitmatch-schema-manifest-${process.pid}`;
const psql = ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (s) => execFileSync("docker", psql, { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const sha = (text) => createHash("sha256").update(text).digest("hex");

const STUB = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema extensions; create extension pgcrypto schema extensions; -- hosted Supabase placement
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role; -- hosted Supabase defaults
create schema auth; grant usage on schema auth to authenticated, anon;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
`;

const inventorySql = readFileSync(new URL("scripts/schema-inventory.sql", root), "utf8");
const inventory = () => {
  const raw = JSON.parse(sql(inventorySql));
  raw.buckets = JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) order by id),'[]') from storage.buckets;"));
  return flattenInventory(raw);
};

const files = [["supabase/schema.sql", readFileSync(new URL("supabase/schema.sql", root), "utf8")]];
for (const f of readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql")).sort())
  files.push([`supabase/migrations/${f}`, readFileSync(new URL(`supabase/migrations/${f}`, root), "utf8")]);

try {
  execFileSync("docker", ["run", "--rm", "--detach", "--network", "none", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], { stdio: "pipe" });
  for (let i = 0; i < 60; i++) {
    try {
      execFileSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "pipe" });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  sql(STUB);
  // fm_wardrobe_items columns some migrations rely on are created by schema.sql itself.
  let previous = inventory();
  const steps = [];
  for (const [file, text] of files) {
    sql(text);
    const now = inventory();
    const adds = {}, changes = {};
    for (const [key, value] of Object.entries(now)) {
      if (!(key in previous)) adds[key] = value;
      else if (JSON.stringify(previous[key]) !== JSON.stringify(value)) changes[key] = value;
    }
    const removes = Object.keys(previous).filter((k) => !(k in now));
    steps.push({ file, sha256: sha(text), adds, changes, removes });
    previous = now;
  }
  const manifest = {
    format: "fitmatch.schema-manifest.v1",
    note: "Expected shape from the reviewed SQL chain applied to a Supabase-like stub in disposable Docker PG17 (hosted major), pgcrypto in schema extensions. Schema only, no data. Policy/constraint text is compared by md5/definition and may differ by server version: inspect before concluding.",
    stub: sha(STUB),
    inventorySql: sha(inventorySql),
    steps,
    final: previous,
  };
  // Self-check: the live inventory of the fully migrated stub must read "applied" for every step.
  const self = compareInventory(manifest, inventory());
  const notApplied = self.steps.filter((x) => !["applied", "no-objects"].includes(x.status));
  if (notApplied.length || self.extra.length) throw new Error("Self-check failed: " + JSON.stringify({ notApplied, extra: self.extra }));
  const json = JSON.stringify(manifest, null, 1) + "\n";
  if (check) {
    const current = readFileSync(out, "utf8");
    if (current !== json) {
      console.error(`${out} is stale; regenerate with node scripts/schema-manifest.mjs`);
      process.exit(1);
    }
    console.log(`${out} current (${steps.length} steps, ${Object.keys(previous).length} objects)`);
  } else {
    writeFileSync(out, json);
    console.log(`Wrote ${out}: ${steps.length} steps, ${Object.keys(previous).length} objects`);
  }
} finally {
  try {
    execFileSync("docker", ["rm", "-f", container], { stdio: "pipe" });
  } catch {}
}
