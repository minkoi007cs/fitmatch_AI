# QINT-G / PC-SAFE-008 Windows handoff

Session `PC-20261107-QINTG008`, 07 November 2026 America/New_York. Scope is **Ready for review**; real integrated GPU and personal 3D remain **NOT VERIFIED**. This continues PC-INT-007, not a new installation or fitting run.

## Revisions and ownership

Full onboarding and H-QWEN-018/H-PC-017 read at operations `c5e2429875f633cf536402b451c0ddaa64344477` / PROC0018, containing the requested published15fd71b. PC baseline `cedbfd686c1cbea016083ccec8f73f88a8c2dfe1`, branch `codex/pc-safe-008`; implementation `12087d433f6093c124e5ccbeeaa24a01e233b69f`. Local process history is appended; central process is not overwritten. Old operations report branches and PR6/7/8 are preserved.

Claude owns all app/transport files. Separate read-only clones were checked at `d17ca355cccb039c496c805667d43a7ddcf63ab2` and new QINT-C checkpoint `931109906089e20738090613086b73c3677d3a40` (drain implementation7d2283b). Neither checkout was edited. No Next.js/SQL/server change by PC.

## Shared guard fixed, independently reviewed and promoted

Old raw guard SHA256 `4ddf206d2cb16794f1e05eded7278d82c027dab1d277ac737b003322f8006680`; **new raw SHA256 `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c`**. Candidate was developed outside the shared path, tested in isolated namespaces and independently retested by Qwen before promotion. Its first candidate was rejected by peer review; it was never installed.

Changes:

- Reject malformed/duplicate/oversized JSON, wrong object/owner/revision, bool/string/null/nonfinite/overflow numeric fields, invalid UTC/Unix agreement, future/expired/oversized windows before native child launch. Timeout must be finite, positive and at most86,400seconds.
- Slot writer v1 includes numeric and UTC issue times. Valid legacy UTC metadata can be read. Maximum slot window is3,600seconds; finite clock future tolerance5seconds. A **present expired slot refuses both owners**; idle coordinator explicitly renews it. Missing slot retains coordinator-only bootstrap. This policy change was explicitly included in both PC ACKs.
- Fix a peer-discovered sub-microsecond boundary: compare duration using the checked numeric issue after UTC agreement, so exactly3,600seconds accepts and a larger window rejects. No arbitrary tolerance expansion.
- Retain suspended launch, kill-on-close Job Object and byte0 exclusion until kernel activeProcesses is zero. An unknown drain query quarantines and holds the guard/lock. Diagnostic receipt-write failure cannot release an unverified tree; Windows replacement retries are bounded.

Fixed lock remains the existing absolute workspace `coordination/gpu0.lock`, **msvcrt exclusive byte0**; it was never removed or replaced. Full absolute paths and both ACKs are in private coordination receipts. Promotion took that OS lock, checked prior named Job Object absence and prior child PID/creation no longer live, backed up previous guard/state/slot, and atomically replaced only the guard source. Qwen independently acknowledged this exact new hash (9/9 CPU tests). A900second coordinator slot and a real shared-guard **CPU-only** smoke completed, exit0; no Qwen GPU slot or live grant was issued. See sanitized `guard-promotion.json` and `qwen-independent-ack.json`.

## New tests and exact limits

`test_guard_safety_native.py` runs actual Windows APIs in private CPU namespaces, never the shared lock. Final candidate006:11 test groups pass, including42 invalid slot values, invalid clocks, valid legacy/v1 and exact-max regressions,55 JSON/timeout pre-spawn rejection cases, both contention orders, real venv failure, a labelled surrogate root with surviving actual interpreter/grandchild, timeout, guard crash/recovery, nested same-lock refusal, and injected query plus diagnostic-write refusal. An external sentinel survived. Busy challenger exit75 did not launch its child. No CUDA/model is imported by this harness.

Candidate004 previously passed the original matrix; independent Qwen review then caught the exact-max boundary. Failed local runs001–003 and005 remain retained, not PASS: an argparse exit-code assumption, an incorrect expectation that a venv redirector must leave descendants alive inside nested jobs, and a Windows diagnostic replacement failure. Explicit synchronization replaced timing assumptions; the final query/write failure case is **injected**, not a claim that an OS query failed naturally. No foreign process was killed. The initial shared smoke used a nonexistent interpreter path and refused before spawn; the corrected existing environment path passed.

On unchanged Claude d17: original18 worker unit tests pass natively (0.218s internal/0.406s launcher), plus4 native containment/byte-lock/crash/reacquire probes pass. The prior production gap still reproduces through actual `stop_process` with both a venv launcher and a labelled CPU surrogate: actual interpreter alive while isolated lock reacquires. Outer worker exit cleans descendants; external sentinel survives. Worker Git blob remains41ee24291c1129626c9461397d14d5c2ee993768. This is method-level CPU evidence, not a live lease/cancel/GPU overlap test.

On new Claude931:27 unit cases run, **22 pass,5 POSIX-only cases skipped** on Windows (0.692s internal/0.828s launcher). Actual `OwnedProcessTree` and `Worker.loop` were then exercised with a native nested Job Object and actual venv interpreter/grandchild. Kernel drain kills the owned tree, the byte0 lock excludes contenders, unknown-query quarantine prevents a new claim, and verified drain resumes the local stub queue. The heartbeat/queue are explicitly CPU stubs; Windows containment/accounting are real. Source raw SHA256 `e251350f5de48ebd951554a9e99a38213015442cb7fed231a7dda68fb3a6d908`.

