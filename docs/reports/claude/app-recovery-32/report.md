# APP-RECOVERY-32 — report (Ready for review; local synthetic rehearsal, NOT a canonical backup/restore proof)

Session **CL-APPRECOVERY-20261109-01** (same Claude app owner/checkout as APP-CLOSE-30). Receipt
[receipt.md](./receipt.md) committed fd00c5c before any edit. Docs baseline `codex/project-operations` f0db00c
(PROC-0032; later d975c5d/PROC-0033 read for PC native status). Source base **499ead01e7f9274ddf310ab346fda4c2464588bd**.
Branch **`codex/app-recovery-32-claude-20261109`**; final head = the commit containing this report
(`git diff 499ead0..<head>`).

No cloud connection, no cloud data, no secrets, no deploy/history repair/enrollment/flag/GPU. Historical SQL,
compat SQL, `cutover-plan.json`, `schema-manifest.json`, `apply.mjs`, `target.mjs`, `worker.py`,
`legacy-canonical-shape.sql` are byte-identical to 499ead0 (12/12 step hashes + manifest re-checked:
[plan-hash-check.log](./logs/plan-hash-check.log)).

## 1. What was verified about the real tools (before writing the runbook)

- **Supabase CLI 3.0.0** (npm `supabase@3.0.0`, binary fetched in the sandbox, no login): `db dump`,
  `storage cp`, `migration repair` flags as used in the README exist (`--help`). `db dump --dry-run` prints the
  exact dump script without connecting; saved in [evidence/](./evidence/) (`cli-3.0.0-dump-{roles,schema,data}.sh`,
  dummy URL/password `rehearsal`).
- **Official guide** (supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore, fetched this
  session): three dumps (`--role-only`, schema, `--data-only --use-copy -x storage.buckets_vectors -x
  storage.vector_indexes`), restore with `psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql
  --file schema.sql --command 'SET session_replication_role = replica' --file data.sql`; auth/storage
  customizations must be recreated separately; the CLI does not move Storage files. CLI reference: default dump
  "ignored schemas include auth, storage, and those created by extensions".

Facts that the old README got wrong or left open (all asserted by the rehearsal):

| Topic | Fact (CLI 3.0.0 script) | Consequence |
|---|---|---|
| Roles | `pg_dumpall --roles-only --no-role-passwords`; CREATE/ALTER/GRANT of reserved roles (`anon`, `authenticated`, `service_role`, `postgres`, `supabase_*`, `authenticator`, `pgbouncer`, `dashboard_user`, `cli_login_*`, `pgsodium_*`, `pgtle_admin`) are commented out | "role exists" errors on a fresh project come only from **custom** roles → narrow, per-role handling |
| schema.sql | excludes `auth`, `storage`, `extensions`, `realtime`, `supabase_migrations`, … | **`on_auth_user_created` (on auth.users) and `wardrobe_storage_own` (on storage.objects) are NOT in schema.sql** → signup provisioning and storage RLS would be lost |
| data.sql | excludes only platform-internal schemas; **includes `auth` and `storage` rows** (`auth.users`, `storage.buckets`, `storage.objects` metadata); starts with `SET session_replication_role = replica`, ends with pg_dump trailer + `RESET ALL;` | completeness markers usable; no object bytes |
| Storage bytes | not in any SQL dump | separate `storage cp` per bucket + byte verification |

## 2. New finding R-RESTORE-ACL-32 (security-relevant; prevented in the runbook)

A Supabase project has `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL … TO anon,
authenticated, service_role`. `pg_dump` writes ACLs relative to the built-in default, so re-created objects get
the target's default grants back even where the source revoked them. Rehearsed with the **literal official
command**: anon gained EXECUTE on `fm_begin_auth_refresh` / `fm_finish_auth_refresh` (SECURITY DEFINER refresh
functions) and SELECT on `fm_auth_identities` / `fm_auth_refreshes` (source: `false/false`, restored:
`true/true`). Fix: `scripts/migration-cutover/default-acl.sql` generates REVOKE (`mode=off`) and exact
re-GRANT (`mode=on`) of the target's default ACLs; they wrap `schema.sql` inside the same single restore
transaction. Result: restored ACLs equal source ACLs (full inventory diff 0) and the target's default ACLs are
back exactly. The inventory diff also detects the problem if the wrap is forgotten. Whether hosted Supabase's
real default ACL set differs from the stub (e.g. extra grantors such as `supabase_admin`) is **not verified**; the
generator reads whatever `pg_default_acl` the target has.

## 3. Deliverables (scope files)

