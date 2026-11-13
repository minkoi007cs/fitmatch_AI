# Worker-held adapter continuation — PC-QINT-P-20261107-02

CPU/runtime proposal **Ready for review**; integrated GPU **NOT RUN**. No approval
or Qwen capability is installed. The personal image assigned to PC-PHOTO-019 stays
in the 3D scope; Qwen has not read it or loaded CUDA. Local coordination ACK records
the installed47331c56 guard and the exact shared absolute lock/byte0.

Read PR10 a49cc8b native evidence and app checkpoint1f4d01f0705453b4f479fe2583a7b752b55ffa04.
Schemas/contract/fixtures are unchanged from pinned9311099 (empty scoped Git diff).
This continuation adds the missing **direct adapter argv and worker-held admission
proposal** to the existing Qwen backend. It does not edit or wrap Claude transport.
Pre-publication app HEAD3c28b33 adds reports/tests/example config; its actual worker
blob is identical to1f4 (`a409b609ca84fdb80f81714dbe5c7144ab15be99`), and schemas/contract
remain unchanged. Those later app tests were not rerun by QINT-P.

## What is implemented

- `worker_cli.py --input <absolute-input.json> --output <absolute-result.json>` is
  an operator-authored argv entry. Only one bounded JSON proposal is written; input
  and result filenames/jobdir/asset identity are checked, existing output is refused,
  OCR remains unverified, no value is human-approved by the model. Expected normalized
  JPEG is checked against actual decoded format; hash/bytes,10MiB/24MP/one-frame and
  visual/token/schema limits remain bounded.
- `worker_admission.py` adds a read-only slot bridge **before model load**. It checks
  finite, current pc-ai metadata and the same installed guard hash/fixed byte0 lock.
  The worker retains sole lock ownership. There is no guard subprocess, lock wrapper,
  slot write, OS unlock or environment-only bypass. If the lock probe finds an idle
  lock, it releases only its own short probe and refuses admission.
- The local operator policy is absent by default. A disabled, PENDING example is
  included; it is not an approval. A future reviewed disposable-test policy must pin
  raw worker/config hashes, full revisions, absolute source/config/workdir/interpreter
  paths, fixed lock path, all five review gates and enabled=true. Source/config changes
  then refuse. Merely setting `FITMATCH_GPU_LOCK_HELD_BY=worker` is insufficient.
- Parent proof combines exact absolute worker argv/config, actual ancestor PID and
  rechecked creation time, reviewed interpreter/source/config hashes, an already-held
  byte0 lock and Windows Job membership. Required parent argv is the simple absolute
  `python worker.py --config config.json [--once]`; Python `-c` with a script name in
  trailing arguments is refused. No guessing relative parent paths or searching
  untrusted shell command strings.
- Missing/corrupt checkpoint becomes MODEL_UNAVAILABLE before torch import. Admission
  MEMORY_PRESSURE and GPU_BUSY retain their typed errors even when a second admission
  check fails immediately before load. Cleanup failure cannot produce a success result.

This is a local operator trust mechanism, not authentication against a hostile local
administrator. Generic `IsProcessInJob` does not identify a particular anonymous Job
Object by itself: the exact reviewed transport is responsible for per-adapter Job
placement/whole-tree drain. Positive parent/Job facts are injected in CPU tests;
they are not native production-placement acceptance. That gate remains open.

## Measured evidence

| Check | Result and limit |
|---|---|
| Combined suite |130 tests,129PASS,1Windows1314 file-link skip;0failure/error; torch not imported |
| New bridge tests |27 tests, including two native disposable byte-lock cases; other positive parent/Job/installed-guard facts injected |
| Actual argv refusals |Four CPU subprocesses: absent approval, env hint alone, unsupported model and malformed input; exact stderr/exit classified by unchanged1f4 transport |
| Error table |Eight codes checked using actual classify_exit; typed adapter TIMEOUT requires operator mapping below |
| Positive output |Synthetic CPU backend + injected parent proof → bounded result; actual transport json_result_ok and exact exported schema checker PASS |
| Shared GPU / HTTP queue |NOT RUN; no shared lock taken by tests, no PC photo/model inference |

The prior103-suite checkpoint remains in evidence unchanged. New combined evidence
is `evidence/worker_bridge/cpu-suite.json`; CPU-generated result is explicitly labelled
`cpu-fixture-result.json`. It is not Qwen inference, an authenticated job or a human
confirmation. Source-only restoration runs66 adapter/wire/bridge tests without
models/images or live credentials.

## Exact transport error compatibility

Pinned1f4 transport raw source SHA256:
659165ab3723a8608c36acfbd826ec023db3c1bfba402a74d4cb066288f8d8d1.
Default mappings accept75/GPU_BUSY,74/MEMORY_PRESSURE,70/INVALID_OUTPUT,71/OOM,
78/MODEL_UNAVAILABLE and2/INVALID_INPUT. Code1 is terminal INFERENCE_FAILED.
The adapter's logical timeout emits124/TIMEOUT; default transport classifies it
INFERENCE_FAILED. For typed timeout in a reviewed test config, explicitly add
`"exitCodes": {"124": "TIMEOUT"}` to the garment.analyze engine. This supported
operator mapping was checked with actual classify_exit; no transport edit was made.
An uninstalled `worker-engine.example.json` supplies explicit argv/fixed-lock/model
and timeout mapping placeholders. Claude's latest example uses positional adapter
args and default lock; replace both for this adapter in a reviewed private test config.
Worker's own hard timeout already reports TIMEOUT independently. Review must also
set its engine timeout long enough to include checkpoint verification/load/cleanup,
while preserving a bounded hard deadline. Do not classify loaded-model emergency
pressure exit86 as pre-load admission MEMORY_PRESSURE.

## Reproduction and remaining gates

With the existing pinned environment, from `ai-service/qint_p`:

```powershell
python -m unittest -v test_adapter test_wire test_worker_bridge
python run_cpu_suite.py --worker-bridge
python transport_interop.py
```

Full suite retains the explicit Q03/candidate/public-fixture dependencies; the
transport probe reads the exact1f4 Git object from the separate docs checkout and
copies it privately for readonly import/classification, without running its loop.
The app source copy is excluded from public source snapshots. The pure66-test
source-only suite needs no images, models, transport source or shared lock.

The bridge checks a slot after the worker has claimed a job/held its OS lock. Denial
returns bounded GPU_BUSY before load, using the app's retryable deferral behavior.
It does not implement slot-aware **pre-claim** scheduling or guarantee FIFO fairness;
Claude/QINT-G/Codex must accept this placement or add a reviewed pre-claim bridge.
Slot expiry never preempts a held GPU execution. No renewal/preemption is performed.

Before GPU integration: Codex reviews this proposal, exact current transport and
PR10's activeProcesses0/process-handle timing limitation; owners settle fixed-path
worker config/slot placement and a dedicated authenticated test endpoint/scoped
credential. Then operator can install a reviewed private test approval and 3D can
grant an explicit Qwen slot. No such policy, config, enrollment, grant or approval
was created in this session. App/transport/sharedguard and central process remain
unchanged. PC-PHOTO-019 keeps its independent 3D input/GPU ownership.
