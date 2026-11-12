# QWEN-48 offline regression preparation

Status: **CPU preparation ready for review; STOP before GPU.**
Continuation of accepted CPU source `3b7edbf7dace52a24da30a19440ba6f3fe074c43`.
Full current app pin: `f58024703bf4ec8be365bee2f8b3e1bd2248fdec`.

The existing authorized first-job input and JPEG are present. Their private manifest/image
hashes and JPEG decoding passed locally. A new owner-only private run contains copies; the old
input, confirmed result/cache, binding and policy were preserved. No source-image digest,
photo/OCR content, request contents or private path is published. No new upload/click is needed.

## Prepared helper and trust path

`offline_regression48.py` is separate from legacy `cli.py`. Default invocation performs only
CPU inspection. Real `--execute` selects **AnalysisBackend48 + wire.execute + GuardedChild**.
It has no network client, database POST, transport loop, alternate backend or verifier override.
The guard label is used only for placement authentication, never in the model prompt.

The helper verifies a pinned private source manifest, request and output placement; compares
the exact guard/coordinator hashes and canonical file identity; then calls the existing actual
`admission.verify(label)`. That verifier requires the real guard ancestry, running pc-ai label,
named Windows Job membership, native child-creation identity, finite slot, held canonical byte0
and RAM admission. Model loading rechecks these facts after heavy imports through the same
real checker. No injected CPU verifier/kernel facts or lambda returning success is used for GPU.
The existing model code performs its normal checkpoint/offline-cache, RAM and VRAM checks.

The helper preserves no-overwrite behavior, uses a one-execution marker, writes output only
after wire execution/unload, and emits only safe status/outcome fields to stdout. It does not
hardcode an image hash, filename, desired category or expected regression answer. Actual
unsupported-category recognition remains to be reviewed from a future real-photo run.

The prepared command uses the unchanged canonical external guard as **sole byte0 owner**:

```text
ENV_PYTHON CANONICAL_GUARD --owner pc-ai --label qwen48-private-regression-001
  --cwd PRIVATE_RUN_ROOT --log PRIVATE_GUARD_LOG --timeout 240 --
  ENV_PYTHON CANDIDATE_ROOT/offline_regression48.py --request PRIVATE_REQUEST
  --approval PRIVATE_OFFLINE_APPROVAL --guard-label qwen48-private-regression-001 --execute
```

These are placeholders; the exact private argv is recorded locally, not executed.
No `--set-slot` or nested guard/worker is present. A new finite 600s PC3D grant is mandatory.
The engine timeout is 240s with 30s drain observation. The unchanged guard queries the native
Job until empty; a 30s observation deadline never permits release of an undrained tree. If
drain cannot be proved, preserve/quarantine the guard and lock instead of force-unlocking.

## Config and approvals

A separate private active config points the one analysis engine at the isolated candidate.
It preserves the worker token/model/transport, canonical coordinator, backend origin/ref,
request/retry limits and 240s/30s engine settings. The prior config and original qint_p remain.
Separate worker, offline and external-guard approval records are all **disabled**. Runtime
manifest and config/approval hashes are in [the sanitized receipt](offline-preparation.json).

The runtime manifest pins 98 source/schema files, including the helper, reviewed assessment
candidate and unchanged shared quality modules. `adapterRuntimeManifest` in the worker config
is operator preparation metadata; unchanged transport does not enforce that extra field. A
future queued-job launch must explicitly verify its manifest in the normal prelaunch check.
The offline helper itself revalidates the pinned manifest before native admission/model load.
No approval, fresh slot or backend capability is inferred from the existence of these files.

Owner-only ACLs were verified for the private directory and nine prepared files. No UAC,
administrator install, credential change or elevation was used. Canonical policy, guard,
lock, withdrawn slot and historical guard state were not modified.

## Actual CPU validation and remaining work

**91 tests run /91 PASS /0 failures /0 errors /0 skips**, Windows Python3.10.22, exit0.
This retains the accepted 81 assessment/adapter/wire/bridge tests and adds 10 helper metadata,
no-overwrite, tamper and fail-closed tests. Kernel facts are not faked as execution evidence.
The prepared real private input passed the helper's default CPU inspection. A direct
`--execute` attempt with disabled approval refused with `offline_approval_disabled` before
torch import or an execution marker. See [test log](offline-cpu-tests.log),
[helper/test patch](offline-helper.patch) and [hash/config receipt](offline-preparation.json).

STOP for Mac review of this exact helper and pins. After final GO, obtain fresh resource/
owned-tree/native checks and a new PC3D slot before the offline regression. Preserve its
private result and actual unload/drain evidence; do not POST or overwrite the confirmed analysis.
Only after hoodie acceptance/drain may a **separate** backend-enabled window process the one
remaining queued job via worker `--once`. No heartbeat/claim/GPU or new slot occurred here.
