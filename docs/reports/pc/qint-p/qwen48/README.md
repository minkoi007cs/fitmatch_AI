# QWEN-48: Windows CPU assessment fix

Current status: **CPU candidate accepted; one private offline unsupported-scope regression
accepted for its single input. STOP before the remaining app job.** Original runtime is preserved.
See [actual offline result/drain/withdrawal](offline-actual.md) and separate worker CPU readiness.
The following sections retain the CPU review evidence; they do not claim general image accuracy.
Latest CPU handoff: [reviewed job-ID gate installation and99-test receipt](job-scope-installed.md).
All approvals are disabled; no coordinator window or remaining app-job execution is authorized.
PC session `PC-QWEN48-20261112-01`, branch `docs/pc-qint-p-20261107`,
base `1629937530dca92ef25f4b87d1ea631dc7b7509a`.

Reviewed Mac proposal `70a36fa971b7c56dfeedc2bbeecac525be128cbb` against actual PC
source bytes. Three existing base hashes matched; all five initial candidate LF hashes matched.
Windows Git apply initially wrote CRLF; those five candidate files were normalized to the exact
reviewed LF bytes before testing. No live file was overwritten.

## Findings and change

The old semantic parser does not coerce a `hoodie` enum into `tshirt`: it validates a schema
limited to tshirt/jeans/unknown and structural consistency. The old prompt does not explicitly
discriminate unsupported garment types, and the mapper emits `proposal` unconditionally,
including for `unknown`. A schema-valid T-shirt answer can therefore be visually wrong.
CPU reproduction identifies these implementation gaps; it cannot prove why a particular image
was misidentified or establish a visible hood from JSON alone.

The isolated candidate adopts the reviewed internal `garmentType` assessment before attribute
projection. Hoodie, jacket, sweatshirt, shirt, sweater, other garment and unknown require null
attributes and map to the **existing** qint.1 `abstained/unsupported_category` result. Ambiguous,
unreadable and non-garment cases keep their distinct existing reasons. Confident T-shirt/jeans
assessments must match the attribute category. Contradictions, legacy flat output, extra/duplicate
fields and malformed output fail the existing bounded validation path; no fallback category is invented.

The prompt explicitly distinguishes an attached visible hood from long sleeves. A long-sleeved
T-shirt remains supported. Only `AnalysisBackend48` uses the new prompt; the local quality
backend retains its original prompt, verified by an exact CPU regression. Public categories,
schemas, qint.1, binding, model/weights, generation bounds, admission and cleanup stay unchanged.
No model-policy bump is proposed for implementing the intended existing abstention contract.
The adapter source hashes must be newly reviewed/pinned; old confirmed analyses/cache are preserved.

## Actual Windows evidence

`python -m unittest test_assessment48 test_adapter test_wire test_worker_bridge -v`:
**81 run / 81 PASS / 0 failures / 0 errors / 0 skips**, exit 0, Python 3.10.22 on Windows.
This includes synthetic positive T-shirt/long-sleeve/jeans, negative unsupported/ambiguous/invalid
cases, unchanged binding/model/policy, no-auto-apply, old error/cleanup/placement checks, and native
byte0 tests using disposable CPU sentinel locks. It is not a fresh rerun of the unchanged transport
56-test native suite or a real-image accuracy test.

Only successful injected analysis responses in `test_wire.py` and `test_worker_bridge.py` were
wrapped for the new internal assessment. Existing assertions/public fixtures are unchanged.
The legacy local-quality fixtures were not changed. One new test verifies separate prompt selection.
All 31 public contract/fixture files are byte-equal to baseline. No torch import, model/CUDA,
heartbeat, claim or real coordinator mutation occurred. See [actual result](cpu-result.json),
[test log](cpu-tests.log), [source hashes](source-hashes.json) and [reviewable patch](candidate.patch).

The final CPU sample at 2026-11-12T17:00:36Z had 6,189,318,144 bytes available RAM and
11,480 MiB free VRAM. These are observations, not a continuing GPU admission. The actual
withdrawn Nov10 slot remains expired, approval remains disabled and its old app/source pins are
not authority for this candidate. Canonical policy/guard/lock identity are preserved.

## Remaining gates

Codex reviews this exact patch/hash/test receipt before installation or approval changes. Then pin
the reviewed adapter and full current app SHA, obtain fresh resource/native/owned-tree checks,
and request a **new** finite PC3D slot. Preserve existing token/env/weights and confirmed data.
First verify the existing authorized private hoodie input offline under a separate finite GPU window;
do not overwrite the confirmed analysis, photo or cache and do not hardcode any image hash/filename.
Only after that result and a separate authorization/window may the one remaining queued job run
with `--once`, at most one job, engine 240s plus drain 30s, no renewal or overlap with render.
No reupload or additional click is needed. Actual image quality, token budget/latency, real regression
and remaining queued-job completion are **NOT VERIFIED** for this candidate.

No raw credential, personal photo, OCR text, lease token or private result is included here.
