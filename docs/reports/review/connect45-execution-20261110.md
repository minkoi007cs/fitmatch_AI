# CONNECT-45 — canonical recovery and connection execution

10 November 2026. Owner explicitly requested actual DB backup/restore and direct app→PC/Qwen testing. Codex operates the existing canonical `fitmatch-ai` project; source baseline6ec119a, serving app7397b6a. Branch `codex/connect-45` owns cutover plan/docs. Claude separately owns CL-UX-FIX-46 UI/tests on its own branch; PC owners retain adapter/coordinator ownership.

## Actual recovery evidence

- Saved local administrator configuration is mode600/Gitignored; credentials are never published. Early authentication failures stopped before SQL; owner corrected and saved the file, then actual PostgreSQL17.6 authentication succeeded.
- Pinned SupabaseCLI3.0.0 official role/schema/data dump scripts, actual managed Auth/Storage customizations plus password-free managed-platform definitions, business/catalog fingerprints and all referenced Storage bytes captured privately.
- Consistent read-only exported transaction snapshot shared by schema/data dumps and comparison queries. Previous snapshots/evidence kept; source data never rewritten for testing.
- Two actual buckets,14objects,20,354,806bytes. Size/plain-MD5/every-SHA256 checked. Backup manifest verification:92checksPASS.
- Actual restore target: official `supabase/postgres:17.6.1.166`, digest `sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86`, networknone. Actual managed schema definitions, role options and extensions loaded. Fresh-cluster grantor differs from hosted Supabase; only local platform bootstrap removes explicit GRANTED BY clauses while retaining role membership options. Original backup remains unchanged. Hosted realtime publication provisioned on the local target before restore. No errors ignored.
- Source uses ICUen-US153.121; initial libc target gave order-dependent aggregate hashes. Fresh ICU target now matches **business and all-table fingerprints**, **69COPYtables /340rows byte-for-byte**, and **666catalogkeys /0differences** under identical public/extensions search path. Initial qualification-only catalog differences are retained as failed comparisons, resolved by matching search path rather than changing definitions. The initial theory of live data changes was not proven; locale mismatch explains the aggregate discrepancy.
- On the actual restored copy, reviewed runner dry-run12pending then execute12APPLIED+VERIFIED. All original69tables/340rows remain byte-identical (expected new private fitmatch-v2 bucket excluded),14Storagebytes rehashed. Signup creates fm_users, outfit save/reopen and cross-owner denial passed inside a rolled-back local transaction. Legacy nullable color/style and required style_category preserved; no worker rows created in this proof.

This is actual canonical backup/restore evidence, distinct from prior synthetic rehearsals. Full private backup, raw rows/photos and logs remain under the ignored private backup directory; they are not synced to PC or stored in Git. Supplementary platform role grantor is an explicit local provisioning difference, not a claim of identical hosted services.

## Target and scope review

The owner-supplied exact session host `aws-0-us-west-2.pooler.supabase.com:5432` is allowlisted, bound to canonical username and supported by official project region metadata, successful authenticated backup and matching canonical Storage objects. All other hosts/users/ports/query overrides remain refused. SQL files, schema manifest and worker hash unchanged. Target suite33/33PASS; plan/README/report-only changes do not require a new frontend build.

Canonical runner dry-run exit0: identity migration VERIFIED PRESENT and12wouldapply. Qwen remainsOFF, workers not enrolled, no GPU slot issued at this checkpoint. Actual canonical execution/postchecks are recorded below only after observed outcomes. No schema replay/reset, unrelated app RLS changes, public PC ports, paid resources or concurrent GPU work.

## Parallel readiness

Both existing PC chats acknowledged CONNECT45 preparation. AI reserved an owner-only local token and sent its SHA256 only; raw token remains on PC. Config targets exact HTTPS origin/backend, disabled pending backend readiness and finite coordinator slot. Coordinator publishes existing native evidence and checks actual process-tree quiescence; unknown processes remain a gate. No inference follows merely from this report.

Claude CL-UX41 report-only bundle6968f35 was received and verified; two medium UI findings and copy minors assigned CL-UX-FIX46 with exclusive UI/test scope. Codex checks that active Claude session every15minutes while this execution remains active; no claim of background monitoring after the session ends.
