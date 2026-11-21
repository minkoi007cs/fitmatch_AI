# QREV — Claude fixes for Codex review of 95d59ad (CL-QREV-20261108-01)

- Handoff: `docs/handoffs/prompt-claude-qwen-review-fixes-20261108.md` (ops `218bc20`, PROC-0020). Review: `docs/reports/review/qwen-code-20261108/review.md`.
- Baseline `95d59ad5846d78f47209041a76198ad56c378f58` (`codex/qwen-app-test`, checkpoint 3 kept). Branch `codex/qwen-review-fixes`.
- Commits: `a2ffe84` QREV-LOCK; `bf0b6d712a50c3aa15a03362a26d32a9aba47eaa` QREV-QUOTA/SNAPSHOT/STATUS (**code SHA under test**); report commit on top is docs/logs only.
- Feature flag `QWEN_ANALYSIS_ENABLED` stays OFF by default. No production grant/deploy/migration/merge. PC guard/runtime/adapters, `tools/acceptance` and main `process.md` untouched (delta below).
- Status: **Ready for review** (Codex). Not an integrated Qwen PASS: no native Windows run, no real Qwen, no Supabase/HTTPS test env.

## Findings → fixes

| Finding | Reproduced first | Fix | Tests |
|---|---|---|---|
| P1 QREV-LOCK (default lock ≠ PC3D lock) | config example + runbook used `default`/PROGRAMDATA path → separate OS lock | Worker refuses to start (exit 5) with `garment.analyze` unless `gpuLock` is an explicit absolute **existing** file (never created; `FileLock(create=False)` opens `r+`), `gpuGuard {path, sha256}` matches (rechecked before each claim), `gpuSlot` absolute. Before each claim, while holding the lock, the slot is validated with a port of the guard's rules (owner, ≤3600 s, skew 5 s, missing file = pc-3d only, strict JSON). Refusal releases the lock and claims nothing. Env markers are not proof. Drain also waits for tracked Windows process handles to be signaled (native finding: ActiveProcesses==0 can precede signal by 0–16 ms). Example config/runbook/contract docs use neutral absolute placeholders. | 39 Python unit tests (startup refusals incl. no lock created, slot rules, guard swap, loop refusal, main exit 5, tracked handles); HTTP: other-owner slot refused before claim via real `worker.py` |
| P2 QREV-QUOTA (analysis bypassed 50/day, 20 active) | PostgreSQL: old enqueue → 21 active jobs | `fm_v2_analysis_reserve` (lock 73 → 74, same order everywhere) applies the existing job policy (50/UTC day, 20 active, shared with 3D) and asset policy (100/24 h); dedupe returns first and consumes nothing. `fm_v2_analysis_enqueue` rechecks job quota atomically. Retry checks the active limit like `fm_v2_job_action`. No new limits invented. | DB: boundaries both directions with 3D, daily vs older days, asset limit, retry, 6 concurrent enqueues at 17 active → exactly 3; HTTP: full queue → 429 before any upload |
| P2 QREV-SNAPSHOT (upload/insert/enqueue failure orphaned private copy) | PostgreSQL: enqueue failure leaves `ready` asset with 0 cleanup intents | Reservation (pending asset + CL-PRIV-01 intent due after 15-min grace) is committed **before** upload. Enqueue finalizes (asset ready, intent removed). Route compensation `fm_v2_analysis_abort` tombstones only unreferenced reservations and makes removal due now; route removes and reports immediately; if that fails the durable intent remains for `scripts/source-cleanup.mjs`. Lost race tombstones only the loser; winner never touched. Lost enqueue reply: abort sees the analysis and keeps it. Late enqueue after the collector ran → `SNAPSHOT_EXPIRED`. | DB: item edited/deleted while uploading, quota taken during upload, crash after reserve → collected after grace then SNAPSHOT_EXPIRED, foreign abort refused, idempotent abort, completed never reopened, lost race; HTTP: storage outage on upload (503) and item edit during upload (404) leave no object and a completed removal record |
| P2 QREV-STATUS (queued vs GPU busy) | UI said "waiting for PC" while the shared lock was held | Worker heartbeat carries optional `gpuBusy` (lock held elsewhere or slot of the other PC owner), sent immediately on transition. `fm_v2_workers.gpu_busy` (additive). `GET /api/v2/analyses` returns `gpuBusy` only from the owner's own online granted workers. UI: "PC đang bận GPU với việc khác…", no attempt consumed, no hint whose work. | Python: transitions/booleans; HTTP: held lock → no claim, attempt/deferrals 0, owner sees busy, second account sees `workerOnline:false, gpuBusy:false` |

`gpuBusy` is an additive, optional field of the app's own heartbeat schema (the local extension already used for `garment.analyze`); the exported v1-r2 JSON schemas and the PC adapter contract are unchanged. Listed for Codex/PC acknowledgement.

## Verification on `bf0b6d7` (logs in `logs/`, Linux workspace, Docker PostgreSQL 16, Playwright Chromium)

| Check | Result |
|---|---|
| `npm test` | 64/64 PASS, exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (run before, never over, `next start`) |
| Python worker unit (`test_worker_unit`) | 39/39 OK, exit 0 — Linux, **not** native Windows |
| `export-contract --check` | 48 files current |
| `check-qwen-contract.py` | PASS (jsonschema installed in workspace) |
| `test:v2:db` | 9 PostgreSQL blocks PASS incl. REPRODUCED + PASS QREV, exit 0 |
| `test:v2` (HTTP + browser + real `worker.py`, CPU **mock** adapter, synthetic guard/slot) | 14 PASS blocks (incl. QINT-C + QREV), exit 0 |

## Still blocked / not verified

1. Native Windows: Job Object + tracked-handle drain, msvcrt byte-0 lock on the real `gpu0.lock`, startup/loop refusals — PC3D must run `pc-ack-checkpoint.md` §3 on this commit.
2. PC3D ACK of the exact absolute lock/slot/guard path + guard hash + no nesting; PC Qwen final conformance on real output.
3. Test environment: dedicated Supabase project + HTTPS deploy + scoped worker token via private channel — not available to this session; nothing opened on the PC (no port/tunnel).
4. Real Qwen quality/timing, 3D↔Qwen contention logs: not run. PC-PHOTO-019 is fitting evidence, not app integration.

## Process delta (for Codex to merge into process.md)

- CL-QREV-20261108-01 (Claude, cloud workspace): QREV-LOCK/QUOTA/SNAPSHOT/STATUS implemented on `codex/qwen-review-fixes` from `95d59ad`; commits `a2ffe84`, `bf0b6d7` + report. Ready for review. QINT-C capability grant still blocked on Codex review + PC3D/PC Qwen ACK + test env.
