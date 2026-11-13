# Phase B exact-job scope: CPU proposal, not installed

Fresh Mac DB/job-readback GO received for one existing queued analysis. The new heartbeat
at 2026-11-13T03:17:33Z (12Nov22:17EST) returned HTTP200, canonical project and sole
garment.analyze capability. All98 reviewed source pins and config52c108ec remained equal.
No worker, claim, model or new GPU slot has started.

The GO also requires an unexpected claimed job to stop before inference. Reviewed transport
claim() sends only instanceId/requestId; --once limits count, not job ID. Existing adapter
worker_admission.verify() binds worker/config/native placement and any valid job directory,
but its strict approval schema has no exact approved-job field. The single-queue DB snapshot
does not itself install an adapter rejection for a different returned job ID. This prerequisite
cannot be represented in the existing exact52c108ec/98-source pins without a reviewed change.

A temporary filesystem-write restriction was explored only on a disposable CPU fixture. The
positive target case failed after inherited permission propagation, and exact fixture ACL restore
required unavailable Windows privileges. The fixture owner's access was repaired normally;
no such ACL change was applied to actual runtime, source, cache, guard or user data. The failed
experiment is not PASS and is not used for execution. No elevation/UAC or GPU occurred.

The matching local worker approval is temporarily disabled to keep this hold fail-closed.
Offline/external-guard approvals remain disabled. Actual candidate/config/source are unchanged.

## Small reviewable alternative

[Proposal patch](job-scope-proposal.patch) adds optional local approved_job_id to the strict
worker-admission policy, validates its canonical UUID and checks it immediately after policy
validation, before environment hints, native probes, image/model work. A mismatch is INVALID_INPUT.
Existing unpinned approval shape remains compatible; today's phaseB approval would explicitly
pin the already authorized job. All existing review/native/lock/parent gates remain required.
No public qint.1 schema, transport, model, image rule or prediction changes are proposed.

The proposal gates new adapter inference. The unchanged transport still claims first and can
reconcile an already cached output without invoking the adapter. It is not a transport claim-
selection or cache-publish allowlist; Mac must assess that distinction against the exact GO.

This patch exists only outside the candidate, is not installed, and is not permission to run.
Actual CPU proposal tests: **8/8 PASS**, 0 errors/failures/skips, no torch import. Mismatch
checks prove that coordinator/lock/native Job probes are never reached, and a matching pin
does not bypass the old admission/review gates. See [result](job-scope-proposal-result.json),
[log](job-scope-proposal-tests.log), [test source](job-scope-proposal-test.py.txt).

Mac must review the exception to the no-source-change execution instruction before adoption.
Adoption would require updated source-manifest/config/approval hashes and the exact job pin,
then relevant Windows regressions. No silent relaxation of the job scope, inference followed
by an ID check, new enqueue/click or automatic heartbeat retry is used. Keep STOP until this
constraint is reconciled and a separately issued finite slot is present.
