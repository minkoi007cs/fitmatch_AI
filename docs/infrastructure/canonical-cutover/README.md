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

Use a private directory with mode 700 on an encrypted disk. Enter the database password at the prompt or
from an environment variable in your own shell. Never paste it into a chat or commit it.

```bash
umask 077; mkdir -p ~/fitmatch-private/backup-$(date -u +%Y%m%dT%H%MZ) && cd "$_"
npx supabase@3.0.0 --version                       # must print 3.0.0
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog --role-only -f roles.sql
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog -f schema.sql
npx supabase@3.0.0 db dump --remote=gohczmqykjkrgdblgbog --data-only --use-copy -f data.sql
# Storage object bytes are NOT in a database dump. Copy the private FitMatch buckets as well:
npx supabase@3.0.0 storage cp -r ss:///fitmatch-wardrobe ./storage/fitmatch-wardrobe --remote=gohczmqykjkrgdblgbog
sha256sum roles.sql schema.sql data.sql > SHA256SUMS; find storage -type f | wc -l > storage-count.txt
```

Use `--dry-run` first to print the `pg_dump` script without connecting for data. The `fitmatch-v2` bucket
does not exist yet on the cloud (it is created by step 2), so there is nothing to copy for it.

## 3. Restore proof (before touching the cloud)

1. Start a disposable local PG17 Supabase stack, or a disposable project that is explicitly not the
   canonical one. Restore in this order: `psql -f roles.sql`, then `schema.sql`, then `data.sql`.
2. Run `scripts/schema-inventory.sql` on the restored copy, then
   `node scripts/compare-schema-inventory.mjs <inventory.json>`. Expect the same picture Codex recorded:
   base partial with equivalent legacy names and different-target owner FKs, identity applied, steps 1–11
   absent, the unrelated tables listed as extra.
3. Run the runner against the restored copy (§4, dry run, then `--execute`). Then run a signup, an outfit
   save/reopen and a wardrobe upload/edit against it, and compare row counts and `SHA256SUMS` of a fresh
   data dump of the FitMatch tables before and after.
4. Record versions, timings and the audit log in the private directory. Send Codex only a sanitized summary.

`npm run test:legacy-compat` is the synthetic version of steps 2–3 on a canonical-shaped legacy database
(PG17, no network). It is not a restore proof.

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
