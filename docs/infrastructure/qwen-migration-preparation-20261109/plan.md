# Qwen canonical migration preparation - CX-MIGRATION-PREP-26

Target: **fitmatch-ai / gohczmqykjkrgdblgbog**. App source reviewed: `f80749a65b47441958e7c6fc485034d7efe446df`, code `2a40f48`. Status: **preparation Ready for review; cloud apply NOT RUN**. This package is not permission to run the hosted migration or a GPU job.

## Confirmed state and semantic reconciliation

Connector read-only access works. Canonical PostgreSQL is 17.6. No `fm_v2_*` tables or CLI migration-history table exist. The app identity migration is structurally present. Eleven subsequent SQL migrations are absent. Wardrobe storage bucket is private.

Do not replay `supabase/schema.sql`. The old name-based comparator reports 69 missing base keys, but many are names or extension-placement differences. The cloud has existing legacy primary keys/indexes/policies/update triggers with names without the `fm_` prefix. `pgcrypto` is installed in `extensions`, whereas the local manifest creates its functions in `public`. Do not relocate the extension, duplicate indexes/policies/triggers or install another copy to satisfy that report. `gen_random_uuid()` resolves as a PostgreSQL built-in; the eleven migrations passed the local rehearsal with pgcrypto in extensions.

Some differences are real and must remain explicit:

| Observation | Decision / implementation owner |
|---|---|
| `on_auth_user_created` on auth.users calls public.handle_new_user(), whose body inserts public.users; public.users does not exist | Claude prepares a guarded correction to public.fm_users. Preserve the existing trigger; inspect all callers and definition before replacement. Harden search_path/privileges and test actual signup semantics locally. This is a confirmed cloud definition defect, reproduced on synthetic local data; no cloud signup attempted. |
| Legacy fm_outfits.style_category is NOT NULL without a default; current POST /api/outfits omits it | Claude fixes payload/schema compatibility. Prefer preserving the legacy column and writing a validated category with a documented rule for multi-style archives; do not invent a misleading global default or drop the column. Fresh and legacy schemas both need regression coverage. |
| Legacy fm_outfits.is_saved exists with default false | Preserve its values and existing behavior; check whether app writes/reads need explicit mapping. |
| Wardrobe/outfit owner FKs reference fm_users, whereas repo base schema targets auth.users | These are not equivalent names. Preserve current FK targets/cascades; prove profile provisioning and old records remain compatible. Do not add a duplicate FK just to match the manifest. |
| fm_wardrobe_items.color/style are nullable; fm_users.email lacks the repo default | Keep current values/nullability unless a separate proven requirement needs a change. The analysis reservation RPC worked on a synthetic row with NULL color/style. No blanket backfill/NOT NULL operation. |
| Existing ownership policies have legacy names and some overlapping policies | Compare effective access, command, role, permissiveness, USING and WITH CHECK. Keep existing equivalent owner protection; do not assume a newly restrictive policy cancels a broad permissive one. |

Read-only aggregate checks found no auth users or identity mappings missing FitMatch profiles, and no wardrobe rows with NULL color/style at this observation. This is a point-in-time check, not a reason to tighten constraints. No emails, images, user rows or storage object names were exported to Git.

The 27 unrelated public tables without RLS remain a separate security finding. Do not alter their owners, policies or data during this FitMatch cutover. Their RLS/grant exposure needs a separately scoped owner decision; it is not fixed by this package.

## Apply order to finalize with Claude

