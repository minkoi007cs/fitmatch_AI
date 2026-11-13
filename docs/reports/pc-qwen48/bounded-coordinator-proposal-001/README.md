# Review handoff — sanitized snapshots, not executable authorization

Original private script SHA256: `821c16757f84bd061968ac711fc206767685be0d55e86ecc04b50613acfc5d8a` (unchanged).
The snapshot below differs by exactly two privacy literal replacements:
R1 is the private approved job identifier; R2 is a private saved-native receipt lookup.
The private restore map stays outside Git. Root already holds the target job/receipt;
restore those literals and verify original SHA before accepting the private source.
No other implementation line is changed. Generic workspace layout stays visible for review.

Read `bounded_coordinator.part-01.txt` then `bounded_coordinator.part-02.txt`;
each is below14,000 characters, concatenation equals the sanitized main file exactly.
`source-manifest.json` records their line ranges/bytes/hashes. The main file is also present.
Do NOT run the sanitized script as a coordinator. It contains placeholders, and its copied
location differs from the private program's intended workspace layout.

Focused tests change only the import filename to the sanitized snapshot. They exercise
metadata/control predicates, never OS native/GPU/slot actions. Private original11tests
and expired-control exit75 are preserved; the copied11tests were checked after sanitizing.
No broad historical tests, current resource sample, issue/withdraw invocation or approval
request ran in this publication task. DBdisabled/noGO. Code/schema review remains pending.

Important open review gate: root/AI must ACK that the drain receipt fields below come
from actual same-run native Job/unload/retained-handle evidence; missing evidence => HOLD.
This is private audit evidence, not a new server/worker transport or API version.

Actual OS approval UI for `issue --execute` may be prepared ONLY AFTER root code review,
with the reviewed original private SHA and fresh operator/backend prerequisites. No old
readonly permission is repurposed. Root manages timing/new GO; this publication grants none.

---

# Review proposal — two bounded calls, no resident Python coordinator

**NOT RUN with a new execution GO. GO155 expired at 14:00 UTC. DB worker is disabled per Mac.**
This is PC3D coordinator report-scope preparation, not a worker/transport/model change.
No existing approved native/readiness script has been altered. No new slot or GPU.

1. `issue --execute`: in ONE approved OS invocation, validate fresh operator GO/deadline,
   backend heartbeat, all98 source pins, current exact job approval/config, offline flagsOFF,
   actual saved native identities/process inventory/Job, RAM>=4GiB/freeVRAM>=8GiB,
   policy/guard/canonical stat-fstat-Win32 identity; nonblocking acquire canonical byte0,
   recheck GO under that lock, write exactly one finite600s slot using existing reviewed
   guard `validate_slot`/atomic `write`, then RELEASE and EXIT. No AI launch or watcher.
   Root must observe process **exit0**, not just stdout, before relaying start to AI.
2. After the actual reviewed worker `--once` finishes, `withdraw --execute` in a separate
   approved bounded invocation validates the actual same-run drain receipt, queries each
   real saved native identity, checks free canonical byte0, and shortens only the existing
   deadline. No new owner/grant/renewal. Missing proof/live/unknown/quarantined => HOLD.

This split preserves the AI launcher's existing other-Python interlock. Never broaden
its allowlist or wrap the worker in the external GPU guard. The coordinator takes byte0
only for its own short allocation/withdraw transaction, never while AI runs. Current
constants pin the approved private job, appf580247, admissionbbbee777, manifestd79a0738/config643b8b47,
workeref25136b, policy789426, guard47331 and lock3699583840/2251799814103012.

## Exact future commands — root review/new GO required first

```powershell
& '<workspace>\envs\qwen-vl\Scripts\python.exe' -B '<workspace>\reports\qwen48-bounded-coordinator-v1\bounded_coordinator.py' issue --execute --go '<workspace>\coordination\qwen48-next-operator-go.json' --out '<workspace>\reports\qwen48-next-window-issue'

& '<workspace>\envs\qwen-vl\Scripts\python.exe' -B '<workspace>\reports\qwen48-bounded-coordinator-v1\bounded_coordinator.py' withdraw --execute --issued '<workspace>\reports\qwen48-next-window-issue\issued.json' --peer-drain '<workspace>\coordination\qint-p-qwen48-worker-owned-drain.json' --out '<workspace>\reports\qwen48-next-window-withdraw'
```

The GO file/output folders do not exist yet. Use unique fresh paths for a new reviewed
window; existing evidence is never overwritten. This script must be reviewed before
execution. Because sandboxed native queries returned WinError5, actual issue and later
withdraw may each need owner Allow/Approve for their exact command **outside sandbox**.
Previous readonly-script approval does not authorize these slot writes. No OS Admin,
UAC, driver/restart, policy weakening, process kill or sandbox-disable command is used.
No execution approval is being requested while there is no valid GO.

## Operator GO audit schema — not a server/API or authority inferred from heartbeat

Root/PC records a real fresh operator instruction as JSON, not the expired control file:

```text
kind = fitmatch.qwen48.operator-go.v1
phase = worker-single-job
goId = unique safe nonce (letters/numbers/-/_)
jobId = exact reviewed<root-reviewed-private-job-id>
appSHA = f58024703bf4ec8be365bee2f8b3e1bd2248fdec
pins = exact PINS dictionary in source
backendReady = true; oneEligibleJob = true
issuedAtUtc / issueBeforeUtc = real new GO; maximum600s issuance window
heartbeatNotBeforeUtc / heartbeatReceipt = exact fresh CPU preflight receipt
previousSlotSHA256 = actual last withdrawn slot hash, not a bootstrap/delete
slotSeconds=600; engineSeconds=240; drainSeconds=30; autoRenew=false
```

Heartbeat must actually report HTTP200/canonical ref/solegarment.analyze/current config
and manifest, no model/claim, age<=180s. GO is rechecked with a two-second safety margin
immediately before write under bound byte0. Metadata predicates passing are NOT admission.

## Same-run drain evidence — root/AI producer ACK required before live use

The private observer receipt must have these fields, derived from actual reviewed worker,
model teardown and native observations; NEVER fill them from mocks or assumptions:

```text
kind=fitmatch.qwen48.worker-drain.v1
jobId / slotSHA256 / workerSHA256 = the actual same issued run
allJobProcessesExited=true; activeProcessesAtDrain=0 (integer)
ownedLiveCount=0 (integer); quarantined=false
modelUnloaded=true; allRetainedHandlesExited=true
nativeProcessHandles=[{pid, creationFILETIME, signalledExited:true}, ...] (>=2)
drainVerifiedAtUtc = actual current native drain timestamp
```

If the existing producer uses different field names, root/AI must reconcile the evidence
contract first. No transport/engine edit is made here; absence of actual Job0/unload/exit
evidence deliberately blocks withdrawal. Exit code alone is not proof. No old phase-A
guard state is accepted as phase-B worker Job proof. Native process AccessDenied/unknown
is a HOLD, not an alternate-check workaround. The script does not kill or wait indefinitely.

On any error after an allocation write, retain `slot-applied.json`/`hold.json`, inspect the
actual slot and do NOT retry issuance. A running worker still owns its own OS lock; this
program never releases another handle or preempts/quarantines a live tree.

CPU control tests are synthetic metadata-only. No actual native/slot/model PASS follows.
