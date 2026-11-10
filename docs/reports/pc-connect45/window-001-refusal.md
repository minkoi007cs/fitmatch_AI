# CONNECT45 window001 — REFUSED_HOST_RAM, no slot issued

Session PC-20261110-CONNECT45-WINDOW1. Owner/Codex explicitly authorized a single test window after promoting `dpl_EK7gxYYHUXsUocAPcGaa5igD7wsE`, reported sourceca3466c/Qwenruntimeoverride1;121unit/fullv2/buildPASS and canonical backend/heartbeat verified by Codex. This superseded the earlier wait-for-window condition, **conditional on fresh resource/identity/quiescence gates**. No model work was authorized in PC3D.

The fresh RAM gate failed, so allocation stopped before executing `gpu_guard --set-slot`. No new slot start/expiry exists. No app job was claimed, GPU/model loaded, slot refreshed, threshold lowered or foreign process killed.

| Actual check | Result |
|---|---|
|18:11:15.5366694UTC /13:11:15EST CIM freephysicalRAM |4067241984bytes <4294967296bytes|
|18:11:57.578962UTC /13:11:57EST authoritative Qwen metric |`psutil.virtual_memory().available` =4119449600bytes <4294967296bytes|
| Required fixed RAM minimum |4GiB =4294967296bytes, unchanged|
| Exact authoritative shortfall |175517696bytes, about167MiB|
| Read-only VRAM |11370MiB free, above existing8GiB requirement;12288MiB total/741MiB used, RTX3060/610.88|
| Policy/guard/lock |789426/47331 pinned full hashes and volume3699583840/fileId2251799814103012 unchanged, stat=open-handle identity|
| Existing slot |Old expiredpc-3d slot; both validators still refuse, not refreshed|
| Saved named Job Object |Read-only query absent/error2|
| New slot / OS byte0 acquisition |None / none|

The authoritative check ran in the existing Qwen Python environment with psutil7.1.3 and imported no torch/model/CUDA. It is the same available-RAM metric used in existing `qint_p/admission.py` and `runner.py`. The second single measurement confirmed the CIM refusal rather than weakening the gate. No polling-until-PASS or automatic retry was started. The earlier17:46RAM minimumPASS was only a snapshot and did not authorize using stale evidence for this window.

Because RAM already refused, PC3D did not complete a new full process-tree grant proof or attempt byte0 acquisition. Binding/old Job read-only checks were still collected, but they do not override the failed resource prerequisite. No claim of all gatesPASS. Qwen's loader also rechecks4GiB after heavy imports before weights; merely freeing the measured167MiB is not a guaranteed cold-load success.

The existing Qwen chat received the exact no-slot refusal and was instructed to keep runtime/claims/model stopped and relay it before owner presses test. ThreeD GPU work stays paused. No slot was created, so there is no new admission to withdraw; previous expired slot remains unchanged. PC3D does not change the hosting flag/worker row itself.

**Current condition: REFUSED_HOST_RAM_NO_SLOT.** Available RAM must genuinely increase; then a new explicit coordinated recheck/window can refresh all gates. No threshold reduction, foreign kill, driver/restart/UAC, model/weights/setup/render rerun, paid service or publicPCport. Native47PASS/9skip evidence is preserved, not rerun. Private refusal/checkpoint and exact resource logs are saved; no tokens/photos/raw process paths in this public report.