**Release timing requires review:** kernel activeProcesses==0 can precede the descendant process object's WaitForSingleObject exit signal. Initial strict assertions failed; diagnostic runs observed all PID identities gone after an additional0–16ms observation. In the actual Worker.loop fixture, the worker had already released its lock at the immediate observation while a descendant wait signal was not yet set. No continued instructions, real model residency or concurrent GPU execution was demonstrated. The observer's extra wait is **not an upstream production guarantee**. `claude-931-native-owned-tree.json` records both kernel success and this limit; PC does not self-accept strict process-handle exit-before-release. Codex/Claude must resolve the intended drain/resource contract before actual integration. A command exit0 here means the evidence probe completed, not live acceptance.

No RAM/VRAM peak was measured for these CPU tests. No inference performance, GPU unload or real GPU contention result is claimed. PID plus creation identities/raw fixture logs stay private; sanitized output and runnable PC harness text are attached for review. Shared guard and source patch reverse-applicability/syntax were checked. Whitespace checks cover implementation/docs; standalone unified-patch blank context markers are intentional patch syntax.

## One lock owner and remaining contract gaps

Claude931 `docs/qwen-contract-v1.md` is a **proposal**, not final live wire. It selects the **worker** as the single lock owner for integrated jobs, with direct adapter execution. PC conditionally agrees with that placement for CPU integration work: do not call the same-lock guard underneath a worker holding FileLock. Standalone3D/Qwen tasks continue to use the guard as sole owner. There is no unlocked guard bypass based only on environment variables. `FITMATCH_GPU_LOCK_HELD_BY=worker` is a signal, not independent proof or a grant.

Before actual GPU:

1. Configure the worker's `gpuLock` to the exact existing absolute `coordination/gpu0.lock`; its ProgramData default is a different lock and is not acceptable here.
2. Agree a finite slot/admission bridge for the worker-owned path. Current worker FileLock does not enforce coordinator slot metadata; the guard must not be nested or simply bypassed on an arbitrary env value. Qwen adapter must verify the reviewed worker execution context before model import/load. This is a contract proposal for Claude/Qwen, not a transport edit by PC.
3. Resolve native kernel-accounting versus process-wait/resource release semantics above. Review the actual source revision and cancellation/timeout/quarantine evidence; no assertion that18unit tests alone close production supervision.
4. Qwen confirms exact931 schemas/fixtures producer-consumer mapping; Claude implements the JSON job/result path in the existing v2 control plane. Codex reviews before test capability registration. No JSON result is disguised as GLB and no new worker protocol is introduced.
5. Supply a dedicated authenticated reachable test environment and scoped worker credentials privately. Then run licensed image browser→durablejob→actual PCQwen→human review, and actual GPU contention both orders. These have **not run**.

See `gpu-contract-proposal.json`. Proposed model lifecycle remains load after admission plus RAM/VRAM check, no resident model after job, release only after reviewed owned-tree drain; rules-v1 and human review remain fallback. Nothing is enabled by these local ACKs alone.

## Preserved outputs, retention and personal intake

SiTH004 checkpoint hash `52d0f666ed0284aad1c2eb809e7d534349d4b52729de4244d486093855648a2b`, valid003 fitting, SMPL-X/weights/junction, patches/env and006 GLBs/previews are retained. Existing private006 pack SHA256 `a9211bbee97d5b25fc8091a1550a664a0be94b0b508bbe589bc253aea108951d`; no new template iteration/render/export was made. Reference body rights remain unresolved for public redistribution, so its mesh/previews stay in the approved private handoff; no new public body asset is claimed accessible.

Source-copy lifecycle proposal from PC-INT-007 remains applicable. Actual inspected worker stages asset role/assetId/localPath/mediaType into per-job attempt manifests and stores private lease/checkpoint state. These are not authenticated per-copy owner/source deletion receipts. New tests create only own disposable process metadata/logs, no real source images. No physical source deletion executor, cleanup daemon or broad Temp/AI/model scan was added, and no data was erased. Transport owner must bind source versions, quiescence, retries and protected derived artifacts; do not publish lease tokens/raw OCR.

The owner has now offered one personal image through Mac delegation, but **the file has not been transferred to or inspected on this PC**. A private pending-intake record is saved; no personal hash, Mac filename/path or photo is published here. Wait for attachment/confirmed private transfer, verify bytes, inspect crop/foreground/mask/keypoints and only run ready stages. The reported single-view clothed/cropped reference does not establish a clean full body, height, gender parameter truth or observed back appearance. No substitute personal image was searched. Real tee/jeans inputs remain needs_input. MSVC/Admin/UAC pause remains unchanged.

## Handoff and next owners

Code is committed locally, with incremental bundle/patch and private evidence/checkpoint handoff. Public changes are sanitized PC report/proposal/harness text only; no app source branch push, merge, deploy, production migration, port, paid service, model download or GPU job.

- Claude/Qwen: reconcile worker-owned lock path/slot bridge, exact contract fixtures and direct-adapter admission; review native wait timing and resource release. Keep feature OFF until Codex review and real test setup.
- Codex: review these exact hashes/native results and distinguish kernel method tests from actual integrated GPU/browser acceptance.
- Owner: transfer the offered image privately to this chat/PC; resume MSVC only when explicitly ready at the PC. No fitting/model redownload is needed for that administrative step.
- PC3D: continue from this checkpoint after review; actualGPU first needs the shared safety/contract/test-environment gates, personal stages additionally need the file and supported inputs. No animation or3D capability was opened.
