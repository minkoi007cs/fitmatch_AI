# CONNECT-45 — canonical recovery and connection execution

10 November 2026. Owner explicitly requested actual DB backup/restore and direct app→PC/Qwen testing. Codex operates the existing canonical `fitmatch-ai` project; source baseline6ec119a, serving app7397b6a. Branch `codex/connect-45` owns cutover plan/docs. Claude separately owns CL-UX-FIX-46 UI/tests on its own branch; PC owners retain adapter/coordinator ownership.

## Actual recovery evidence

- Saved local administrator configuration is mode600/Gitignored; credentials are never published. Early authentication failures stopped before SQL; owner corrected and saved the file, then actual PostgreSQL17.6 authentication succeeded.
- Pinned SupabaseCLI3.0.0 official role/schema/data dump scripts, actual managed Auth/Storage customizations plus password-free managed-platform definitions, business/catalog fingerprints and all referenced Storage bytes captured privately.
- Consistent read-only exported transaction snapshot shared by schema/data dumps and comparison queries. Previous snapshots/evidence kept; source data never rewritten for testing.
- Two actual buckets,14objects,20,354,806bytes. Size/plain-MD5/every-SHA256 checked. Backup manifest verification:92checksPASS.
- Actual restore target: official `supabase/postgres:17.6.1.166`, digest `sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86`, networknone. Actual managed schema definitions, role options and extensions loaded. Fresh-cluster grantor differs from hosted Supabase; only local platform bootstrap removes explicit GRANTED BY clauses while retaining role membership options. Original backup remains unchanged. Hosted realtime publication provisioned on the local target before restore. No errors ignored.
- Source uses ICUen-US153.121; initial libc target gave order-dependent aggregate hashes. Fresh ICU target now matches **business and all-table fingerprints**, **69COPYtables /340rows byte-for-byte**, and **666catalogkeys /0differences** under identical public/extensions search path. Initial qualification-only catalog differences are retained as failed comparisons, resolved by matching search path rather than changing definitions. The initial theory of live data changes was not proven; locale mismatch explains the aggregate discrepancy.
- On the actual restored copy, reviewed runner dry-run12pending then execute12APPLIED+VERIFIED. All original69tables/340rows remain byte-identical (expected new private fitmatch-v2 bucket excluded),14Storagebytes rehashed. Signup creates fm_users, outfit save/reopen and cross-owner denial passed inside a rolled-back local transaction. Legacy nullable color/style and required style_category preserved; no worker rows created in this proof.

This is actual canonical backup/restore evidence, distinct from prior synthetic rehearsals. Full private backup, raw rows/photos and logs remain under the ignored private backup directory; they are not synced to PC or stored in Git. Supplementary platform role grantor is an explicit local provisioning difference, not a claim of identical hosted services.

## Target and scope review

The owner-supplied exact session host `aws-0-us-west-2.pooler.supabase.com:5432` is allowlisted, bound to canonical username and supported by official project region metadata, successful authenticated backup and matching canonical Storage objects. All other hosts/users/ports/query overrides remain refused. SQL files, schema manifest and worker hash unchanged. Target suite33/33PASS; plan/README/report-only changes do not require a new frontend build.

Canonical runner dry-run exit0: identity migration VERIFIED PRESENT and12wouldapply. Qwen remainsOFF, workers not enrolled, no GPU slot issued at this checkpoint. Actual canonical execution/postchecks are recorded below only after observed outcomes. No schema replay/reset, unrelated app RLS changes, public PC ports, paid resources or concurrent GPU work.

## Parallel readiness

Both existing PC chats acknowledged CONNECT45 preparation. AI reserved an owner-only local token and sent its SHA256 only; raw token remains on PC. Config targets exact HTTPS origin/backend, disabled pending backend readiness and finite coordinator slot. Coordinator publishes existing native evidence and checks actual process-tree quiescence; unknown processes remain a gate. No inference follows merely from this report.

Claude CL-UX41 report-only bundle6968f35 was received and verified; two medium UI findings and copy minors assigned CL-UX-FIX46 with exclusive UI/test scope. Codex checks that active Claude session every15minutes while this execution remains active; no claim of background monitoring after the session ends.

