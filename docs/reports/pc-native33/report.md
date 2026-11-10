# PC-NATIVE-33 / GPU-READY-33 — native fixture verified, no GPU grant

Session **PC-20261109-NATIVE33**, PC3D on native Windows. Operations read in full and in order at **8ab74aca3c2d994d2d44b149a3f9a46fdd536e42 / PROC0032**, followed by APP-CLOSE-30 independent review and the PC checkpoint handoff. PC baseline **73613fda093c3803e45932f286b0e89a58759a3d**, clean; owned branch `codex/pc-native-33`. Read-only readiness implementation **74a97a3455e2bae70b9d0ed303d210948231e9c3**. No earlier PC-NATIVE-33 completion was found; this is the first full native run of this exact reviewed fixture here.

## Actual native result

**56 tests run: 47 PASS, 9 skipped, 0 failures, 0 errors; exit0.** Unittest internal time **1.594s**, launcher wall **1.741398s**. Python3.10.22, Windows/AMD64; existing separate SiTH Python environment, no packages installed. Commands ran directly on Windows, not WSL or a mocked OS. Many individual units intentionally mock kernel/client behaviour; this does not make all47cases independent real-GPU/process-tree integrations.

```text
cd scripts/worker
python -m unittest -v test_worker_unit
```

Source was fetched from `codex/app-close-30-claude-20261109` and checked out detached in a NEW disposable test worktree. Existing f80749a and7631review worktrees were not reset/overwritten. Checkout was clean before and after testing. Checkout creation used `core.autocrlf=false` for that command only, so actual tested raw bytes equal the Git LF blobs. No persistent Git/global environment setting changed.

| Item | Verified SHA256 |
|---|---|
| App HEAD |499ead01e7f9274ddf310ab346fda4c2464588bd (Git commit)|
| Exact reviewed patch |50ddd9cb14d893c4f6bdbf7c099e5e4e6c16dc54a333294c8837c2674bde5fd3|
| Resulting `test_worker_unit.py` |f178f7f0ff2723b8e0b5f3235c2da71a1565d9138bd04529362f4223d8a86429|
| Production `worker.py`, raw=Git LF |ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6|

The exact test-only change is already integrated in candidate499ead0 (commitf591d96); it was **not applied twice**. `git apply --reverse --check` against the published patch passed. Production worker diff fromf80749a is empty. The copied-policy test now PASS: fixture copy occurs before canonical byte locking; admission identity refusal and the alternate split-lock assertion still execute while the canonical fixture lock is held. No assertions were weakened, no production source was edited, and the older local8a9fdeproposal is not substituted for this reviewed50ddd9patch.

The raw stdout/stderr logs, exact byte hashes and all skip names/reasons accompany this report. Stdout warning/busy/quarantine/backend-refusal messages are **intentional synthetic unit fixtures**, not telemetry from a live Qwen job or actual unsafe-enabled configuration.

### Skipped cases and limits

Five `QuiescenceTests` are POSIX-only: drain-owned-grandchild, exited-grandchild zombie, lock-until-drained, old-launcher-poll and SIGTERM-ignoring-grandchild. Reason: `POSIX process-group drain; Windows uses the per-job Job Object (native PC test)`.

Four `SharedGpuAdmissionTests` skip because `symlinks not permitted here: OSError`: workspace-alias exclusion, forged/linked slot, guard link escaping workspace, and linked lock/policy. Symlink privilege/Developer Mode/Admin settings were not changed. A skipped test may execute assertions before its skip; it is still reported skipped, not partially counted as PASS.

Historical PC-BIND-25 supplemental18cases remain preserved and are **not new runs**: actual Windows junction alias/swap/protected-path cases and3owned interpreter/grandchild drain cases, with observed process handles signaled before unlock, external sentinel survived and explicit queue/heartbeat stubs. Production worker bytes are unchanged, so these results were reused. They do not convert all POSIX/symlink skipped cases into native PASS. Codex must review the scoped ACK and remaining coverage; a suite exit0 is not live acceptance.

## CPU readiness inventory

New read-only `probe_native33_readiness.py` validated actual `SharedGpuAdmission` binding without creating a FileLock, acquiring byte0, running a worker loop or using a server. Existing policy and guard hashes match:

- Policy `789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039`.
- Guard `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c`.
- Existing lock volume **3699583840**, fileId **2251799814103012**, matching policy/stat/open-handle fstat. No lock recreation, replacement or policy re-pin.
- Existing slot belongs to `pc-3d` and is expired. Both unchanged worker and guard finite-slot validators refuse it: `Invalid or expired GPU admission window`. No slot refresh or pc-ai grant.
- Historical named guard Job Object currently absent (`OpenJobObjectW` query-only, error2). Saved guard/child process objects are no longer live at those identities. No process termination was performed. Saved completed/drain timestamps remain historical evidence.
- A read-only CIM snapshot found0matching known FitMatch/Qwen/Blender Python processes among316processes;120command lines were unavailable. This is a bounded snapshot, **not global-idle proof**, GPU occupancy measurement or permission to start a job. A future grant requires fresh peer/owned-tree evidence and actual OS-lock exclusion.
- Five existing Qwen adapter source hashes match the historical peer ACK. No peer tests or adapter review are claimed as new PC3D execution. The expected operator-approval file is absent. Existing private config plan has no reviewed serving HTTPS origin; credentials were not read or installed.

Protected actual policy/guard/lock/slot/state and private FACE31 GLB hashes/file identities remained unchanged across this run. No private appearance assets were rebaked/rerendered. FACE31 still has `identityAccepted=false` and visibly failed semantic alignment. Its existing gap report is reused; no new fitting/texture/camera benchmark was run merely to update this handoff.

## Remaining gates / handoff

GPU-READY-33 means **CPU checklist ready for review**, not ready for live Qwen. Follow the separate checklist: Codex scoped-native/skip review and peer ACK; canonical private recovery/Storage-byte/role/schema proof and backend preflight; approved exact target/SQL execution scope; reviewed HTTPS origin/serving revision/project binding; private scoped worker enrollment and bounded operator approval; fresh peer/owned-tree proof immediately before a finite pc-ai slot. No slot is issued here.

Integrated worker remains the sole owner of the one canonical byte0 OS lock. Adapter runs directly without nesting the guard. Hold the lock through actual owned-tree drain; an unknown drain result quarantines and blocks new claims. Qwen and3D rendering/inference must never overlap. No public PC port, cloud SQL/deploy/migration, paid service, foreign-process kill, fitting/inference/render/download, driver change or restart occurred. MSVC/UAC remains paused; compiler-dependent SiTH nvdiffrast/Warp/drape are not resumed.

Claude APP-RECOVERY-32 retains app/SQL/recovery ownership. Canonical backend stays `fitmatch-ai / gohczmqykjkrgdblgbog`; smoke is deprecated. This report changes the previous Windows fixture result from46PASS/9skip/1ERROR to the new exact-source47PASS/9skip/0ERROR. It does not erase the old evidence, waive unresolved gates or claim product/likeness acceptance. Publish only safe report/log/hash/ACK/source snapshots through PR10; private checkpoints and raw machine process identities stay outside Git.
