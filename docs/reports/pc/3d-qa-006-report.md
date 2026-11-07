# 3D-QA-006 — closed seams, preserved UV corners and native Windows finding

Session **PC-20261106-3DQA-006**,2026-11-06 America/New_York. Implementer handoff for review, **not product acceptance**. Completed005 first: [report](full-look-setup-report.md), draftPR4 metadata, verified local bundle/patch/artifact ZIP. Keep005 as a comparison; no source/model/fit overwritten.

## Actual revisions and scope

PC clean baseline **5bfca0979e18aaf6ebc6eda341ca299cc4ccd785**, new local branch **codex/pc-3d-qa-006**. Implementation **6cc3b316931a539d13eaaa2586a80d928f250530**. Only owned seam/UV/export/QA helpers, PC reports and capture checklist. Code stays local; public scope sanitized documentation only. No app source push, live worker, enrollment, animation, deployment, paid model/API, UAC, driver or reboot.

Separate clean application review clone at **7be869c989bc8c2b13d8b9ce621c9f70d487e57c**, branch codex/full-look-reviewed; read AGENTS, pc-native-preflight and integration report. Worker Git blob remains **41ee24291c1129626c9461397d14d5c2ee993768**, matching the producer inspected at48f66f9. Checkout remains unchanged. Current Windows raw worker SHA256 **f88b38bc29b45566a81eab122e52062809fc86345a20654b60b4275f8dff8da4** includes checkout line endings; compare Git blobs for repository identity rather than equating it to the earlier LF handoff-copy digest.

Operations read/rechecked through a32f6fbf7a1ba7c744930a3f8b872dd801aab206/PROC14, then root deltas/dispatch through **b23f071f852bea51cb746ee69359e6f089bc62bc / PROC15** before publication. PC local process is append-only. SiTH004 SHA256 still **52d0f666ed0284aad1c2eb809e7d534349d4b52729de4244d486093855648a2b**. No body fitting, weights, Blender sewing100frames or pants PBD100frames rerun;006 reuses those actual outputs and synthetic source images002.

## Seam and material changes actually made

Weld only vertices with the same original GarmentCode sewing identity, using their simulated mean position.7503→7173physical vertices,14082triangles unchanged,0degenerate faces removed,1connected surface,4boundary components (neck/hem/two cuffs),0non-manifold edges. Winding already consistent; median cloth/nearest-body normal dot **.952405**, no global orientation flip. Maximum repair displacement **11.316mm**, mean **.0334mm**; these edits are explicitly recorded, not a new simulation or garment resize.

Keep original panel-corner UVs in a checked correspondence map independently of welded physical vertex indices. Set embedded PNG sRGB/CLIP and use backface culling for orientation QA. Actual front/side/back/eight-view contact sheet inspected: teal shirt/red-white F front and B back remain correctly oriented; no visible new reversed-face holes. Both decoded embedded textures in each garment **exactly match source PNG pixels**. This proves storage preservation on synthetic fixtures, not real-photo reconstruction or exact rendered colour under arbitrary lights.

CPU BVH positive/negative controls pass. After welding, **0tee-body,0pants-body,0tee-pants and0non-adjacent self-intersection pairs**, without a special sewing-adjacency exclusion map. Float precision/adjacent-triangle limitations remain. Shared seam vertices eliminate gaps geometrically; this does not validate fabric mechanics.

**Tradeoff:** absolute panel-edge strain p95 **5.936%**, max **72.491%**,89edges over20%, versus005p95=5.754%/max46.451%/50edges. Closing a22mm gap deforms some small seam triangles. Keep material/size accuracy **needs review/changes**, rather than calling the whole garment quality PASS. Only one reference body has been tested; no per-person resizing or cross-body size acceptance.

## Actual006 artifacts and costs

Private local **`<workspace>/outputs/pc-template-full-look-006/`**: manifest.json/versionv006, full-look-manifest.json, evidence-manifest.json, threeGLBs, benchmark.json, quality-notes.md, repair/texture/collision/format reports and8rendered PNGs/contact sheets. Avatar is an untextured reference body; tee/Pants are fixed templates with own synthetic textures. Unique versioned fixture IDs are used, not reused wardrobe version IDs for changed bytes.

| GLB | Bytes | SHA256 |
| --- | ---: | --- |
| avatar.glb |856156|f08d64d313ee7c86cfd030a0f9a829b39fcd22cc7de9783ffeefc11c82b57cc2|
| tee.glb |344848|dc18c44439c337e370f8e8d2fbcc2d13eb940d155adc1ea9cd7523235516e1fd|
| jeans.glb |941952|009598c1fbc5817c749600b63f2663014161217e93e47b0c8e2f8c318de3d6b4|

Total **2142956bytes**; static GLB2, one mesh/file, body47500/top14082/bottom29038triangles, no duplicated body,4embedded garment PNGs, no external resources/skins/animation/Draco/KTX2. **All3Khronos0errors/0warnings**, independent Blender/Trimesh reload, finite geometry, shared world bounds within **5.44e-8m** of sources. +Y-up,+Z-front,metres preserved; no independent normalization. Technical QA evidence preflight exited0/PASS,6artifacts,human review pending, **productGate NOT_VERIFIED**.