## Canonical execution and postchecks — observed

All12canonical steps APPLIED+VERIFIED, runner exit0. Fresh pre/post business fingerprint equal,14source Storage objects/20,354,806bytes preserved;11V2tables and private fitmatch-v2 bucket exist, private V2functions have no anonymous execute privilege. Deliberate CLI3history adoption exit0 and all13versions read back. SupabaseREST zero-row probes for models/jobs/workers/analyses eachHTTP200. Production Qwenflag remains0. Browser authenticated Prepare now reads the empty3Dlibrary with enabled capture controls and truthful Processor offline status; prior DATA_UNAVAILABLE is gone. Screenshot `/private/tmp/fitmatch-connect45-backend.png` is local evidence, not PC delivery.

One worker registered DISABLED, bound to the sole existing linked owner, capability garment.analyze only, using the PC-held reserved token's SHA256. Rawtoken never transferred to Mac/chat; no app job or GPU inference run. PR10updated85e9d37 native/readiness10files independently checked against SHA256/bytes. Native47executedPASS/9skips preserved. Coordinator snapshot owned-treePASS, globalGPUidle notproven; fresh admission/resource checks still required. PC reported freeRAM below4GiB threshold earlier, so do not lower admission or kill foreign apps.

Follow-up messages with backend/enrollment readiness were attempted after registration; the send call stopped returning and was bounded/terminated, delivery UNKNOWN. Subsequent wait snapshots could not reach remotehost, and fresh thread inventory no longer listed the PC chats. Do not infer worker start, receipt or runtime connection. QwenflagOFF/workerDISABLED remain the safe verified state. User asked to restore PC Remote Control connection; unaffected docs/UI work continues. ClaudeCL-UX-FIX46 separately observedRunning after explicit dispatch; next active-session check due15minutes after14:11:36UTC.


## Activation checkpoint — 14:28 UTC

Fresh thread inventory still has no remote PC chats. Claude UI46 remains Running, observed testing bright hero screenshots390/1440 at the first15-minute check. Do not retry an unknown-delivery start blindly: obtain the PC's actual current worker/config/owned-process state first.

Next operator sequence after reconnection:

1. Reconcile AI and3D receipts with immutable workerSHAef25136b and deployed7397b6a. Confirm the existing reserved token locally matches registered hash, without transmitting token or private configuration.
2. With QwenflagOFF, enable only the existing scoped worker for a bounded heartbeat/backend-identity check; current source strips garment.analyze from stored capabilities while flagOFF. Require HTTPS200, canonical projectRef and a fresh DB last_seen before inference activation. No GPU/model load is needed for this transport check.
3. Coordinator refreshes canonicalpolicy/lock identity, owned-tree drain and actual resource admission. Prior freeRAM below4GiB is a refusal, not permission to reduce the threshold. Obtain one explicit600-second slot for one garment.analyze job; no automatic renewal or overlapping3D.
4. Deploy/review QwenflagON only for the agreed test window; heartbeat must then show the exact granted analysis capability. Submit one owner-approved garment photo through authenticated app UI. Record reserve/enqueue/claim/result/humanreview, duration/VRAM/RAM and non-overlap evidence; do not auto-confirm predicted fields.
5. At window end disable analysis flag/worker and withdraw slot unless owner explicitly chooses continued operation. Preserve actual output for human review and report timeout/failure honestly.

This is a pending execution sequence, not an observed heartbeat, live inference or product-quality PASS. Local rolled-back signup/outfit/two-owner checks passed on the actual restored data; an equivalent real hosted two-account acceptance remains to run.


## Resumed connection and UI review — 17:52 UTC

Owner explicitly approved report publication. Commit7d042ed pushed to codex/connect-45 and exact remote readback verified. Both original PC chats rediscovered and resumed after prior usage limit. Native policy/guard/lock identity and absence of owned engines reported unchanged; freeRAM measurements4,680,658,944/4,612,816,896bytes exceed4GiB narrowly, so refresh before inference. No new model download or native suite rerun.

