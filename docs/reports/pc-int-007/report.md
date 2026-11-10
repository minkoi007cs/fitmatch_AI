# PC-INT-007 continuation report

Session `PC-20261106-INT007`, Windows PC/GPU engineer, task `PC-INT-007`, handoff `H-AUDIT-016`. Status: **Ready for review** for this audit/proposal scope. Product avatar/clothing pipeline: **NOT VERIFIED**. No animation or live capability enabled.

## Baselines and preserved work

Operations actually read: `d3f29a51f8615f4831aa173791896a6fba0eca6e` / PROC0016, containing requested `f75290da00e2006e67ef4139afdcafac5daa655d`. Root rules, roadmap/process, github-sync, post-audit handoff and project audit were read. Snapshot contracts remain revisioned references. Separate local operations branch `docs/pc-int-007-local`; central process was not overwritten. Prior owned docs branch/PR4 remain intact.

PC code baseline `f3bebd19501c515ae4cfd5c392ccaaa01ff1c65f`, implementation `998b048e10b3958ac0fd84cca7836e18840d17f9`, branch `codex/pc-int-007`. Tree was clean at claim. Changes here are the PC-owned audit scripts, local journal and this report folder. Read-only app clone remains clean at `7be869c989bc8c2b13d8b9ce621c9f70d487e57c`; worker Git blob `41ee24291c1129626c9461397d14d5c2ee993768`. No app/transport source changed. No Next.js code edited.

SiTH004 stays paused; checkpoint SHA256 `52d0f666ed0284aad1c2eb809e7d534349d4b52729de4244d486093855648a2b`. SMPL-X six files/version1.0, model junction, weights, Windows patches, valid003 fitting and005/006 artifacts were retained. No download, fitting, full cloth simulation or GPU inference was rerun. All new experiments below are CPU-only.

## Native Windows findings for Claude

The sanitized proposal `windows-launcher-test-7be.patch` is published in draft PR6. It targets app base7be and test Git blob `4ddfebeea02a28d529dd1bf75676fc50cfa2b999`; canonical source SHA256 `755f8c9d5b9504ae5ba2673bea50cb1ec6224d177a97cb92a846986bbc13f7e2`. Patch SHA256 `aa8c8b04616253963083fbd3962803bf5c9da81aed0d103b8a51f76c3a71944a`. This only selects the base interpreter for a standard-library lock fixture on Windows. Existing measured evidence: unchanged suite17PASS/1ERROR; disposable proposed copy18/18PASS in0.197s; native actual-interpreter containment/lock probes4/4PASS. `git apply --check` passed against the untouched pinned clone. These are retained006 measurements, not new runs or proof of a production fix.

**New, separate admission/retention gap:** a native CPU fault injection calls actual7be containment, FileLock and `stop_process` methods with a dummy venv adapter. After killing its owned launcher, `stop_process` returns while the actual interpreter remains alive; another process can acquire the isolated test lock. The contained worker's eventual exit closes its Job Object and removes all owned interpreter/grandchild descendants, verified by PID plus creation identity. No real worker API, GPU job, source cleanup or foreign process was used. This method-level repro does not prove actual concurrent GPU overlap, but prevents acceptance of launcher-poll as per-job quiescence. `quiescence-finding.json` carries sanitized evidence. The test-only patch above does **not** repair this production gap. Claude owns any transport fix; PC supplies evidence/proposal only.

## What the actual pipeline consumes

See machine-readable `capability-input-license.json`: ten stages and seventeen component/license observations. Actual fitting can use existing prebuilt Kaolin CUDA without MSVC; the completed demo fit is reusable. New fitting needs aligned RGBA/mask and COCO25 body/hand/face keypoints, not plain JPEG alone. `centralize_rgba.py` centralizes an existing alpha mask; it does not extract one. Local `fit.py` hardcodes male SMPL-X and normalized coordinates; personal height/pose calibration remains unverified.

Back hallucination and clothed human reconstruction instantiate nvdiffrast CUDA rasterizers in dataset imports and import the unbuilt tinyobjloader binding. These remain compiler-dependent. Prior load-only skipped the dataset and proves neither denoising nor12GB inference feasibility. UV parameterization can use xatlas, but SiTH's texture bake also uses CUDA rasterization; xatlas installation alone does not finish this stage.

The actual engine consumes no video or separate face-photo fusion. SMPL-X face keypoint/expression loss is not photographic identity fusion or an editor. A fitted body can become a separate estimated collider after calibration; a clothed reconstructed human is not a clean body with independently replaceable clothes. The mean_all reference used in006 is not the user's body or the003 fitted person.

GarmentCode/our template scripts make fixed patterns and synthetic texture fixtures. They do not recover arbitrary real garment structure from front/back photos. Native Warp-GarmentCode remains unbuilt. No reconstruction/drape adapter has passed a real-input self-test. All five advertised capability entries remain false and `engines` is empty. The adapter only validates a disabled legacy/explicitv1-r2 three-normalized-JPEG subset; validated height/measurements are not currently consumed by inference. No second transport was added.

Root MIT licenses do not establish rights to nested fitting/OpenPose-derived code, body models, checkpoints or data. The matrix separates observed local license documents from unresolved scope. Diffusion model-card metadata declares CC-BY-NC-4.0; the Warp fork has a noncommercial research/evaluation clause; checkpoint-specific and reference-body asset clearance is incomplete. This is an evidence index, not commercial/redistribution approval or a complete SBOM. No account terms were newly accepted. Current private artifact handling remains unchanged.

## Seam diagnosis and bounded local experiment

The comparison uses the same21,577 canonical panel edges for005 and006, with checked source-to-welded triangle mapping. Exactly1,970 changed edges are seam-adjacent;19,607 interior edges are unchanged. Global p95 absolute strain rises5.754% to5.936%; max46.451% to72.491%. Region labels are approximate template labels:

