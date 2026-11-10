# CONNECT-PC-GPU-45 refresh002 — RAM threshold passes, execution window pending

Session PC-20261110-CONNECT45-R2, report-only continuation. PC baselineb5c03cfa1057dd1394edb2c2f8ff3adcbb95b7e1 clean on owned `codex/pc-native-33`. Current operations433922c52d0561dcd931bdb96a80d7115b652cdf/PROC0045 onboarding and changes read/reconciled; exact execution report read at Codex `codex/connect-45` **7d042ed9ef02046b52e24f2235bb434b64359ee8**. Production source7397b6a/workerSHAef25136b unchanged. Native47executedPASS/9skip/0error evidence85e9d37 remains preserved, not rerun.

The latest Codex report confirms actual canonical backup/PG17restorePASS,12canonical steps APPLIED+VERIFIED and13history versions adopted. Worker **8f1cc6bb-6446-4a7f-9d67-6144deba29be** is registered **DISABLED**, capability garment.analyze only; QwenflagOFF. These are backend-owner outcomes, not PC SQL tests. Older pre-cutover/pending-restore entries are history. This follow-up still explicitly withholds slot/GPU authorization until a verified heartbeat/backend-ready acknowledgement and execution window.

## Actual new read-only sample

10November2026 **12:46:04–12:46:53 EST /17:46:04–17:46:53 UTC**:

| Check | Observed result |
|---|---|
| Free physical RAM |4612816896bytes (about4.30GiB)|
| Required minimum |4294967296bytes (4GiB), unchanged|
| Minimum-RAM gate |PASS at measurement; margin317849600bytes (about303MiB)|
| RTX3060/610.88 read-only |12288MiB total,730MiB used,11381MiB free;16%GPU utilization reported|
| Policy/guard |789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039 /47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c unchanged|
| Existing lock |volume3699583840/fileId2251799814103012; policy/stat/open-handle fstat match|
| Existing slot |Expired pc-3d; worker and guard both refuse; no refresh|
| Saved named Job Object |Read-only open/query absent/error2|
| Saved owned process objects |8native creation-identity/zero-time-wait queries;0same owned objects live,0unknown queries|
| Full process-name snapshot |297processes,0Python/Blender/known engines;118command lines unavailable|
| Quiescence conclusion |PASS within the known-owned-tree/all-known-engine snapshot scope; **global GPU idle NOT PROVEN**|

The former4179521536byte sample was below4GiB and was a refusal. It is superseded for this measurement by the new4612816896byte sample; no threshold was reduced and no foreign app was killed. A roughly303MiB margin above the minimum is not a cold-load success guarantee. Recheck immediately before admission; if free RAM drops below4294967296bytes, refuse again. Do not use this saved snapshot to bypass a later failed resource or process query.

No raw command lines/tokens/photos are in the public delta. Private process names/PIDs/creation identities and driver lists remain local. Unreadable command lines are not treated idle; native saved-owned identities and all current engine names were checked separately. UI/system GPU activity remains. No model/CUDA/render, unit-suite rerun or live heartbeat/claim was started by PC3D.

## Exact remaining condition

**WAIT_HEARTBEAT_BACKEND_READY_AND_EXPLICIT_WINDOW.** Canonical cutover is reported complete, but PC3D has not received the explicit verified heartbeat/backend-ready release plus execution window. The registered worker is still reported disabled/QwenflagOFF. AI owner owns private config/token matching and CPU heartbeat preparation; PC3D does not read raw tokens, enable the worker or change flags.

Proposed bounds remain **one garment.analyze job, one finite600second pc-ai slot,240second engine timeout+30second drain, no auto-refresh,3D GPU work paused**. No slot is issued/refreshed. The existing prepared command is NOT RUN:

```powershell
& '<existing-sith-python>' workers/windows/gpu_guard.py --owner pc-3d --set-slot pc-ai --slot-seconds 600
```

Before any future execution: explicit Codex release/window and verified HTTPS/canonical heartbeat/capability/input/operator policy; fresh RAM>=4GiB and owned-tree evidence; same existing pinned lock/guard/policy and actual byte0 exclusion. Worker alone owns that lock while directly invoking the adapter. No nested guard, lock recreation, foreign-process kill, concurrent3D, early unlock before owned-tree drain/unload or automatic slot renewal. Any unknown owned-tree/query state fails closed.

Checkpoint saved for resumption. No duplicate setup/weights/fitting/texture/render, public PC port, paid resource, MSVC/UAC, driver change/restart, app/SQL/transport/coordinator implementation change or cloud write. Status: current CPU minimum-resource/scoped-quiescence evidence ready for review; real Qwen and slot issuance **NOT RUN**.
