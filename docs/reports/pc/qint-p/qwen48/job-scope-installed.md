# Reviewed exact-job gate: CPU installation complete

**99/99 Windows CPU tests PASS. All approvals disabled; execution paused.**
Mac accepted the job-scope proposal at183923b and independently reconciled its newline hashes.
Only the reviewed worker_admission.py patch was installed in the isolated qint_p_qwen48 candidate.
Original qint_p and the prior candidate/config/manifest/approval bytes remain preserved privately.
No further adapter source or test source was installed in the candidate.

## Exact source representation

The original PC proposal writer produced CRLF bytes, while GitHub stores the LF patch.
These are deliberately different raw hashes, not a claim of byte-identical publication:

| Artifact | LF SHA256 | CRLF SHA256 |
|---|---|---|
| Reviewed patch | `1fd343ed9b2f8f84be169a90378544d66d3bbcc67505c2448cb12489ebe8969e` | `24bc102bf7572e233752f2904db3cdfc6bc08315670bee7e0aca74ee74fcb876` |
| Reviewed resulting admission | `bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37` | `9809179982a3f08d9aeed8744de4c16f9d537299aa1bb8a4f5029d0e591a3e04` |

The installed source is **LF**, raw hash bbbee777... as independently computed by Mac.
The first CRLF patch check refused against the LF baseline and made no source/pin changes.
After the explicit hash reconciliation, the LF patch check/apply passed and its resulting raw
source hash matched. The old proposal receipt now labels its Windows CRLF digests explicitly.

## Actual compatibility and policy checks

Actual Windows Python3.10.22: **91 existing compatibility tests +8 job-scope tests =99 run,
99 PASS,0 failures,0 errors,0 skips,exit0**, no torch import. The eight job-scope test cases
were rebound to the actual installed candidate admission module; its module path and raw
bbbee777... hash were asserted. They did not continue testing only the separate proposal copy.
No positive fake native proof was used for real execution; no real execution occurred.
See [actual receipt](job-scope-installed-result.json) and [test log](job-scope-installed-tests.log).

The same98 source/schema entries remain pinned; exactly one runtime source hash changed.
The private worker policy pins the already authorized queued job using canonical approved_job_id.
Mismatch refusal occurs before native probes or model work; old review/parent/Job/byte0/
coordinator/backend gates remain. The local gate constrains adapter inference; transport claim
selection and cached-output reconciliation remain unchanged and require the normal exact queue
preconditions at any later execution GO.

## New private pins, all disabled

- Runtime manifest: `d79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e`.
- Active config: `643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31`.
- Worker approval: `4a8f39f3d6a3cbe3fd822943614bded7f2b3e2c0284bcd86c93f334e0ae2968b`.
- Disabled offline approval: `d4195486b7d98ee4bc8b258e21d8c71767df2c8a64766a107b4b69d680aea7cb`.
- App remains `f58024703bf4ec8be365bee2f8b3e1bd2248fdec`; backend preflight is PENDING.

The manifest/config/worker policy and disabled offline metadata were repinned consistently.
Current worker/offline/external-guard approvals are all FALSE. Historical executed approval
snapshots from the successful offline run are preserved, not rewritten. Source-photo, token,
env, weights, transport, public qint.1 schemas and canonical policy/guard/slot/lock are unchanged.
No private paths, photo/OCR, source-image hash, raw credential or token hash is published.

STOP. Mac reports the DB worker disabled and prior GPU GO paused while PC3D has no available
coordinator window. No heartbeat, claim, GPU, slot write/renewal, coordinator takeover, model or
account change, reset-credit use or purchase occurred. PC did not mutate the queued job.
Its latest pending/attempt0 state is Mac-reported, not a fresh PC database query. Reuse the
retained input/job after final source-pin review and coordinator availability or explicit
operational handoff; no new upload/click is needed. Separate Blender work is outside this scope.
