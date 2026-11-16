# CAT54 CPU candidate — ready for root review

The private W007 image was actually viewed: the dominant garment is a dark horizontally quilted jacket with an open front zipper and standing collar. There is insufficient visible hood evidence to call it a hoodie. No material composition is inferred. The old assessment accepts attributes only for tshirt/jeans and explicitly requires other garment types to return null attributes. Its historical result was abstained/unsupported_category, null attributes, one attempt, 19 output tokens, 86,812 ms. This is consistent with the old scope restriction; it does not establish which exact garmentType the model emitted. Raw model text was not persisted in the available attempt files and cannot be recovered from its digest.

Root reports the historical W007 backend job/analysis deleted and the later job69 canceled at attempt zero. Neither target is restored or requeued. Their status is root-reported, not a fresh PC database query. Historical local W007 result, once marker and receipts are preserved. The old78 confirmed item is untouched. A future real run must use a NEW qint.2 job bound to a CURRENT owned image after deployment and all execution gates.

Root's latest signed-in app inspection identifies the current beige hoodie as the intended retest source. This is root-reported visual context, not a new PC image inspection. The deleted jacket and canceled jeans job are excluded. Root will provide the NEW authenticated-UI job ID/input before config gates. No garment label, color, job ID or image digest is hardcoded into the candidate to enforce that expected answer.

## Actual source and isolation

Local docs branch `docs/pc-qint-p-20261107`, baseline HEAD `c8b33d743ec6458093e06362a8cf14e6ae3ad03c`, clean before the CAT54 claim. Local HEAD is not claimed synchronized with earlier connector publications. Scope is this CAT54 report/source directory and the PC-owned process delta.

The new source candidate is `ai-service/qint_p_qwen54`, separate from the active `qint_p_qwen48`. Its exact app contract source is `1cef14d6fc866b21ade675fb425b383be3dcd6ed`. All 34 fetched schema/fixture/checker/document files match their Git blob IDs, including unchanged files; the three changed schemas are not approximations.

- [Runnable new modules and mapper/CLI source](./proposal/) and [small baseline diff](./candidate-source.patch).
- [Changed candidate file inventory with actual SHA256](./candidate-changes.json).
- [CPU diagnosis and unchanged baseline source hashes](./cpu-diagnosis.json).
- [Verification and prepared private pins](./cpu-verification.json), [complete synthetic CPU log](./cpu-suite.log).
- [Windows source bytes versus published LF hashes](./source-representations.json); all eight runnable source files are already LF and have identical hashes in both representations.

The assessment supports tshirt, shirt, hoodie, jacket, sweater and jeans independently, without relabeling. A visible attached hood is needed for hoodie; long sleeves alone are insufficient. Uncertain, ambiguous, non-garment, unreadable and out-of-domain targets still abstain. Unknown is accepted by the app vocabulary but deliberately remains an abstention in this assessment. A hoodless sweatshirt is not forced into tshirt or sweater. Common attribute consistency and forced-unknown material/hidden pockets remain enforced. This is analysis taxonomy only, with no new 3D capability.

New public policy is `qint.2`, adapter revision `pc-ai.qwen-cat54.v1`, internal attributes revision `pc-ai.grounded-attributes.v3`. The mapper chooses the legacy assessment for qint.1; its schema still refuses new categories under that policy. The new backend only overrides the prompt: load/generate/unload inherit the identical pinned implementation. Output budget remains 192 tokens and at most two schema attempts. Human review and approvedForAutoApply=false remain mandatory.

## Actual CPU verification

`python -B run_cat54_cpu.py` on the isolated Windows candidate ran **177 tests: 176 passed, zero failures, zero errors, one skipped**. The strict harness intentionally returned exit **1** because it requires zero skips. The single Not run is the pre-existing native filesystem symlink case, WinError1314; no elevation was requested. It is not counted as PASS or silently waived.

