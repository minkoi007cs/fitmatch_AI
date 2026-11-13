# QWEN-48: actual private offline regression

One authorized existing private input was tested once on 12 November 2026. The actual result
was **abstained / unsupported_category**, with null attributes, no OCR candidates and
approvedForAutoApply=false. Mac accepted this single unsupported-scope regression. This is
not evidence of general classifier accuracy, supported-category quality or full 3D acceptance.
No image/OCR/raw response, private path or source-image digest is published.

## Actual timing and resources

- One schema attempt, 19 output tokens, wire duration **85,250 ms**.
- Canonical guard start 17:26:04.069830Z, completed 17:27:30.706493Z: **86.637 s**.
- Admission to model-loaded event 80.375 s; admission to cleanup 85.250 s.
- Model monitor peak RSS 1,853,636,608 bytes; minimum host available RAM 3,927,523,328 bytes.
- Torch peak allocated 4,437,815,808 bytes; reserved 4,527,751,168 bytes.
- Device usage peak observed by nvidia-smi 5,103 MiB (includes other device usage).
- Final observer sample: available RAM 5,825,925,120 bytes; VRAM free/used 11,409/702 MiB.

These are one-run measurements. The minimum during model execution does not replace the
unchanged 4 GiB pre-load admission requirement. No repeated benchmark/SLA claim is made.

## Actual native lifecycle and withdrawal

The real helper selected AnalysisBackend48 + wire.execute under external_guard_owns_byte0.
The named Windows Job reported allJobProcessesExited=true, activeProcessesAtDrain=0 and
guard exit0 at17:27:30.706493Z. Four retained actual native process handles all signaled exited
with code0, including guard/helper launcher and actual interpreters; no owned process remained.
The model cleanup event was recorded before result publication and final helper/guard exit.

PC3D independently retained four process handles, queried five saved owned identities with
0 live matches, observed the named Job absent, and acquired/released the free canonical
byte0 for withdrawal. The actual slot was shortened only at admitUntilUnix to
17:29:17.143123Z, verified17:29:17.188640Z. Canonical slot SHA256:
`cec3b66bd522e011622a178d5bbbf114d6684111c7c700a8cc3e2a11fcf4061f`.
Actual bytes/hash/volume/file identity/UTC were read back on PC; both validators refuse expiry.
Policy, guard and canonical lock identity/bytes remained unchanged. Global GPU idle is not claimed.

Offline and guard approvals were disabled only after proven drain. Worker approval stayed
disabled throughout. No HTTP, heartbeat, claim, database POST, confirmed-result/cache overwrite,
second regression or slot renewal occurred. Private result/input and executed approval snapshots
remain on PC. See [sanitized actual receipt](offline-actual-result.json).

## Separate remaining app-job readiness

The same reviewed candidate and full app SHA f58024703bf4ec8be365bee2f8b3e1bd2248fdec are
retained. All98 source pins were independently rechecked. Prepared config SHA256 remains
`52c108ec8afd8c77be0283e5dfe49ea5dfffed8099c901d9b9ddec7ee831e6f9`;
the matching worker-held approval remains disabled, backend preflight pending. No external
guard wraps the future worker. See [CPU readiness](worker-cpu-ready.json).

STOP until a fresh explicit backend/worker-enabled signal authorizes exactly one bounded
heartbeat check. After canonical backend and sole garment.analyze grant are verified, a
separate fresh PC3D slot plus Mac worker GO is required for --once at most one already queued
job. No new upload/click/enqueue or reuse of the withdrawn offline slot is permitted.