| Region | p95 strain005 →006 | Edges above20%005 →006 |
|---|---:|---:|
| Armhole | 13.275% →31.797% | 3 →33 |
| Collar | 7.440% →7.605% | 0 →0 |
| Hem | 2.783% →2.837% | 0 →0 |
| Sleeve | 4.998% →5.100% | 7 →14 |
| Torso | 6.005% →6.167% | 40 →42 |

Canonical targets on corresponding physical edges differ by at most0.686%, with none above10%. This supports seam placement as the main introduced problem rather than a large mismatch in sewn rest lengths. The approximate synthetic-logo rectangle has173 changed edges; its aggregate p95/max are unchanged. This does not establish real logo fidelity or unchanged pixels on a newly rendered candidate. Existing006 front/back/side previews remain the visual evidence; no new candidate render was produced.

A single bounded seam-only least-squares experiment moves322 shared seam vertices and freezes6,851 interior vertices exactly. No global scale, pattern targets or garment size changed. Coordinate bound±3mm permits an actual maximum vector move4.272mm. Max strain improves72.491%→51.701%; p955.936%→5.890%; edges above20%89→66. Solver hit60 evaluations without convergence. Zero triangle orientation flips and zero vertices inside body beyond1mm; independent Blender BVH controls pass, with zero tee/body, pants/body, tee/pants and nonadjacent self triangle pairs. BVH is floating-point static geometry evidence, not calibrated cloth acceptance.

The private candidate OBJ is **nonconverged/review-only**, not promoted to006, not exported as a new web asset and not a material/size PASS. Interior strain remains deliberately untouched. These findings justify targeted seam/collision solver work, not blind rescaling or another full template iteration.

## New measurements versus retained history

| New CPU task | Actual wall time | Peak process-tree RSS | Result |
|---|---:|---:|---|
| Initial005/006 comparison | 1.120s launcher /0.333s internal | 44,179,456 bytes | exit0, region metrics saved |
| Same comparison after explicit triangle-map validation | 0.318s internal; launcher resource sampling not repeated | Not measured | exit0, same geometry metrics |
| Bounded local candidate | 6.100s launcher /5.419s internal | 111,042,560 bytes | exit0, solver nonconverged |
| Candidate Blender BVH | 0.250s internal | Not measured | controls pass, reported pairs0 |
| Bounded inventory | 0.061s internal | Not measured | 244 files,0 eligible/deleted |
| Inventory CPU fixtures | 0.019s initially; final check0.018s,8 tests | Not measured | PASS |

Comparison/candidate sampled whole-device usage763/769MiB includes desktop/other processes; it is not process VRAM and these tasks use CPU. Sample interval0.5s, no observed OOM. No new avatar/create-garment/full-drape/export timing is claimed. Device remains RTX3060/12,288MiB driver610.88, i7-12700F/16GiB from prior verified inventory. Existing SiTH Python3.10.22/torch2.1.0+cu121; GarmentCode Python3.12; Blender4.5.3LTS. Compiler-path read still absent; nvdiffrast package presence is not a working JIT test. No compiler build/install retry under the owner pause. `TOOLCHAIN-STATUS.md` is an older snapshot whose sentence saying SMPL-X is absent is superseded by the verified model transfer/003 fitting; its compiler resume commands remain historical preparation, not executed success.

Historical measurements retained separately:003 demo fitting200iterations53.607s, peak3.07GiB VRAM; load-only26.938s;005 CPU tee sewing149.297s;006 weld0.534s and8-view export/render61.537s launcher. None is a personal avatar or real garment benchmark.

## Retention and artifacts

The dry-run inventory protects all244 files/45,243,011 bytes, plus a separately identified own historical test temp directory with two files. Zero deletion and no whole-machine search. See `retention-proposal.md` for owner/job/source-version binding, server tombstone alignment, whole-tree quiescence, explicit per-copy allowlists, protected derived artifacts and retryable receipts. Physical cleanup remains NOT VERIFIED; source deletion is not inferred from cancellation or duplicate hashes.

Reuse existing private006 GLB/preview pack:2,142,956 bytes across3GLBs, embedded textures/buffers, one separate body/top/bottom, Khronos0errors/0warnings each, same metres/Y-up/Z-front/pose. Reference body is untextured; tee/Pants are templates with own synthetic images. ZIP4,581,033 bytes SHA256 `a9211bbee97d5b25fc8091a1550a664a0be94b0b508bbe589bc253aea108951d`. Private PC path/hash index is available locally; no transfer to Mac or public download access is presumed. PriorPR4 remains draft. This task publishes sanitized report/patch metadata only through PR6.

## Blockers and next owners

- **Owner/Admin:** MSVC/UAC pause retained. When explicitly resumed at the PC, run the existing `workers/windows/install-msvc-admin.ps1` in an Administrator PowerShell; it requests no restart/driver change. Then PC can validate nvdiffrast/tinyobjloader/nativeWarp builds and continue SiTH004. No UAC was triggered here.
- **Owner inputs:** personal video/photos/height and real tee/jeans front/back plus garment dimensions remain `needs_input`. Do not substitute template/reference output as personal success.
- **Claude:** review the exact7be unit patch, address per-job quiescence/admission and retryable owner-scoped retention in the existing transport; verify a new explicit source revision before PC conformance. App privacy/URL fixes remain separate ownership.
- **PC after review:** target seam constraint behavior and canonical-size/material QA; only promote a candidate after convergence/geometry/material/visual acceptance. Continue actual SiTH once compiler permission is resumed; no weights redownload or fitting repeat without reason.
- **Codex/owner:** review report/matrix/evidence/private006 previews and artifacts. No product gate is self-approved.