| New stage | Internal seconds | Launcher seconds | Peak tree RSS bytes | Whole-device sampled MiB |
| --- | ---: | ---: | ---: | ---: |
| CPU seam weld |.534|4.518|133148672|5184 (Qwen overlap, not weld VRAM)|
| CPU export/reload+8views |.598 export/reload,61.050 script|61.537|631205888|772 (desktop)|

No GPU job by3D in006; CPU work overlapped Qwen's guarded quality run. No OOM observed. Old simulation/model times in benchmark.json are explicitly marked reused, not measured again. See005 for earlier OptiX renderer proof;006 render actually used CPU.

## Shared absolute lock ACK

Both owners ACK the same absolute local **coordination/gpu0.lock**, byte0 msvcrt OS lock, and the same absolute gpu_guard.py launcher. Private Qwen ACK **PC-AI-QUALITY-20261106-02** received2026-11-06T05:45:49Z; guard SHA256 **4ddf206d2cb16794f1e05eded7278d82c027dab1d277ac737b003322f8006680** equals current3D file. Full private paths retained in coordination/qwen-gpu-ack.json and3D receipt, omitted from public metadata. AI quality job observed released/allJobProcessesExited at05:47:52Z. No model rerun requested for ACK.

Live engines stay empty. Future worker config must use that same absolute path; its ProgramData default differs. FileLock is not the setup slot policy, and nesting a worker that takes the same lock under the setup wrapper would deadlock. No live config or disabled-containment opt-in was enabled.

## Native Windows18-suite failure, reproduced cause and proposal

Actual run of unmodified app7be869c with SiTH Python3.10.22 `-I scripts/worker/test_worker_unit.py -v`: **17passed,1error**,exit1. The new cross-process test killed Popen.pid then expected immediate lock release. Windows venv redirector PID differs from the actual interpreter holding the lock; controlled repro showed the interpreter survived launcher kill while the test's stdin pipe remained open, then exited/released when that fixture pipe closed. This is not evidence that OS locking failed or a production worker was exercised.

Prepared a **local-only patch proposal**, base7be869c, `workers/windows/patches/app7be-native-lock-test-proposal.patch`: launch this stdlib-only test fixture with the base interpreter on Windows so the PID killed is the holder. Applied only in a separate disposable test copy, **18/18PASS**,0.197s. Original app checkout/transport/tests remain unchanged. Mac/Codex must review/apply/retest; do not report upstream18PASS or a production transport fix from the proposal.

PC native containment probe now records/targets the actual disposable worker interpreter with PID+creation-time validation, then verifies its owned child and grandchild exit. **4/4PASS** against7be869c's worker, no foreign process killed, no GPU/API. Launcher and worker PIDs were in fact distinct. This avoids confusing launcher termination with actual worker death; the setup guard separately contains the entire suspended-launcher child tree.

Exact current producer→PC adapter rechecked with the read-only7be worker and local JPEG download stub: **10/10PASS**, adapter raw SHA256 **000df1514746b5998eebfe632b36a771812eaf53066ff754d7d7339beab0b6a9**. Old8regressions were not repeated in006 (passed005). Accepts the explicit disabled three-JPEG v1-r2 subset only; exit78/noartifact retained. No video/face fusion/top/bottom inference or full live ACK.

## Remaining inputs/gates and handoff

[Capture checklist](capture-input-checklist.md) prepared. Personal capture/height/real tee+jeans photos still **needs_input**; no alternative personal sources fetched. True-size ambiguity from uncalibrated front/back images is explicit, not solved by hidden garment scaling. PC source-retention cleanup, real likeness/editor, per-body sizing and live lease/cancel/GPU stress remain unverified.

MSVC/Admin/UAC pause remains: owner must run existing install-msvc-admin.ps1 from their Administrator PowerShell when available. Then verify compiler/rasterizer/native Warp and continue004, retaining valid fitting. No installer/UAC/driver/reboot action in006. Next review: seam repair versus strain tradeoff, template/previews and Windows test proposal, then native solver comparison when compiler is authorized. Code bundle/patch/artifacts remain private local; only metadata/checklist/report publish to the docs PR. Publication or code exit0 does not grant an engine or product PASS.

Operator commands are retained verbatim in private benchmark JSON; fresh output paths are required. Example focused checks from the PC checkout, replacing workspace/review placeholders with the pinned local paths:

```powershell
& '<workspace>/envs/sith/Scripts/python.exe' workers/windows/test_worker_windows_native.py --worker-source '<review>/scripts/worker/worker.py' --worker-revision 7be869c989bc8c2b13d8b9ce621c9f70d487e57c --report '<fresh-native-report.json>'
& '<workspace>/envs/sith/Scripts/python.exe' workers/windows/verify_fixture_textures.py --output '<workspace>/outputs/pc-template-full-look-006' --textures '<workspace>/diagnostics/synthetic-garment-images-002' --report '<fresh-texture-report.json>'
& '<workspace>/envs/sith/Scripts/python.exe' '<operations>/tools/acceptance/check_handoff.py' '<workspace>/outputs/pc-template-full-look-006/evidence-manifest.json'
```