1. Run [preflight.sql](./preflight.sql) read-only; bind canonical ref outside SQL using the connector target. Abort on drift/collisions. Full private inventory and bucket metadata must be refreshed before the actual cutover.
2. Capture a private logical schema/data backup and storage recovery inventory/copy as appropriate, then prove restore in disposable PostgreSQL matching hosted major version. A catalog JSON file and the synthetic rehearsal are **not** data backups. No full backup/restore proof exists yet.
3. Stage the existing eleven absent files listed and hashed in [migration-plan.json](./migration-plan.json), in order, against the restored baseline. Identity SQL already exists; verify rather than replay or pretend history is applied. Existing migrations are not all rerunnable: no bulk `db push` against an empty cloud history.
4. Claude generates a new compatibility migration with the installed CLI (discover version/help first). It must correct the auth trigger target with precondition checks and preserve existing records/constraints. It can follow the eleven files during cutover because their DDL does not provision auth users, but it must precede app/auth pilot traffic. Do not reuse immutable migration versions or alter already applied historical files. Outfit compatibility may require both an app payload fix and an additive fresh-schema change; keep them in the reviewed release.
5. Produce an explicit migration-history adoption strategy and audited apply runner/commands. The cloud has no CLI history: do not mark every historical file applied, synthesize fake apply evidence, or let the CLI infer that missing history means an empty DB. Record actual files, hashes, order, transaction results and database pre/post conditions. Review the exact strategy before cloud execution.
6. Full restored-baseline tests: old wardrobe/outfit/profile/identity rows unchanged, auth creation/profile provisioning, legacy outfit save/reopen, migrations, RLS/privileges/private buckets, analysis quota/dedupe/cancel/cleanup/fencing and cross-owner tests. Build/HTTP tests must use this reviewed source, not only a pristine schema.sql fixture.
7. Codex reviews exact SQL, compatibility code, restore proof and test evidence. Cloud application/HTTPS release is a later explicit execution step after a concrete package is reviewable. Cloud rollback initially leaves additive objects in place, turns Qwen OFF and revokes only the pilot worker; never drop schema to roll back the UI.

## Local rehearsal completed

Disposable network-none PostgreSQL16, synthetic legacy FitMatch subset constructed from observed column/constraint/policy/trigger metadata plus minimal auth/storage stubs. No cloud user rows, actual auth server, object-store bytes or model involved. Old FK names/targets, nullable fields and extra required outfit columns were retained. pgcrypto lived in extensions.

- Reproduced missing public.users on auth insert, then candidate target correction produced FitMatch profiles.
- Reproduced omitted style_category failure; an explicit validated category insert succeeded.
- All eleven absent migration files applied in order without replaying schema.sql.
- Synthetic wardrobe record, populated identity and refresh records retained exactly; unrelated sentinel and private wardrobe bucket preserved, new v2 bucket private.
- Quota RPC worked; analysis-reserve execute denied to anon/authenticated and allowed to service_role. Real SQL analysis reservation worked with legacy NULL attributes. Legacy cross-owner SELECT returned no rows.
- Eight focused checks plus eleven migration applications passed. An initial strengthened rerun encountered Docker's temporary initialization socket; readiness was corrected to TCP before final successful run. This is a harness correction, not a hosted regression.

Sanitized log: [rehearsal.log](./rehearsal.log). Private source inventory/harness remain outside Git. This rehearsal does **not** close cloud backup/restore, PG17, real Auth/Storage, full app route or native Windows gates.

## Real Qwen gate, separate from database readiness

Both PCs must ACK exact worker/policy/guard/native identity and owned-tree drain. Existing code passes focused Mac review; Windows is NOT VERIFIED. Require reviewed HTTPS app revision and canonical environment, private scoped worker enrollment and one finite pc-ai slot issued by 3D. One OS lock byte0, worker is sole lock owner, adapter does not reacquire it, lock retained until the owned process tree exits. During the slot 3D performs CPU preparation only. No inference or GPU rendering was started by this preparation task.

PC snapshot in this session: host unavailable for both chats. PR9 head `3f59cd24d369bad6c465d81113f94ce96cc98a18` and PR10 head `32267169391e825ac1569a25d4f762d098dbf82b` unchanged; no new native ACK demonstrated. Unreachable is not proof that the PC is stopped or idle.

## Reference used for operator guidance

Supabase's [migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI v3 changes](https://supabase.com/changelog/supabase-cli-v3): choose the installed CLI's explicit target from its help, not remembered defaults. The [database minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) was checked; this task does not upgrade the cloud database or modify crypto data.
