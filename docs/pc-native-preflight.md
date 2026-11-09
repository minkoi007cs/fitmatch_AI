# PC native preflight — INT-01A / CX-PC-PREFLIGHT-13

Read current operating documents on `codex/project-operations` first. Read application source from `codex/full-look-reviewed` in a separate clean checkout; record the full SHA. Do not pull this app branch over the active GPU engine checkout. Reuse existing Python; no model download, inference, admin installer, service registration or server enrollment is needed for these checks.

## 1. Native OS locking

From the app checkout, run in PowerShell:

```powershell
python -I scripts/worker/test_worker_unit.py -v
if ($LASTEXITCODE -ne 0) { throw "Worker preflight failed" }
```

18 tests are expected at this revision. The new test starts an isolated child Python process, verifies another process cannot acquire the same temporary lock, terminates only that test child, then verifies OS lock recovery. It never opens the production GPU lock or loads a model. The inherited-descriptor assertion is POSIX-only; Windows correctly uses containment rather than `pass_fds`.

macOS result: 18 PASS. Windows result: NOT RUN by Codex. The containment unit tests use injected binders; their success is not a native Job Object test.

## 2. Native containment binding

Run in a fresh child Python process, with working directory `scripts/worker`:

```powershell
python -c "import worker; print(worker.ensure_process_containment({}))"
if ($LASTEXITCODE -ne 0) { throw "Native containment binding failed" }
```

On Windows require `windows-job-object`. Do not set `unsafe-disabled` to obtain a passing result. Record error type and context if binding fails. This checks binding only. Separately test a disposable worker/adapter child process tree: terminate the disposable parent and verify its child exits; do not terminate existing engine jobs. Report that test separately before live enrollment.

## 3. Shared GPU coordination

The production worker default is `%PROGRAMDATA%\fitmatch\gpu-0.lock` (fallback temp directory if PROGRAMDATA absent); an explicit `gpuLock` path overrides it. **QREV-LOCK + QREV-BIND-02:** for any config with `garment.analyze` (or `requireSharedGpuLock: true`) `gpuLock`/`gpuSlot`/`gpuGuard` are refused; the worker is bound by `gpuCoordinator {path, sha256}` to the PC3D policy `<workspace>/coordination/gpu-coordinator.json`, which records the canonical `gpu0.lock` file identity (volume + file id) and the guard's relative path + hash. Lock/slot/guard are derived from it; an opened lock with another identity (copied/replaced/aliased elsewhere) is refused before claim (see docs/qwen-test-env-runbook.md, `scripts/worker/gpu_coordinator_policy.py`). The earlier split prompt used another path as an example. PC 3D and Qwen must ACK the same absolute path and byte-0 msvcrt lock, acquire before GPU load, and hold until GPU children have exited/unloaded. The temporary unit-test lock does not verify Qwen's wrapper. No two simultaneous GPU benchmarks to test exclusion.

## 4. Adapter contract remains a prerequisite

PC's last report describes a strict ten-field local input. Current worker writes eleven fields including `protocolRevision`, with new nested media/output contract fields. Do not declare compatibility based only on server JSON schemas or strip fields silently. Capture an actual synthetic manifest produced by `run_lease_bound`, test it through PC CLI, agree supported version and explicit additions, then add rejection tests for unsupported versions/unknown fields. Include top and bottom kinds, video/face roles, shared frame, and bounded exit78/exit2 JSON behavior. Never enable bottom or avatar capabilities from a validator-only success.

Return a sanitized report with app SHA, adapter SHA, native test commands/exits, shared-lock ACK from both PC chats, and contract acceptance/rejection output. Preserve checkpoint004, weights, fitting and MSVC/UAC pause. Continue independent model/render work already authorized. Real assets and personal likeness remain separate gates.
