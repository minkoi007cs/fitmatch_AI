# PC-BIND-25 / PC-SAVE-30 - preserved native checkpoint

Session PC-20261109-BIND25, continued by PC-SAVE-30 without duplicate execution. Baseline875d85c571198a185a73d739f46196ae5c99faec; branch codex/pc-bind-25. Implementation saved as **a2af700a26884181ff2f26de428779fbffe3b4d6**. Operations1e211de/PROC0027 and91455324d566c0187ae34859d8ee365010f3665e/PC-SAVE-30 read; current dispatch delta read without replacing central process. Scope PC probes/proposal/report only. App/SQL/transport remain Claude-owned and untouched.

## Exact source and policy ACK

Native source appf80749a65b47441958e7c6fc485034d7efe446df / code2a40f48. Worker Git LF SHA256 **ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6**; raw CRLF Windows checkout **ec9df0b049feac6a14580da525657d25fb29f2663166a4b4c96a52a6baa33ddd**. Exact coordinator-helper raw SHA251617428bb215cf416ae243244164881eaee6bfa255a51977f027137a9d045f. Read-only app worktree remains f80749a, clean; previous7631checkout also retained.

PC3D and Qwen ACKed the proposed fitmatch.gpu-coordinator.v1 shape and worker-sole-byte0-owner/direct-adapter placement, no nested external guard or env-only proof. After Qwen idle ACK, prior native Job/PID absence checks and acquisition of the **existing actual** shared OS lock, PC3D ran the exact helper once, without --replace. The helper itself takes no lock. No real lock/slot/guard/state file was created, replaced or edited. Guard remains **47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c**.

- Existing coordinator policy SHA256: **789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039**.
- Actual lock identity: volume **3699583840**, fileId **2251799814103012**.
- os.stat(path), os.fstat(open handle) and Win32 GetFileInformationByHandle agreed exactly.
- New config binding uses only gpuCoordinator{path,sha256}/gpuSlotOwner; no legacy gpuLock/gpuSlot/gpuGuard. Helper verify returned admitted:true **for binding only**, without slot evaluation/lock/network/CUDA. Binding-only config is not an enrolled worker config: reviewed HTTPS origin/expectedBackend/scoped credential still require the app-owner/Qwen private configuration.
- Actual existing slot remained expired; the native matrix confirmed pc-ai refusal. No slot was renewed/granted and no capability/operator approval was installed. Qwen independently verified policy identity/hash, with the same original-suite limitation below.

These numbers and hashes are metadata, not an execution grant. Private absolute paths and raw machine/process identities remain outside public Git.

## Original native worker suite: NOT all-PASS

Native Windows CPython3.10.22, original unmodified test source: **56 total = 46 PASS, 9 skip, 1 ERROR**, exit1;1.408s internal/1.539s launcher. Five skips are POSIX process-group cases; four are file/directory symlink privilege cases. No privilege/security/UAC setting changed to remove skips. Unit suite includes mocks and synthetic guards, not actual GPU evidence.

The error is SharedGpuAdmissionTests.test_copied_coordination_with_identical_policy_refused_while_canonical_held. Its copytree reads the byte of the fixture lock AFTER acquiring the Windows byte-range lock; Windows raises PermissionError before the admission assertion. This does not demonstrate production binding acceptance. Sanitized original log is published; it is not relabelled PASS.

Test-only proposal SHA256 **8a9fde241e6468116d45461ccba262f51ed2963f7b4d839cd09759fd82595be0** snapshots the copied workspace BEFORE taking the lock and retains the refusal/split-lock assertions while held. `git apply --check` passed without applying to the app. Exactly one targeted test ran in a disposable copy and passed,0.015s; production worker bytes unchanged. Original56suite remains failed; no full rerun was made. An initial absent proposal-directory path was corrected before that test, not an app failure. Claude now owns NATIVE-FIXTURE-30; wait for its exact test patch/revision before rerunning56 and recording skips.

## Supplementary native matrix: 18 recorded cases

