# PC-CPU-FACE-31 — CPU appearance feasibility, quality not accepted

Session PC-20261109-CPU-FACE31; role PC3D; task H-PC-31. Receipt documentation revision **5a69df39cb1060e1db5395f043d64d5ce35fcb48 / PROC0031**, containing b1313e9. PC baseline **7e7c61e29d7da96b48cd582e10e696cae084ca07**, clean; owned branch `codex/pc-cpu-face-31`. Implementation **84d59045f5c0a5b082daca1e84d3c09993f4d669**. SAVE30 checkpoint, source bundle and PR10 publication53e649f were finalized first and preserved. This report is a delta, not a replacement for central process or previous PC history.

## Result and limits

A new **private** static 3D debug GLB embeds an actual masked photograph-derived face appearance atlas. Source mesh, saved orthographic camera, camera-scale removal/floor translation and existing xatlas correspondence were reused. No new fit, unwrap, inference, model download or GPU render ran. UV seam duplication changes10475 vertices to14291;20908 triangle positions are **bit-identical after GLB float32 roundtrip** to the existing debug GLB. Units remain nominal model metres, +Y up/+Z front, with no personal height calibration.

Format/projection feasibility is ready for review. **Visual face quality FAIL / identityAccepted=false.** Actual CPU front/side/back/head previews show eyes and lips displaced on the generic estimated head. Saved camera/shape alignment is inadequate for likeness. No image warp, geometry correction, photo plane or generative completion hides that failure. Hair and unobserved head/body regions remain neutral; body shape remains an inferred prior. No avatar/garment capability, animation or product quality gate is enabled.

Private camera correspondence is sufficient for deterministic projection, not correct semantic alignment. The existing fit's debug overlay uses `pixel=(x+1,1-y)*size/2`; this same mapping was implemented directly in NumPy. The private annotation binds exact prepared image, mesh, saved UV, reference GLB and transform metadata by SHA. A conservative manually reviewed face polygon excludes hair, clothing, earrings and background. No neck/clothing texture is requested. A separate head-only vertex mask comes from the existing licensed model's head/jaw/eye skinning weights (sum>=0.8), with original topology equality checked; all vertices of each textured triangle must qualify. This is CPU array reading, not model inference.

Bilinear source sampling requires all four source pixels inside the eroded mask and opaque foreground. Every accepted atlas ray must hit the nearest actual mesh surface, and candidate normals face the saved camera. Other texels remain exactly neutral. The embedded sampler uses nearest filtering, clamp and no mipmaps to avoid colour spread outside accepted atlas texels. This is a partial appearance debug asset, not a production skin atlas or multiview reconstruction.

## New measurements on this PC

| Stage | Actual result |
|---|---|
| CPU bake, final private attempt002 |4.861473s|
| Export plus built-in validation |0.740130s|
| Combined measured bake/export stage |5.601603s; peak process working set785084416bytes|
| Blender4.5.3 LTS Cycles, CPU,2threads/16samples,480x640 |4views;10.018686s stage wall; peak working set357277696bytes|
| Independent reproducible audit |0.856514s;128 all-triangle rays, max depth discrepancy5.83e-16|
| Official Khronos validator2.0.0-dev.3.10 |0errors/0warnings/0infos|
| Focused CPU visibility regressions |3PASS; no skips|
| Final GLB |989312bytes;1mesh/1embedded image/1texture; static, no external resource/compression|

Timings are single measured samples, not latency promises or cold-start totals. Python imports/startup are outside the baker's internal timer. Peak memory is Windows process lifetime peak working set, not whole-machine RAM; stages ran sequentially. VRAM was **not measured** in these CPU-only runs and is not reported as zero. No OOM occurred. Environment: Python3.10.22, NumPy1.24.1, trimesh4.6.13, Pillow12.3.0. Prior GPU fitting timings and prior native56/18results are historical evidence only and were not rerun here.

Attempt001 was retained privately: integer source-pixel ownership left avoidable holes on subpixel face triangles. Attempt002 replaces that approximation with exact orthographic ray/triangle tests and adds the explicit head vertex mask. The final source adds empty-bin safety, covered by CPU tests, after asset002; no equivalent model/fit run was repeated. Both attempts still fail likeness.

## Checks and evidence

