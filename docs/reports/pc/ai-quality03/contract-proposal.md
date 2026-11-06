# Versioned human review and controller proposal — not an app wire revision

Schema IDs: `pc-ai.review-envelope.v2`, `pc-ai.human-confirmation.v1`, `pc-ai.human-confirmation-result.v1`.
These are local CPU proposals for Claude/app owner review from app7be869c. No server/transport/schema migration is applied.
There is no live provider, OCR auto-apply or `avatar.reconstruct` text-job capability. Rules-v1 remains the app fallback.

Construct the result envelope on the trusted side after strict attribute parsing. Bind result ID and envelope digest to authenticated owner,
job/item IDs, immutable source revision/image SHA256, model revision, policy revision and raw-response digest.
Raw OCR stays in `candidate_logo_texts`; accepted `attributes.logo_texts` is empty and `ocr_status=unverified` while visible text is unreviewed.
The result status is always `requires_human_review`; `approved_for_auto_apply` is always false.
Reject model-provided approval fields, additional keys, unknown schema versions, noncanonical UUIDs, changed result digests and promoted raw OCR.

The UI should show the exact source/version next to unverified candidates, visibly label uncertainty, and let the owner correct or reject each field.
An explicit confirmation carries a new confirmation ID, expected result/digest and the same source binding, plus the fields personally approved.
Server authentication supplies `authenticated_owner_id` and current source/job state; never trust an actor identity from the request body.
Recheck ownership, source revision/hash, current result, cancellation and source tombstones before any app transaction.
Reject stale/foreign confirmations and approval fields attached to `reject`/`needs_input`. No empty or unknown-field approval.

The CPU function validates an explicit human field-confirmation example, but performs no app write and still leaves auto-apply false.
The envelope digest is integrity/version binding, not a signature, authentication, proof that someone viewed an image, or a durable idempotency store.
Claude must implement trusted authentication, persistent confirmation-ID uniqueness/digest replay handling, atomic updates and stale-selection checks after ACK.
Candidate spellings are never silently corrected from fixture labels. Ground truths are only for evaluation and are not sent to a model prompt.

CPU metrics distinguish known-prediction accuracy, coverage/abstention and unsupported nonvisible claims.
OCR precision is undefined for partially adjudicated text regions; extra text requires review rather than an invented false-label claim.
Multiple/ambiguous garments require target selection before any model load.
The seven curated sources have single-annotator provisional labels and are not representative validation.

The controller proposal admits only finite clock/slot expiry, a current AI slot, verified guard-child/held-lock evidence,
at least4GiB available host RAM and8GiB GPU headroom, and a confirmed target where needed.
Recheck admission after acquiring the logical lease and before load. Output is at most192tokens/8192bytes with at most2schema attempts.
Schema errors may retry once; oversized output, runtime failure and deadlines are terminal.
Attempted partial loads also require cleanup. Do not release a logical lease when unload fails or a child remains.

The callback deadline cannot interrupt a blocked generation. A real Windows Job Object guard supplies the hard timeout and holds the OS lock
through whole-tree exit. CPU native tests use unchanged guard code in an isolated disposable namespace and launch only an allowlisted CPU child;
they are not another GPU scheduler or a substitute GPU lock. The actual fixed machine lock remains
`<GPU_ROOT>/coordination/gpu0.lock`, guard `<GPU_ROOT>/fitmatch_AI/workers/windows/gpu_guard.py`.

Controlled1GiB/3sample pressure decisions and a real CPU exit86/tree-drain were tested without exhausting machine RAM.
No new GPU model inference or GPU memory-failure/unload was run. Refactoring these helpers into selected quality02 runtime requires review;
its prior hardcoded emergency loop has not been independently fault-injected with a loaded Qwen model.
Do not nest a worker that acquires the same lock inside the setup guard.

Finding Q03-GUARD-01: existing guard accepts NaN/Infinity slot expiry in an isolated CPU reproduction.
This is a local admission-metadata hardening gap, not a claimed remote exploit. The proposed controller refuses these values;
the shared 3D guard was not changed. A narrowly scoped patch with exact base hash is supplied for the 3D owner to review/test.
Do not adopt the guard as a production admission scheduler based on these CPU passes alone.