| File | Purpose |
|---|---|
| `docs/infrastructure/canonical-cutover/README.md` | §2 backup (what each file contains, exact commands incl. official exclusions, capture of auth/storage customizations, manifest + verifier), §3 restore proof (target guards, narrow role handling, default-ACL wrap, compare rules: business fingerprint not raw dump hash, inventory diff = 0, bytes), §3.4 rehearsal, **§4b execution checklist** (hashes, secrets, stop conditions, partial failure, owner/operator per step; pooler allowlist stays empty until the exact Dashboard host is reviewed) |
| `scripts/migration-cutover/verify-backup.mjs` | offline backup completeness check, exit 2 on any defect |
| `scripts/migration-cutover/write-backup-manifest.mjs` | `BACKUP-MANIFEST.json` (file sha256, storage sha256/size, business fingerprint) |
| `scripts/migration-cutover/capture-managed-customizations.sql` | read-only DDL capture of our triggers/policies in auth/storage (schema-qualified) |
| `scripts/migration-cutover/default-acl.sql` | R-RESTORE-ACL-32 off/on generator |
| `scripts/migration-cutover/business-fingerprint.sql` | read-only fingerprint + counts (hashes only) |
| `scripts/migration-cutover/restore-preflight.sql`, `check-restore-target.mjs` | restore target must be fresh and never canonical/retired |
| `scripts/migration-cutover/rehearse-restore.mjs` (`npm run test:restore-rehearsal`) | end-to-end local rehearsal + fault cases, using the files above |
| `scripts/fixtures/supabase-platform-stub.sql` | fresh-project stand-in (byte-identical to the platform part of the legacy fixture) |
| `tests/verify-backup.test.ts` | offline unit tests (verifier, COPY parser, restore-target guard) |

Hashes (sha256 prefix): rehearse-restore b20fa112…, verify-backup b94c24e2…, write-backup-manifest 2d3cf61b…,
check-restore-target 4eda2c13…, capture 53254400…, default-acl fca94975…, business-fingerprint 940dfc87…,
restore-preflight f7a141cd…, platform stub 507ab111…; unchanged: apply 4f51669f…, target e488a2ea…,
plan b64eb6f5…, manifest 24f38ce7…, worker ef25136b….

## 4. Rehearsal (`npm run test:restore-rehearsal`) — [log](./logs/restore-rehearsal.log), exit 0

Two disposable PG17 containers (`--network none`), synthetic data only: 2 auth users, profiles, 3 wardrobe items
(nullable color/style), 2 legacy outfits (`style_category` NOT NULL, `is_saved`), 2 identity mappings, 1 refresh,
a custom role with a grant, private bucket, 3 `storage.objects` rows with size/eTag metadata and 3 synthetic
byte files (48 213 / 7 001 / 131 072 bytes).

| Stage | Assertions |
|---|---|
| backup | roles/schema/data produced by the CLI 3.0.0 scripts (pg_dump 17.9 in the source container); custom role present, reserved roles filtered; auth trigger + storage policy absent from schema.sql and captured separately; auth.users rows in data.sql; bytes copied; manifest |
| verify | 37 checks PASS |
| restore | `check`/preflight → single transaction roles + acl-off + schema + acl-on + replica data → customizations → bytes |
| compare | business fingerprint and counts equal; **full catalog inventory equal (109 keys: public/auth/storage tables, triggers, policies, grants, functions, buckets)**; storage bytes sha256 equal and consistent with restored metadata size/eTag |
| cutover on restored copy | runner dry run 12 pending, no change → `--execute` 12 applied+verified → fingerprint unchanged; FKs → `fm_users` with original cascades; nullable color/style; `style_category` NOT NULL/no default; identities/refresh kept; buckets `fitmatch-v2`/`fitmatch-wardrobe` private; signup provisions `fm_users`; outfit save + reopen; cross-owner outfit and storage rows hidden; pre-existing profiles unchanged after signup; bytes unchanged |

Fault cases (all detected **before** a cutover could proceed):

| Fault | Caught by |
|---|---|
| truncated `data.sql` (60 %) | verify: sha256 + missing trailer/RESET ALL (also without manifest hashes) |
| missing `data.sql` | verify: missing |
| one object's bytes missing / one byte flipped | verify: row⇄bytes, size/md5-eTag, manifest sha |
| Storage never copied, manifest regenerated empty | verify: rows in data.sql without bytes |
| custom role already on target | preflight refusal; raw restore aborts with "role … already exists" and leaves target untouched; explicit allow of a verified-equivalent role skips only its CREATE line, grant still applied |
| non-fresh target | `restore-preflight.sql` refusal |
| SQL error inside data.sql | single transaction: 0 tables, 0 roles, 0 auth rows afterwards |
| auth/storage customizations forgotten | inventory diff lists `trigger:auth.users.on_auth_user_created`, `policy:storage.objects.wardrobe_storage_own` |
| literal restore without ACL wrap | R-RESTORE-ACL-32 diff on 4 objects (§2) |
| restore target = canonical/retired/redirecting URL | `check-restore-target.mjs` (unit test) |

