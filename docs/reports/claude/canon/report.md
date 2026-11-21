# QREV-BIND-02 + ENV-CANON-01 — Claude report (CL-CANON-20261109-01)

- Handoff: `docs/handoffs/prompt-claude-canonical-backend-20261109.md` (ops `7b247ba`, PROC-0024, BACKEND-024) with `prompt-claude-final-gpu-binding-20261108.md` / H-QFINAL-022 and the PC repro (`docs/pc-safe-008-20261107`, `qfinal022-report.md`). Receipt pushed before edits: `docs/claude-CL-CANON-20261109-01` @ `301d624`.
- Baseline `579ece2` (cleanup focused PASS kept, queue/collector not rewritten). Branch `codex/qwen-review-fixes`, no history rewrite.
- Commits: `8c297fe` binding + backend identity (early checkpoint pushed), `2d629a3` schema inventory tooling, `2a40f48` Windows-safe binding checks — **code SHA under test `2a40f48`**; report commit on top is docs/logs only.
- Hashes on `2a40f48`: `scripts/worker/worker.py` `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6`; `gpu_coordinator_policy.py` `9d600e87…f47b`; `src/lib/backend-identity.mjs` `7ccdbe75…5b6a`; `schema-manifest.json` `1a09fcf6…0ffa`; `schema-inventory.sql` `7bf229c6…7072`. Exported v1-r2 JSON schemas unchanged (export-contract current); Qwen adapter contract unchanged.
- Flag OFF by default. No deploy, no cloud migration, no worker grant, no GPU, no access to the canonical database from this session.
- Status: **Ready for review** (Codex). Native ACK, canonical inventory and real Qwen: **NOT RUN**.

## QREV-BIND-02 — what was fixed

Native finding (both PCs): a config naming another existing absolute lock/slot was admitted while the canonical lock was held. Fix (proposal shape, needs PC3D + Qwen ACK):

- Shared-GPU configs may no longer name `gpuLock`/`gpuSlot`/`gpuGuard` (refused, exit 5). The only input is `gpuCoordinator {path, sha256}` → PC3D policy `<workspace>/coordination/gpu-coordinator.json` written by the coordinator from the **existing** lock with `scripts/worker/gpu_coordinator_policy.py write`. It records the lock's file identity (volume + file id) and the guard's relative path + sha256.
- Lock/slot/guard are derived; the **opened handle** must carry the recorded identity (copied/restored coordination folder with byte-identical policy, replaced file, link to elsewhere → refused; an alias of the same file stays one exclusive lock). Slot/lock/policy must not be symlinks/junctions (other reparse points allowed); guard must resolve inside the workspace. Policy hash, guard hash, held-handle identity and slot are rechecked before every claim; a lock replaced after start stops the worker (exit 5) before claim. Worker remains sole owner, no nesting, env markers never proof.
- Checkpoint for native ACK with the exact matrix and commands: `pc-binding-checkpoint.md`. The PC repro script (sha `8290691…`) now stops at its first constructor call with the legacy-key refusal, so the regression matrix lives in `test_worker_unit.py`.

## ENV-CANON-01 — what was added

