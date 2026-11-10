# CX-CLAUDE-PC-HANDOFF-30 - latest reconciliation

## Claude

App branch codex/canonical-migration-26 now points to **0c4c44ea518453b823af50b2b5b0f4f8b0b65878**. Implementation remains cf902d3. The delta from847aeea changes only report/logs: run1 log renamed, run2 added, status updated Ready for review.

The full run2 log was read: npm run test:v2 exited0, including QINT browser proposal/confirmation, worker/backend/binding, cleanup race and legacy outfit assertions. This supersedes the old statement that the rerun was interrupted. The first 15s browser timeout is retained, its cause not identified; one successful rerun does not root-cause it. It is implementer-reported PASS with a real log, not an independent browser rerun by Codex. Do not assign a redundant UI rewrite or repeatedly rerun unchanged suites without a reason.

Prior independent 76-unit PASS and 12SQL/manifest hashes remain bound to unchanged implementationcf902d3. Runner SHA256 is unchanged: b7273a39152cc573b24a6ce21089b02ff97207704454a5ce91194a4a841067a2. Therefore **R-MIGTARGET-29 remains open**, despite the green existing suite: arbitrary host accepted by project-suffix username before fake psql. See [original proof](./claude-checkpoint-847aeea.md). Hosted execution remains NEEDS CHANGES.

PR15 remains a docs/report PR into operations; use the app branch for code review and any future app preview. Cloud apply, backup/PG17 restore proof, reviewed serving HTTPS revision, scoped enrollment and real Qwen still have no completion evidence.

## PC - real chat progress now available

Both existing chats were read after compact snapshots became available. These are PC agent reports, not Codex artifact reruns:

| Chat | Completed/reported evidence | Outstanding |
|---|---|---|
| 3d model | Original worker suite46PASS/9skip/1ERROR; supplementary18native cases completed, including copied-policy refusal while canonical lock held, aliases, swapped lock, junctions and signaled-handle drain; existing policy created from actual lock and checked | Save/publish local logs/probe/fixture proposal, fix original suite fixture with app owner, rerun exact received patch; no GPU grant |
| AI model | Same original suite46PASS/9skip/1fixture error; supplementary4/4native cases; adapter/JSON/schema/error mapping70/70 without torch; independently verified 3D policy, native scoped binding ACK saved locally | Save/publish bridge/config changes and sanitized evidence; consume app owner's fixture patch; serving backend/HTTPS readiness |

Both latest turns terminated with usage-limit systemError. This replaces earlier mere host-unavailable status: messages did reach the agents and substantial CPU work was performed, but final GitHub handoffs were not published. PR9/10 heads are still3f59cd24/32267169. Do not claim agents are currently working, code is saved remotely or GPU is idle.

**Subsequent dispatch:** after publishing H-RESUME-30, both PC-SAVE-30 messages returned success and compact snapshots show new turns inProgress on both chats. AI model explicitly acknowledged and is packaging sanitized local source/evidence forPR9 without model/test reruns. 3D is active after delivery; specific execution receipt pending. This supersedes the initial stopped-turn status above. Final publication/completion has not yet been verified; no GPU grant was issued.

Policy reported by both: SHA256 **789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039**. Existing guard SHA47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c. Existing worker LF SHAef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6, unchanged bycf902d3. This is a scoped binding ACK only; no slot or integrated GPU permission. Do not recreate policy/lock after resume merely because another chat starts.

## NATIVE-FIXTURE-30 - precise remaining test defect

Both PCs report Windows refusing copytree's read of the canonical lock byte while the test itself holds it. In scripts/worker/test_worker_unit.py, test_copied_coordination_with_identical_policy_refused_while_canonical_held calls self.copy_workspace() after holder.acquire(0), so it errors before its binding-refusal assertions. This does not demonstrate a production binding failure.

PC3D made a test-only proposal in a disposable copy: prepare the copied directory before acquiring the canonical lock; keep canonical lock held throughout SharedGpuAdmission refusal and split-lock-free assertions. The targeted adjusted test reportedly passed, original checkout unmodified. Supplementary matrix retains that important locked-canonical condition. Nine skips must remain explicitly reported with reasons; do not silently call the original suite all-PASS or remove security assertions.

Local evidence locations to recover on PC, without moving images/weights/secrets:

- Fitmatch-GPU/reports/pc-bind25/native-matrix-001 and reports/pc-bind25/copy-fixture-proposal-targeted.log.
- Fitmatch-GPU/fitmatch_AI/workers/windows/proposals/worker-bind25-copy-before-lock.patch.
- Fitmatch-GPU/coordination/gpu-coordinator.json and scoped ACK files (keep private paths/config private).
- Qwen docs checkout fitmatch-pc-ai-01-docs: docs/reports/pc/qint-p/bind25-native.md, bind25-worker-test-proposal.patch.txt and qint-bind25-process.md; source bridge files in Fitmatch-GPU/ai-service/qint_p. Git state must be inspected before any staging.

## Assignments and gates

Claude/new app agent continues APP-RESUME-29 as **APP-CLOSE-30**: retain0c4c44e; fix R-MIGTARGET-29 and test-only NATIVE-FIXTURE-30, add regressions, review cutover/backup plan and publish source/report for Codex. Do not redo auth/outfit work or assume existing tests cover the new target guard case.

PC continuation **PC-SAVE-30** is checkpoint preservation/publication first, then exact test patch/native acknowledgment when execution capacity is available; no new GPU load. Existing source ownership remains. Real Qwen only after reviewed cloud/recovery/HTTPS/scoped-worker and native gates, a finite pc-ai slot from3D, shared canonical OS lock byte0 through owned-tree drain, no nested adapter lock. No app/cutover/GPU action was performed by this reconciliation.
