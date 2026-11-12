# QWEN-48: visual assessment review candidate

Status: **CPU candidate only; not installed on PC and not an image-quality acceptance.**

The first real hoodie analysis returned a T-shirt proposal. The existing prompt presents only the supported category enum, and the mapper always emits a proposal, including for `unknown`. Independent CPU reproduction of the published PC snapshot confirms the latter behavior. These are separate findings: correcting the mapper alone does not prove the model will recognize a visible hood.

This patch proposes a local assessment with `garmentType` before attribute projection. The model may identify a hoodie, jacket, sweatshirt, shirt, sweater or other unsupported garment. Such results carry no attributes or OCR candidates and become the existing `qint.1` `abstained/unsupported_category` response. Ambiguous targets, unreadable images and non-garments retain their separate existing reasons. A supported type must match the returned attribute category. Contradictions, duplicate keys, extra fields and legacy flat output are rejected through the existing bounded schema retry path.

The assessment prompt distinguishes a visible attached hood from long sleeves: a long-sleeved T-shirt remains eligible. An `unknown` type means the supported category was not established and conservatively abstains. This is a review policy, not proof that an unknown image actually contains an unsupported garment.

Only the worker analysis backend selects this prompt. The existing local quality backend keeps its prior default prompt. Model loading, weights/revision, generation limits, visual-token bounds, admission, process containment, cleanup, transport and public API schemas are unchanged by the proposal. Public result binding, raw-output digest, `qint.1`, and `approvedForAutoApply=false` are retained. No confirmed wardrobe row is rewritten.

## Evidence

- Baseline published PC commit: `1629937530dca92ef25f4b87d1ea631dc7b7509a`; source snapshots under `docs/reports/pc/qint-p/sources/`.
- App source used for compatibility: `f58024703bf4ec8be365bee2f8b3e1bd2248fdec`.
- Portable `python -m unittest test_assessment48 -v`: **10 tests passed** with parameterized supported/unsupported and malformed cases.
- Eight synthetic candidate results parsed successfully by the actual app `analysisResult` Zod validator: T-shirt, jeans, hoodie, jacket, unknown, non-garment, unreadable image, ambiguous target.
- Python compile check passed for the new module and the three modified runtime files.
- Mac review environment: Python 3.12, jsonschema 4.23.0, psutil 6.1.0, Pillow 11.0.0, isolated from the app and PC environments.
- Baseline full `test_wire` cannot import Windows `msvcrt` on Mac. No Windows/native-suite success is claimed.

## Reconciliation before installation

The PC AI owner retains actual runtime ownership and may already have a candidate. Compare this proposal with that work; do not overwrite it. `source-hashes.json` records base and candidate bytes. Verify actual PC base hashes, then review or adapt the patch in a separate candidate directory. The live PC files, config, approval, model cache and coordinator were not edited from Mac.

Existing injected test backends in `test_wire.py` and `test_worker_bridge.py` emit the old flat local response. If adopting this candidate, update only their analysis response fixtures to the new wrapper and run those existing Windows suites; do not weaken assertions or change the public contract fixtures. Preserve separate local quality tests and backend behavior.

Before a live claim, the PC owner must finish its CPU review/tests and pin the reviewed adapter source and current app revision in the normal local approval. Then obtain fresh resource/process/lock checks and a new finite coordinator slot. Verify the real hoodie privately using the existing authorized image, without rewriting its confirmed analysis, followed by a separate finite window for at most the one remaining queued job. No new image upload is required by this proposal.

Actual visual accuracy, output-token use, latency, Windows integration and final owned-process drain remain **not verified** for this candidate. A model can still identify a garment incorrectly; synthetic parser tests cannot establish image truth. Do not mark QWEN-48 complete until real-photo verification and the remaining app job have evidence.
