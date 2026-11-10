# Mac completion plan — 06 November 2026

**Current reconciliation — UI-UX-39, 10/11/2026:** source retains499ead0 plus recoveryba94505 and the UI release oncodex/hosted-38. Status updates describe implementation/local evidence, not hosted migration or personal-quality acceptance. See [current UI/release audit](reports/review/ui-ux-20261110.md) and operations process for serving revision.

Owner: Codex integration, following user instruction to complete work while PC progresses. Baseline 48f66f9 on codex/full-look-reviewed. Continue this branch; preserve canonical Studio. Claude has handed off C0–C3; no new concurrent UI assignment is assumed without receipt. PC remains owner of engine/adapters and native GPU verification.

## Ordered work and acceptance

| Package | State | Deliverable and acceptance |
|---|---|---|
| MAC-14A recovery presentation | Implemented, tested | Failed/canceled reconstruction remains visible in Studio; category lookup rejects prototype names; source-deleted errors explain recapture. Unit regressions + lint/build. |
| MAC-14B fitting regeneration | Implemented, tested | Explicit new generation after exhausted attempts, preserving old versions and saved looks. Same request id dedupes, new request may create generation only after prior terminal failure; quota still enforced. DB concurrent requests, owner isolation, stale completion and tombstoned-source tests required. |
| MAC-14C engine version policy | Planned | Pin engine revision at creation and make cache generation distinguish revision; existing ready assets stay viewable. Never auto-run all wardrobe items after engine upgrade. Coordinate PC revision contract first; additive migration and populated-DB regression. |
| MAC-14D expired asset recovery | Implemented/tested CL-URL-01 | Refresh a signed URL once for the same model/version; hash remains pinned. Abort stale selection; no inference triggered. Test expired links, changed version/hash, network failure and selection races. |
| MAC-14E privacy completion | Cloud cleanup intent/retry implemented/tested; PC retention remains | Audit tombstones versus staging copies, duplicate source references and saved derived assets. Keep collector dry-run until exact deletion policy reviewed. PC cached-source deletion needs PC implementation/receipt. |
| MAC-14F capture and error UX | Implemented/tested with synthetic inputs; physical devices/PC pending | Review desktop/mobile screen states: no avatar, wardrobe first, PC offline, queued/running/failed, source deleted, duplicate submission. Preserve input on error and current outfit during failed selection. Browser screenshots and keyboard checks; no fabricated ETA. |
| MAC-14G contract handoff | Prepared, PC ACK pending | Native preflight runbook exists. Next: exact producer manifest fixtures for all supported kinds, CLI adapter conformance and shared-frame agreement. No unilateral field stripping. |
| MAC-14H pilot preparation | Runbook/rehearsal prepared; private backup/restore and cutover pending | Test-env configuration/runbook, migration order/rollback, two-account script, remote-worker offline/restart cases. Credentials remain local; actual deployment and production migration are separate actions. |

## Cache investigation already completed

Current SQL returns the existing fitting for an immutable avatar/garment pair regardless of terminal failure. Client idempotency key is also fixed to that pair. Retry is capped at three attempts. Therefore merely changing the client request key cannot revive exhausted fitting; removing the cap would allow unbounded GPU work. Implement MAC-14B as explicit generation lifecycle, including uniqueness, saved-look bindings, selection of current generation, and old-generation fencing. Do not patch one condition and call cache recovery complete.

Engine revision is a separate concern from failed attempts. Keep an already saved/renderable asset pinned; offer explicit regeneration when supported. Existing appearance/fit quality is not validated by any cache test.

## What requires PC or user evidence

Native Windows Job Object teardown, shared lock used by both Qwen and 3D, strict adapter acceptance of v1-r2, real textured body/top/jeans, face editor parameter support, actual peak VRAM/RAM and 15–30 minute timing, personal likeness approval. Continue Mac packages independently; these remain release gates.

## Completion evidence for this increment

MAC-14A adds three regressions; npm test 47 PASS. lint/build results recorded in process after completion. Earlier independent full DB/API/browser results remain attached to the earlier revision; they are not claimed rerun for this small presentation change. No production schema, wire or engine change in this increment.


## Fitting generation implementation

Migration `20261106053812_fitting_generations.sql` adds `superseded_by` (deferred self-reference) and a partial unique index allowing one current fitting per avatar/item. POST jobs/:id/regenerate applies only to exhausted failed/canceled fittings without output; the old job id is the idempotency identity. Owner advisory lock serializes requests. Quotas remain enforced. Ready derived inputs are required; retained derived GLBs can still be fitted after original photos are deleted. SOURCE_DELETED failures and unavailable derived inputs are rejected.

Old models/jobs/assets/looks stay intact. Superseded jobs cannot retry; current Studio/recommendation selectors exclude them. Saved looks resolve their explicit IDs. Fresh prepare requests use new request keys; DB pair uniqueness dedupes them, avoiding replay of the first generation's old idempotency receipt. No automatic regeneration or engine-revision upgrade is included. Apply migration before app rollout in a test environment; production migration is not performed here.