All **22 new CAT54 assessment/wire/CLI tests passed**, including exact public schemas, all six category identities, legacy-policy rejection, unknown/OOD abstention, material/pocket refusal, strict JSON, OCR/color consistency, retries limited to two, unchanged 192-token calls, unload failure withholding output, and a synthetic CLI result through the actual candidate mapper. The broader suite also passed native CPU copied/replaced-lock refusal, cross-process exclusion, child/grandchild timeout drain and guard-crash cleanup. These are disposable CPU fixtures, not a new real GPU/native execution ACK.

`python -B contract_snapshot/scripts/check-qwen-contract.py` separately returned **exit 0 / qwen-v1 conformance PASS** against six valid and eighteen invalid result fixtures plus input/error cases. No torch, transformers or bitsandbytes import occurred. No private image was fed to a model during this work. Model category accuracy remains NOT VERIFIED until an authorized real run.

Reproduce with the existing pinned qwen-vl Python environment, from the isolated candidate directory. The supplied source is an overlay on the reviewed qwen48 baseline; apply candidate-source.patch to that isolated copy, add the new modules, and use the exact contract snapshot at the full app commit above. Do not apply it over the active runtime or old 98-source pins.

The unified patch uses LF. For a Windows CRLF baseline, normalize only the three files in the disposable copy (wire.py, worker_cli.py, test_wire.py) and the patch to LF before applying, or use the supplied full mapper/CLI source. An actual git apply --check on that LF-normalized disposable baseline returned exit 0. The LF patch SHA256 is `631fab4fb1cfc2d72a8e562fbf5e4c5bdae8504245b4d31be6e4d76788072f96`. The generated patch's blank context lines carry the required unified-diff space; ordinary source whitespace checks exclude that artifact.

## Config and manifest adaptation prepared, disabled

Private preparation created three NEW files, without activating them:

| Artifact | Actual SHA256 |
|---|---|
| qwen54-runtime-manifest.json, 111 entries | `2b558726a222980b376711eb790a7fda010e0ca4a22d9cfb2af10c4b4dd471bd` |
| qwen54-worker.prepared.json | `a41a9b157434886abfbd0d48de8b09bc912acc44c3af53ad023de79658455a3e` |
| qint-worker-qwen54-approval.json, enabled=false | `f7c22ddfe5323760a1e7d71cdc5e98ca0ea0c86e914f37d0a005ad6220ac1d72` |

Manifest scope is the inherited 98 entries mapped to the isolated candidate plus its new modules/tests and exact snapshot files. Unused historical copied utilities are not newly admitted into the manifest. All entries match actual bytes. All original active 98 entries also still match their old manifest.

The prepared config uses a new, empty work directory and the same Python/environment/model, transport, timeouts, drain and coordinator. Only the adapter CLI path, explicit disabled qwen54 approval path, isolated work directory and new runtime-manifest pin are adapted. The CLI command remains direct `python qint_p_qwen54/worker_cli.py --input {input} --output {output} --policy <qwen54-disabled-policy>`. It adds no external guard or nested lock owner.

`gpuCoordinator {path,sha256}` and `expectedBackend {projectRef:gohczmqykjkrgdblgbog,appOrigin:https://fitmatch.minkoi.org}` are preserved; gpuLock/gpuSlot/gpuGuard keys are absent. No token or token digest is published. The immutable transport still hashes to `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6`; the shared guard remains `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c`.

Every new local review field is PENDING and the new approval is OFF. The deleted old job pin was removed from the new disabled preparation; it must be replaced with the NEW exact job ID before any approval can be enabled. The old current98 manifest/config/approval bytes are unchanged. Existing execution helpers are not repointed: they remain bound to the closed qwen48 flow and are not eligible to launch this candidate.

Root reviews the source/schemas/tests and serving revision first. Follow-up work is a separately reviewed helper/pin adaptation for the new job, fresh backend preflight/native ACK and a finite pc-ai slot issued by the existing 3D coordinator. Worker remains sole byte-zero lock owner until its entire owned process tree drains. No heartbeat, claim, slot issuance, requeue, inference or render was run here. No transport, model, environment, grant, guard or cleanup implementation was changed.
