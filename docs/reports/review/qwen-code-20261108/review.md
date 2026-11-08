# QINT-R focused source review — 08/11/2026

CX-QINT-REVIEW-20. App source pinned95d59ad5846d78f47209041a76198ad56c378f58 on codex/qwen-app-test; detached isolated worktree, no app edits. Existing Claude source/Studio preserved. Review scope analysis API/SQL, JSON worker transport, lock/drain and test-config handoff; not full security audit or personalquality acceptance.

## Verdict

**NEEDS CHANGES before real integrated Qwen capability.** Auth/lease/binding/humanconfirmation design looks consistent in reviewed paths and existing regression tests pass; GPU-safe deployment configuration and lifecycle/resource gaps below remain. No live grant/deploy/migration was performed.

## Findings for Claude

1. **P1 QREV-LOCK:** scripts/worker/config.qwen-test.example.json gpuLock=default and runbook explicitly specify PROGRAMDATA/fitmatch/gpu-0.lock. Actual PC3D uses Fitmatch-GPU/coordination/gpu0.lock. Worker default_gpu_lock follows the former. If copied verbatim, these are different OSlocks, so both processes can enter their GPU sections. This is a source/config mismatch, not an observed GPU overlap. Require explicit absolute shared path in test config and startup admission that refuses missing/mismatched lock/guard/slot; do not accept env marker alone as proof, do not nest the same lock. PC supplies exact private path/hash ACK; neutral placeholder in public example is fine but default must fail closed for this integration.
2. **P2 QREV-QUOTA:** fm_v2_analysis_enqueue inserts jobs without daily/active quotas enforced by existing fm_v2_enqueue (50/day,20active). Repeated distinct owneditems/photos can bypass intended resource limits and delay both users on oneGPU. Apply shared owner serialization/quota policy atomically, including retry; dedupe should not consume quota. Existing tests do not cover this analysis quota boundary. Confirm product policy rather than silently invent new limits.
3. **P2 QREV-SNAPSHOT:** createAnalysis uploads snapshot and inserts ready asset before enqueue. RPC rejection (e.g. item deleted/changed between initialread and enqueue) throws with no cleanup intent or rollback compensation; failed asset insert after upload also leaves object. Collector only sees durable intents, so this path can retain private copies. Persist pending intent/asset lifecycle before external side effects or add durable compensating cleanup, preserving source binding and no deletion of referenced winner on dedupe. Reproduce failures at upload→assetinsert→enqueue boundaries and concurrent itemdelete.
4. **P2 QREV-STATUS:** worker takes GPUlock before claim; while anotherGPUjob holds lock, no analysis is claimed/deferred and UI may remain queued. waiting_gpu currently inferred from serverdeferrals. This prevents false actualrunning but does not yet prove requested GPUbusy wording. Test/clarify truthful waiting state without leaking crossownerwork or consuming inferenceattempts.

## Independent checks on pinned source

- npm test:64/64 PASS, exit0 (unit.log).
- Python stdlib worker tests on Mac:30/30 PASS, exit0 (python.log), not nativeWindows proof.
- npm run test:v2:db:8 PostgreSQL16 blocks PASS, exit0 (db.log); disposable Docker only.
- export-contract --check:48 files current.
- check-qwen-contract.py: NOT RUN to completion because review Python lacks jsonschema (ModuleNotFoundError), not a demonstrated contract defect.
- No fresh lint/build/HTTPbrowser this focused pass. Claude reported these; not labelled independently rerun. No actual QwenGPU/Supabase/HTTPS or app-to-PC test.

## PC evidence received (implementer reported)

PC-PHOTO-019 dd80777: actual photo fitting67.63s,PyTorchpeak3.07GiB,RAM3.21GiB,noOOM; privateGLB+frontsidebackface debugrenders, validator0/0; no face/hair/texture likeness. GPUreleased; Qwen ACK noCUDA. Contactsheet/ZIP metadata readback confirmed private; reviewer has not visually inspected the mesh/render. CompilerMSVC reconstruction/texture remains paused; no productPASS.

PR9 latest reports129PASS/1skip and source-only66; guardACK47331c56…, no actual integratedGPU. PCreview documentation does not remove deploymentpath mismatch. Next Claude fixes QREV-LOCK/QUOTA/SNAPSHOT, targetedtests and handoff; PC runs final native config/conformance before realtest. Dedicated reachable testenv/scopedcredentials still needed; no production usage.
