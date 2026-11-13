# Drain audit contract v3 — proposal only / awaiting AI evidence ACK

Root accepted the v2 disabled-approval/completedUTC fixes at docs commit
`88b7d0a54a9efa1815ffd11642814ce24c67dfdf`. This bounded follow-up proposes ONLY
the private audit metadata contract and focused tests. It is not a server API,
worker transport, instrumentation change or live native receipt. No GO/approval/slot.

The reviewed v2 coordinator source remains unchanged at SHA256
`af1c22b0ec092e61810b794a561c57a1d1f3c51639d55e2d0e1a008dd14b14a0`.
Its strict old withdrawal predicate is NOT silently replaced or called. After root
review and AI producer ACK, a separate bounded integration must replace that predicate
and produce coordinator-owned fresh closeout evidence before a new live window.
Neither this proposal nor the prior v2 acceptance authorizes a run.

## What the reviewed source actually proves

Pinned worker SHA256:
`ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6`.

The successful inference control path calls `process.drain()` in finally. A false
return quarantines and prevents the success path. On Windows `drain()` first checks
`alive()` using the actual Job Object active-process count; only after false/zero does
it call `_quiet()` / `_WindowsJob.wait_tracked()` to require tracked native handles
signalled. **wait_tracked itself waits handles; it does not independently export or
re-query a numeric count.** `output_ready` is written only after drain success,
adapter return0 and valid output. Analysis `completed` follows successful server
result POST. This is reviewed source-control-path evidence of the internal drain
checks, not a separately captured numeric Job0 measurement.

Concrete alternative paths reviewed: `resume_pending()` and cached completed/output
reuse can publish an old output without a new inference drain. Worker return0 alone
also does not prove the expected job succeeded. Therefore a target directory absent
**before** launch, the new same-run attempt1 checkpoint, actual backend result and
worker+adapter native identities are mandatory. The existing AI preflight already
refuses an existing exact-job directory and unreviewed pending outputs. A later absent
directory, an old checkpoint or a generic worker exit cannot substitute for that
prelaunch observation. No loophole was found when the full stipulated chain holds;
missing chain evidence remains HOLD.

## Candidate normalized PRIVATE audit shape

The module validates metadata predicates only, not provenance or native state. Fields
below must reference actual observations and private source receipts. Synthetic test
fixtures never supply a real audit receipt. No model unload callback is exported.

```text
kind = fitmatch.qwen48.worker-drain-control-path.v1
goId / jobId / slotSHA256 = exact real coordinator-issued receipt
workerSHA256 = exact reviewed worker above
transportDrainEvidenceBasis = reviewed_completed_checkpoint_control_path
counterIndependentlyRecorded = false
modelPythonUnloadCallbackNotExported = true
targetDirectoryAbsentBeforeLaunch = true
targetDirectoryCheckedAtUtc <= workerLaunchedAtUtc (both within this issued window)
checkpoint = {jobId, attempt:1, stage:output_ready|completed, observedAtUtc}
serverResult = {jobId, attempt:1, state:SUCCEEDED, observedAtUtc}
workerExitCode = 0; quarantined = false; unknownNativeCount = 0
noOwnedModelProcessSurvives = true
nativeProcessHandles = [
  {role:worker|adapter|descendant, pid, creationFILETIME,
   handleRetainedBeforeExit:true, signalledExited:true}, ...
]
drainVerifiedAtUtc = actual same-run final observer timestamp
```

Both distinct worker AND actual adapter identities must be evidenced, not two launcher
handles relabelled to satisfy a count. Roles need actual worker PID / inferring adapter
PID or verified observed process-tree evidence. All retained same-run identities must
be included; no live/unknown native observation may be dropped. `noOwnedModelProcessSurvives`
means the owned process exits, not an independently recorded Python unload callback,
CUDA allocation measurement or global GPU idle. Unexported numeric/callback fields
`activeProcessesAtDrain`, `actualPeerJobActiveCount`, `modelUnloaded` are refused here.

Producer mapping for AI ACK (these are proposed mappings, NOT already emitted fields):

- Existing start/GO/slot records and fresh preflight must bind goId/jobId/slot, exact
  worker source and actual prelaunch directory absence. Do not infer absence afterward.
- Read the actual new job checkpoint, its attempt/instance/attempt directory and output
  binding. Read authenticated backend-owner result for that exact job/attempt/output.
  Preserve the private raw evidence; never publish lease, input/output digest or OCR.
- Existing observer `nativeFinalSnapshot.records` exposes nativeCreationFILETIME,
  handleRetainedBeforeExit/nativeHandleSignalledExited and unknownCount. Normalize
  those actual fields explicitly; no invented active counter or model unload flag.
- Actual workerExitCode0 and nonquarantined observer completion are necessary, but not
  sufficient without the new checkpoint/backend/adapter chain above. The observer's
  `transportDrainPathReturned` boolean alone does not establish it.

**AI ACK remains PENDING** for the complete available chain and exact mappings,
including prelaunch absence and actual adapter identity provenance. If a producer
cannot supply a required observation, report that missing evidence; do not add fake
fields, weaken the unchanged runtime, or call synthetic validation a native PASS.

## Coordinator-owned closeout, separately required

`validate_coordinator_closeout()` describes a second audit record produced only by
the coordinator's actual post-drain read-only native/resource/process/binding and
canonical lock checks. It is NOT satisfied by peer claims. It requires the same
GO/issued slot, an observation after peer drain, every exact saved PID/creation identity
freshly not live/unknown0, canonical binding verified, nonblocking byte0 acquired and
released, fresh process inventory/no known engine, actual RAM/freeVRAM observations.

Post-run RAM/freeVRAM are observations; preload admission floors are not introduced as
new barriers to revocation. Actual integration must preserve the existing identity-bound
nonblocking lock acquisition and slot/hash check in the withdrawal transaction itself;
a preceding free-lock probe cannot authorize a later unbound write. No nested OS lock,
lock creation/deletion, kernel-check change, kill, retry, owner change or renewal.

## Validation and limits

18 focused synthetic CPU contract tests passed. They cover the complete metadata shape
and refusal of old output, wrong attempt/GO/slot/source, missing backend success,
quarantine/nonzero exit, missing/live/unknown handles, unavailable measurement claims,
and incomplete coordinator evidence. Tests make no native, filesystem evidence,
backend request, process, lock, model or GPU calls. No real PASS follows from them.

V2 source, actual worker/guard/policy/canonical lock/slot/state/approval/admission and AI
helper bytes match the before snapshot. Existing checkpoints/weights/private assets
remain preserved. MSVC/UAC paused; no DB enable, execution approval, new slot, inference,
fitting, render or historical/native-suite rerun.
