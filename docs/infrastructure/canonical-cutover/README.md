# Canonical cutover package — CL-MIGRATION-26

Status: **REVIEW ONLY. Nothing here has been executed on the cloud.** Target: `fitmatch-ai` /
`gohczmqykjkrgdblgbog`, PostgreSQL 17. `smoke-supabase` is retired for FitMatch, and the runner refuses it.

Real execution needs all of these first. None of them is satisfied by this package:

1. **Codex SQL review PASS** of the exact files and hashes in `cutover-plan.json`.
2. **Private backup** of the canonical project (§2), stored outside Git.
3. **PG17 restore proof** of that backup, with this runner executed against the restored copy (§3).
4. **Owner decision** to run against the canonical project, with a maintenance window.

Catalog metadata (Codex's inventory) is not a backup.

## 1. What changes, in order

| # | File | sha256 (prefix) | Mode |
|---|---|---|---|
| — | `supabase/schema.sql` | — | **never replayed** on the populated project |
| 0 | `20261103_app_system_identity.sql` | 6779f230da48 | verify-only (already present on cloud) |
| 1 | `20261104_ai_daily_quota.sql` | 72c898950bab | apply once |
| 2 | `20261105_studio_control_plane.sql` | 149fbcbf3d72 | apply once |
| 3 | `20261106025506_worker_recovery_r1.sql` | 8b141146bc25 | apply once |
| 4 | `20261106035951_full_look_c1.sql` | c539cb075898 | apply once |
| 5 | `20261106042143_capture_retention_c2.sql` | cfddc2a9ab32 | apply once |
| 6 | `20261106044040_gc_dry_run_c3.sql` | 8751b4aec051 | apply once |
| 7 | `20261106053812_fitting_generations.sql` | 4d9beb5d1776 | apply once |
| 8 | `20261106150000_source_cleanup_priv01.sql` | 10581f817603 | apply once |
| 9 | `20261107120000_qwen_analysis_qint.sql` | 0440dccc8044 | apply once |
| 10 | `20261108090000_qwen_review_qrev.sql` | 8f403db32387 | apply once |
| 11 | `20261108150000_qrev_cleanup_claim.sql` | 08227b3fa14a | apply once |
| 12 | **`20261109093355_legacy_compat_auth_outfits.sql`** (new, made with `supabase migration new`) | 00a1e82284cc | guarded, rerunnable |

Full hashes are in `cutover-plan.json`. That file also pins `schema-manifest.json` by sha256. Historical
migrations are unchanged byte for byte.

The compatibility migration must run **before any pilot traffic**. It fixes two defects that Codex observed
and this package reproduced on a legacy-shaped PG17 database:

- **Signup is broken.** `on_auth_user_created` → `public.handle_new_user()` inserts into `public.users`,
  which does not exist. The fix replaces the function body in place (`CREATE OR REPLACE`, same OID). The
  existing trigger keeps firing it, so no trigger is created or duplicated. The function writes
  `public.fm_users (id, email)` with `on conflict (id) do update set email`. It runs as `SECURITY DEFINER`
  with `search_path = ''` and fully qualified names. `EXECUTE` is revoked from `PUBLIC`, anon and
  authenticated; a trigger function does not need it to fire.
- **Saving an outfit fails.** The legacy `fm_outfits.style_category` is `NOT NULL` with no default, and
  `POST /api/outfits` omitted it. The route now writes the archive's single shared style plus
  `is_saved = true`. It refuses a mixed-style archive (`MIXED_STYLE_ARCHIVE`) or a contradicting explicit
  style (`STYLE_CATEGORY_MISMATCH`) before writing. The migration adds `style_category` (nullable) and
  `is_saved` only where they are missing, i.e. on a fresh schema. The legacy columns, their `NOT NULL` and
  the absence of a default are kept. Nothing is dropped, backfilled or globally defaulted.

The migration refuses (and its transaction aborts with nothing changed) in these cases:

- `fm_users` or `fm_outfits` is missing.
- The function is missing or is not a trigger function.
- The executing role does not own it.
- `fm_users` has `FORCE ROW LEVEL SECURITY`.
- Any trigger other than one on `auth.users` calls it.
- `fm_users` has another required column without a default.
- There is no unique index on `fm_users.id`.
- The existing outfit columns have unexpected types.

Kept as they are (no blind change):

- Owner FKs on the legacy tables reference `fm_users(id)`, not `auth.users`; the comparator reports this as
  `different-target`.
- Nullable wardrobe `color`/`style`.
- `fm_users.email` has no default.
- Legacy constraint, index and policy names; the comparator treats them as `equivalent`.
- pgcrypto in schema `extensions`.
- The 27 unrelated public tables (no RLS, anon writes). They are reported, never altered: a separate owner
  decision.

## 2. Private backup (owner runs; Supabase CLI 3.0.0; outputs never go to Git or chat)

What each artefact really contains (verified on CLI 3.0.0 with `db dump --dry-run`, which prints the exact
`pg_dumpall`/`pg_dump` script, and against the [official backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)):

| File | Source | Contains | Does NOT contain |
|---|---|---|---|
| `roles.sql` | `db dump --role-only` (`pg_dumpall --roles-only --no-role-passwords`) | custom roles + their grants | reserved roles (`anon`, `authenticated`, `service_role`, `postgres`, `supabase_*`, `authenticator`, `pgbouncer`, `dashboard_user`, `cli_login_*`, …: their CREATE/ALTER/GRANT lines are filtered out), passwords |
| `schema.sql` | `db dump` (`pg_dump --schema-only`) | `public` (and other non-platform schemas): tables, functions incl. `handle_new_user`, policies, grants, default privileges | schemas `auth`, `storage`, `extensions`, `realtime`, `supabase_migrations`, …; therefore **our trigger `on_auth_user_created` on `auth.users` and our policy `wardrobe_storage_own` on `storage.objects` are missing** |
| `data.sql` | `db dump --data-only --use-copy` | rows of `public` **and of `auth` and `storage`** (e.g. `auth.users`, `storage.buckets`, `storage.objects` metadata); starts with `SET session_replication_role = replica`, ends with the pg_dump trailer and `RESET ALL;` | `extensions`, `realtime`, `supabase_migrations`, `auth.schema_migrations`, `storage.migrations`, … ; **no object bytes** |
| `auth-storage-custom.sql` | catalog query below | our triggers/policies inside `auth`/`storage` | platform objects |
| `storage/<bucket>/…` | `storage cp -r` | object **bytes** | — |

```bash
umask 077; B=~/fitmatch-private/backup-$(date -u +%Y%m%dT%H%MZ); mkdir -p "$B" && cd "$B"
npx supabase@3.0.0 --version                                   # must print 3.0.0
# --remote=<ref> uses the linked project/credentials; --remote=<connection string> is also accepted (keep it in
# your shell only). Use the session-pooler string only if IPv6/IPv4 add-on is unavailable.
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog --role-only -f roles.sql
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog -f schema.sql
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog --data-only --use-copy \
  -x storage.buckets_vectors -x storage.vector_indexes -f data.sql      # exclusions from the official guide
# Our customizations inside auth/storage (schema.sql skips those schemas). Read-only; run with psql on the
# same connection, review the output, keep it private:
psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -f <repo>/scripts/migration-cutover/capture-managed-customizations.sql > auth-storage-custom.sql
# Object bytes (not in any SQL dump), bucket by bucket:
npx supabase@3.0.0 storage cp -r ss:///fitmatch-wardrobe ./storage/fitmatch-wardrobe --remote=gohczmqykjkrgdblgbog
# Manifest + independent completeness check (offline):
node <repo>/scripts/migration-cutover/write-backup-manifest.mjs "$B"
node <repo>/scripts/migration-cutover/verify-backup.mjs "$B"          # exit 0 required
```

`fitmatch-v2` does not exist on the cloud yet (step 2 creates it). `verify-backup.mjs` refuses: a missing or
empty file; sha256 different from `BACKUP-MANIFEST.json`; `data.sql`/`roles.sql` without their completion
markers (truncated dumps); an unterminated `COPY`; missing FitMatch core tables/`handle_new_user`; an
`auth-storage-custom.sql` without `on_auth_user_created`; any `storage.objects` row without bytes, bytes without
a row, or bytes whose size / plain-md5 eTag differ from the row's metadata (a Storage copy that never ran is
caught even when the manifest is self-consistent). The manifest also records a **business fingerprint** (§3).

