# QREV-CLEANUP-RACE — Claude fix for Codex re-review of 7631cb0 (CL-QRACE-20261108-01)

- Handoff: `docs/handoffs/prompt-claude-qrev-cleanup-race-20261108.md` (ops `8daabc0`, PROC-0021). Review: `docs/reports/review/qrev-recheck-20261108/review.md`. Receipt: `docs/reports/claude/qrace-receipt.md` (docs `ceae68b`, pushed before edits).
- Baseline `7631cb00114ddf559c234f1c0f13285dbb7305ab` on `codex/qwen-review-fixes`; all QREV-LOCK/QUOTA/SNAPSHOT/STATUS fixes kept, no history rewrite.
- Commits: `997104f` fix (migration, collector, tests), `ad6d1d7` runbook (**SHA under test**), report commit on top is docs/logs only.
- `scripts/worker/worker.py` **unchanged** since `bf0b6d7` (sha256 `4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb`): the pending PC native ACK for the 7631cb0 worker applies to this revision as is. No wire change.
- Flag stays OFF; collector is not scheduled/enabled anywhere; no production, no external storage deletion, no grant/deploy/migration outside disposable Docker PostgreSQL and the in-process fixture.
- Status: **Ready for review** (focused). Real integrated Qwen: NOT VERIFIED.

## Reproduced first

On the 7631cb0 functions (inside the full DB runner, before the new migration): reserve → intent due → `fm_v2_source_cleanup_due` lists the path → `fm_v2_analysis_enqueue` succeeds (asset `ready`, intent deleted) → late `fm_v2_source_cleanup_report` returns `updated 0`. Same as the reviewer's fragment; log line `REPRODUCED QREV-CLEANUP-RACE` in `logs/test-v2-db.log`.

## Fix (migration `20261108150000_qrev_cleanup_claim.sql`, additive)

- `fm_v2_source_cleanup_claim(token, limit, lease 30–3600 s)`: per owner, in fixed owner order, takes the **same advisory locks as enqueue (73 then 74)**, re-reads due rows `for update skip locked`, and:
  - unreferenced **pending reservation** → tombstoned (`deleted`) in the claiming transaction, so enqueue (which needs a pending asset) can never publish it afterwards → `SNAPSHOT_EXPIRED`;
  - `deleted` asset (CL-PRIV-01 original sources, deleted analyses, aborted reservations) → claimed;
  - `ready`/`rejected` asset or any asset referenced by an analysis → **never claimed**;
  - claimed rows get `claim_token` + `claimed_until`; only claimed paths are returned.
- `fm_v2_source_cleanup_claim_report(token, user, paths, ok, error)`: updates only rows of that owner still held by that token; releases the claim; failure keeps the existing backoff/attempt cap.
- `fm_v2_source_cleanup_due`: still a side-effect-free read (dry run), now skips rows under an active lease.
- `fm_v2_analysis_enqueue` (same signature): fenced reservation → `SNAPSHOT_EXPIRED` (was `INVALID_ASSET`).
- `fm_v2_analysis_abort` (same signature): only the owner's analysis reservations; reopens a **completed** removal of an unreferenced reservation so an upload that lands after the collector already removed the path is removed again (remove is idempotent).
- `scripts/source-cleanup.mjs --execute`: claim → remove exactly the claimed paths → report with the token. A crash or lost report leaves the claim to expire (5 min) and a later pass retries; a superseded pass's late report changes nothing. Dry run unchanged.

## Tests (logs in `logs/`, Linux workspace, Docker PostgreSQL 16, Playwright Chromium)

| Check | Result |
|---|---|
| `npm test` | 65/65 PASS (collector: claim is the first call, execute never removes from the due read, token on every report, failed claim removes nothing) |
| lint / build | exit 0 / exit 0 (build run before, never over, `next start`) |
| Python worker unit | 39/39 OK (worker unchanged; Linux, not native Windows) |
| `export-contract --check`, `check-qwen-contract.py` | current / PASS |
| `test:v2:db` | 10 PostgreSQL blocks PASS. New block: reviewer race reproduced then fixed; collector-wins → `SNAPSHOT_EXPIRED`; enqueue-wins → never claimed; **8 concurrent enqueues vs a claim → exactly one winner per snapshot** (published ⇔ not claimed); duplicate concurrent collectors take disjoint rows; active lease not re-claimed; lost report re-claimed after lease; superseded and foreign-owner reports update 0; failure releases claim with backoff; CL-PRIV-01 intents still claimed, a ready asset with a (defensive) intent never claimed; dry run has no effect; late upload reopened by abort (other owner / non-analysis asset cannot reopen); concurrent item delete; browser roles denied. |
| `test:v2` (real routes + PostgreSQL + browser + real `worker.py`, CPU mock adapter) | 14 PASS blocks. New in QINT/QREV block, with the **real collector** against the fixture: collector between upload and enqueue → 409 `SNAPSHOT_EXPIRED`, object removed, no analysis; collector completes while the upload is in flight, object lands late → 409 and the route removes it via reopened abort; enqueue-wins → collector finds nothing, every published snapshot still stored, no claim left. CL-PRIV-01 retention HTTP test (collector dry run + execute with storage outage) passes on the claim path. |

## Not done / blockers (exact)

1. **PC native ACK** of the worker at `7631cb0` (unchanged here): shared lock/guard/slot paths, 39 unit tests + startup/loop refusals on Windows — requested to PC3D/PC Qwen by Codex; not received by this session.
2. **Dedicated test environment does not exist for this session**: no test Supabase project URL, no service-role key for it, no HTTPS test deployment of this branch, no scoped worker enrollment token, no private channel to receive them. Without these, the next step (one licensed photo: browser → authenticated test API → PC Qwen real → human review under the shared lock, with no-cross-owner and no-GPU-overlap evidence) cannot be run. Not bypassed with a public PC API, tunnel or the production project.
3. Real Qwen quality/timing and 3D↔Qwen contention logs: not run. Mock adapter results are plumbing evidence only.
4. Residual (documented, not closed): if an upload is still in flight longer than the 15-minute grace **and** the app process dies before enqueue, the late object has no open intent. Closing that needs a storage-listing reconciliation sweep, out of scope here.

## Process delta (for Codex to merge)

- CL-QRACE-20261108-01 (Claude, cloud workspace): QREV-CLEANUP-RACE fixed on `codex/qwen-review-fixes` from `7631cb0`; commits `997104f`, `ad6d1d7` + report. Ready for focused review. Real Qwen test still blocked on PC native ACK + dedicated test env/credentials.
