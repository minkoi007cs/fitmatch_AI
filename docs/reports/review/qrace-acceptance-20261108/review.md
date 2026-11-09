# Focused cleanup acceptance — CX-QRACE-REVIEW-23

Source579ece2f4d7eb1b5336fec1469d5965ab9d8f919 / codead6d1d7 on codex/qwen-review-fixes; PR13a5ca16d. Read-only detachedworktree; noappedit or externaldatachange.

**QREV-CLEANUP-RACE: PASS focused**. Sourceclaim now takes ownerlocks73→74, tombstones unreferencedpendingreservation beforeexternalremove, refusesready/referencedassets, leases rows withtoken; collector removesclaimedpaths only. Enqueue rejects fencedasset. Abort canreopen completed removal afterlateupload. Reviewer independently reran65unit and10PostgreSQL16blocks exit0 including baselineoldracerepro, collectorwins/enqueuewins,8concurrentenqueuesvsclaim/disjointcollectors/leaseexpiry/lateorforeignreport/dryrun/lateupload/itemdelete. Logsattached. Noexternalstorageremoval; no freshHTTP/lint/build thisfocusedpass. PriorClaudeHTTPmockresults are reported not independentlyrerun. Knownremaininglongupload+appdeathaftergrace orphan requiresreconciliation, notclosed; focusedPASS is notwholeprivacyacceptance.

**QREV-BIND-02: NEEDS CHANGES.** Worker hash4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb exactlyunchangedfrom7631cb0. PCnativefinalACK stillrejects foreignexistingabsolute lock/slot admitted whilecanonicalheld. Cleanupreport saying nativeACKpending doesnotcloseknownnativefailure. Nativeunit/drainpassing doesnotprove canonicalconfiguration. Do notenable realtestcapability until correction+nativeACK.

**Real app→Qwen: NOT RUN.** BothPC CPUonly/noQwenslot. Dedicatedtestenv notestablished. Read-onlyconnectedSupabase inventoryfoundoneproject named smoke-supabase; purposeNOTassumed, ownerquestionpending. NoSQL/migration/tokenread/deploy wasperformed. No newrealGPUgrant.

NextClaude: retain579ece2cleanupPASS, implement canonicalbinding perH-QFINAL-022 andpublishfinalSHA; noqueue/collectorrewriteagain. PC3D publishCPUcanonicalrepro/nativeACK; PCQwen configbridge+testendpointinventory andboundedreallicensedphoto aftergates. AllGPUserializedviaexistingOSlock andboundedslot; 3Dnotpreempted.
