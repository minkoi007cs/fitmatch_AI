# QWEN54 FINAL OFF pinset — W008 CPU handoff

This final pinset supersedes the a5275aa prepared-path pins. Root explicitly authorized one exclusive byte-exact active config copy and the reviewed CPU/source fields. There is no execution GO, no heartbeat, no slot issuance and no worker activation.

Target NEW authenticated-app job: `1dadcac7-dbac-477c-a305-2f0c45644ab8`; analysis `36ec393f-3401-44e6-94e7-9b937aff4463`; policy qint.2. Root-proposed GoID: `PC3D-QWEN54-W008-20261116`. Serving revision is `e6541f4f129b2fec16eedf1d275db8f612387eeb`; exact contract snapshot remains `1cef14d6fc866b21ade675fb425b383be3dcd6ed`.

## Final actual private paths and hashes

Paths are relative to the existing GPU root.

| Artifact | Actual Windows SHA256 |
|---|---|
| worker-data/qwen-pilot/private/qwen54-worker.active.json | `584ec8e7775b8c603ad96d145ba6c0557e01fc496ba26a762d99ab9e2d938d4d` |
| worker-data/qwen-pilot/private/qwen54-runtime-manifest.json | `74cb0422f2252612b1ecf855decbd29b8bc66191b8b128b8a90d39d8f702e162` |
| coordination/qint-worker-qwen54-approval.json | `c9db71996dafbdb77c82738ae54223e114f56f18b73707f75d0db9e0e9acb926` |
| ai-service/qint_p_qwen54/worker_admission.py | `bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37` |
| reports/ai/qint_p/cat54/helper-preparation/execute-once-20261116.py | `20cafae342c112e44973a8e1c3c6232ca4a3846924354a1090b1c2e67ed4b6c1` |
| reports/ai/qint_p/cat54/helper-preparation/heartbeat-window-once.py | `56417b4990d045d57730e12599427f5e034bfe4e34ca764b442ee85ffc516cbc` |

The active config was absent and created with exclusive xb from the exact prepared bytes. Its 1,661 bytes and SHA256 are identical to the prepared config. No further copy or rename is planned. Both final helper copies and approval now reference this active path.

Approval remains enabled=false and pins only the NEW job. Contract, production_drain, worker_placement, slot_bridge, native_binding and serving_revision review fields are PASS under root's scoped source/schema/CPU review and the unchanged previously reviewed implementation. These are review acknowledgments, not a claim of fresh native execution or future GPU success. **backend_preflight remains PENDING** until the actual fresh heartbeat and authorized helper flow. The existing helper will restore these exact final OFF approval bytes after its eventual single run.

Manifest is 19,548 bytes with exactly 111 entries, totaling 486,879 pinned source bytes. All hashes match. The earlier 2b5587 to 74cb0422 transition changed only appRevision; zero file entries were added, removed or modified. Reconstructing the old appRevision reproduces the exact old hash. Finalization leaves manifest74cb0422 unchanged. Admission is unchanged at 10,356 bytes. See [exact manifest/config delta](./manifest-config-delta.json).

## Full source, full diffs, machine receipt

- [FINAL pinset and complete raw/LF/sanitized hash matrix](./final-pinset.json).
- [Complete execute source](./execute-once-20261116.py), [full diff from reviewed4f31 baseline](./execute-once-20261116.py.patch).
- [Complete atomic heartbeat source](./heartbeat-window-once.py), [full diff from reviewed58e3 baseline](./heartbeat-window-once.py.patch).
- [Final helper delta versus a5275aa](./finalization-vs-a527.patch), [final OFF approval delta versus a5275aa](./final-approval-vs-a527.patch).
- [Full redacted config/approval diff from preserved qwen48](./private-config-structure.patch).
- [Earlier preparation receipt](./preparation-receipt.json) is historical and superseded by final-pinset.json.

Public source replaces only the machine-specific root with `<GPU_ROOT>`; substitute the actual existing root to reproduce it. Actual raw Windows, actual LF and published sanitized LF hashes are explicit in the receipt. No token value or token digest is published. The helper copies were rebuilt byte-for-byte from the original reviewed helpers using only literal paths, job/app/hash constants and the 98-to-111 count replacements. No function, architecture, transport or model behavior was introduced.

Native observer/wait logic, exact argv roles/ancestry, checkpoint/admission joins, completed-output binding, control-flow producer, PS7 timestamp parsing and atomic original/byte-exact-copy behavior remain unchanged. Receipt kind identifiers stay unchanged for coordinator compatibility. Read-only references to the disabled qwen48 offline approval and historical native readiness are intentional. Old W007 helpers, receipts and markers are preserved.

Engine timeout/drain remain 240/30 seconds, observer330, at least360 seconds remaining in a fresh600-second pc-ai slot. The observer never owns/releases byte0, kills, retries or withdraws; live/unknown/error still quarantines. The worker owns byte0 through its entire owned tree. Inference must not overlap rendering.

## CPU evidence and execution boundary

The existing [17 execute fixtures](./test_execute_once_helper.py) and [12 format/import fixtures](./test_heartbeat_window_format.py) previously passed 29/29, zero failure/error/skip, exit0: [actual log](./helper-cpu-tests.log). Root instructed no further test repetition on unchanged behavior. Only final path/hash/review metadata changed afterward; literal replacement equality and actual byte/data checks were performed without invoking a helper. No additional architecture tests were added. Earlier safe CLI refusals remain in the historical receipt and were not repeated.

The separate runtime `worker-data/qwen-cat54/runtime` now exists empty, with the exact protected reviewed private-directory ACL copied and verified. This is reversible CPU preparation, not a worker start. All original98 hashes match. Guard, transport, coordinator and current CLOSED slot are unchanged:

| Component | SHA256 |
|---|---|
| Transport | `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6` |
| Guard | `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c` |
| Coordinator policy | `789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039` |
| Current CLOSED W007 slot | `07ca3504edd124b300336a42c65888a7a16b159f44b81a163223d45cfb4d1e4e` |

There is no new execution authorization file or consumed W008 marker. No --send, heartbeat, claim, slot write, worker start, GPU load or inference occurred. Root must review these final diffs/pins, independently establish queue/backend/worker state, and obtain the actual finite W008 grant through the existing 3D coordinator before any execution.

New heartbeat receipt names are `qint-p-qwen54-heartbeat-only-W008.json` and byte-exact `qwen54-window-008-heartbeat.json`; coordinator publication must bind those names. No wrapper/policy/lock/slot was created by this agent. Root owns temporary eligibility deferral/restoration of the other legacy qint.1 jeans job; PC has not canceled, deleted or requeued it. Exact-job adapter refusal does not change transport claim selection. This handoff itself grants no execution.