The existing worker was conditionally enabled with exact token hash and garment.analyze-only grant for one heartbeat. PC-held token remained private. PC reports HTTP200/success/canonicalbackend/grants[] at17:48:24UTC; independent canonicalDB last_seen17:48:27.688Z/capabilities{} confirms transport with QwenOFF. Zero claims/model loads/GPU jobs. Coordinator keeps3Dpaused and can issue one600-second slot only after a fresh admission check and explicit execution window.

Claude CL-UX-FIX46 completed source7edb330/report162a941. Verified incremental bundleSHA9aebda359e8fa274c5414e62bf86cf0279167db870164b9f605d21f83e2431a1; source changes reviewed and cherry-picked as ca3466c79d42f4b8ff273b86d34734ebb8935443. English residual, mobile hero overlay (image remains behind text), plurals, labels/navigation,404 and chips fixed. Corresponding test changes preserve assertions; two new unit tests. Independent121unit/fulltest:v2PASS (real local SQL/HTTP/browser, CPU MOCK), lint0errors with one warning in the unchanged prior report helper. Default Turbopack blocked by sandbox portEPERM; webpack with actual Googlefonts passed after network authorization. Claude stand-in image/nav contrast observation remains a limit, not a live-site finding.

Tracked-only source export (noenv/privatebackup/test-results) staged on Vercel dpl_EK7gxYYHUXsUocAPcGaa5igD7wsE, reviewedCommit/gitCommitShaca3466c, READY/aliases[]. StageHTTP200/EnglishHTML/newmobileoverlay verified. Qwen1 is a deployment-only override for a future bounded test; projectdefault0/public7397b6a unchanged. No promotion or GPU slot yet. Browser control is disabled in Codex Work settings, so owner was asked to enable it or choose manual app testing; do not extract cookies or bypass authenticated UI with service-role writes. Await that choice before promoting the test deployment and allocating the finite GPU window. Real Qwen output/humanreview, physical mobile and personal avatar/tee/jeans acceptance remain NOT VERIFIED.


## Manual test activation attempt — 18:14 UTC

Owner chose manual app testing and requested release/PC execution. Promoted reviewedca3466c QwenON stageEK7gx; canonicalproductiontarget/metadataREADY andpublicHTTP200/newEnglishheroHTML verified. Both PCs acknowledged one-job/600-second window assignment, but coordinator refused before issuing a slot: Windowsfree4,067,241,984bytes and exactQwenpsutil.available4,119,449,600bytes, both below4GiB. Exact deficit175,517,696bytes(~167MiB). No slot/start/expiry, noGPU/modelinference/claim;0analysisjobs in canonicalaggregate. No threshold lowered or foreign process closed.

To close this unsuccessful test window, promoted the already-built sameUIca3466c QwenOFFdeployment dpl_3isoxQrLB2yzL2kpr2KtuGgoEUMm and disabled the existing worker (readbackFALSE). NewUI remains online; Qwenrun remains NOTRUNpendingadequateRAM. Owner asked to close unneededPCapplications and signalready; resources must be measured fresh, not reused from the earlier4.30GiB sample. PCowners retain checkpoint and noautomaticretry or slotrenewal.


## Actual online Qwen run and human confirmation

After graceful Chrome closure (zeroChromeprocesses, restored-tabstate retained) and Claude window closure (ninebackgroundprocesses remained), threeRAMsamples4.565/4.624/4.612GiB exceeded4GiB; laterfreshsamples~4.91GiB andVRAM11434MiB. ChatGPT/Codex/RemoteControlpreserved. Prior usage-limit failures interrupted execution before claim; after normalreset, activeconfig/approval pinned fullappca3466c and immutableworkeref25136b; heartbeat200/canonicalref/grantedgarment.analyze independently matched DB.