## 3. Restore proof (before touching the cloud)

Rehearsed locally on synthetic data by `npm run test:restore-rehearsal` (§3.4). For the real backup:

1. **Target:** a disposable local Supabase stack or a disposable project that is explicitly not the canonical
   one, freshly created, on PG17. Guards, both must pass:
   `TARGET_URL=… node scripts/migration-cutover/check-restore-target.mjs --canonical-ref gohczmqykjkrgdblgbog`
   (refuses the canonical and retired refs and redirecting URL parameters) and
   `psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -f scripts/migration-cutover/restore-preflight.sql` (no
   relations in `public`, no rows in `auth.users`/`storage.objects`/`storage.buckets`). Then every
   `CREATE ROLE` in `roles.sql` must be a custom role that does **not** exist yet on the target
   (`grep '^CREATE ROLE' roles.sql` vs `select rolname from pg_roles`). If a custom role already exists, compare it (attributes, memberships) and, only if
   equivalent, comment out exactly that one `CREATE ROLE "<name>";` line in a private copy (its `ALTER`/`GRANT`
   lines stay). Never drop `ON_ERROR_STOP` or ignore role errors wholesale. The other documented hosted cases
   (`supabase_admin` owner lines, `cli_login_postgres` grant) are handled the same narrow way, line by line,
   recorded in the private log.
