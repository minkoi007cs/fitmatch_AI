# QREV re-review — CX-QREV-RECHECK-21

08/11/2026. Source7631cb00114ddf559c234f1c0f13285dbb7305ab, codebf0b6d712a50c3aa15a03362a26d32a9aba47eaa on codex/qwen-review-fixes. Read-only separate checkout; no app source changes, no deploy/migration on external projects. Claude PR12 report59f02cf reviewed against actual code.

## Disposition

- **QREV-LOCK: source fix accepted, native/config ACK pending.** Explicit absolute existing lock, guardhash and finite slot validated before claim; single worker lockowner and tracked-handle drain. Public placeholder intentionally refuses startup. PC must bind exact actual coordination lock/guard/slot paths, test original39unit/native and mismatch refusal on this revision. No environment-only proof or nestedlock accepted. No realGPU release acceptance from Mac tests alone.
- **QREV-QUOTA: PASS focused code/PG tests.** Shared20active/50UTCday/100assets24h, ownerlocks73→74, enqueue recheck, active retry guard, dedupe-first. Six enqueues against17active admitted3.
- **QREV-SNAPSHOT: partial fix; NEEDS CHANGES QREV-CLEANUP-RACE.** Durable pending reservation/intent before upload, compensation/loser protection fixes original untracked orphan cases. But due-query is a nonclaiming read and external deletion can race finalize as reproduced below.
- QREV-STATUS source change and existing HTTP tests reported; current reviewer did not rerun HTTPbrowser. gpuBusy only own online workers, no crossowner disclosure in reviewed query.
- **Real integrated Qwen: NOT VERIFIED**, no testcapability grant approval yet. PC native/adapterACK, cleanup race fix and dedicated authenticated reachable testenv remain.

## New P1 QREV-CLEANUP-RACE — deterministic interleaving on PG16

1. Reserve synthetic analysis snapshot; a pending asset and pendingcleanupintent exist. Set intent due (models elapsed grace, not real wallclock wait).
2. Call fm_v2_source_cleanup_due: collector caches path. This RPC does not claim/tombstone/fence the reservation.
3. Call fm_v2_analysis_enqueue before collector storage.remove: succeeds, asset becomes ready, cleanupintent deleted, analysis/job published.
4. collectSourceCleanup still iterates its cached paths and calls storage.remove without rechecking or claiming. Snapshot backing the ready analysis can be removed. Later cleanup_report returns updated0 because enqueue deleted intent.

**Reviewer reproduced DB ordering/path eligibility and readyasset/nointent/late report0**. No external storage deletion was performed; actual destructive outcome follows directly from collector source lines invoking remove on cached paths. Not a user data-loss incident. Grace-period delay reduces frequency but does not prevent the race.

Repro: use original pinned scripts/test-v2-db.mjs; inject race-probe.mjs.txt immediately before outer finally and keep import.meta resolution pointing to original script's location. Execute on disposable DockerPG16. race.log records the result after all9baselineblocks. Initial copy under/tmp failed relative migration resolution (ENOENT); corrected harness baseURI then rerun exit0. Source app untouched.

Required fix: atomic collector **claim that makes reservation permanently nonfinalizable before external remove**, same synchronization as enqueue, durable retryable removal ownership/fence. Enqueue must refuse once collection claimed, and a ready/referenced snapshot must never be eligible for such claim. A final read before remove alone does not close the race. Retain dry-run behavior, existing original-source intents, retries and duplicate collectors. Test both orderings: collectorwins→enqueue refused; enqueuewins→collector never removes; lost remove/report replies, late upload and concurrent itemdelete. No globalcleanup executor activation.

## Independent verification

- npmtest64/64, Python39/39 Mac, lint exit0.
- test:v2:db9PostgreSQLblocks exit0; QREV quota/failurecases exercised.
- reviewer race injected into same fullDBrunner exit0, reproduced above.
- Default npm build failed because linked node_modules is outside Turbopack checkoutroot; infrastructure layout, not claimed app regression. Alternative npm run build -- --webpack completed exit0 (webpack-build.log); this is not default Turbopack verification.
- No new HTTPbrowser/nativeWindows/QwenGPU/HTTPS/Supabase run; no productPASS.

## PC appearance status

PC9557ae3 report: tinyobjloader rc13 wheel + available Microsoftruntime load originalSiTHOBJ paths onCPU; xatlasunwrap1.12s withoutgeometrychange; neither yields identity/texture. nvdiffrastCUDA still needs MSVC+WindowsSDK; Admin/UACpause retained. Actualfit/debugGLB are estimatedbody, no likeness/hair/texture. Compiler unblocks rasterizer/build, not guaranteed identity. Current singleimagecropped belowhip/hiddenback cannot ground bodyheight/hiddenparts. Need actual appearance/reconstruction+UVbake run and separate face/hair/identity strategy with front/side references and humanreview. No new heavyweight model selected/downloaded or privateimages published.

## Next handoff

Claude retain all QREV fixes, repair collector race with evidence. PC3D/Qwen already directly requested exact7631cb0nativeACK/bridge in parallel; no GPUnewgrant or MSVCpermission escalation. Testenv remains required, no using production by default.
