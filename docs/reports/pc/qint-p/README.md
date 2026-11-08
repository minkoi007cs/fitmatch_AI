# QINT-P / AI-QUALITY-04 checkpoint — 07/11/2026

Latest coordination: [PROC0020 exact-revision CPU handoff](proc20-handoff.md),
nine refusal cases PASS; final Claude startup/config ACK remains pending.
Prior continuation: [direct worker-held adapter/slot bridge](worker-bridge.md),
130CPUcases/129PASS/1skip. The103-case checkpoint below is preserved as history;
no real GPU integration has run.

Session PC-QINT-P-20261107-01, operations c5e2429 / PROC-0018.
Runtime/controller/CPU conformance is **Ready for review**. Integrated GPU is
**NOT RUN**, not accepted. The app remains owned by Claude and shared guard by QINT-G.

The selected Q02 detail backend now has a bounded controller, image snapshot/hash
checks, pre-load admission, two schema attempts, 192 output tokens, 8192 raw output
bytes, logical timeout, partial-load cleanup, pressure monitoring and explicit
external-guard placement. Only the parent guard releases the OS lock after its
whole Job Object drains. A successful child cleanup is not a tree-drain receipt.
Pressure/hold fault modes after model load are implemented but **not executed with
a loaded model**. They are local operator options and cannot come from model output.

## Evidence

| Check | Result / scope |
|---|---|
| Combined CPU suite | 103 tests, 102 PASS, 1 native file-symlink skip (Windows1314), 0 failures/errors; no torch import |
| Exact Claude fixtures | 4 valid + 16 invalid result fixtures, adapter/error fixtures; exported checker PASS at 9311099 |
| CLI | Licensed jeans image inspected successfully; execution without new ACK refused before torch import |
| Checkpoint | All 28 files rehashed, 8,887,290,909 bytes, 17 shards matched prior Q02 receipt; no download/load |
| Retention | Bound synthetic source + OCR + diagnostic copy dry-run; models/derived/active process refused; zero source deletions |
| Guard candidate | Initial c6340b02 changes requested; revised47331c56 independently9/9PASS,35invalid slots/38native pre-spawn cases; candidate ACK recorded |
| GPU / browser→API→PC | **NOT RUN**, no integrated capability grant or resident model |

Machine is Windows PC, existing Python3.10.22/qwen-vl environment. Full suite
includes preserved Q03 logical tests and revised guard matrix/native CPU tests
in isolated disposable paths. Earlier100/99PASS/1skip evidence against the old
guard is retained separately. It does not rerun Q03's known NaN admission
reproduction, or claim the old guard is safe. No real shared lock, slot or guard
was modified by this session.

## Guard finding and ACK

Candidate c6340b02bea3d3f27595535878ecc95909f9b21b9d134455cd0599a01bcfeaa2
rejects a slot produced by its own v1 writer when duration is exactly3600s and
Unix time has sub-microsecond precision. For issued1794057600.1234562, emitted UTC
is `2026-11-07T13:20:00.123456+00:00`; duration after parsing UTC is
3600.0000002384186, exceeding the strict maximum. This is an availability boundary
bug, not evidence of an unsafe admission bypass. Finite/type/invalid-window cases
were rejected; native exclusion, child/grandchild timeout/crash cleanup passed.

QINT-P initially withheld ACK and wrote a local coordination review receipt.
QINT-G reproduced/fixed the issue using the checked numeric issue for v1 duration,
without widening the maximum, and supplied revision47331c56. Independent repeat
passed9/9 groups; the exact sub-microsecond max3600s now accepts. Candidate ACK
records full hash47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c,
fixed absolute lock/byte0, no nested lock and expired-present-refuses-both policy.
ACK covers that exact candidate. QINT-G then promoted it after idle OS-lock/Job
Object/PID identity checks. QINT-P independently read the promotion receipt and
verified the installed shared file hash matches47331c56. The current slot belongs
to pc-3d; no Qwen GPU slot was granted. This session did not perform promotion.
The first retest had a test-fixture timing error: a +10s future issue became valid
while native processes started; changed to +300s. The subsequent max3600s failure
is a separate deterministic code finding. Initial logs are retained and not PASS.

Fixed lock remains `coordination/gpu0.lock`, absolute path from the coordinator's
receipt, msvcrt exclusive **byte0**. Candidate ACK does not authorize integrated GPU.