2. **Default privileges (R-RESTORE-ACL-32):** a Supabase project has `ALTER DEFAULT PRIVILEGES` for `postgres` in
   `public` granting ALL to `anon`, `authenticated`, `service_role`. `pg_dump` writes ACLs relative to the
   built-in default, so objects re-created by `schema.sql` would get those grants **back** even where the source
   revoked them. Rehearsed: the literal command re-granted `anon` EXECUTE on `fm_begin_auth_refresh` /
   `fm_finish_auth_refresh` and SELECT on `fm_auth_identities` / `fm_auth_refreshes`. Therefore wrap the
   restore with the target's default ACLs switched off and restored in the same transaction:

   ```bash
   psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -v mode=off -f <repo>/scripts/migration-cutover/default-acl.sql > acl-off.sql
   psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -v mode=on  -f <repo>/scripts/migration-cutover/default-acl.sql > acl-on.sql
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file acl-off.sql --file schema.sql --file acl-on.sql \
     --command 'SET session_replication_role = replica' --file data.sql --dbname "$TARGET_URL"
   psql "$TARGET_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f auth-storage-custom.sql   # after data: triggers must not fire on restored rows
   ```

   Any error aborts the whole transaction (rehearsed: nothing half-restored). Then upload the object bytes
   to the target buckets (CLI `storage cp` per bucket, or the guide's script) and re-run `verify-backup` logic
   against the target's `storage.objects` (sizes/eTags).
3. **Compare (must be identical before any runner step):**
   - business fingerprint: `md5` over `auth.users(id,email)`, `fm_users`, `fm_wardrobe_items`, `fm_outfits`,
     `fm_auth_identities`, `fm_auth_refreshes`, `storage.objects(bucket_id,name,owner,metadata)`, FitMatch
     buckets and the unrelated sentinel table (query in `rehearse-restore.mjs` `FINGERPRINT`), plus per-table counts;
   - full catalog inventory (`scripts/schema-inventory.sql` + buckets) source vs restored: **zero differences**.
     This is what catches a forgotten `auth-storage-custom.sql` and the default-ACL re-grant;
   - storage bytes: sha256 per object equal to the backup manifest.
   Never compare raw dump hashes before/after a migration: dumps change with every DDL. Compare the business
   fingerprint of the columns that exist before and after; rows created by smoke tests (signup, outfit) are
   excluded by id.
4. **Runner on the restored copy:** dry run (12 pending, fingerprint unchanged), `--execute` (12 applied +
   verified), fingerprint unchanged, owner FKs to `fm_users`, nullable wardrobe `color`/`style`, legacy
   `style_category` NOT NULL/no default, identity/refresh rows, private buckets; then signup provisions
   `fm_users`, outfit save/reopen, cross-owner denial, bytes unchanged.
5. Record versions, timings, audit log and the comparisons in the private directory. Send Codex only a
   sanitized summary (counts, hashes of the business fingerprint, pass/fail), never rows.

### 3.4 Local synthetic rehearsal (APP-RECOVERY-32)

`npm run test:restore-rehearsal` runs §2–3 end to end on two throw-away PG17 containers (`--network none`): a
Supabase-like platform stub (`scripts/fixtures/supabase-platform-stub.sql`) plus the canonical legacy shape
and synthetic users/wardrobe/outfits/identity/refresh/storage metadata, and synthetic object bytes on disk.
Dumps are produced by the CLI 3.0.0 scripts themselves (`db dump --dry-run` output, `pg_dump` executed inside
the source container). Fault cases: truncated/missing `data.sql`, missing/corrupted/never-copied bytes,
pre-existing custom role, non-fresh target, restore SQL error, forgotten auth/storage customizations, literal
restore re-granting privileges. It is **not** a backup of the canonical project, not hosted Auth/Storage and
not a Storage API copy. Requires Docker and the CLI (`SUPABASE_CLI`, default `npx -y supabase@3.0.0`).

## 4. Runner (`scripts/migration-cutover/apply.mjs`)

```bash
export DATABASE_URL=...   # set privately in your shell; never printed by the runner
node scripts/migration-cutover/apply.mjs --plan docs/infrastructure/canonical-cutover/cutover-plan.json \
  --expected-ref gohczmqykjkrgdblgbog --audit ~/fitmatch-private/cutover-audit          # dry run
node scripts/migration-cutover/apply.mjs ... --execute                                  # only after §0
```

Before running anything, the runner checks:

- Target identity (R-MIGTARGET-29, `scripts/migration-cutover/target.mjs`), checked **before any psql
  process starts** (refusal = exit 2, nothing is connected):
  - Scheme `postgres://` or `postgresql://` only, single host, database `postgres`, no fragment.
  - **Direct:** host exactly `db.<ref>.supabase.co`, port 5432, user exactly `postgres`.
  - **Pooler:** host must be listed in the plan's `trustedPoolerHosts` (empty by default, so the pooler is
    refused until the owner copies the exact session-pooler host from the project's dashboard *Connect* panel
    into the plan and it is reviewed) and have the form `aws-<n>-<region>.pooler.supabase.com`; port 5432
    (session mode; transaction mode 6543 is refused); user exactly `postgres.<ref>`. A matching
    `postgres.<ref>` username on any other host is refused — the username is not evidence of the host.
  - URL query parameters other than `sslmode` (`require`/`verify-ca`/`verify-full`), `connect_timeout` and
    `application_name` are refused (`host`, `hostaddr`, `port`, `service`, `options`, … could redirect psql).
  - libpq variables that can retarget psql (`PGHOST`, `PGHOSTADDR`, `PGPORT`, `PGSERVICE`, …) are removed
    from psql's environment. There is no override flag. `--isolated-test` accepts loopback hosts only.
  - Note: the pooler form above was taken from Supabase's documented connection strings as known to the
    implementer; this cloud session could not reach the docs. Codex/owner confirm the exact host in the dashboard.
