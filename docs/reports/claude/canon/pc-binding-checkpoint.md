# QREV-BIND-02 — checkpoint for PC3D / PC Qwen native ACK (CL-CANON-20261109-01)

Source for native review: `codex/qwen-review-fixes` at the commit named in `report.md` (worker changes in `8c297fe` + `2a40f48`). This is a request for a native ACK, not evidence that the PC ran anything. No real paths, tokens or credentials here; real values stay in each PC's private config/receipt.

## What changed for the PC (shape is a proposal: PC3D + Qwen ACK needed)

- A worker config with `garment.analyze` (or `requireSharedGpuLock: true`) **must not** contain `gpuLock`, `gpuSlot` or `gpuGuard` → `Refusing to start … only from the pinned PC3D coordinator policy` (exit 5).
- Instead: `"gpuCoordinator": {"path": "<abs>/Fitmatch-GPU/coordination/gpu-coordinator.json", "sha256": "<policy sha from PC3D receipt>"}` and `"gpuSlotOwner": "pc-ai"`.
- The policy is written **once by PC3D** from the existing lock (never creates it):

  ```
  python scripts/worker/gpu_coordinator_policy.py write --workspace <abs>/Fitmatch-GPU --expected-guard-sha256 47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c
  ```

  Shape (`fitmatch.gpu-coordinator.v1`): `coordinator: "pc-3d"`, `owners: ["pc-3d","pc-ai"]`, `lock: {name: "gpu0.lock", volume, fileId}`, `slot: {name: "gpu0-slot.json"}`, `guard: {relativeToWorkspace: "fitmatch_AI/workers/windows/gpu_guard.py", sha256}`, `issuedAtUtc`. The helper prints the policy sha256 for the receipt.
- Worker derives lock = `coordination/gpu0.lock`, slot = `coordination/gpu0-slot.json`, guard = `<workspace>/<relativeToWorkspace>`. The opened lock handle must have the recorded `(volume, fileId)`; slot/lock/policy must not be symlinks or junctions (OneDrive placeholder reparse points are allowed); guard must resolve inside the workspace. Before every claim (lock held): policy hash, guard hash, held-handle identity, finite slot. Lock replaced after start → exit 5 before claim.
- Unchanged: worker is the sole lock owner, adapter gets `FITMATCH_GPU_LOCK_HELD_BY=worker`/`FITMATCH_GPU_LOCK_PATH`, guard must not nest; slot rules are the port of guard 47331; owned-tree drain before release.
- New for the pilot (ENV-CANON-01): `"expectedBackend": {"projectRef": "gohczmqykjkrgdblgbog", "appOrigin": "https://<reviewed app origin>"}` is required with `garment.analyze`; the worker stops before claim if the app's heartbeat names another project.

## The QFINAL-022 repro against this source

`repro_qrev_binding_cpu.py` (sha `8290691…`) builds configs with `gpuLock`/`gpuSlot`; on this source its first constructor call raises `AdmissionError: Remove gpuLock/gpuSlot/gpuGuard …`. That is the expected refusal, but the script will stop there, so it cannot serve as the regression. The equivalent matrix is in `scripts/worker/test_worker_unit.py`:

| QFINAL case | New test | Expected |
|---|---|---|
| foreign existing absolute lock while canonical held | `test_config_cannot_name_lock_slot_or_guard`, `test_copied_coordination_with_identical_policy_refused_while_canonical_held` | refused (config key) / refused (file identity) while the real lock is held; no second lock taken by the worker |
| foreign absolute slot admitting the other owner | `test_config_cannot_name_lock_slot_or_guard`, `test_forged_or_linked_slot_cannot_admit_other_owner` | refused (config key) / refused (slot is a link) / canonical pc-3d slot refuses pc-ai |
| alias of the same file | `test_aliased_workspace_resolves_to_the_same_exclusive_lock` | accepted, same exclusive lock |
| lock replaced after start | `test_lock_replaced_after_startup_refused_on_open_and_loop_exits` | exit 5, claims 0 |
| process-level | `test_main_refuses_to_start_with_legacy_or_foreign_binding` | exit 5 for `gpuLock: default` and for a copied coordination tree |

## Native steps requested (Windows, exact commit)

1. `python -m unittest -v scripts\worker\test_worker_unit.py` → expected 56 tests OK; symlink cases may be **skipped** without privilege (report how many). Report Python version.
2. PC3D: `gpu_coordinator_policy.py write` on the real workspace; report policy sha256 + `lockIdentity` (volume/fileId are not secrets but keep the private path out of public reports).
3. Qwen: put `gpuCoordinator` + `expectedBackend` in the private config; `python scripts\worker\gpu_coordinator_policy.py verify --config <config>` → `admitted: true` with derived paths.
4. Negative matrix on the real machine with isolated copies (never touch or delete the real lock/slot): copy of the coordination folder pinned with the same policy sha → `identity` refusal; `gpuLock` key present → refusal; slot as a junction/symlink (if permitted) → refusal; worker `--once` with the slot assigned to pc-3d while 3D holds the real lock → no claim, heartbeat `gpuBusy: true`.
5. Native identity check: confirm `os.stat(path)` and `os.fstat(handle)` give the same `(st_dev, st_ino)` for `gpu0.lock` on that NTFS volume and Python version (covered by `test_valid_binding_derives_canonical_paths` + the helper's verify; report explicitly).
6. ACK exact: app commit, worker sha256 (LF blob and CRLF checkout), policy sha256, guard sha256, single lock owner, no nesting.

No GPU slot grant, Qwen load or real app job until Codex review + this native ACK + the canonical schema/access gates pass.
