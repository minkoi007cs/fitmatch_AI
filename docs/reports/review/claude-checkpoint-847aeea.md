# CX-FRESH-HANDOFF-29 - Claude checkpoint review

> Subsequent evidence: app0c4c44e adds the successful test:v2 run2 log without code changes. [Latest reconciliation](./progress-claude-pc-20261109.md) supersedes the interrupted-rerun status here; R-MIGTARGET-29 remains open because runner bytes are unchanged.

Owner explicitly stopped Claude for usage limits and requested a fresh AI handoff. This is a focused source/evidence review, not full cloud acceptance.

## Exact revisions

- App branch: codex/canonical-migration-26, HEAD `847aeea27d1fa5970231c3445ac89a3c5c61a809`.
- Implementation: cf902d3; 847aeea adds report/logs. Baseline f80749a.
- Draft PR15: head docs/claude-CL-MIGRATION-20261109-01 at `5d08c984d21ddb529cd494de6c78c541c3f6d62b`, base codex/project-operations. GitHub metadata confirms only two changed documentation files. It is NOT the app code PR. Its automatic Vercel preview is not evidence that source847aeea is deployed/tested.
- Source report: docs/reports/claude/migration/report.md on the app branch, read in full.

## Delivered and verified limits

Auth compatibility SQL corrects handle_new_user in place to fm_users, empty search_path, retained trigger, guarded schema and preserved records. Outfit POST writes validated shared style_category and is_saved=true, rejects mixed/mismatched styles. The comparator, hosted-default privilege model, cutover plan/runner and legacy/fresh fixture are implemented. Existing historical SQL is retained.

Codex independently ran `npm test` on847aeea: **76/76 PASS**, exit0, Mac reviewer worktree. All 12 planned SQL hashes and the schema-manifest hash match source. Key SQL/route/runner were inspected. No fresh full build/PG17 legacy/DB/HTTP/browser suite was run by this reviewer; those PASS claims remain Claude-reported.

Claude's test:v2 log confirms failure at scripts/test-qwen-http.mjs:183, waiting 15 seconds for the AI proposal panel after the worker stored a review result. Rerun was interrupted by the owner's stop. It is NOT VERIFIED, not established as flaky or unrelated. Fresh agent must reproduce and compare f80749a in the same environment if needed.

Fresh canonical read-only check: v2 table count0; auth function still names obsolete public.users. Fixes are in the candidate source, not installed in cloud. No SQL writes, signup probes, deployment, credential read or GPU work by this review.

## R-MIGTARGET-29 - target guard needs correction before hosted execution

In scripts/migration-cutover/apply.mjs the hosted target check accepts either the exact canonical direct hostname OR any URL whose decoded username ends with `.<expectedRef>`. The latter does not constrain hostname or require the exact expected migration username. Thus an arbitrary database host can pass the target guard. This breaks the expected-project fail-closed guarantee of the cutover tool.

Deterministic offline reproduction on847aeea:

1. A fake psql executable writes a marker, prints FAKE_PSQL_CALLED_NO_NETWORK, exits7; it never connects.
2. Set synthetic DATABASE_URL to `postgresql://postgres.gohczmqykjkrgdblgbog@example.invalid/postgres` and run the default dry-run with canonical plan/ref, private audit dir and `--psql` pointing to that fake.
3. Actual: fake executable is reached; runner exits3 with cannot-connect. Expected: target identity refusal, exit2, BEFORE invoking psql.

No real credentials, cloud connection or --execute were used. This is an execution guard defect, not a claim that a wrong cloud database was migrated. **Hosted execution remains NEEDS CHANGES** until this finding and the incomplete UI verification are resolved.

Fresh agent should validate supported PostgreSQL scheme, canonical direct endpoint or explicitly trusted Supabase pooler endpoint together with exact project-bound username. Reject unverified hosts even with a matching username suffix, wrong refs/users and malformed URLs before any psql call. Preserve loopback-only isolated tests. Derive allowed endpoint forms from verified configuration/current official documentation; do not add an override that silently bypasses binding. Add offline regressions proving zero psql calls for refused targets.

## Transfer

App implementation ownership can transfer from the stopped Claude to the next AI under the owner's explicit request, after a receipt. Codex retains independent review/docs coordination. Start from847aeea, not main/d2a9898/f80749a. Preserve all prior recovery, cleanup-claim and GPU binding fixes. Scoped prompt: [fresh AI resume](../../handoffs/prompt-fresh-ai-migration-resume-20261109.md).

PC ownership remains split: 3D owns coordinator/guard/render; AI owns Qwen adapter/runtime. Last known dispatch: AI message accepted, execution receipt not verified; 3D failed steering twice and live snapshots unavailable. Do not infer GPU idle. Native policy ACK, private backup/PG17 restore proof, reviewed HTTPS serving revision, scoped worker enrollment and real model smoke remain open.
