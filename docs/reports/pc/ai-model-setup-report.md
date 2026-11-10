# PC-AI-01 — Qwen model setup and smoke report

Session `PC-AI-20261105-01`, task `PC-AI-01`, H-PC-SPLIT-010, 05 November 2026 America/New_York.
Machine verified: Windows `MIN_KOI` / `Min_Koi`, RTX3060 12GB, driver610.88, physical RAM 17,013,657,600 bytes.
Docs baseline `47f521f83e024062ad0b041b878d0460932dc892` / PROC-0010;
independent checkout `fitmatch-pc-ai-01-docs`, branch `docs/pc-ai-01-20261105`.
Read root onboarding, full product requirements, execution plan, split ownership and sync/reassignment handoffs.
Central process and PR1 are untouched; this report is a proposed delta for Codex review.
Pre-publication sync read operations `a72686a72732d55198413f2d456033e9034a8811` / PROC-0012,
including the updated process/roadmap. App protocol/review progress there does not change Qwen ownership or make this a live worker integration.

## Outcome

Downloaded/hash verified: **8,887,291,213 bytes in 13 files**.
Separate runtime installed; dependency check passed; 9 CPU JSON contract tests passed.
CPU config/tokenizer/processor/header readiness: PASS; CUDA was not initialized by that check.
Guarded GPU smoke: **GPUSmokeSchemaPassed**. Child exit **0**, entire guarded process tree exited.
Schema and performance evidence are for three reference samples, not product quality acceptance or a latency SLA.

## Ownership, paths and initial receipt

The [receipt](pc-ai-01/receipt.json) was written before runtime/model setup.
Initial inspection found no existing Qwen env/model/cache or partial download in the assigned Fitmatch-GPU paths
or default Hugging Face hub. The 3D owner later confirmed it had started none.
All owned paths are relative to the existing Fitmatch-GPU workspace:

| Purpose | Path |
|---|---|
| Local helpers, schemas, fixtures | `ai-service/` |
| Isolated Python environment | `envs/qwen-vl/` |
| Exact model files and resumable partials | `models/qwen3-vl-4b/` |
| Dedicated uv/HF config cache | `ai-service/cache/` |
| Raw local reports | `reports/ai/` |

No SiTH/SMPL-X/GarmentCode environment, fitting, weight, mesh, renderer or app/server/worker transport file was modified.
Only metadata/schema proposals and redacted evidence go into this public docs checkout; weights and input images stay outside Git.

## Model, revision and integrity

Official source: [Qwen3-VL-4B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct).
Pinned revision `ebb281ec70b05090aa6165b016eac8ec08e71b17`. Model card/API declare **Apache-2.0**, ungated; no account or terms acceptance was performed.
That repository revision has no separate LICENSE file in its file listing; license evidence is the pinned card metadata, not an invented local license grant.
The card is preserved locally with SHA256 `a884e5e78f7d6f7bfe237f909dbc41a126542e259dc79d8ab33cc8980580ff79`.
Full [download manifest](pc-ai-01/model-manifest.json) lists exact sizes, SHA256 and upstream Git/LFS hashes for every file.
Small files match source Git blob IDs; both weight shards match source LFS SHA256:

| File | Bytes | SHA256 |
|---|---:|---|
| model-00001-of-00002.safetensors | 4,967,229,296 | `30a01a0556622645a3cce87b655bbbbbc1f170c196099f1b666c93202c3339a9` |
| model-00002-of-00002.safetensors | 3,908,490,048 | `046296a2a387efb43b0c997d5833c789604d168834f6e0d3064bf7bb13d002a6` |

Download plus streaming hash verification took **269.767s**;
8,887,291,213 model payload bytes were transferred in this run, excluding HTTPS/API overhead and runtime wheels.
Free disk before setup: 392,364,064,768 bytes; CPU-readiness snapshot: 376,658,165,760 bytes.
Downloader is resumable, serial and uses a dedicated artifact OS lock; that lock grants no GPU admission.
Header/index validation found **713 BF16 tensors**, complete index,
8,875,631,616 tensor-data bytes.
These are **original BF16 weights quantized on load**, not a downloaded or saved 4-bit checkpoint.

## Pinned runtime

