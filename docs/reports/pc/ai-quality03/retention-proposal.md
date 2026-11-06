# PC source retention proposal — awaiting app/Claude ACK

Proposal version `pc-ai.source-retention.v1`; app review baseline7be869c, H-AUDIT-016.
This document does not implement deletion, queue messages, storage credentials or a live worker capability.

Current inventory is metadata-only and limited to Qwen-owned areas. Seven public reference images have provenance,
but no owner/job/source-revision binding. `ai-service/jobs` does not exist. No personal files were fetched or scanned.
Original and re-sharded model caches have independent lifecycles; they must never be candidates for a source-image deletion request.
Raw OCR, error excerpts and face/image-related diagnostic material must be treated as source-sensitive when personal inputs are introduced.

Use a dedicated trusted PC source root, with paths
`<job UUID hex>/<source-revision UUID hex>/source/<SHA256>.<extension>` and optional
`source-evidence/<SHA256>.json`. Full UUID hex is32characters, not a truncated identity/hash.
A sibling `binding.json` binds the full authenticated owner UUID, job UUID, source-revision UUID and image SHA256.
The context must be established from an authenticated, scoped server assignment, never from model output or an untrusted path.
Owner is mandatory in the binding/ledger even though it is omitted from the folder name to keep Windows paths short.
The first three-UUID layout exceeded the machine's path limit in synthetic tests. No Windows setting/UAC change was made.
Choose and validate a short trusted root at enrollment; the current plan is not a guarantee that arbitrary long roots work.

Before planning cleanup, require a current owner/job/source tombstone fence, matching job attempt, and drained owned process tree.
Validate the immutable binding sidecar, allowlisted artifact kinds, filename/content SHA256 and every path component for reparse points.
Never plan deletion of a model/derived asset/another owner/job, or follow a source symlink into another tree.
`cleanup_plan` produces a dry-run receipt only; it never removes files.
Native file-symlink creation was unavailable with Windows1314; the refusal logic was fault-injected separately.

The server must durably retain deletion work even after logical source rows are tombstoned. Proposed states:

1. `requested`: immutable deletion operation ID and bound artifact manifest are durably recorded.
2. `waiting_for_drain`: cancel/fence dependent work; wait for own process-tree exit, not just root PID disappearance.
3. `physical_delete_pending`: retryable PC/storage work survives network failure, app restart and repeated delete requests.
4. `deleted_verified`: only after a handle-bound local operation and post-delete absence receipt, or a verified already-absent result.
5. `failed_retryable` or `needs_operator_review`: preserve the original bound paths/digests and error class; do not report deleted prematurely.

Repeated requests must return/reconcile the original operation, even when logical source-retention already says deleted.
Do not recompute candidates solely from not-yet-deleted source rows; that is the audit's lost-retry gap.
An already-absent file can complete idempotently after binding and fence verification. A changed digest/reparse path is quarantined for review.
Bound retry count/backoff, maximum age and operator escalation need an explicit app policy/ACK, not an unbounded loop.

Future execution needs a fresh tombstone/attempt check and Windows handle-based no-reparse deletion to close the plan-to-delete race.
Path validation in a dry-run is insufficient to authorize a later path-based unlink. There is no deletion executor in this checkpoint.
The app must display logical deletion vs physical cleanup pending/error truthfully and keep cleanup controls/recovery available.

Retention choices remain owner controlled. Do not silently introduce a TTL/default for failed jobs or source-sensitive logs;
Claude should reconcile those defaults with the product requirements and communicate them before enabling cleanup.
Public reference corpus retention is separate from private job sources. Ready derived avatar/garment/looks remain governed by references/tombstones,
not by deleting their source image. Model caches are not personal-source copies.

Receipts should include operation ID, binding digest, job attempt, artifact digests, process drain proof, status, retry count and redacted error class.
Absolute paths, raw OCR, filenames containing personal information, signed URLs and credentials stay out of public reports/client DTOs.
Only scoped worker enrollment may receive a cleanup request; no service-role credential on PC and no new capability is advertised here.
