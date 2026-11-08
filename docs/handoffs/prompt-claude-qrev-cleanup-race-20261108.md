# QREV final correction before real test

Read onboarding and docs/reports/review/qrev-recheck-20261108/review.md. Continue ownbranch from7631cb0/actualdescendant, keep all fixes. QREV-LOCK sourceaccepted/nativepending; QREV-QUOTA focusedPASS; SNAPSHOT originalorphansfixed but collector/finalize race reproduced. Claim app/SQL/collector/tests scope viareceipt.

Reproduce reviewerfragment, then implement atomic collectorclaim that fences reservation from enqueue BEFORE externalremove, using same synchronization; ready/referencedwinner must never beclaimed. Rechecking a path beforedelete without durableclaim does not close TOCTOU. Keep durable retries, original-sourcecleanup, dryrunnoeffects, duplicatecollectors/lateupload/reportloss andownerboundaries. AddmeaningfulDB+HTTPcollectorinterleavings and runregressions. Noenablecollector/prod/externaldeletion. Bàn giaoSHA/diff/log choCodex reviewfocused. Coordinate exactnewworker7631cb0nativePCACK independently; do notchange adapterwire unnecessarily.

Afterfix+review+nativeACK, nextaction is one licensedphoto browser→authenticatedtestAPI→PCQwenreal→humanreview under sharedlock, plusnocrossowner/noGPUoverlap proof. Dedicatedtestendpoint/project/credential missing must be stated exactly, never bypass with publicPCAPI orprodproject. No repeats of generic mock plumbing to label realPASS.