PC3D issued one600-second pc-ai slot expiring23:27:14UTC. First launcher refused Windows267invalidcwd withoutcreatingworker; pathfixedbeforeclaim. Job78ff5270-d27e-4e24-9137-d6b5f9dc0399 thenSUCCEEDEDstageREVIEW/attempt1/errorNULLat23:21:13.943884UTC. Canonicalresultproposal/hashpresent/autoApplyfalse/evidence1attempt117tokens86344ms. GPUmetricsinside resultNULL; PCreportedseparatelyobservedpeak5184MiB andRAMmin3.12GiB, notcontinuousinstrumentation. Worker/adapterexit0/allfourheldnativehandlesexited; drainreceiptwritten, afterRAM~4.97GiB/VRAM11430MiBfree. Workerdisabledafteronejob. CoordinatorwithdrawalACKnotreceivedbutslotfiniteexpiryhaspassed; nooldslotreuse.

Owner screenshotandDBconfirmsave: analysisCONFIRMEDfourfields, notautomaticallyapplied. Pipelineclaim/result/review/confirmationPASSforoneactualsample; likeness/3D/quality/performanceSLAremainunaccepted. Asemanticqualityfindingremains: ownerphotoisvisiblyhoodedgarmentbutQwenproposedtshirt/longsleeves/necklineother, thenownerconfirmedcategorytshirt. Do not rewrite confirmed data or call classificationcorrect merelybecausecontractpassed. Unsupported-categoryabstentionneedsPCownerinvestigation. Privateimage/OCRnotpublished.

Secondownerjob7a7362b8-c134-4501-9e91-deef68dd0da2 remainsQUEUEDattempt0, firstCONFIRMED/succeeded. Followupforseparateboundedsecondrunhadunknowndeliveryafterremotehostbecameunavailable. CurrentremotePCinventoryabsent, nosecondinference/newslotclaimed. SameUIQwenOFFpromotedagainwhilewaitingforreconnection; existingworkerFALSE. OwneraskedreconnectPC; queuedinputretained.

## UI47 integration in progress

Claudecompletedfcc23e0/datedreportandbundleSHA03d11b0d404f8c8d63815bbd8ce9c121f4830905eadfc239a76b779b101d713e verified. Code dd3071d reviewed/cherry-picked7a441b5, thenf580247 keepswardrobecards1columnbelow380px. ScopeNavbarphoto contrast, analysisfocusafteruseractions/buttonsize/wrapping/saveguidance/labels/retrylimit plusbrowserassertions. Allrawvalues/actions/auth/SQL/workerunchanged. Prior1.2contrastmeasurementpartlyincorrectduetotransition; Claude correctedbaseline2.37minandnew8.99–12.43(stand-inphoto). Independent121unit/lint0errors(1oldreporthelperwarning)/webpackrealfontbuildPASS; finalfullV2pending, nofinalreleaseclaimyet. NewUIstagedwithQwenOFF, neverenablesGPUbyUIrelease.


## UI47 released

Finalsourcef58024703bf4ec8be365bee2f8b3e1bd2248fdec independentlypasses121unit/lint0errors(oneunchangedpriorreporthelperwarning)/webpackwithactualGooglefonts/fulltest:v2exit0. ActualbrowsercheckscoverfocusafterAnalyze/Retry/Save/Close, 36pxbuttons, nounclippedSave/Dismiss at320/390/820/1440, Navbarlandinggradient/lightlinks and1-columnwardrobebelow380px. Syntheticbrowserimagesreviewed;notactualownerphotoquality. NoSQL/worker/queuechanges.

Promoted dpl_ULqpC5fUMQewETvcnCQ1sjpRLXxz READY, exactproductionfullSHAreadbackandpublicHTTP200/EnglishheroHTMLPASS. QwenOFFoverride, existingworkerdisabled. AstaticSSRassertionforhydratedheaderclasseswasinvalid(initialSSRsolidheader), notcalledPASS; hydratedbehavioriscoveredbyactualbrowserregression. Localinteractiveproductionbrowserwasunavailable, so nofakeproductionvisualclaim. Firstanalysisconfirmed4fields; secondqueued0waitingPCreconnect. Remainingsemantichoodieclassificationissueandpersonal3D/physicaldevicegatesnotclosedbythisUIrelease.