- 241717 accepted atlas texels/4015 triangles; all selected triangles head-only. Independent audit recomputes UV-to-camera mapping: maximum error3.07e-5pixel; UV roundtrip error2.98e-8.
- Embedded image bytes decode to the exact private atlas pixels; the four-pixel source footprint is inside the intended mask. Recomputed source RGB differs by at most1integer level from float32 correspondence rounding. No colour correction or invented hidden texture.
- All texels outside the accepted atlas mask are exactly neutral: leakage count0. This is a deterministic mask/atlas check, not a claim that the manual mask or semantic alignment is ground truth. Independent128ray subset tests every source triangle, without the baker's spatial bins; all are nearest surfaces.
- Reference geometry correspondence has maximum position delta0. No source vertex/triangle/frame/pose change. No duplicate body file is described as a separate garment. No production `avatar` entry is published.
- Protected source photograph, saved mesh/GLB, checkpoint004, existing real policy/lock/slot/state and guard hashes/file identities were checked unchanged. Weights and fitting were not executed or edited. Private asset manifest includes hashes/paths; public metadata intentionally excludes them.
- New owned code: `bake_visible_face_cpu.py`, `render_visible_face_cpu.py`, `validate_visible_face_cpu.py`, `test_visible_face_cpu.py` under `workers/windows/`. Existing `glb_assets.py` is reused. Public review snapshots and hashes accompany this report; private annotation/head mask/source assets do not.

Reproduction uses the existing separate CPU-capable SiTH environment; do not combine engine requirements. Commands accept explicit private paths, omitted here intentionally:

```text
python bake_visible_face_cpu.py --photo <saved-prepared-image> --mesh <saved-fit-obj> --uv <saved-uv-npz> --head-vertices <private-head-bool-npy> --reference-glb <existing-debug-glb> --mesh-qc <existing-transform-json> --annotations <private-input-bound-mask-json> --output <new-private-folder>
node validate-glb.cjs <new-glb> <private-validator-report> <existing-gltf-validator-directory>
blender --background --factory-startup --python render_visible_face_cpu.py -- --mesh <new-glb> --output <new-private-preview-folder>
python validate_visible_face_cpu.py --asset <private-output-folder> --photo <saved-prepared-image> --mesh <saved-fit-obj> --uv <saved-uv-npz> --head-vertices <private-head-bool-npy> --output <new-private-audit-json>
python -m unittest discover -s workers/windows -p test_visible_face_cpu.py -v
```

Blender explicitly uses CyclesCPU/backendNONE with no device enumeration, GPU denoising, photo plane or material replacement. Private PNG labels say FRONT-VISIBLE PARTIAL and NOT ACCEPTED; actual geometry is rendered. The source mask/atlas/GLB/contact sheet and pixel/triangle mappings remain private.

## Blockers and next owner steps

**Compiler:** read-only gate still reports MSVC absent; expected vcvars64 and SDK Include are absent, existing local NVCC is present. No JIT/native rebuild, administrator installer, UAC, security-policy change, restart or driver change ran. SiTH nvdiffrast, Warp build and drape remain blocked on owner-completed `install-msvc-admin.ps1`, followed by scoped approval/review and shared admission. This report does not mark an old TOOLCHAIN-STATUS SMPL-X absence sentence current: licensed SMPL-X and saved fitting already exist.

**Face quality:** next appearance stage needs reviewed visible facial landmark/pose/calibration and head-shape alignment against the existing source, with explicit authorization for that fitting stage. Better neutral-expression front/side close-ups and additional viewpoints are needed for currently unobserved face/hair/back detail. A frontal texture alone cannot establish identity or recover hidden geometry. Do not run a new body fit merely to make this report greener. Metric body scale still needs an actual height/reference. Real tee/jeans image/form validation remains needs_input; no clothing inference/drape was added here.

**Native/integration:** existing app worker LFsha ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6 and historical original56 result46PASS/9skip/1fixtureERROR stay unchanged. Await exact app-owned NATIVE-FIXTURE-30 patch and Codex review; no transport/SQL edits or full suite rerun. Canonical backend is fitmatch-ai/gohczmqykjkrgdblgbog; smoke is deprecated. Cloud migration/recovery/HTTPS/scoped enrollment gates remain outside this CPU task.

Real coordinator policy789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039, guard47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c and existing byte0 lock/slot/state were preserved. No new pc-ai slot, operator approval, nested OS lock, CUDA work, cloud write/deploy, public PC port or foreign process kill. Publication is a source/evidence handoff, not a live Qwen or likeness PASS.