## Claude contract reconciliation

Imported immutable public schemas/fixtures/checker from
931109906089e20738090613086b73c3677d3a40 on `codex/qwen-app-test`; file hashes are
in the source snapshot pin. `wire.py` maps Q02 visible attributes into camelCase
v1, preserves binding, removes unsupported composition/pocket claims, keeps OCR
as unverified candidates and never invents worker-visible owner identity.
The fixture's placeholder model revision is accepted for shape checking and
rejected for actual runtime; operator grant must name the existing pinned Qwen
revision ebb281ec70b05090aa6165b016eac8ec08e71b17.

This is **CPU conformance received, final integration ACK pending**:

1. Claude documents worker as sole lock owner with ProgramData default, while all
   PC tools use the fixed coordination lock. Existing transport supports an explicit
   `gpuLock` config override: use that exact shared path, not the default. QINT-G,
   Claude and Codex must acknowledge placement/config. No nested guard around a
   same-lock worker. This session's actual GPU entry verifies external-guard
   placement only; worker-held admission is deliberately not enabled.
2. Claude production drain fix 7d2283b is available but independent acceptance is
   owned by QINT-G/Codex. Unit/mock conformance here does not approve it.
3. A dedicated reachable authenticated test endpoint/scoped worker credential and
   contract/registry review are still required; none were used or logged.
4. Wire image decoder bounds are10MiB,24MP, JPEG/PNG decode, one frame; app input
   promises normalized JPEG. Source and asset hashes/IDs must agree. QINT-C should
   retain these image bounds in test normalization. No outputPath execution or
   arbitrary URL/command comes from a model response.

`wire.execute` is a tested library mapper, not an enrolled/polling worker. A
production argv entry and worker-held proof will be completed against the agreed
transport placement. There is no second queue/auth stack, public port or service.
Error mapping covers the contract codes; actual process stderr/exit integration
and post-exit GPU baseline evidence remain NOT RUN.

## Corpus and lifecycle

Seven existing fixture image hashes and label hashes/crop decisions are frozen in
corpus-freeze.json. Original full frames, no crop. Multi-hanger needs target
selection before load. Labels remain one annotator's provisional labels; second
review must inspect category/colors/pattern/visible structure, separate incomplete
OCR truth, preserve source attribution and record disagreements without consulting
new model outputs. No second annotator is claimed. Prioritize one app vertical
slice before broader one-pass inference; no repeated OCR chasing.

Candidate OCR in results, raw model diagnostics and source copies share source
sensitivity if personal images are later introduced. Existing Q03 cleanup planning
can bind source-evidence copies, but deployed PC collector/deletion ledger and
cloud→PC tombstone delivery are absent. Current CLI outputs use licensed fixtures
and remain retained; cloud deletion does not prove PC deletion. Model/derived
weights and ready 3D outputs have separate protected lifecycles. No guessed TTL or
physical deletion executor is added.

## Reproduce

On this PC, from `ai-service/qint_p`, use the existing qwen-vl Python:

```powershell
python -m unittest -v test_adapter test_wire
python run_cpu_suite.py
python contract_snapshot/scripts/check-qwen-contract.py
python checkpoint.py
python retention_probe.py
python probe_slot_roundtrip.py
```

The full103 suite requires preserved Q03 paths, public images/provenance and the
exact revised QINT-G candidate. Candidate repro uses the same pinned file.
`checkpoint.py` reads existing weights in bounded4MiB chunks, no CUDA/download.
Do not run model commands directly or repurpose the CPU fixture driver for GPU.

For a clean source review, `python restore.py <fresh-directory>` restores all
included source snapshots and checks hashes. Then run the39 self-contained CPU
adapter/wire tests under `<fresh-directory>/ai-service/qint_p` with the pinned env.
The source-only reconstruction excludes images, models, env and shared guard;
full103/native/candidate/model checks require those explicit local dependencies.
Source snapshots normalize CRLF to LF; manifest records both original and snapshot
hashes. Evidence removes private path prefixes and trailing log whitespace. A fresh
source-only restoration independently passed all39 adapter/wire CPU tests.

Next: QINT-C/QINT-G settle worker-held admission and fixed lock config;
Codex review; dedicated test endpoint;
then controlled loaded-model faults and one real browser→Qwen→human review slice.
