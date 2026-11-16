# QWEN54 helper copies — CPU preparation, execution OFF

Root accepted the CAT54 assessment/schema scope and authorized literal copies of the two reviewed helpers. The actual NEW authenticated-app target is job `1dadcac7-dbac-477c-a305-2f0c45644ab8`, analysis `36ec393f-3401-44e6-94e7-9b937aff4463`, policy qint.2. Root reports the serving revision `e6541f4f129b2fec16eedf1d275db8f612387eeb` READY. The exact contract snapshot remains `1cef14d6fc866b21ade675fb425b383be3dcd6ed`.

The earlier request for an unbound-job placeholder was superseded by root supplying this actual NEW job. No placeholder can launch: the copies are now exact-job bound, but their new execution authorization and actual READY do not exist. All review fields are PENDING, and the worker approval is false. This is not a worker GO, heartbeat authorization or slot grant.

## Current actual private pins

| Artifact, relative to GPU root | Actual Windows SHA256 |
|---|---|
| worker-data/qwen-pilot/private/qwen54-runtime-manifest.json, 111 entries | `74cb0422f2252612b1ecf855decbd29b8bc66191b8b128b8a90d39d8f702e162` |
| worker-data/qwen-pilot/private/qwen54-worker.prepared.json | `584ec8e7775b8c603ad96d145ba6c0557e01fc496ba26a762d99ab9e2d938d4d` |
| coordination/qint-worker-qwen54-approval.json, OFF/all reviews PENDING/exact NEW job | `72e26da104cd2dbcaf98ab951c68f1de95c7b763bf662abfa0d0f8be3703b921` |
| ai-service/qint_p_qwen54/worker_admission.py, unchanged | `bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37` |
| reports/ai/qint_p/cat54/helper-preparation/execute-once-20261116.py | `7868dcfac0f200465076220604a0e6264c9ce03e49a28e3856dc10fa9a0427a5` |
| reports/ai/qint_p/cat54/helper-preparation/heartbeat-window-once.py | `2315c8d91f79ff35ab86e399049bdbcbe9d3745dda00b30151aea3a853b7ce18` |

These supersede the initial preparation-only manifest/config/approval hashes in the parent report. Runtime source file bytes have not changed: only manifest appRevision metadata and its config hash reference were updated for the actual serving revision; the new disabled approval adds the NEW exact-job pin and corresponding metadata. All 111 source hashes still match, as do all original 98 active qwen48 entries.

[Exact manifest/config delta and admission byte count](./manifest-config-delta.json): manifest 2b5587 to 74cb0422 changes only appRevision; zero entries added, removed or changed. Reconstructing the prior appRevision reproduces its exact old hash. No .active config file is created: the helper uses the exact prepared path directly as --config, retaining hash 584ec8e7. No rename/copy is needed to activate the reviewed approval. A hypothetical byte-exact copy would retain the same config hash but switching paths would require a separately reviewed approval/helper repin.

## Full source and diff

- [Execute copy](./execute-once-20261116.py), [complete diff](./execute-once-20261116.py.patch).
- [Atomic heartbeat copy](./heartbeat-window-once.py), [complete diff](./heartbeat-window-once.py.patch).
- [Complete redacted config/approval structural diff](./private-config-structure.patch).
- [Machine-readable hashes and evidence](./preparation-receipt.json), including actual raw, actual LF and published sanitized LF hashes.
- [17 reused execute fixtures](./test_execute_once_helper.py), [12 reused timestamp/import fixtures](./test_heartbeat_window_format.py), [actual 29-test log](./helper-cpu-tests.log).

The public source replaces only the machine-specific GPU root with `<GPU_ROOT>`; substitute the actual existing root to reproduce it. It contains no token value or token digest. All other source is complete, not an excerpt. The private copies were proven byte-for-byte equal to their reviewed baselines after the explicit literal replacement map: paths, job/app/pin values and source count 98 to 111. No new helper function, architecture or transport behavior was introduced.

The native observer, exact worker/adapter argv roles and ancestry, checkpoint/admission joins, completed-output binding, control-flow producer and native wait-state code are AST-identical. The existing receipt kind identifiers are deliberately preserved for coordinator compatibility. Atomic PS7 timestamp parsing, READY freshness, HTTP timeout, no redirects/retry and exclusive original/byte-exact-copy receipt behavior are unchanged. The existing read-only references to the disabled qwen48 offline approval and historical native readiness remain intentional; those historical files are not modified.

Observer limit remains 330 seconds, at least 360 seconds remaining in a fresh 600-second pc-ai slot. The observer never owns/releases byte zero, kills, retries or withdraws. Failure/live/unknown still quarantines and finally attempts restoration of the exact disabled approval bytes. The worker retains the lock through the entire owned tree. No inference may overlap rendering.

New files use qwen54 receipt/marker names and 20261116 suffixes. The heartbeat copy pins the actual new execute-copy hash and writes `qint-p-qwen54-heartbeat-only-W008.json` plus a byte-exact `qwen54-window-008-heartbeat.json` when eventually authorized. A coordinator wrapper must bind these exact new names; this agent has not created a wrapper, policy, lock or slot. Proposed GoID from root is `PC3D-QWEN54-W008-20261116`.

## Actual verification and pending gates

The two existing helper fixture files were reused: **29/29 PASS, zero failure/error/skip, exit 0**, with mocked fixture callbacks and temporary files. No new architecture tests were added. The actual execute CLI with the proposed GoID returned exit 75 / CPU_REFUSED / FileNotFoundError because its new authorization is absent. The actual heartbeat CLI WITHOUT --send returned exit 75 with READY absent and HTTPAttemptMarkerExists=false. No heartbeat, claim, approval activation, model load, GPU run, slot issuance or marker consumption occurred.

The immutable transport remains `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6`; guard `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c`; coordinator policy `789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039`. The actual current slot still hashes to CLOSED W007 `07ca3504edd124b300336a42c65888a7a16b159f44b81a163223d45cfb4d1e4e`. The old helpers still hash exactly to execute `4f31ff51...` and heartbeat `58e3bc86...`, with W007 files and consumed markers preserved.

Root now reports the other legacy qint.1 jeans job eligible again, superseding the earlier canceled-status snapshot. Root owns its bounded temporary eligibility deferral/restoration during the one hoodie test; PC has not canceled, deleted, restored or requeued it. Exact-job adapter refusal does not change transport claim selection, so root backend preflight must establish the intended eligible queue before execution.

Next: root reviews these full diffs and hashes, provides any allowed review-field/pin changes, and supplies actual backend/native/finite-slot GO through the existing 3D coordinator. No new job or execution is authorized by this report. The new isolated work directory must also exist with reviewed private permissions before the unchanged execute preflight can pass. Existing helpers are never repointed to this job.
