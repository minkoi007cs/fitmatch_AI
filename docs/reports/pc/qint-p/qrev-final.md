# Exact Claude final conformance — PC-QINT-P-20261108-04

App7631cb00114ddf559c234f1c0f13285dbb7305ab/codebf0b6d7. The **worker-owned/direct
adapter placement proposal is ACKed for the exact PC coordination paths**; final
startup/configuration ACK is **WITHHELD** for two reproducible mismatches below.
No CUDA, shared OS-lock acquisition, real worker loop/network or personal input.

## Findings on the exact final source

`SharedGpuAdmission` rejects default/relative/missing lock files and guard hash
mismatch, but accepts **any existing absolute lock file**. It also accepts an
arbitrary absolute `gpuSlot` rather than binding it to the ACKed coordinator slot.
The fixed installation paths and the chosen config paths are not independently
compared. In a CPU fixture, an unrelated existing lock and a different existing
slot both reached `Worker(...)` in the actual `main()` method (exit0 from the injected
CPU loop), where the desired behavior was startup refusal before worker construction.

This is a configuration/admission acceptance gap, not an observed GPU overlap or
remote exploit. `main()` used disposable CPU DirLock/containment/Worker stubs, so no
real locks, credentials, client or adapter were used. The existing Qwen bridge
independently rejects both wrong paths before CUDA; that last barrier does not
establish the requested worker startup guarantee. A reviewed exact config alone
can be considered separately by Codex, but must not be called a generic mismatch
rejection. Claude/Codex should bind startup to an independent exact PC coordination
receipt or explicitly reconcile the narrower acceptance rule before final ACK.
QINT-G separately reported the matching CPU admission gap while holding the canonical
lock and acquiring another disposable lock; that native probe belongs to QINT-G's
evidence. This session did not reproduce that real-lock interval or infer GPU overlap.

The PC receipt privately records the actual lock/slot/guard absolute paths:
existing coordination/gpu0.lock, adjacent gpu0-slot.json, and installed guard hash
47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c.
Worker owns byte0, Qwen is a direct child, no nested guard, no env-only bypass.
The older external-guard ACK remains standalone-only. No Qwen slot was requested.
QINT-G's separate real-lock CPU probe has an idle/no-heavy-Qwen receipt.

## Evidence

| Check | Result / scope |
|---|---|
| Exact source identity | CRLF Windows copy SHA5f03f523a78e9cb805850e5d7df8e2a37a5b550c205633a1d2f2ba00fb509604; Git LF SHA4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb |
| Final schema/fixture comparison |28 file hashes unchanged from pinned adapter contract |
| Guard vs new worker finite-slot matrix |35 invalid cases refused,3 valid/legacy/max3600 cases agree |
| Upstream startup fixture |5 invalid cases refused;2 wrong-existing-path cases unexpectedly reached Worker; fixed-path positive reached CPU stub |
| Pre-claim metadata methods |Wrong owner, expired, NaN, duplicate JSON and subsequent guard hash swap refused in disposable namespace |
| Own adapter regression |131 cases,130PASS,1Windows1314 file-link skip,0errors/failures; torch not imported |
| Restored source-only suite |67 adapter/wire/bridge cases PASS; no models/images/live config required |

The first source pin check stopped because Git emits LF while the native PC file
is CRLF. Both digests and byte conversion were verified; the executed private
Windows copy has the exact5f03 hash reported by QINT-G. No application code changed.
The actual startup smoke exits1 intentionally while the two acceptance gaps remain;
this finding result must not be relabelled PASS because the adapter unit suite passes.

## Own bridge/config alignment

The bridge now checks the final worker's `gpuGuard`, `gpuSlot`, `gpuSlotOwner`
fields against the actual installed receipt, in addition to fixed gpuLock/workDir,
source/config pins, parent identity, OS-lock/Job proof and review gates. Missing or
swapped fields refuse before lock/kernel probes. The example engine config has
the same new fields as required private placeholders. No real policy/config is
installed. New field compatibility is CPU-tested; native final parent/Job/resource
acceptance stays with QINT-G/Codex. The final source's native39 suite was run by
QINT-G, not repeated or claimed as this session's test result.

Reproduce on the PC with the existing pinned environment:

```powershell
python qrev_final_smoke.py
python -m unittest -v test_adapter test_wire test_worker_bridge
python run_cpu_suite.py --qrev-final
```

The first command reads exact Git objects and private installed guard bytes and
uses only disposable metadata/CPU stubs. It never calls the worker network loop
or acquires the shared lock. Full131 dependencies are the preserved public corpus
and isolated candidate fixtures. Public snapshots omit the private app source.

Controlled loaded-model pressure/timeout hooks are preserved, **NOT RUN**. No model
or cache download/benchmark/rehash, app enrollment, capability grant, production
change or personal-photo operation occurred. Codex cleanup/quota review, exact
startup/config reconciliation, native ACK, explicit pc-ai slot and dedicated test
environment/scoped credential remain gates before real integrated GPU.
