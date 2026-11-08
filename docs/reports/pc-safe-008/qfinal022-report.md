# PC-QFINAL-022 â€” runnable canonical-binding repro and conditional handoff

Session PC-20261108-QFINAL022, PC3D GPU coordinator; task PC-QFINAL-022/H-QFINAL-022. Onboarding AGENTSâ†’agentâ†’roadmapâ†’process read fully/in order at8b669534f6cb014411fc3a9c88a4294af0c8da3a/PROC0022; current4e40578733042b9d8511c75ea6b53bbf35be955c dispatch delta also read. PC baseline059e63cac040d8658724d45b1437e643c511c4e6, clean before new owned branch codex/pc-qfinal-022. Existing docs branch docs/pc-safe-008-20261107/PR10 retained. This is a sanitized PC delta, not a replacement for central process.md.

## Current gates, unchanged app

Observed app codex/qwen-review-fixes still7631cb00114ddf559c234f1c0f13285dbb7305ab / codebf0b6d712a50c3aa15a03362a26d32a9aba47eaa. QRACE docsceae68b5d4cf45eb594fc242d777b256d5693b4e is receipt only; **cleanup is NOT CLOSED**. No cleanup code/final tests inferred from that receipt. Final startup/config ACK remains **NEEDS CHANGES / QREV-BIND-02** on both PCs. No new GPU slot/capability/test approval is installed or granted.

Prior QINTG009 evidence is retained, not rerun here: original39Windowsunit34PASS/5POSIXskip,7CLI refusals,3actual native tracked-handle drain cases and real canonical OS-lock exclusion both directions. Those are historical results on the same app SHA, not fresh performance/model evidence. Observed successful drain does not approve canonical path binding. Claude owns transport/cleanup; PC did not edit either.

## New sanitized runnable CPU repro

New PC helper workers/windows/repro_qrev_binding_cpu.py; exact UTF-8 source SHA256:

`8290691756df7c157e5de6905e061aeb11d58544af62748be2bc131113e2f17c`

Review copy beside this report: `repro_qrev_binding_cpu.py.txt` (save as `.py` without reformatting). New evidence: `qfinal022-repro-evidence.json`. The helper uses stdlib plus the exact unmodified worker source. It verifies the actual47331guard bytes but **never imports or executes the guard**; no synthetic guard substitution. The real guard file stays in the private handoff, identified by the known digest. Do not reconstruct or normalize that guard text; its raw digest is byte-sensitive.

Worker target hashes:

- Windows checkout CRLF raw: `5f03f523a78e9cb805850e5d7df8e2a37a5b550c205633a1d2f2ba00fb509604`.
- Same Git LF blob: `4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb`.
- Actual shared guard raw: `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c`.

Example on Claude's checkout (replace only file locations; this is not an endpoint/config/secret):

```sh
python repro_qrev_binding_cpu.py --worker /path/to/exact-app/scripts/worker/worker.py --expected-worker-sha256 4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb --guard /path/to/private-raw-47331-gpu_guard.py --output /path/to/new-isolated-output
```

On Windows pass the5f03raw digest instead. Output directory must be new; the helper preserves fixture files, does not erase data and never touches the real canonical coordination directory.

Actual new run on Windows exited0 with `BUG_REPRODUCED_NEEDS_CHANGES`:

1. Holds an isolated canonical CPU byte0lock; real pinned guard, correct isolated slot/owner. Changing only gpuLock to another existing absolute file passes startup/admission and acquires a second OS lock simultaneously.
2. Canonical isolated slot assigned pc-3d correctly refuses a pc-ai worker. Changing only gpuSlot to a second absolute fixture assigned pc-ai admits that other owner while the canonical fixture lock remains held.

This is a focused constructor/admission/FileLock repro. No worker.main, claim, adapter, network, CUDA, model or real shared slot/lock was used. Exit0 means the **bug reproduced**, not acceptance. This portable fixture supplements prior actual shared-lock native evidence; it does not replace it. A new fixed source may require its newly defined trusted-policy fixture before the same negative matrix can serve as a regression. No final native ACK is inferred from this old-source repro.

## Canonical config checkpoint and environment inventory

Both PCs continue to agree on workspace coordination/gpu0.lock (exclusive byte0), adjacent gpu0-slot.json, actual fitmatch_AI/workers/windows/gpu_guard.py47331, and conditional integrated placement **worker sole lock owner â†’ direct Qwen adapter**. No external/nested guard and no env-only proof. Qwen's new canonical checkpoint is explicitly metadata, not an installed/approved worker config; startup ACK withheld and cleanup gate not closed. Private absolute paths remain in the local checkpoints, not this public report.

PC3D bounded inventory: no worker token/config/app/test-app environment key is populated, no test-approval file, app config remains a placeholder example. No credential values read/logged and no endpoint contacted. These checks do not search Qwen's private configuration or prove credentials absent elsewhere. Qwen's authoritative checkpoint reports dedicatedTestEnvironmentReady=false/operatorApprovalInstalled=false; final HTTPS/test-label/scoped-token readiness still needs a verified configuration receipt. Never assume a production environment is an authorized disposable test environment.

## Exact next gates / owners

1. Claude publishes new cleanup and canonical-binding source SHA, preserving7631fixes; trusted coordinator policy/path identities and pin must be independently bound, not self-asserted by alternate config. Existing foreign file and forged slot must refuse before claim/spawn/CUDA. Collector race needs both orderings with actual final diff/tests.
2. Codex reviews cleanup+binding. PC3D/Qwen then validate the new exact source/config/schema hashes and perform final native startup/refusal/actual OS-lock/tracked-handle drain ACK. Current NEEDS CHANGES is not expired by time or peer idle.
3. Dedicated authenticated HTTPS test endpoint/project label and least-privilege scoped worker credential are configured privately. No service-role on PC, public PC port/tunnel, production migration/deploy or secret in report.
4. Only once those gates PASS: coordinator verifies idle owned trees and the actual existing OS lock, creates an explicitly bounded pc-ai slot and sends receipt. Qwen still must acquire that same OS lock, recheck finite admission/resources, load pinned model once for a licensed garment photo and unload/drain before release. Do not use the private portrait as the garment test. Return job/model/result/timing/resource/browser-confirm evidence, with contention orders clearly separated from CPU mocks.
5. No3Dheavy work overlaps. Busy or expired/wrong slot means wait/refuse before claim/model load; never preempt, clear a held lock, create a second lock or accept a resident model after exit. After Qwen completes, verify actual drain before any next3Dslot.

No unchanged39/full app/model benchmarks, weights/env setup, fit or render rerun. Photos/assets/checkpoint004/006/private019 and guard remain preserved; Admin/UAC pause unchanged. Existing post-MSVC/face/hair capture preparation is retained; compiler availability will not imply personal likeness. Status: CPU handoff **Ready for review**; cleanup/binding **Changes requested**; real integrated Qwen **NOT VERIFIED**.
