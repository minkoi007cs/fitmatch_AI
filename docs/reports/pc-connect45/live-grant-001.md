# CONNECT45 — one real app/Qwen job, drained and admission withdrawn

Session PC-20261110-CONNECT45-RESUME2310-GRANT1, PC3D coordinator. Scope: shared admission/resource/owned-process proof only; PCAI owns the model and Codex owns backend/UI. Native47PASS/9skip evidence is preserved, not rerun. No model, torch or GPU inference was started by PC3D.

**One actual job completed and reached REVIEW; the slot is withdrawn.** Codex independently read canonical DB status SUCCEEDED/stageREVIEW/errornull/attempt1 at23:21:13.943UTC. PCAI's926byte `fitmatch.garment-analysis.result.v1` output passed schema/job-binding checks after exit, outcomeproposal, auto-applyfalse. Confirmed fields were0at Codex's check. Human semantic/visual review is separate; no garment attributes were automatically accepted by this coordinator. The second job stayed QUEUED/attempt0 and was not run; Codex disabled the scoped worker while retaining UI for proposal review.

## Actual admission and execution

Fresh NEW GO followed actual backend/config/approval readiness at reviewed serving source **ca3466c79d42f4b8ff273b86d34734ebb8935443**, deploymentEK7gx/QwenON, immutable worker **ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6**. The old18:30window was not reused. Fresh admission measured **5468221440bytes availableRAM >=4294967296**, **11429MiB freeVRAM >=8GiB**,0known engine processes,0same saved-owned objects live/unknown and saved Job Object absent. Existing policy/guard matched, and a retained read handle proved policy=stat=fstat=nativeWin32 lock volume3699583840/fileId2251799814103012. The coordinator did not nest a byte lock; the unchanged guard alone briefly acquired canonical byte0 for allocation.

| Event | Actual UTC,10November2026 |
|---|---|
| Exactly one pc-ai600s slot issued |23:17:14.701015|
| Original finite expiry |23:27:14.701015|
| First actual worker start |23:19:41.961836|
| Actual worker output completed |23:21:13.926587|
| Canonical DB SUCCEEDED/REVIEW, reported by Codex |23:21:13.943|
| PC3D4retained observed process objects all signaled |23:21:17.556629|
| PCAI owned-drain receipt, all captured handles exited/live0 |23:21:19.255900|
| Existing admission deadline shortened/withdrawn |23:24:23.204896|
| Readback and free-lock verification completed |23:25:12.731019|

PCAI first encountered Windows267/missing working directory **before any child/claim/model existed**. It created the authorized directory and made one actual corrected worker launch. This did not create a second model/job run or renew the slot. PC3D independently captured4actual native process handles (venv launcher/interpreter for worker and adapter) while live; all later signaled. Observer CPU-only exit0; it never killed a process or acquired the GPU lock.

PCAI executed one `garment.analyze` via the direct reviewed worker `--once`,240second engine timeout+30second drain, no second queued job and no runtime restart. No nested guard or alternate transport. The initial slot SHA256 was **16aa02234c791c09e14369ff598c8b568cd80954e37fd447b09b2bda27902f9a**, slot volume3699583840/fileId2814749767563627. Duplicate GO was explicitly deduplicated; only one allocation command ran.

## Measured single-run resources

The following timings/resources are PCAI's actual native run measurements, not a repeated PC3D benchmark or README estimate. PC3D independently observed process lifetimes and driver memory samples. One sample is not an SLA or stability distribution.

| Measurement | Actual result |
|---|---|
| Worker launch→output completion |91.965s|
| Admission→model loaded interval |76.531s, includes preparation/loading; not pure inference time|
| Admission→cleanup interval |86.344s|
| Output tokens / model attempts |117 /1|
| Model-process peak RSS |1851334656bytes|
| Torch peak allocated / reserved |4437815808 /4605345792bytes|
| Whole-device sampled peak used |5184MiB, includes desktop/background usage|
| Minimum host available during model run |3346268160bytes|
| PCAI final availableRAM |5334749184bytes|
| PCAI final free/usedVRAM |11430 /681MiB|
| PC3D independent post-drain free/usedVRAM |11427 /684MiB|
| Actual worker/adapter captured process exit codes |0/0/0/0|

The fixed4GiB **preload** gate was met and not lowered. Host available RAM later fell to3346268160bytes during the loaded model; that is a measured runtime low, not a claim that4GiB stayed available throughout inference. No OOM was reported in this run; resources remain tight and concurrency was not tested. Pure generation-only timing was not independently measured. Environment read from existing package metadata without importing torch in PC3D: Python3.10.22, torch2.9.0+cu128, transformers4.57.1, bitsandbytes0.48.2, safetensors0.8.0, psutil7.1.3; RTX3060/driver610.88.

## Drain and withdrawal proof

PCAI reports all4captured native handles exited, worker/adapter exit0, cleanup event seen and live0. PC3D separately retained4native process objects until all signaled at23:21:17.556629UTC, then rechecked their creation identities. This is evidence about the observed owned runtime, not global GPU idle or an independent measurement of the exact worker-unlock timestamp. The immutable worker's internal Job Object drain policy and prior native coverage are unchanged. At withdrawal the coordinator obtained the existing bound canonical byte0 nonblocking, proving it was free, and released its verification lock afterward. No foreign process was killed or preempted.

Withdrawal shortened **only `admitUntilUnix`** to23:24:23.204896UTC. Owner remainedpc-ai and the original issued timestamp remained unchanged. No new pc-3d grant, deletion/bootstrap, renewal or600s extension. Both existing worker and guard validators now refuse the expired admission. Policy789426, guard47331, lock identity and historical guard-state bytes/file identities remained unchanged. Withdrawn slot SHA256 **c02ec350a55bf169d4e4cb3a2f2560c6b1c9e48c5ea8731c5426bacb4b7c3412**, fileId decimal **60235645016150717**, volume3699583840.

The first verification attempted to hash the locked byte through a second file handle while the coordinator itself held byte0. Windows raised PermissionError **after the withdrawal write**; `finally` released the lock. PC3D reconciled actual readback, verified the free lock and hashes outside that held-byte section, without writing the slot a second time. This verification defect did not renew admission, restart a job or alter the worker; it is retained in the private evidence.

Issued/withdrawn metadata and full expiry/identity notifications were delivered to the existing PCAI coordination thread before report packaging. Current state **WITHDRAWN_AFTER_ONE_JOB_AND_OBSERVED_OWNED_DRAIN**. No active grant remains. ThreeD GPU work was not automatically restarted; the drain prerequisite is complete, so later authorized3D work need not wait for human proposal review. MSVC/UAC pause and other engine/quality gates still apply.

## Handoff and limits

Public files contain only safe lease/resource/outcome metadata; no garment photo/OCR, raw result, owner/job paths, token/lease secret, personal asset hash or model weight. Private PCAI completion/drain receipts and the independent observer's PIDs/creation times remain outside Git. No setup/download/native retest, driver/restart/UAC, paid resource, public PC port, SQL/hosting/worker/adapter/guard implementation edit by PC3D.

This closes the bounded real app→PCQwen execution and shared-admission lifecycle milestone for one job. It does not accept semantic garment quality, two-account/24x7 reliability, avatar likeness, separate3Dtee/jeans, editor, drape or full first-release pipeline. FACE31 remains a private rejected-likeness partial and compiler-dependent stages retain their prior blockers. User/Codex can review the actual proposal in the app; a further model job needs a new explicit authorization and fresh gates.