- The smoke ref is refused.
- The server major must be 17.
- The manifest and every file must match their reviewed sha256.

For each step, in order:

1. The runner takes a read-only inventory and checks the precondition. Objects the step adds must be absent:
   no same-name object and no equivalent definition. Objects the step changes must still have the definition
   the manifest recorded before it. A step that already reads applied, or any conflict, is **refused**.
   Only the guarded compatibility step is rerunnable.
2. The file runs through `psql` with `ON_ERROR_STOP`, preceded in the same SQL stream by
   `SET lock_timeout = '5s'` and `SET statement_timeout = '120s'` (validated plan values; APP-CLOSE-30 moved them
   from `PGOPTIONS`, which did not reach the server through `docker exec` and may not through a pooler). Each
   file is a single `BEGIN … COMMIT`.
3. The runner re-inventories. The step must read `applied`, or `applied-with-differences` limited to the
   plan's allowed key: the legacy `NOT NULL` `style_category`.
4. A JSONL audit line (mode 600) is written.

The runner stops at the first refusal or failure (exit 4 or 5); later steps are not attempted.

**History adoption is not automatic.** The runner never writes `supabase_migrations`. At the end it prints:

`npx supabase@3.0.0 migration repair --status applied <versions executed and verified, plus the verified-present 20261103> --remote=gohczmqykjkrgdblgbog`

