# AI-QUALITY-02 — grounded attributes and host memory comparison

Session `PC-AI-QUALITY-20261106-02`, MIN_KOI Windows, 06 November 2026 America/New_York.
Docs baseline `a32f6fbf7a1ba7c744930a3f8b872dd801aab206` / PROC-0014;
branch `docs/pc-ai-quality-02-20261106`, separate docs checkout.
Pre-publication readback `b23f071f852bea51cb746ee69359e6f089bc62bc` / PROC-0015 includes the AI-QUALITY-02 dispatch; central process is not modified here.
Preserved [PR3 checkpoint](https://github.com/minkoi007cs/fitmatch_AI/pull/3) at49d27d0; no rewrite/merge of PR3 or PR1.
Read current onboarding/rules, process/roadmap updates and H-PC-SPLIT-010; scope is local Qwen quality/runtime evidence.
No app/server/transport, env3D, MSVC/UAC/driver, paid provider, model download, new chat or live integration.

## Outcome and review status

Host memory improvement **Ready for review**: process peak working set **3.920→1.746GiB**, observed **55.5% reduction**.
Detail run host available-memory floor **3.124GiB**, versus0.151GiB baseline.
Both new runs exited0 through the original shared guard and all children exited. Model is unloaded; no further GPU run scheduled.
Structured category/dominant colors/pattern/logo visibility/collar/sleeves match both narrow labels.
**OCR remains Needs changes**: detail reads DELO as DEL. Jeans fixture passes; tshirt raw result is rejected for review despite valid JSON.
14 CPU tests PASS. These two public references are not a representative dataset or real-user garment acceptance.

## Root cause and local weights preparation

Baseline minimum host available RAM161,599,488 bytes occurred17.389s into the run, during weights loading;
peak sampled process RSS4,150,222,848 bytes at26.412s. Image-token reduction alone cannot address that loading peak.
Original model remains Qwen/Qwen3-VL-4B-Instruct revision `ebb281ec70b05090aa6165b016eac8ec08e71b17`, original Apache-2.0 card declaration;
unchanged Python3.10.22/torch2.9.0+cu128/transformers4.57.1/bitsandbytes0.48.2 env.

CPU streaming copy repartitioned the existing two large BF16 safetensors files into **17 local BF16 shards**.
No tensor splitting/quantization occurs in this step; all713 tensor payloads (8,875,631,616 bytes) were independently reread and matched by SHA256.
Original shard hashes were rechecked first. The largest embedding is indivisible, so the512MiB grouping target has one **777,912,472-byte shard**.
Files live in `models/qwen3-vl-4b-reshard512m/`; originals are unchanged. Added local disk usage is about8.88GB, **downloaded bytes0**.
CPU preparation: 144.788s; peak process working set44,994,560 bytes.
[Derived shard sizes/hashes](ai-quality02/reshard-summary.json) include the full local tensor-manifest digest;
full713 tensor entries remain local at `reports/ai/quality02/reshard-manifest.json`.

Runtime still quantizes those BF16 tensors to NF4 on load (356Linear4bit modules, FP16 compute, SDPA, CUDA0).
This is a **re-sharded BF16 artifact**, not a saved4bit checkpoint. No CPU offload was enabled: host memory was the constrained resource;
offloading model modules into RAM would need a separate supported/benchmarked design.
Parallel checkpoint loading is explicitly disabled. References: [pinned Transformers loading API](https://huggingface.co/docs/transformers/v4.57.1/en/main_classes/model),
[safetensors format/API](https://huggingface.co/docs/safetensors/api/torch). The local streaming implementation copies payloads without importing torch.

## Labels and validation

The unchanged licensed inputs are the [CC BY4.0 tshirt illustration](https://commons.wikimedia.org/wiki/File:White_tshirt.png),
author Сергей Шахвердов,171×155; and [public-domain jeans photograph](https://commons.wikimedia.org/wiki/File:Jeans.jpg),
author Oktaeder/uploaded Juanmak,435×650. Images remain outside Git.
[Provenance](ai-quality02/public-image-provenance.json) has source/license links, original bytes/hash and preprocessing notes.
[Labels](ai-quality02/labels.json) were established by visual inspection before new model runs. Ground truth is never sent to the model.
Personal wardrobe photos remain **needs_input**; work continued on clearly labeled fixtures without waiting for Mac.

V2 closed schema removes unsupported freeform construction claims; material composition, hidden-back and total pocket count are always unknown for this task.
Those three policy-forced fields do **not** earn perceptual-accuracy credit.
Validation separates JSON/schema, field consistency and fixture-specific truth. Unknown is an abstention, not a correct known answer.
Category/color errors, invented brand text and incomplete/omitted logo OCR are tracked individually.
No generic validator can infer pixel truth from JSON alone; fixture comparison is not an unlabeled-image proof.

The [CPU suite](ai-quality02/cpu-semantic-tests.log) exited0,14 tests,0.002s.
It proves schema-valid red/jeans on the tshirt is rejected semantically, invented OCR fails, unknown remains partial,
hidden-pocket/material claims fail, duplicate/extra/oversize/NaN/trailing JSON fails, and raw OCR never becomes verified text.
The public source snapshots are review evidence, not app code installation.

## Measured comparison

| Run | Samples | Load s | Whole process s | Peak process working set GiB | Min host available GiB | Whole-device peak MiB |
|---|---:|---:|---:|---:|---:|---:|
| PR3 baseline | 3 | 51.795 | 103.245 | 3.920 | 0.151 | 5284 |
| Low resolution probe | 2 | 32.809 | 81.966 | 1.779 | 3.198 | 5288 |
| Detail profile | 2 | 32.66 | 58.191 | 1.746 | 3.124 | 5292 |

Each new profile ran exactly once. Baseline has3samples versus2images per new run; whole-run time is **not** an apples-to-apples throughput comparison.
Baseline load-start available RAM was2,539,438,080 bytes; lowres 4,843,933,696, detail 4,701,528,064 bytes.
Background host pressure and cache warmth differ. The improved free-RAM floor is partly better starting headroom;
the measured process high-water reduction supports the re-sharding improvement but does not isolate every cause or establish an SLA.
Torch peak allocated stays **4,437,815,808 bytes**, identical to baseline; device peak is essentially unchanged.
There is no claimed VRAM reduction. [Lowres result](ai-quality02/lowres-result.json), [detail result](ai-quality02/detail-result.json)
preserve raw outputs/attempts, timings and phase peaks; memory CSVs retain every sample. Raw local result hashes are included.

## Resolution, semantic errors and selected proposal

CPU processor-only verification (CUDA not initialized) found actual image token counts:

| Profile | Tshirt tokens | Jeans tokens | Output cap |
|---|---:|---:|---:|
| PR3 baseline preprocessing | 72 | 176 | 384 |
| Lowres probe | 25 | 70 | 192 |
| Detail profile | 72 | 70 | 192 |

Max image edge320px, image token cap96, one schema retry at most; all four new image generations passed schema on their first attempts.
Detail keeps the small tshirt's processor minimum65536pixels while jeans stays bounded; lowres minimum4096pixels damaged OCR.

| Field | PR3 | Lowres | Detail |
|---|---|---|---|
| Category, primary colors, pattern, logo visible/not visible | Correct for both | Correct for both | Correct for both |
| Tshirt crew neck/short sleeves | Incorrectly stated details not visible | Correct explicit fields | Correct explicit fields |
| Tshirt logo OCR | FON BET correct; missed DELO/RUSCON | RUSCON correct; DEL/FOMBET false | FON BET/RUSCON correct; DEL false |
| Tshirt OCR precision/recall on3labeled texts | 1.0 /0.333 | 0.333 /0.333 | 0.667 /0.667 |
| Jeans total pockets/composition | Unsupported freeform claims | Unknown enforced by policy | Unknown enforced by policy |

The larger tshirt budget improves recall relative to the lowres probe, but **does not eliminate OCR errors**.
No further GPU reruns were made to chase this example. The CPU review envelope stores all raw candidates separately,
clears accepted logo text, marks OCR unverified and `approved_for_auto_apply:false` for every proposal.
This fallback uses no fixture truth and does not silently repair DEL into DELO. Raw model JSON is retained.
[Per-field evaluation](ai-quality02/semantic-evaluation.json) and [review proposals](ai-quality02/review-proposals.json) expose the distinction.
The selected runtime proposal is the detail profile plus mandatory OCR review/unknown text, not automatic brand extraction.
Generalization, real-photo robustness, multilingual/logo coverage and model self-confidence calibration remain unverified.

## GPU coordination and resource gates

The unchanged shared OS guard acquired byte0 of the one fixed absolute lock before either model load.
Exact absolute paths were ACKed locally in `coordination/qwen-gpu-ack.json`; the public [ACK](ai-quality02/shared-lock-ack.json)
redacts the home/workspace prefix as `<GPU_ROOT>`:
`<GPU_ROOT>/coordination/gpu0.lock` and `<GPU_ROOT>/fitmatch_AI/workers/windows/gpu_guard.py`.
Guard SHA2564ddf206d2cb16794f1e05eded7278d82c027dab1d277ac737b003322f8006680.
Admission slot from3D at2026-11-06T05:25:03.600020Z was valid for both starts; no takeover, slot mutation or foreign job termination.
New direct invocation refused before torch import (expected exit1); guard launch uses own Qwen env as contained child.
At least4GiB host available RAM is required after imports and before load; at least8GiB GPU headroom.
Own process exits86 if host RAM remains below1GiB for3samples; this emergency path was **not triggered/tested under real pressure**.
These are experiment admission thresholds, not production safety acceptance. Do not repeat loads alongside memory-heavy3D CPU work.
Live worker remains disabled; do not wrap a future worker that acquires the same lock in this guard, which would deadlock.

Both guard exit receipts say allJobProcessesExited=true and exit0. Final device memory after process exit759MiB.
CUDA allocator counters remain nonzero inside cleanup; **whole process-tree exit** is the authoritative unload boundary.
[Release receipt](ai-quality02/gpu-release.json) was copied to `coordination/pc-ai-qwen-release.json` for3D to reclaim admission.
No resident model/service is left and no new GPU work is scheduled.

## Reproduction and handoff

Relative to `ai-service/quality02`, run CPU fixtures and processor check with existing `../../envs/qwen-vl/Scripts/python.exe`.
`reshard.py` streams into a new derived model folder and refuses overwrite; don't rerun against completed outputs.
GPU command used the original guard with ownerpc-ai and a current3D slot, timeout600s, labels
`qwen-quality-PC-AI-20261106-02` and `qwen-quality-detail-PC-AI-20261106-02`, own child `run_quality.py` and `run_quality.py --detail`.
CPU semantic tests/repack/processor checks exited0; two contained GPU children exited0. No model download or environment install occurred.

```powershell
# Run from ai-service/quality02. A new valid3D slot is mandatory for the final command.
..\..\envs\qwen-vl\Scripts\python.exe -m unittest -v test_semantic
..\..\envs\qwen-vl\Scripts\python.exe processor_compare.py
..\..\envs\sith\Scripts\python.exe ..\..\fitmatch_AI\workers\windows\gpu_guard.py --owner pc-ai --label qwen-quality-detail-PC-AI-20261106-02 --cwd . --timeout 600 --log ..\..\reports\ai\quality02\detail-guard-child.log -- ..\..\envs\qwen-vl\Scripts\python.exe -u run_quality.py --detail
```

[Source snapshots/hashes](ai-quality02/source-manifest.json) describe the final detail runner and CPU validation policy;
the lowres probe used the earlier default-only runner before the detail flag and review policy were added.
The source changes for review policy were CPU-tested after GPU execution and do not rewrite the measured raw outputs.

Codex: review memory tradeoff and reconcile this session delta into central process. Claude/app owner: schemas/envelopes are local proposals,
not an agreed live transport capability. Next useful quality work is a wider authorized real-photo set and reviewed OCR strategy,
while keeping model unloaded and the4GiB gate. Image/wardrobe quality remains partial, source photos need user provenance.
No mesh/avatar/garment reconstruction, personal likeness, full-release or live-worker PASS is claimed.