PC-owned probe source SHA256 **e627a8fd7d95fde466facf32334cdfdba5c15f4d354a4da32524c024d70308c0** (review copy probe_bind25_native.py.txt). Actual app/guard/policy bytes were checked. Overall probe exit0,1.973s launcher, external disposable sentinel survived. No real server or model; queue/heartbeat are explicit CPU stubs.

Observed checks include actual stat/fstat identity; byte-identical copied policy+guard with a different existing lock rejected **while the real canonical lock was held**; actual-main copied-policy refusal exit5; junction workspace alias resolves to the same file and cannot acquire a second lock; expired actual slot refuses pc-ai; legacy keys refuse as controls; valid isolated policy/slot/held-handle check; wrong-owner isolated slot refusal; swapped isolated lock rejected on open and loop exits5/claims0; slot/lock/policy junctions refused. Copies were prepared before holding the byte lock, preserving the important held-canonical admission condition. The four original symlink skips remain skips: directory-junction coverage does not claim arbitrary file-symlink privilege coverage.

Three actual owned-tree fixtures cover root-exited surviving interpreter/grandchild, venv launcher failure and own Job-query failure/quarantine/recovery. Actual suspended Job placement and process handles were used. Retained SYNCHRONIZE handles for observed interpreter/grandchild were signaled before unlock; PID creation identities and timestamps retained privately. No foreign process terminated. Original policy/lock/slot/guard/state hashes were identical after the probe. This proves observed CPU fixture lifetimes, not resident-model unload or all possible transient descendants. No GPU critical interval was started.

## Existing UV/preview/texture/compiler state

CPU-only review decoded existing labelled front/side/back/head PNGs and parsed the existing GLB2:419772bytes, one mesh, embedded buffer, **0 images/0 textures**. Existing xatlas UV map has14291UVvertices/20908triangles, finite UVs within[0,1]. A CPU wireframe UV-layout QA image was produced from that saved map; no new unwrap, fit, model inference or 3D render. All original private assets remain unchanged and are not included in public Git.

Identity remains rejected: estimated parametric body, hidden surfaces inferred, generic face/wrong mouth, no hair/identity texture. UV layout is not appearance reconstruction or a face-texture projection result. The prior actual model/CPU render measurements remain historical, not new benchmark runs.

Current read-only with_toolchain gate exits1: `MSVC is not installed. Complete install-msvc-admin.ps1 with physical UAC approval first.` Expected vcvars64/Windows SDK Include absent; local NVCC exists. No compiler/JIT/Admin installation/UAC attempt, driver change or restart. nvdiffrast CUDA reconstruction/UV bake remains blocked; compiler success alone would not establish face likeness. Existing post-MSVC/capture runbook retained.

## Acceptance and next owner

Focused native identity/hash/shape/refusal/drain evidence supports the new policy binding; **final suite/acceptance remains pending** the exact app-owned fixture patch and Codex review. Do not report56PASS. Source0c4c44e/codecf902d3 is reported as the later app checkpoint with unchanged worker; it was not a new PC native test target here. Claude's R-MIGTARGET-29/APP-CLOSE-30/migration work stays with the app owner.

Canonical backend is fitmatch-ai/gohczmqykjkrgdblgbog; smoke is deprecated. Connector access is restored per Codex, but canonical schema/recovery/migration review, serving HTTPS revision and scoped enrollment remain separate gates. PC performed no SQL/cloud mutations or backend installation. Qwen peer ACK reports no reviewed HTTPS origin/scoped token/backend preflight/real readiness.

PC-SAVE-30 now saves/publishes this existing evidence; no tests/fitting/models/render or policy rewrite was run for the save continuation. Keep policy789426/guard47331/actual lock identity, checkpoints004/006/private019/weights and UAC pause. Await exact NATIVE-FIXTURE-30 source/test patch; rerun the56suite then, preserving18matrix evidence unless production behavior changes. Real Qwen requires Codex/native/backend/HTTPS gates, fresh idle/owned-tree proof and finite pc-ai slot plus the same actual OSlock until model exit/drain. No grant, public PCport, paid service, foreign kill or nested lock.