The operator runs it deliberately after reading the audit log. Do not use `db push`, a mass repair,
`db reset`, or a `schema.sql` replay.

Expected-shape model: `schema-manifest.json` is generated by `scripts/schema-manifest.mjs` on disposable
PG17 with the hosted placement and defaults. That means pgcrypto in `extensions` and Supabase's default
privileges, which grant anon, authenticated and service_role on new public tables and functions. Without
these defaults, a correct cloud apply would have failed verification after step 1. With them, the chain
gives the browser roles no access to any FitMatch v2 private table or function. The only exceptions are
read-only owner-scoped RLS tables and the non-callable `set_updated_at` trigger function. Legacy `fm_*`
tables keep Supabase's default grants behind per-owner RLS.

## 4b. Execution checklist (only after Codex review PASS and an owner go decision)

| # | Step | Who | Stop if |
|---|---|---|---|
| 1 | Check out the reviewed commit; `sha256sum` of `apply.mjs`, `target.mjs`, the 12 step files, `schema-manifest.json` equal the values in the review report and `cutover-plan.json` | operator (owner machine) | any hash differs |
| 2 | Secrets typed into the operator's own shell only (`DATABASE_URL`, DB password); never in chat, Git, logs | owner | — |
| 3 | §2 backup into a private 700 directory; `verify-backup.mjs` exit 0 | owner | non-zero |
| 4 | §3 restore proof on a disposable target incl. inventory diff = 0, fingerprint/bytes equal, runner dry run + execute + smoke | owner, summary to Codex | any difference |
| 5 | Canonical endpoint: direct `db.gohczmqykjkrgdblgbog.supabase.co:5432` user `postgres`; or add the **exact** session-pooler host from Dashboard → Connect to `trustedPoolerHosts` and get it reviewed (empty today; never guess) | owner + Codex | target refused |
| 6 | Maintenance window; Qwen flag OFF; no worker granted `garment.analyze` | owner | — |
| 7 | Runner dry run on canonical (`--audit` private dir): 20261103 VERIFIED PRESENT, 12 would apply | operator | any refusal (exit 2/3/4) |
| 8 | Runner `--execute`; stop at first failure (exit 5); later steps are not attempted | operator | non-zero → §5 |
| 9 | Post-checks: inventory comparator, signup, outfit save/reopen, wardrobe upload/edit; fingerprint of preserved columns equal to the backup's | operator | any difference → §5 |
| 10 | History adoption: run the printed `migration repair --status applied …` deliberately | owner | — |

Partial failure: every step file is one transaction, so a failed step leaves no partial DDL; earlier committed
steps are additive and remain. Do not re-run a non-rerunnable step; reconcile with the audit log and Codex.

## 5. Rollback

- **Before history adoption:** each file is atomic, so a failed step leaves nothing behind. Stop and keep the
  audit log.
- **After a step committed:** the schema is additive. The app keeps running the old routes. Roll back
  *behaviour* first:
  - Keep `QWEN_ANALYSIS_ENABLED` unset or `0`. It is OFF by default; the analysis routes return 403 FEATURE_DISABLED and
    enqueue nothing.
  - Leave PC workers without `garment.analyze` in `allowed_capabilities`. That is a scoped ungrant per
    worker row: `update fm_v2_workers set allowed_capabilities = array_remove(allowed_capabilities, 'garment.analyze') where id = '<worker>'`.
  - Or disable a worker (`enabled = false`).
- **A data-level restore** from §2 is the last resort and needs an owner decision. No `down` migrations are
  provided or run.
- **Compat function:** to restore the previous body, re-apply the backed-up definition from `schema.sql` §2.
  Do not drop the trigger.

## 6. Remaining gates (not PASS)

- Codex review of this package.
- The private backup and PG17 restore proof (§2–3).
- The owner's go decision and window.
- History adoption after a verified run.
- A reviewed HTTPS app revision and env (`real-qwen-smoke.md`).
- PC3D native coordinator ACK, policy and finite slot for pc-ai.
- PC Qwen adapter/runtime ACK.
- Pilot.
