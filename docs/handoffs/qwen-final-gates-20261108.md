# H-QFINAL-022 — cleanup + canonical GPU binding → one real test

Chủ dự án giao review và nối Qwen thật vào app chạy thử, dùng GPU tuần tự với3D. Đọc onboarding đầy đủ và processlatest. Không làm lại model/env/weights/checkpoints. No productiondeploy/migration/publicPCport/paid/AdminUAC.

## State at inspection

- Claude QRACE receipt exists at docs/claude-CL-QRACE-20261108-01 ceae68b5d4cf45eb594fc242d777b256d5693b4e. It claims collector atomicclaim/token/fencing/lateupload scope, but only receipt is published: no final code/report/tests. App codex/qwen-review-fixes still7631cb00114ddf559c234f1c0f13285dbb7305ab. Not claiming Claude stopped or has no local work.
- QREV-CLEANUP-RACE remains reproduced/notclosed until newdiff +independentretest. Do not rerun unchanged64/39/DB9 to label fixed.
- PC3D059e63cac040d8658724d45b1437e643c511c4e6: native39tests34PASS+5POSIXskip,7startuprefusals andprocesshandles/drain probes pass; actualstandardlock exclusion passesbothways. **NEW QREV-BIND-02:** foreign existing absolute lock/slot config admitted while canonicalGPUlockheld. Qwen independentlyconfirms; bothfinalACK NEEDS CHANGES.
- Prior reviewer sourceaccepted QREV-LOCK was provisional/nativerequired; nativefinding supersedes that limitedacceptance. Drain success does not approve canonicalbinding.

## Claude — preserve active QRACE, add scoped binding correction

Continue current QRACEwork; do not restart or overwrite. Keepallfixesfrom7631cb0. Publish early sourcecheckpoint/finalSHA then report; externalClaude tool endpoint not available, owner forwards this prompt.

1. Finish atomiccollectorclaim/tombstone BEFORE externalremove, fencedreports/retry/dryrun/winnerprotection/lateupload, both collectorwins/enqueuewins tests per priorreview.
2. **Additional scopedhandoff QREV-BIND-02:** appworkertransport/configvalidation/tests/runbook now included. Merely requiring anyexistingabsolute file +selfdeclared guardhash/slot is insufficient to prevent accidental splitlocks. Bind worker to the coordinator's approved canonical lock/slot/guard locations (one fixed sourceoftruth, pathidentity rules resolving aliases correctly) and pinnedrevision; do not trust alternate paths just because config names them. Coordinate exactshape with PC3D/Qwen, no unilateraladapterwirechange. Test existingforeignlock andforgedslot with realstandardlockheld: refusal beforeclaim/spawn/CUDA. Wrongnonexistentpath testcase alone is insufficient. No nestedlock; worker soleowner until actualtreeexit.
3. Newsourcecheckpoint +meaningful tests/logs. NativeonWindows remainsPCowned. PreserveUI/status/quota/retention tests; reportactualSHA andJSONcontractunchanged/hashdelta. FeatureOFFdefault; no testgrant until reviewer+nativegatePASS.

## PC3D — validate final source and coordinate GPU slot

Preserve059e63/findings, publish sanitized runnableCPUforeignlock/slotrepro or giveprivatefilehash+exactinstructions via existingreports, so Claude canretest. Do notmodifyClaudeproductiontransport. Whennewsourcepublished: nativeunit/actualOSlock/trackedhandles pluscanonicalbinding matrix, ACK exactpath/hash/singleowner. No arbitraryguardfile substitution. Duringwaiting CPU dependency/captureprep only; nofitrerun. Current3Dsource/preview/weightsprivate. Once allcode/nativegatesPASS andtestendpointconfigured, checknoactiveGPUownedtree, createboundedpc-ai slot via coordinator then ACK toQwen; OSlock stillrequired, never preempt3D or clearheldlock. AfterQwenexit confirmdrain before next3Dslot.

## PCQwen — CPU adapter ACK → real licensed-photo slice only after gates

Keep CPU-only while no finalreview/nativePASS. Compare newtransportSHA and schemahash to bridge, reject oldreceipt/pathmismatch/foreignslot beforeCUDA. Shareexactcanonical receipt with3D. Inventory whether a dedicatedtestHTTPSendpoint and scopedworkertoken are ALREADY configured: report only present/missing and project/testlabel, nosecretvalues. Do not assume productionenv is authorizedtest.

After Codexclosedcleanup+binding and PC3DnativeACK: existingpinned4Bmodel/runtime, workerheldlock/directadapter (no nestedguard), licensedfixturefirst. Authenticate app→enqueueoneanalysis→PCclaim→load/infer→boundedresultschema→browserhumanreview/confirm, recordjob/result/modelhash/timestamps/resources/unload. Never use the user's personalportrait to substitute for garmenttest. Assert GPUcriticalinterval nooverlap with3D; busycasequeuesanddoesnotclaim/spawn/CUDA. Noendpoint/credential => reportexactmissingprerequisite, completeCPU/configtasks; do not startfakeintegration oropenpublicPCAPI. No broadbenchmark/newweights.

## Codex gate and evidence

Newappdiff/claimracebothorderings +canonicalbindingnative logs reviewed beforecapabilitytestenablement. Existingunit/DBPASS are regressionevidence only. Browser→realQwen→confirm must be explicitlyreal, noCPUmock. Conditionalnexttask is authorized; it is not a declaration ofPASSorpermission toskip unmetgates. Productionmain untouched.
