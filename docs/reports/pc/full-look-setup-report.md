# PC-3D-02 — renderer, fixed full-look fixture and disabled adapter R2

Session **PC-20261105-FULLLOOK-04**, continued2026-11-06 America/New_York. Tasks PC-SETUP-02, PC-3D-02, independent DISC-DENIM-01/APP-RENDER-01 spike and disabled adapter conformance. **Ready for review for renderer/technical artifacts only. Personal product and live engine gates NOT VERIFIED.**

## Receipt and preserved baseline

Initial H-EXEC-009 full root/spec/handoff read at operations598666fa2b45de315c16cbf43807550db6e9c48b (PROC-0009); H-PC-SPLIT-010 read47f521f83e024062ad0b041b878d0460932dc892 (PROC-0010). Clean operations checkout subsequently ff-only pulled **a72686a72732d55198413f2d456033e9034a8811 / PROC-0012**; root rules unchanged, roadmap/process deltas and QA-PACK-01 usage/review read. Historical snapshot is not live acceptance.

PC source started clean **7314cba0329104a20128d1d7e8018e2109e448fd**, changed from codex/pc-gpu-pipeline to owned task branch **codex/pc-full-look-setup**. Code commits: **df39979** portable renderer/shared guard; **c1ceff0** fixed templates/CPU sewing/export/render/QA; **820e34ceb3d705950b159747d715d3c5fe95a63f** disabled versioned adapter and native Windows probes. Source stays local. Only this report and sanitized delta/evidence are proposed for public documentation. No central process or Claude transport/server/UI/SQL changed.

SiTH004 checkpoint remains paused-by-user, SHA256 **52d0f666ed0284aad1c2eb809e7d534349d4b52729de4244d486093855648a2b**. Preserve existing SMPL-X/models/junction, Windows patches/envs, fitting003 and all prior reports. No model redownload, fitting rerun, UAC/installer, driver change, restart, cloud/API spend or live worker startup. New template outputs are separate from SiTH004; they do not complete its textured-human stage.

Owner explicitly has no personal capture or real tee/jeans photos yet. Those checks are **needs_input**, not failed reconstruction or fulfilled personal-avatar requirements. No personal images were sought elsewhere. Qwen belongs to the separate PC-AI chat; this chat started no Qwen env/download/partial/model and did not change its files.

## Actual environment delta and readiness

RTX3060 **12288MiB**, driver **610.88** unchanged; i7-12700F/16GiB RAM. Existing SiTH Python3.10.22/torch2.1.0+cu121, GarmentCode Python3.12 environment and local CUDA12.1.1 preserved. No newly measured SiTH inference throughput. Earlier fitting53.607s/model-load-only26.938s are historical and are not timings for this run.

| Component | Actual status |
| --- | --- |
| Blender4.5.3LTS portable | Installed in user workspace; real OptiX RTX3060 and CPU renders passed |
| MSVC/Windows SDK | Expected vcvars still absent; no compiler on PATH, owner Admin/UAC pause remains |
| nvdiffrast0.3.3 | Existing package; previous actual CUDA compile failed missing MSVC, not retried during pause |
| GarmentCode native Warp fork | Preserved source/env, previous build failed missing MSVC; not built by this work |
| SiTH reconstruction | Blocked at compiler-dependent rasterizer; no new back image/textured reconstruction |
| Independent cloth | Experimental CPU PBD and Blender built-in CPU sewing actually ran; this is not native Warp success |
| Engine capabilities | Empty/disabled; templates and model loads do not enable reconstruct/drape |

