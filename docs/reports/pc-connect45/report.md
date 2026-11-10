# CONNECT-PC-GPU-45 — current CPU readiness, no slot issued

Session PC-20261110-CONNECT45, PC3D coordinator, 10 November2026 America/New_York. Follow-up to PC-NATIVE-33/GPU-READY-33. Operations **546ca6474d65bf6d0462dd97ab2fa25e837695ed / PROC0043** read/reconciled against previously fully read8ab74ac onboarding; current direct CONNECT45 dispatch supersedes older credential-missing/Storage9 status. Baseline **a4386c06025b08c07b2747727d3d5c69f5387201**, owned branch `codex/pc-native-33`. This delta changes reports/checkpoints only; no adapter, worker, guard, coordinator policy, lock or slot implementation/config changes.

## Native publication completed first

PR10 **76437519ea6ba0345322ec1ed16c5c09064fb5b8** contains9new safe native33 files. All9read back exactly, including raw stdout950bytes/SHA771792c2864e4824ea97dac5ff07d412ff5c15c45fc90d1c2f78c520e8ff149a and stderr6334bytes/SHAf8dc14819e36960d37647a1e5f64a641aee8b39adcd4bd933296b1c9260dc034. Separate local operations commit845e7826090531af399b2ba6bc40a4dc824b2386 retained, no reset/merge of divergent histories. PR remains draft/open/unmerged.

Exact499ead0 native test result remains **56run/47PASS/9skip/0fail/0error/exit0**. Skips5POSIX+4symlink privilege remain explicit. Production workeref25136b unchanged, reviewed patch50ddd9/resulttestf178 verified. No redundant suite,18case matrix, fitting, texture bake or preview render rerun. See [native result](../pc-native33/report.md), [raw test log](../pc-native33/worker-unit-native56.log) and [scoped ACK](../pc-native33/binding-readiness-ack.json). Required context-space in the exact patch-text artifact is preserved for its SHA; it is the only expected whitespace-check exception.

## New read-only observation

Evidence window **09:03:19–09:06:29 EST (14:03:19–14:06:29 UTC),10November2026**. Private raw process paths/PIDs/creation identities are retained outside Git; public summary contains only counts/status. This snapshot must be refreshed immediately before a future authorized slot; it is not a continuing lease or global-idle monitor.

| Observation | Actual result |
|---|---|
| Existing coordinator policy |789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039, unchanged|
| Existing guard |47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c, unchanged|
| Existing lock identity |volume3699583840/fileId2251799814103012; policy=stat=open-handle fstat; no byte0 acquisition|
| Existing slot |pc-3d, expired; both current worker/guard finite validators refuse; no refresh|
| Saved named Job Object |Read-only query absent/error2; no job creation or termination|
| Saved owned process identities |8current creation-identity/zero-time-handle queries;0same owned objects alive,0unknown queries. Includes3historical actual drain fixtures' interpreter/grandchild identities; no rerun|
| All Windows process-name snapshot |336processes;0Python/Blender/known-engine names.117command lines unavailable; raw commands never stored|
| Driver-listed process inspection |22entries,21queryable native image/process handles and1opaque image query. No known owned engine image; per-process VRAM unavailable under WDDM|
| Owned-tree status |PASS within known saved-owned/all-known-engine scope at this snapshot; **global GPU idle NOT PROVEN**|
| Hardware read-only snapshot |RTX3060, driver610.88,12288MiB total/734MiB used/11377MiB free,3%reported utilization|
| RAM snapshot |17013657600bytes visible;4179521536bytes free (about3.89GiB). Not a cold-load admission PASS|

The earlier unknown-command-line gap is narrowed by checking every process name, native process image/creation handles for driver-listed entries, exact saved owned process identities and the actual saved Job Object. No inaccessible command line was silently classified idle. System/GUI GPU activity remains; one opaque driver image remains UNKNOWN, so no claim of zero GPU contexts, zero VRAM use or complete machine-idle proof. No foreign process was killed, suspended or inspected for secrets.