- `src/lib/backend-identity.mjs` (shared by app, operator scripts, tests): approved refs = `gohczmqykjkrgdblgbog` only (adding one is a reviewed code change); `FITMATCH_EXPECTED_SUPABASE_REF` required; URL exactly `https://<ref>.supabase.co`; JWT keys must carry the same ref and role (new-format keys carry no claims: URL + ref decide and the project rejects foreign keys); `smoke-supabase` refused in every position and mode; `FITMATCH_BACKEND_MODE=isolated-test` accepts loopback only and refuses any `*.supabase.co`.
- Enforced before any request: admin client, user server client, session refresh in the proxy (protected pages 503, public pages still render), startup log in `src/instrumentation.ts` (prints project ref or reason only), worker routes → 503 `BACKEND_IDENTITY_MISMATCH` before worker auth touches a database; `manage.mjs` (enrollment/grants), `source-cleanup.mjs`, `gc-dry-run.mjs` exit 5 with no token minted / nothing removed, and print only the target ref.
- Worker: heartbeat reply now carries `backend.projectRef` (additive field of the app's own transport); `expectedBackend {projectRef, appOrigin}` is required with `garment.analyze` (HTTPS origin unless loopback, smoke refused) and the worker stops before claim on mismatch.
- Docs: runbook rewritten for the canonical pilot (no new test project, no blind migration chain, rollback = flag OFF + ungrant), contract/preflight/README/pc-worker-connect updated, config example uses placeholders only.

## Canonical schema/RLS/storage/migration inventory — prepared, NOT RUN

- `scripts/schema-inventory.sql` (read-only catalog query, no user rows/object names/secrets) + bucket and migration-history queries in `docs/infrastructure/canonical-schema-reconciliation.md`.
- `scripts/schema-manifest.mjs` builds `docs/infrastructure/schema-manifest.json`: `schema.sql` + 12 migrations applied to a Supabase-like stub in disposable Docker PG16 (13 steps, 441 objects), self-check, `--check` drift guard.
- `scripts/compare-schema-inventory.mjs`: per-migration applied/partial/absent/present-differs, extra cloud objects (never dropped), public tables without RLS, public buckets.
- Recovery procedure (private dump + storage copy + restore proof on Docker) and a reconciliation proposal template are in the same doc. The Docker chain does not prove the cloud schema matches.

## Verification on `2a40f48` (logs in `logs/`, Linux workspace, Docker PG16, Playwright Chromium)

| Check | Result |
|---|---|
| `npm test` | 72/72 PASS (incl. backend identity: canonical/wrong/retired/isolated cases, route 503 with no network call, `manage.mjs`/`source-cleanup`/`gc-dry-run` exit 5 on smoke; schema compare logic) |
| lint / build | exit 0 / exit 0 (build never over `next start`) |
| Python worker unit | 56/56 OK on Linux (binding matrix, coordinator helper, backend binding). **Not native Windows.** |
| export-contract / qwen contract | current / PASS |
| `test:v2:db` | 10 PostgreSQL blocks PASS (unchanged SQL; cleanup race block still reproduces-then-fixes) |
| schema manifest `--check` | current, self-check all applied |
| `test:v2` | 14 PASS blocks, exit 0 (real routes + PostgreSQL + browser + real `worker.py`, CPU mock adapter, synthetic coordinator workspace written by the PC3D helper, backend mismatch exit 5 before claim) |

## Blockers (exact)

1. **Native ACK** (PC3D + Qwen): Windows unit run, real policy written from the real lock, verify, negative matrix, `os.stat`/`os.fstat` identity equality on that NTFS volume — not available to this session.
2. **Canonical database access**: the connected Supabase account sees another org; no read-only connection to `gohczmqykjkrgdblgbog` exists here, and no credential may be requested in chat. Inventory/backup/compare must be run by the owner from the Dashboard (or via a correctly authorized connector) before any additive migration proposal can be specific.
3. **Reviewed HTTPS revision + scoped worker token**: the existing HTTPS app must serve this reviewed revision with `FITMATCH_EXPECTED_SUPABASE_REF` set before any PC enrollment; token delivered privately. Not done (no deploy authorized).
4. Real Qwen quality/timing and 3D↔Qwen contention: not run.

## Process delta (for Codex)

- CL-CANON-20261109-01 (Claude, cloud workspace): QREV-BIND-02 + ENV-CANON-01 implemented on `codex/qwen-review-fixes` from `579ece2` → `8c297fe`, `2d629a3`, `2a40f48` + report. Ready for review. Real Qwen pilot blocked on native ACK, canonical inventory/backup/reconciliation, reviewed HTTPS revision + scoped token.