## 5. Other checks

| Check | Result |
|---|---|
| `npm test` | **118/118 PASS** ([log](./logs/npm-test.log)): 114 previous + 4 new |
| `npm run lint` | PASS ([log](./logs/lint.log)) |
| plan/manifest hashes | 12/12 + manifest OK |
| `test:legacy-compat`, Python, build, `test:v2` | **not rerun**: runner, SQL, worker, app code unchanged since Codex's independent PASS on 499ead0 |

## 6. Environment and substitutions (state these in review)

- Docker Hub/GHCR/ECR are blocked here: `postgres:17-alpine` is a **local stand-in image** (`docker import`):
  conda-forge **PostgreSQL 17.9** server + psql/pg_dump/pg_dumpall 17.9 (installed with micromamba from
  conda.anaconda.org into `/opt/pg17client`). Not the official Alpine image. Codex should rerun
  `npm run test:restore-rehearsal` with the official image.
- The CLI's dump scripts are executed with `pg_dump` from the source container instead of the CLI's
  `supabase/postgres` image (the dump script text is the CLI's own). Real `db dump` needs Docker and the CLI image.
- The platform layer is a **stub** (roles, `auth.users`, `storage.buckets/objects`, `pgcrypto` in `extensions`),
  not real Supabase Auth/Storage: hosted `auth` has more tables (identities, sessions, …) and platform
  triggers/policies; the capture query excludes platform-function triggers, which is an assumption to verify on
  the first real restore proof (review its output).
- Storage bytes: a local directory stands in for `supabase storage cp`; no Storage API was exercised.
- Node 22.23.4, Docker 29.9.2, Supabase CLI 3.0.0.

## 7. Native PC status (from ops d975c5d, reported, not verified by me)

Both PCs report the exact f591d96 test file on Windows: **56 run / 47 PASS / 9 skip (5 POSIX-only quiescence,
4 symlink privilege) / 0 error / exit 0**; log publication pending. Not "56 PASS".

## 8. Not run / not proven

Real canonical backup and restore proof, hosted Auth/Storage behaviour, real `storage cp`, hosted default ACLs,
any pooler host, official PG17 image for this rehearsal, cloud dry run, HTTPS serving revision, scoped worker,
real Qwen/GPU. Implementer evidence only — **not an independent review PASS, not cloud-ready**.

## 9. Publication

Push from this sandbox is refused (proxy 403). Incremental bundle `app-recovery-32.bundle`
(prerequisite 499ead0, already on GitHub) is handed to the owner/Codex; hashes in the chat reply.

## 10. Process delta for Codex to import

```text
### L-0xx - 09/11/2026 - START/HANDOFF - CL-APPRECOVERY-20261109-01 / APP-RECOVERY-32
Claude receipt fd00c5c (base 499ead0, docs f0db00c), branch codex/app-recovery-32-claude-20261109. Verified CLI 3.0.0
dump scripts (--dry-run) + official guide: data dump includes auth/storage rows; schema dump excludes auth/storage so
on_auth_user_created and wardrobe_storage_own must be captured separately; reserved roles filtered; bytes outside SQL.
New R-RESTORE-ACL-32: target default ACLs re-grant revoked privileges (anon EXECUTE on fm_*_auth_refresh, SELECT on
fm_auth_*); runbook wraps schema.sql with default-acl off/on in the restore transaction. Rehearsal
test:restore-rehearsal PASS on local PG17.9 stand-in: CLI-script dumps, verify 37 checks, restore, fingerprint+109-key
inventory+bytes equal, runner dry-run/execute 12, preserved FKs/nullability/style_category/is_saved/identity/refresh,
signup/outfit/cross-owner; 10 fault cases detected pre-cutover. README §2/§3/§4b rewritten. npm 118/118, lint PASS.
SQL/plan/manifest/runner/worker unchanged. No cloud/deploy/GPU. Ready for review; Codex reruns with official image.
```

| Task | Owner | Status |
|---|---|---|
| APP-RECOVERY-32 | Claude CL-APPRECOVERY-20261109-01 | Ready for review |
| Review + official-image rerun | Codex | Planned |
| Private canonical backup + restore proof using README §2–3 | owner (after review) | Planned |

## 11. Next steps

1. Codex: review diff 499ead0..head; run `npm run test:restore-rehearsal` with official `postgres:17-alpine`
   and `npx -y supabase@3.0.0`; judge R-RESTORE-ACL-32 handling.
2. Owner, after review: §2 private backup → `verify-backup` → §3 restore proof on a disposable project (inspect
   `auth-storage-custom.sql` and the inventory diff on real hosted platform objects) → sanitized summary to Codex.
3. Then §4b checklist; pooler host only from the Dashboard, reviewed.