The source worker at serving-code **7397b6a954dbe877e425abd09abd125398c271c4** was fetched/read from Git: SHAef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6, no worker diff from the tested499ead0. Existing checkout remains untouched. HTTPS **https://fitmatch.minkoi.org** and serving revision are supplied/verified by the Codex hosting owner; PC did not authenticate, heartbeat, claim or verify a token in this task. No service-role key is accepted on PC.

## Bounded test preparation — NOT EXECUTED

Proposed limit for Codex/AI-owner review: **one owned `garment.analyze` job, one finite600second pc-ai admission window,240second engine timeout plus30second drain bound**, existing selected Qwen model/revision and private operator policy. No auto-refresh, extra queued job, retry with a different image, 3D overlap or second transport. AI owner must validate RAM/VRAM/headroom against the existing measured runtime profile immediately before cold load; the free-RAM number above alone does not prove it fits.

After explicit Codex **BACKEND_READY**, reviewed native/skip ACKs, canonical restore/cutover/enrollment, exact HTTPS/config/input binding and current quiescence/OS-lock checks, the coordinator can execute the existing command below from the PC source checkout. **It was not run.** Path placeholders refer to existing executables and files; no new helper/lock is to be installed.

```powershell
# NOT RUN. Only after explicit backend-ready and current reviewed quiescence.
& '<existing-sith-python>' workers/windows/gpu_guard.py --owner pc-3d --set-slot pc-ai --slot-seconds 600

# AI owner then invokes the worker directly; never wrap this in gpu_guard.
& '<existing-worker-python>' '<reviewed-app>/scripts/worker/worker.py' --config '<private-canonical-pilot-config>' --once
```

Before even the slot command, verify the exact policy/guard hashes and that the **existing** lock file still has the pinned identity. If missing/replaced/unknown, stop; never let a helper recreate it. The unchanged internal guard opens a+b, so this prerequisite matters; no guard patch is authorized here. Slot allocation briefly takes the existing OS byte0 lock, verifies old owned quiescence and writes only a finite admission; it launches no engine. The integrated worker subsequently owns the one bound byte0 lock itself. No nested guard, alternative lock, shared-policy re-pin or environment-only proof.

The worker must retain its lock through actual owned Job Object/process-object drain. Slot expiry does not authorize preemption or early unlock. Unknown drain means quarantine/no next claim. For model unload, require owned process objects signaled/context gone; do not assert whole-GPU memory becomes zero while GUI processes remain. Keep3D GPU work paused throughout the Qwen admission/job/drain period. Afterward record real elapsed time/RAM/VRAM/error/OOM/actual output proposal and human review, not a MOCK success or schema-only quality claim.

## External status and exact gates

The latest direct Codex dispatch reports canonical authentication, complete CLI backup plus14Storage objects/92checks, with actualPG17restore proof **in progress**; canonical has **not migrated**, Qwen **OFF**. These are hosting/backend-owner reports, not PC database tests. Older operations546ca64 credential-missing/Storage9 statements are historical relative to this newer direct dispatch; no new user credential request is needed from PC.

No explicit backend-ready release has arrived. Still required before issuing a slot:

1. Codex confirms actual recovery proof and controlled canonical cutover/backend preflight completed with the expected project.
2. AI owner supplies reviewed private scoped enrollment/config/operator approval and immutable owned input binding, with no token/photo values in this report.
3. Codex reviews both native47executed/9skip ACKs and the exact serving worker/config contract; source bytes remain pinned.
4. Refresh owned-tree/identity/process evidence immediately before admission; any ambiguous owned engine or failed query blocks. Coordinator must obtain actual byte0 exclusion at allocation; no inference from chat-idle.
5. Confirm runtime resource headroom for the existing model, then authorize exactly the bounded one-job plan above.

Status: **CPU evidence/checklist Ready for review; native publication complete; live app→Qwen NOT RUN; slot NOT ISSUED.** ThreeD work is paused by coordination, not by holding the OS lock in this task. No CUDA/model/render/fitting/download, foreign kill, lock deletion, public PC port, UAC/MSVC install, driver/restart, cloud SQL/deploy/paid action. Private FACE31 GLB/previews and rejected identity remain intact. Adapter/transport/backend ownership stays with the current AI/Codex/Claude owners.
