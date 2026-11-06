# Proposed process delta — 3D-QA-006

Session PC-20261106-3DQA-006, source6cc3b316931a539d13eaaa2586a80d928f250530 from5bfca09, local branch codex/pc-3d-qa-006. Operations b23f071/PROC15 rechecked, current app7be869c reviewed in separate clean checkout. No central process/app source overwritten. [Report](3d-qa-006-report.md), [safe evidence](3d-qa-006-evidence.json), [capture checklist](capture-input-checklist.md).

- **Ready for review, seam/UV/material scope:** known sewing correspondences welded,1surface/4expected open boundary components/0non-manifold edges,0gap. Original per-corner UV preserved; backface/sRGB/material QA and exact source-PNG decoded pixel checks passed. No fitting or drape simulation rerun.
- **Ready for review, actual006 output:** body/top/bottom2.142956MB GLB2 total,3Khronos0/0, shared-frame reload,8actual static views. Templates/reference/synthetic labels retained, newv006IDs. BVH0body/top-bottom/non-adjacent-self pairs. Not personal avatar/real clothing.
- **Changes requested, material/size quality:** max repairmove11.316mm; edge strain p95=5.936%,max72.491%,89edges>20%. Closed seam improves topology but worsens some local strain; not physics acceptance.
- **Native preflight finding:** unmodified app18-suite on Windows17pass/1error. Controlled repro identifies venv launcher versus interpreter PID/held stdin pipe. Base-interpreter fixture patch proposal in disposable copy18/18PASS; original app unchanged. Mac/Codex must review/apply. Updated actual-interpreter native containment probe4/4PASS.
- **Disabled adapter:** actual current7be producer→PC CLI10/10PASS, same worker Git blob41ee242 as48f66f9; only explicit three-JPEG v1-r2 boundary accepted, normal78/noartifact. No full live/video/bottom ACK. Old8regressions not rerun006.
- **Shared GPU:** Qwen formal absolute-path/byte0 ACK received; guard SHA4ddf206d…matches, model tree observed released.006onlyCPU, weld's sampled wholeGPU5184MiB is AI job use, not cloth VRAM. No foreign kills/lock takeover.
- **Still blocked/needs_input:** MSVC/UAC pause; dependent SiTH004/nativeWarp; personal capture/height/real garment photos; likeness/editor/source-retention and live GPU/lease tests. Engines empty, product NOT_VERIFIED, human review pending. Preserve005 comparison and SiTH004/model/fitting state.

Public documents only, no code/mesh/photo/weights/credentials/signed URLs. Local bundle/patch+artifact receipt supplied separately after creation; not presumed delivered on another machine. No merge,deploy,enrollment,paid service,driver/restart/Admin action or animation.
