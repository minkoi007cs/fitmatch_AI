# AI-QUALITY-03 — CPU robustness, human review and source retention

Session `PC-AI-QUALITY-20261106-03`, task AI-QUALITY-03 / H-AUDIT-016, Windows MIN_KOI,06November2026 America/New_York.
Read current AGENTS/agent/roadmap/process, project audit and `pc-post-audit-20261106.md`.
Docs baseline `f75290da00e2006e67ef4139afdcafac5daa655d` / PROC-0016; pre-publication readback `d3f29a51f8615f4831aa173791896a6fba0eca6e`.
Separate branch `docs/pc-ai-quality-03-20261106`; central process/PR1/PR3/PR5 and app/3D sources are unchanged.
Preserved [quality02 checkpoint PR5](https://github.com/minkoi007cs/fitmatch_AI/pull/5)90184b1, selected detail runtime, original/derived weights and existing env.

## Outcome

**Ready for review, not live integration.** Final CPU suite: **60passed, 1Not run/skipped, 0failures, 0errors**, 61cases, exit0, 5.897s.
The skip is native file-symlink creation (Windows1314); no elevation/OS change was attempted. Reparse refusal logic was fault-injected separately.
Six real Windows process tests verified isolated CPU child/grandchild cleanup and actual interpreter vs venv-launcher PIDs.
Low-memory emergency decision/exit86 was tested with injected integers, **not real RAM exhaustion**.
There were **zero new model/GPU inference runs**, no new model download, environment install, service, auto-apply or capability advertisement.
Rules-v1 remains fallback; personal images are **needs_input**. All examples/fixtures are clearly labeled.

**Known issue Q03-GUARD-01:** unchanged shared guard accepts NaN/Infinity slot expiry in an isolated CPU reproduction.
This is a local admission-metadata robustness gap, not a claimed remote exploit or a live GPU run.
A scoped patch with base hash is supplied for PC-3D-02 review; the real guard/slot/lock was not edited.
The Qwen controller proposal rejects nonfinite metadata before load, but is not wired into the selected quality02 runtime or live worker.

## Broader licensed fixtures and annotation plan

Five new original photographs were acquired from Wikimedia Commons, total8,241,486bytes, source SHA1 and local SHA256 verified.
They join the prior photograph and illustration: **7sources,6photographs+1illustration**.
[Corpus plan/labels/provenance](ai-quality03/corpus-plan.json) contains source/license URLs, authors, hashes, image kinds and provisional visual labels.
Sources include [T-shirt.jpg](https://commons.wikimedia.org/wiki/File:T-shirt.jpg),
[Tshirt.jpg](https://commons.wikimedia.org/wiki/File:Tshirt.jpg),
[black jeans](https://commons.wikimedia.org/wiki/File:Levi%27s_501_black.jpg),
[naturally occluded Wikipedia shirt](https://commons.wikimedia.org/wiki/File:Shirt-Wikipedia.JPG) and
[plain long-sleeve top](https://commons.wikimedia.org/wiki/File:Men%27s_long-sleeve_T-shirt.jpg).
Author/license attribution is preserved in the provenance; image bytes are not redistributed in Git.

| ID | Kind | Ground-truth scope / limitations |
|---|---|---|
| legacy-striped-illustration | illustration | Prior regression only; no new inference to chase DELO. Crest text not adjudicated. |
| legacy-blue-jeans | photograph | Original front photograph; no hidden-back pocket/material truth. |
| plain-white | photograph | Despite acquisition alias plain-white, actual image has green chest print. ESPRIT is visible on neck tag and small chest text. Stylized central text remains unadjudicated. Filename/title are not labels. |
| multi-hanger | photograph | Several garments and heavy mutual occlusion; no single item target. Need crop/target selection before model load; no garment-wide no-logo claim. |
| black-jeans | photograph | Folded/back view, tan waistband patch and red tag visible, two visible rear pockets can be annotated separately. Brand text is unadjudicated at inspected display scale. Filename brand is not OCR truth. |
| striped-wiki | photograph | Central rider shirt only, back/partial view. Sack occludes lower graphic. Collared striped top is out of the first-release tee class; category/neckline unknown/review. Printed word Wikipedia visible; lower graphic/text unadjudicated. Nearby riders are distractors. |
| long-sleeve | photograph | Navy coarse color=blue, plain front long-sleeve top worn by a publicly licensed model. Garment labels only, no identity/face analysis. |

The acquisition alias plain-white is deliberately **not** treated as a plain-shirt label: visual inspection found green chest print.
The multi-hanger case requires selecting a target before load. The striped collared/back-view shirt is a hard negative/unknown for tee category,
with natural lower-logo occlusion and distractors. Black-jeans filename branding is not OCR truth.
Labels are single-annotator provisional; second review and region-level text adjudication remain required.
Four collection strata plan16additional photos (plain tee views, patterned/occluded logo photos, denim views and hard negatives).
Partition/hashes/labels must be frozen before any future GPU case; never send accepted labels/brand strings to the model.

Acquisition encountered an initial HTTP429; it was recorded/deferred rather than bypassed. Subsequent bounded metadata/original requests succeeded,
reusing files already cached. The per-file budget was raised locally from3MiB to6MiB to include the5.67MB natural-occlusion photograph.
No personal account files, user photos or large models were fetched. No image edits or model inference were used to generate labels.

Metrics separate category/color/pattern errors, coverage/abstention and unsupported nonvisible claims.
Unknown predictions do not earn correct-known-answer credit. Unknown ground truth is not a chance to score a lucky guess.
OCR precision is only defined for fully adjudicated text regions; extras from partially labeled regions are unadjudicated/review,
not automatically false brands. No broader-corpus accuracy rate is reported because it has not been run through a model.

## Controller and native fault evidence

The CPU controller proposal checks finite clock/expiry, current pc-ai slot, proved held-lock/guard-child evidence,
4GiB host/8GiB GPU headroom and target selection, then rechecks immediately before load.
Those headroom values are policy inputs in these tests; no GPU or real low-RAM benchmark is implied.
Generation has at most192tokens/8192bytes and2schema attempts. Invalid schema can retry once; oversized output/runtime crash/deadline is terminal.
Partial load failure still invokes cleanup. Unload failure or a surviving child prevents logical lease release.
The callback deadline does not interrupt a blocked generation; the Windows Job Object guard supplies the hard timeout.

| Group | Cases | Result / evidence |
|---|---:|---|
| Admission/budget/retry/pressure/controller |18|PASS; no load on invalid slot/clock/headroom/target; bounded retries; failed cleanup retains logical lease |
| Versioned human-review envelope |15|PASS; wrong owner/source/result/version, tombstone/cancel and self-approval rejected |
| Retention dry-run |11|10PASS+1Not run; active job/foreign binding/changed bytes/traversal/derived/reparse refused |
| Abstention/error metrics |8|PASS; errors, unknowns, incomplete OCR truth and target ambiguity kept distinct |
| Corpus/provenance |3|PASS;7hashes/licenses/partition/visual-label checks |
| Native Windows CPU processes |6|PASS; exclusivity75, normal release, timeout124, child crash7, injected pressure86, guard crash+descendant cleanup |

Native tests execute the **unchanged** guard code with constants injected into disposable `quality03/test-runs/q03-*` CPU namespaces.
The test driver only permits this task's allowlisted CPU child; it cannot run arbitrary model helpers.
Actual Windows Job Object/byte-lock behavior is exercised, while the machine GPU coordination files are not touched.
Parent driver PID is tracked directly; guard child launcher PID and actual interpreter/grandchild PID+creation time are recorded separately.
Only immediately created, identity-checked test processes are terminated. An unrelated test sentinel survives guard-crash cleanup.
The lock is released only after the owned tree exits; no model was loaded, so this is **CPU process-tree cleanup**, not a new GPU-unload claim.

Injected signals2GiB→512MiB→512MiB→512MiB trigger exit86. No real machine pressure was manufactured.
The selected quality02 emergency loop has not been fault-injected with a loaded Qwen model, and that GPU failure/unload path remains Not run.
The final suite sampled peak process-tree RSS155,430,912bytes, minimum host available5,052,678,144bytes,
main-process peak working set36,872,192bytes. Sampled tree RSS can miss very short peaks.
[CPU results](ai-quality03/cpu-suite.json), [log](ai-quality03/cpu-suite.log) and memory CSV retain counts/metrics/PID evidence.

The separate [slot metadata repro](ai-quality03/slot-metadata-repro.json) has2known-failing behaviors:
NaN and Infinity expiry both admitted an isolated normal CPU child (exit0). The reproduction runner's exit0 means the issue was reproduced,
**not that invalid metadata passed the desired policy**. Finite/shape checks are in [patch proposal](ai-quality03/guard-slot-expiry-proposal.patch.txt),
base SHA2564ddf206d2cb16794f1e05eded7278d82c027dab1d277ac737b003322f8006680.
Patch not applied or claimed tested as a modified native guard. Finding notice is also local in `coordination/pc-ai-quality03-guard-findings.json`.
PC-3D-02 owns review/apply/retest; no scheduler/live capability acceptance follows from these tests.

## Human-confirmation contract for Claude

[Envelope schema](ai-quality03/review-envelope.schema.json) is `pc-ai.review-envelope.v2`;
[confirmation schema](ai-quality03/human-confirmation.schema.json) is `pc-ai.human-confirmation.v1`.
Source binding includes authenticated owner/job/item/source-revision UUIDs, image SHA256, result UUID,
model/policy revisions and raw-output/envelope digests. All raw OCR stays separate from approved fields.
Model fields cannot approve themselves; unknown schema versions/extra fields/stale bindings fail.
An explicit human may submit corrected text for that exact source/version. The CPU validation result still has auto-apply false and performs no app write.
[Synthetic DTO example](ai-quality03/synthetic-confirmation-example.json) contains fake IDs/digests and a fake user transcription,
not an authenticated human action or new inference.
Hashes bind integrity/version, not authentication or proof that a person viewed an image.
App owner must enforce trusted auth, current tombstones/selection, durable confirmation-ID/digest replay rules and atomic field updates after ACK.
[Contract/controller proposal](ai-quality03/contract-proposal.md) is not a wire/server schema change. No new worker capability/provider is enabled.

## Source/temp retention audit and proposal

Inventory is metadata-only and Qwen-scoped; it excludes private-inputs,3D/env files and other personal folders.

| Area alias | Files | Bytes | Proposed lifecycle |
|---|---:|---:|---|
| public_reference_sources | 2 | 107,441 | reference_corpus_keep |
| public_quality03_sources | 5 | 8,241,486 | reference_corpus_keep |
| source_temp_jobs | 0 | 0 | owner_job_revision_binding_required |
| hf_config_cache | 0 | 0 | cache_review_separately |
| original_model | 13 | 8,887,291,213 | never_source_cleanup |
| derived_model | 28 | 8,887,290,909 | never_source_cleanup |
| qwen_reports | 43 | 353,243 | source_sensitive_if_personal_inputs_future |

Current Qwen sources are public corpus inputs, not owner/job scoped copies. `ai-service/jobs` is absent; no private job deletion ledger/collector exists.
Raw OCR and diagnostic excerpts become source-sensitive once personal inputs are introduced. Public fixture retention is separate.
Original and derived model totals are unchanged; they are never source cleanup targets. No source/model/3D artifact was deleted.

[Retention proposal](ai-quality03/retention-proposal.md) uses short full-UUID-hex job/source-version paths with immutable owner/job/source/SHA sidecar binding.
The first synthetic layout with3nested UUIDs failed Windows path-length limits; shortening layout and adding sidecar owner checks fixed that without OS changes.
The dry-run checks tombstone/attempt/drain proof, stored binding, allowlisted paths/digests and reparse components. It never executes deletion.
Native file-symlink creation was refused with1314 and is explicitly Not run; separate injected reparse-flag refusal passed.
Initial failure logs remain local; [digests](ai-quality03/initial-test-log-digests.json) and this report preserve their disposition.

Claude should persist deletion work before logical tombstones, retain original candidates across retries and report physical-delete-pending truthfully.
Do not derive retries only from not-yet-deleted rows. Separate requested→waiting_for_drain→physical_delete_pending→deleted_verified/retry states.
Revalidate owner/version/fence and use handle-bound Windows deletion to close plan-to-delete races before enabling an executor.
Sources, raw OCR/temp copies, model caches and referenced derived assets have different lifecycles; no guessed TTL/default or mass erase is introduced.

## Commands, limits and handoff

From local `ai-service/quality03` with existing Qwen Python:

```powershell
..\..\envs\qwen-vl\Scripts\python.exe prepare_corpus.py
..\..\envs\qwen-vl\Scripts\python.exe build_corpus_plan.py
..\..\envs\qwen-vl\Scripts\python.exe run_cpu_suite.py
..\..\envs\qwen-vl\Scripts\python.exe reproduce_slot_metadata.py
..\..\envs\qwen-vl\Scripts\python.exe retention.py
..\..\envs\qwen-vl\Scripts\python.exe build_exhibits.py
```

Final commands exited0; suite exit0 includes the declared1skip. The acquisition429/size-budget stop and initial retention path/link errors were corrected/documented.
[Source hashes/snapshots](ai-quality03/source-manifest.json) include dependencies on unchanged quality02 schemas/parser.
All original photos, model weights, local paths and secrets remain outside public Git; public copies have redacted home prefixes.
No new GPU run, real loaded-model OOM/unload, persistent deletion executor, app auth/storage transaction, two-account live integration or general-photo quality was verified.
This checkpoint is **Ready for review**, with Q03-GUARD-01 and native file-link case unresolved and schema/retention proposals awaiting Claude ACK.
Codex reconciles the delta;3D owner reviews guard hardening;Claude owns app privacy/URL and confirmation/deletion integration from the agreed source revision.
Continue independently only within those boundaries; personal inputs remain a separate needs_input, not a reason to invent product PASS.