Python3.10.22, torch2.9.0+cu128, torchvision0.24.0+cu128, transformers4.57.1,
accelerate1.11.0, bitsandbytes0.48.2, huggingface-hub0.36.0, Pillow12.0.0.
Full 34-package [lock](pc-ai-01/requirements.lock.txt) includes JSON validation and monitoring dependencies.
Torch/vision wheels came from the official PyTorch cu128 index; dependencies were resolved using that index and PyPI.
HTTPS dependencies selected too old by the PyTorch index were explicitly repinned from PyPI; final dependency check passed.
Version choices are a pinned compatible experiment, not a claim to be the latest releases.
Runtime references: [PyTorch versions](https://pytorch.org/get-started/previous-versions/),
[Qwen3-VL Transformers](https://huggingface.co/docs/transformers/model_doc/qwen3_vl),
[bitsandbytes0.48.2 Windows/CUDA support](https://huggingface.co/docs/bitsandbytes/v0.48.2/installation).

NF4 double quantization, FP16 compute, SDPA, batch1, local files only, `trust_remote_code:false`,
explicit CUDA0 placement, low-CPU-memory loader; **no CPU offload**.
Observed 4-bit modules: 356; device map: `{"": "cuda:0"}`.
The downloaded artifact remains BF16. No remote model Python code or network inference provider was used.

## CPU checks and typed JSON proposals

`-m unittest -v test_contract`: exit0, 9 tests, 0.010s; all fixture/negative assertions passed.
Rejects wrong garment slots, extra/invented dimensions/capabilities, unobserved-logo text, executable/unknown edit actions,
missing fields, duplicate keys, NaN, Markdown/trailing text and responses above16KiB.
These tests validate parsing/boundaries, not the truth of model observations.
[Garment schema](pc-ai-01/schemas/garment-attributes.schema.json) and [edit schema](pc-ai-01/schemas/edit-intent.schema.json)
are local proposals; Claude owns integration and must reconcile owner/version binding before any live use.
All edit intents carry `execution_allowed:false`, `engine_binding:null`, preview confirmation required.
No actual face/body/hair/skin/mesh edit, 3D generation or worker capability is implemented by Qwen setup.
The existing rules-v1 recommender remains available without this model.

CPU `cpu_readiness.py`: exit0, 23.59s; process peak working set 812,380,160 bytes,
RAM available before/after 5,453,639,680/4,783,394,816 bytes.
Text tokenization and a programmatic blank-image tensor check passed; that blank is not image inference or garment evidence.
The script used CUDA_VISIBLE_DEVICES=-1 and recorded `cuda_initialized:false`; no weights were loaded.
Warnings: PyTorch reported a missing Visual C++ redistributable registry marker although imports succeeded.
No redistributable/MSVC/UAC/system install was attempted. The GPU loader also emitted a deprecated torch_dtype warning;
the measured invocation is preserved unchanged.

## GPU receipt, slot, process guard and inputs

3D receipt `coordination/pc-3d-qwen-receipt.md` confirms no prior Qwen job/download.
Receipt SHA256 `f813f5671fbe6f5de9c67fef7e853ca87ec70f68c31a381661dbc45741c3083a`.
3D-issued slot: 2026-11-06T03:53:27.340738+00:00, ownerpc-ai, bounded1800s admission.
The **unmodified** 3D guard `fitmatch_AI/workers/windows/gpu_guard.py` acquired the fixed
`coordination/gpu0.lock` OS byte lock and held it through entire child-tree exit.
AI independently checked ancestry, active state/label, current slot, receipt/input hashes and that shared OS lock was held
before importing torch. Direct unguarded invocation correctly refused before GPU load (expected child exit1).
3D's four CPU process guard tests were read, not rerun by AI; they cover exclusivity, release, owned-child/grandchild cleanup and receipt recovery.
See [guard exit](pc-ai-01/shared-guard-exit.json) for actual AI launch PIDs/job/exit receipt; paths are redacted in the public copy.

Public references (not personal garments):

* Tshirt: [White tshirt.png](https://commons.wikimedia.org/wiki/File:White_tshirt.png), Сергей Шахвердов,
  [CC BY4.0](https://creativecommons.org/licenses/by/4.0/). It is a small171×155 **illustration** with blue stripes and multiple logos, not a garment photograph.
* Jeans: [Jeans.jpg](https://commons.wikimedia.org/wiki/File:Jeans.jpg), Oktaeder (uploaded by Juanmak), author public-domain dedication,435×650 photograph.

[Provenance/hash manifest](pc-ai-01/public-image-provenance.json) records authors, source/license URLs, original file hashes and preprocessing.
Original files were retained unchanged locally; inference composites alpha over white and bounds dimensions to512px.
No project-owner photo, paid API, public port or resident server was used.

## Three-sample GPU results

At most384 generated tokens, deterministic decoding, 16KiB response cap and one schema retry.
The retry repeats the task with a correction instruction; there is no unbounded repair loop or automatic execution.
Local inference can produce incorrect facts despite valid JSON; quality findings are recorded below separately.

| Sample | Attempts | Final schema valid | Final attempt seconds | Input/output tokens |
|---|---:|---|---:|---|
| tshirt | 1 | True | 16.803 | 534 / 160 |
| jeans | 1 | True | 19.433 | 638 / 179 |
| text-edit | 1 | True | 7.415 | 334 / 95 |

Load: **51.795s**. Whole smoke wall time: **103.245s**.
Torch peak allocated/reserved: **4,437,815,808 / 4,601,151,488 bytes**.
Sampled whole-device peak: **5284MiB** (includes desktop/context/other device use; not solely model allocation).
Process peak working set: **4,209,344,512 bytes**.
Sampled host minimum available RAM: **161,599,488 bytes**.
Metrics sample count: 169. No fit/throughput/quality extrapolation beyond this bounded run.
Actual outputs, token counts, each retry, errors and metrics are in [GPU result](pc-ai-01/gpu-smoke.json) and redacted child log.

Model references were deleted and CUDA cache cleared; allocated/reserved after cleanup:
9569280 / 4443865088 bytes.
Process exit is the authoritative unload boundary: guard confirms allJobProcessesExited=true, exit0.
The OS lock released only after that boundary. Slot ownership is admission metadata, not a resident model.

## Reproduction and exit status

Commands ran from local `ai-service/`, with exact pinned environment paths represented relative to the workspace:

```powershell
..\envs\qwen-vl\Scripts\python.exe model_setup.py --download
..\envs\qwen-vl\Scripts\python.exe -m unittest -v test_contract
..\envs\qwen-vl\Scripts\python.exe cpu_readiness.py
..\envs\bootstrap\Scripts\uv.exe --cache-dir cache/uv pip check --python ../envs/qwen-vl/Scripts/python.exe
..\envs\sith\Scripts\python.exe ..\fitmatch_AI\workers\windows\gpu_guard.py --owner pc-ai --label qwen-smoke-PC-AI-20261105-01 --cwd . --timeout 900 --log ..\reports\ai\qwen-guard-child.log -- ..\envs\qwen-vl\Scripts\python.exe -u gpu_smoke.py
```

Download/CPU/schema/dependency commands exited0. Guarded GPU child exited0.
The guard's CreateProcess resolves child argv from the calling working directory, which was ai-service.
GPU re-runs require a **new valid 3D-issued slot**, the shared guard and input provenance; these commands do not extend admission.
Initial sandbox DNS/uv-cache access failures were retried through approved tool escalation.
Image downloader first completed its files but failed printing the Cyrillic credit to cp1252; stdout was fixed and the cached-file rerun exited0.
No artifact was deleted or downloaded twice for that repair.

## Limits and next owner

This is readiness plus a three-sample smoke, not full-release/G0/G1, personal garment quality or engine-edit acceptance.
No benchmark repeats/p95, large-context/multiimage/video, CPU-offload, service, API transport, owner isolation, scheduler integration or real-user-photo accuracy has been verified.
Manual grounding review against the two inspected references: tshirt blue/white stripes, visible logos and top slot are correct,
but the assertion that no collar/sleeve details are visible is false; round neck and short sleeves are visible.
Jeans category/blue/bottom are correct, but five-pocket construction cannot be confirmed from this front view,
and material composition is not proven by its appearance. The text request correctly mapped to face_width/decrease,
with execution disabled. These errors are retained in the raw JSON, not silently corrected. **Image grounding quality: NEEDS CHANGES.**
16GB host RAM is tight: host available RAM reached only161,599,488 bytes (154.1MiB).
Do not run another model load alongside memory-heavy 3D CPU work; VRAM fit in this run is not safe production host acceptance.
Keep model unloaded between admitted runs. Claude reviews schemas/outputs before any capability/API binding;
Codex reviews this evidence and reconciles the proposed process delta. 3D retains GPU coordination and all 3D/toolchain ownership.
User likeness/garment approval, real wardrobe samples and unsupported edit parameters remain outside this smoke.
Post-exit nvidia-smi measured758MiB. AI wrote `coordination/pc-ai-qwen-release.json` so 3D can reclaim admission;
AI did not mutate the 3D-owned slot or shared lock files. The prior GPU process is fully gone.