Official archive [Blender4.5.3 Windows ZIP](https://download.blender.org/release/Blender4.5/blender-4.5.3-windows-x64.zip):400100678bytes; publisher SHA256 **6b657c8bdd3a7b65b07b9e1ae17eb4be7dd4aa23121da7f3d3354fc2551330a7** matched. Download/extract35.289s, no system installer. GPL2-or-later licensing notice/components read locally; binary not part of public PR. No extra checkpoints downloaded.

## Shared GPU coordination — actual process evidence

Fixed machine-wide byte0 OS lock: `<workspace>/coordination/gpu0.lock`, shared across both chats/workDirs. Stdlib guard launches child suspended, assigns named Windows kill-on-close Job Object, then resumes; keeps OS lock until all job descendants exit. Surviving-child/receipt checks fail closed, no takeover by timestamp. Four actual CPU process checks passed: concurrent admission refusal75/no contender child, release/reacquisition, own guard crash kills child+grandchild, safe receipt recovery. No foreign process killed.

Qwen receipt `<workspace>/coordination/pc-3d-qwen-receipt.md` and bounded AI slots were published and sent to the existing AI chat under the owner's coordination instruction. AI acquired the same guard; 3D read its exit0/allJobProcessesExited receipt before switching admission for one OptiX scene, then released/re-granted AI slot. CPU meshing/sewing can proceed independently. Slot expiry changes admission only; never preempts a held job. Check current slot/OS acquisition at runtime, not a report timestamp. This setup guard is not live scheduler acceptance.

## Output actually produced

Private local folder **`<workspace>/outputs/pc-template-full-look-005/`** contains requested version1 manifest, three GLBs, benchmark.json, quality-notes.md,8static camera PNGs and labelled contact sheet. Additional full-look-manifest.json follows the reviewed v1-r2 asset-set shape; evidence-manifest.json follows fitmatch.evidence.v1. These are fixtures/proposals, not live capability declarations.

| File | Bytes | SHA256 | Content |
| --- | ---: | --- | --- |
| avatar.glb |856176|02e4b658d6ff1569cd9634bd75cabdcc8568b2264bd3fb015c0864fad6e66821|GarmentCode mean_all reference body, untextured,47500triangles; not personal avatar |
| tee.glb |347480|fc81b95fa1f2fd0b44496446e53c5129fff6e333e7f7ddb56fccad71940ed59b|Fixed tee template,14082triangles,2embedded synthetic images; garment only |
| jeans.glb |941960|a1ce4b9ec13896092966daf64af8023cbaa96ad9894234b5745a9cf8292df157|Fixed Pants template,29038triangles,2embedded denim-style images; not reconstructed jeans |

Total GLB **2145616bytes**, each below40000000/set below120000000. GLB2 static triangles, embedded buffers/PNG textures, no Draco/KTX2/skins/animation/external resource. One mesh per file; source/export face counts match, no repeated body in clothes. Blender export/reimport plus independent Trimesh world-coordinate reload passed; maximum bounds deviation **5.44e-8m**. Khronos validator2.0.0-dev.3.10: **0errors/0warnings for all3**. Texture decoder/UV/material linkage gate passed for clothes; reference body deliberately has no texture.

Shared metres,+Y-up,+Z-front; body already metres, original garment cm converted.01 once. Shared rigid axis conversion only, no per-asset normalization. Body floorY=0,height1.719901m is a reference body's known source scale, not a measured person. Tee sewing initial placement+.08mY is rigid, not resizing. Pants canonical design length.9,width1,flare1,rise1 with no cuff/waistband is fixed for this experiment; original tee mesh reused. No second-body size/fit claim.

Provenance: GarmentCode **d449629979028123a5c4dc9e732a2ec19b7fce31**, MIT notice retained locally. Its bodies/Readme attributes non-SMPL-named mean_all to [GarmentMeasurements](https://github.com/mbotsch/GarmentMeasurements), whose code license is GPL3; no claim that repository MIT automatically covers every underlying body/model/dataset. This fixture stays local for research with attribution; no body/model assets are published in docs. Front/back colour/letter and denim seam/pocket images were created by our procedural fixture script, no external/personal photo. Drawn pockets are not geometric pocket reconstruction.

## Measurements from this session

All launcher metrics sampled. RAM=process tree RSS, VRAM=whole GPU including desktop/other owner; not exact per-process allocator peak. CPU drape stages allocate no GPU model. In particular pants5285MiB coincided with AI smoke and is **not cloth VRAM**.

| Stage | Internal stage seconds | Whole launcher seconds | Peak tree RSS bytes | Sampled device MiB |
| --- | ---: | ---: | ---: | ---: |
| Tiny OptiX cube |2.987 render|16.577|621142016|1569|
| Pants pattern+mesh |.363+1.496|7.268|155963392|808|
| Tee CPU PBD attempt1 |47.643 simulation|48.858|84242432|755|
| Tee CPU PBD attempt2 |64.449 simulation|65.552|88637440|755|
| Tee CPU PBD attempt3 |75.604 simulation|76.607|90677248|777|
| Pants CPU PBD |84.767 simulation|86.736|98844672|5285 (AI overlap)|
| Full-look003 OptiX export/render |.461 export/reload;24.634 script|25.547|931835904|1576|
| Tee Blender CPU sewing100frames |149.297 simulation|150.449|309657600|777 (desktop)|
| Final005 CPU export/render8views |.432 export/reload;58.141 script|58.734|633360384|771 (desktop)|

Failed runs remain preserved: full-look001 image-path failure; full-look002 tee slipped;003 tee-body/self intersections;004 UV metre/cm bug made tee texture wrong;005 fixes UV scaling without rerunning physics. No OOM observed in these runs; this does not predict SiTH denoising/reconstruction memory.

## Quality findings and why this is still a technical fixture

PBD tee002 passed a sampled distance precheck but slipped down the chest in actual render. Tee003 rigid placement/support helped silhouette but BVH found98tee-body pairs,416tee-pants pairs and790non-adjacent tee self pairs; it is rejected. This shows sampled distances/exit0 alone are inadequate.

Final tee uses original unsewn pattern panels and330loose-edge sewing constraints in Blender CPU cloth, with self/body/static-pants collision, no pinned collar. Pants retain88explicit artificial waist-height supports from the CPU baseline. No dimensions/rest panel triangles were recalculated to fit a new body. Actual final front/side/back/8views inspected: teal/red-white F front and B back visible, basic shirt/pants silhouette; shoulder seams/hem rough, shirt short, generic white body, no face/hair fidelity.

CPU BVH positive/negative controls passed. Final **0tee-body,0pants-body,0tee-pants** triangle pairs; self overlap excluding genuine seam adjacency0tee/0pants.212raw tee pairs share canonical sewn vertex identity and are separately counted, not arbitrary regions ignored. This float-precision check excludes adjacent pairs and does not prove every seam/fold is clean.

Seam gap p95 **4.322mm**, max **22.095mm**,11/330seams over5mm. Absolute panel-edge strain p95 **5.754%**, max **46.451%**,50/21577edges over20%. Thus quality **needs changes** despite improved collision results; no calibrated denim physics, watertight stitched garment or real-logo preservation claim. Technical evidence preflight actually exited0/PASS with6artifacts, humanReview pending, **productGate NOT_VERIFIED**. Not first release, clean personal body, likeness/editor or wardrobe end-to-end acceptance.

## Exact reviewed producer → PC boundary and native Windows checks

Pinned reviewed app source **48f66f97c1157b561436af0d4baa3b59fe78b430**, worker blob **41ee24291c1129626c9461397d14d5c2ee993768**. Read v1-r2 contract/schemas/measurement rules and actual producer. Read-only worker copy retained outside PC source; no transport implementation installed or edited.

Offline test calls actual Worker.run_lease_bound, using only a local synthetic-JPEG download stub/no API, then executes real PC adapter CLI and actual structured-exit classification. Before fix: expected MODEL_UNAVAILABLE became INVALID_INPUT; inspector also rejected (2failing/8passing cases). After explicit versioned subset: **10/10PASS** on SiTH Python3.10.22, plus **8existing adapter regressions PASS**. Normal remains exit78/MODEL_UNAVAILABLE/no artifact; inspect0 never advertises readiness. Unknown revision/top/asset fields, roles/order/frame mismatch, Boolean measurement, video and bottom kind reject.

Accepts only the disabled **three-normalized-JPEG avatar subset**: explicit protocolRevision=v1-r2, params.heightCm+ordered roles front/side/back, optional strictly bounded measurements, image/jpeg asset metadata, content=avatar and sharedFrame declaration. Legacy snapshot ten-field inputs retained. Measurements are validated but not consumed; no video/frame/face fusion, edit, top/bottom engine or full v1-r2 ACK. Paths/IDs/credentials stay strict. Metadata acceptance cannot promise calibrated output. TIMEOUT is recognized as a reviewed parent contract code, but no timeout/OOM/export engine exit was newly implemented or tested.

Against the same pinned source, **4CPU Windows probes PASS**: injected binder refusal raises ContainmentError; real native bind+worker FileLock excludes a raw msvcrt byte0 contender in isolated fixture; killing only the test-created worker kills its own child+grandchild; lock reacquisition closes descriptor. No live API/lease/GPU stress tested. This supplements the4setup-guard process checks, not replaces live integration.

Before live: configure worker gpuLock to the **same coordination/gpu0.lock**. Its default ProgramData lock would differ; FileLock alone does not enforce setup admission slots. Keep live workers stopped during setup slots, do not wrap a worker that takes the same byte lock inside the setup guard (self-deadlock). Pin both owners' source revisions and agree unsupported video/bottom/source-retention behavior. Source tombstone/private job-folder cleanup remains open. No second transport or service-role key is introduced.

## Reproduce and next owner steps

Scripts under workers/windows: setup_blender_portable.py, gpu_guard.py, garmentcode_pants.py, prepare_blender_sewing.py, blender_sewing_drape.py, blender_template_scene.py, blender_collision_qa.py, validate_template_set.py, package_template_fixture.py and make_fixture_evidence.py. Actual operator argv, settings, errors and resource series are in private reports/*benchmark.json+logs and per-run JSON. Use fresh outputs; existing inputs/fits must not be overwritten. Bundle/patch receipt is recorded locally after creation; path in this report does not mean another machine received source/artifact bytes.

For MSVC when the owner returns: open PowerShell **Run as administrator**, accept Windows UAC, then run `<workspace>/fitmatch_AI/workers/windows/install-msvc-admin.ps1`. It selects MSVC14.38/SDK22621, --norestart and no driver. Agent does not start/elevate it. After owner confirms: toolchain verify→CUDA rasterizer smoke→native Warp build and template comparison→continue SiTH004 without refitting valid body.

Meanwhile Codex reviews actual fixture/previews/seam metrics and limited adapter ACK; Claude owns live transport/config/schema/UI and can use labelled fixture shape, not enable a real engine. Personal capture/height/real tee+jeans photos remain needs_input until owner supplies them. Keep all checkpoints/models/envs and the first failing samples for comparison. No animation or product completion claim.
