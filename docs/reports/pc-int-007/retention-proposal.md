# PC retention inventory and deletion receipt proposal

Task PC-INT-007, session PC-20261106-INT007. Proposal only, no deletion implementation or authorization. App/transport owner: Claude; PC owns inventory/evidence and future engine-local integration after contract review. Baseline route remains `/api/v2/worker`.

## Observed state

The bounded read-only scan counted 244 files / 45,243,011 bytes across PC-owned research runs, template runs and mesh diagnostics. Both checked default live job roots were absent. Eight duplicate-image groups contain 22 files; identical bytes are not ownership or deletion authority. Every file remains protected: zero eligible, zero deleted. A separately identified old, own native-test temporary directory contains two files; it also remains intact. No global Temp, Downloads, model, environment, source repository, coordination or Qwen directory sweep occurred.

`retention-public.json` contains aggregate counts only. The private ledger contains relative local paths and optional bounded image hashes; it never decodes input manifests, tokens, private logs or configuration. The inventory helper rejects whole-workspace/outside/protected/overlapping roots and reparse components, refuses following reparse entries, and bounds depth/file count. Eight CPU fixture tests pass. This is a trusted, stable operator-root inventory, not a TOCTOU-safe deletion sandbox or a Windows ACL audit.

The checked worker stages inputs with job/asset/role/localPath/mediaType. It has no authoritative owner-to-each-local-copy ledger or tombstone receipt. A checkpoint may contain a private lease token; it must not be copied into public evidence. No enrolled real worker job, user deletion request or server tombstone was exercised.

## Relationship to the checked server

App revision `7be869c989bc8c2b13d8b9ce621c9f70d487e57c`: `src/app/api/v2/[...path]/route.ts` calls `fm_v2_source_retention`, then best-effort storage removal, reporting `storageCleanupPending`. Migration `20261106042143_capture_retention_c2.sql` tombstones source rows and cancels related unfinished jobs with `SOURCE_DELETED`, while retaining ready derived avatars/fittings/looks. A repeated request must continue pending physical cleanup even after logical deletion. App/cloud retry and URL/privacy fixes belong to Claude's audit work; PC does not duplicate those handlers.

Server logical deletion does not prove that downloaded copies, extracted frames, masks or an executing adapter are gone. A new native CPU fault injection also found that `stop_process` returns when the venv launcher has exited although the actual interpreter remains alive. An isolated lock could be reacquired in that condition. Whole-worker Job Object exit did remove the owned descendants. This is a method-level test, not a real cancellation/E2E or concurrent GPU test. See `quiescence-finding.json`. Per-job quiescence is a prerequisite for cleanup and subsequent admission, independently of the unit-test-only launcher patch.

## Proposed ownership ledger and workflow

1. The transport owner should persist an authenticated, private per-copy ledger: scoped owner runtime reference, worker ID, job ID, source asset/version, role, content digest/size, local relative path, copy purpose, creation event, and lifecycle state. Record normalized source, derived frame/mask and cache copies when created. Owner/job identity must come from verified server context, never filenames, mtime or arbitrary local JSON. Do not send service-role credentials to the PC. Keep the existing transport family; no second worker protocol. A private transport sidecar can hold this ledger without adding unreviewed fields to the strict engine manifest.
2. A verified server deletion/cancellation event first fences new reads, renewals and publication for the affected owner/job/source version. Claude must define the event/receipt contract and idempotency key within the reviewed v2 flow. A locally invented tombstone is not sufficient authority.
3. Stop and wait for the entire owned per-job process tree, including launcher, actual interpreter and descendants. Record PID creation identity and containment completion; launcher `.poll()` alone is insufficient. Do not release admission or delete source files while a descendant can still read or recreate them. Test timeout/crash/already-exited-launcher behavior using owned fixtures before enabling cleanup.
4. Build a finite explicit file allowlist from the ledger and matching tombstone scope. Verify final resolved handle/path inside the dedicated job source area, no reparse traversal, file identity/version/hash and no protected-path overlap. The current inventory helper does not supply these deletion guarantees. Never recursively erase an entire job/workspace or infer permission from duplicate hashes.
5. A future approved implementation removes only authorized copies, records each absent/deleted/failed result idempotently, and retries pending failures. Crashes or access-denied failures remain `cleanup_pending`; logical cancellation is not `physically_cleaned`. Confirm absence and prevent recreation before issuing a scoped physical-cleanup receipt. Receipts must omit local absolute paths, tokens, signed URLs and image bytes.
6. The receipt should bind schema revision, scoped worker/owner/job/source versions, tombstone request ID, process-quiescence evidence, allowed-copy counts, deletion/absence/failure counts, pending retry reason and completion time. Distinguish cloud cleanup, this worker's cleanup and all registered copies; no single-worker receipt proves global erasure.

## Retention classes and limits

| Class | Proposed treatment after verified scope/quiescence | Current action |
|---|---|---|
| Staged normalized source, extracted frames, masks, subject-specific temporary caches | Explicit owner/job/source-bound deletion and retryable receipt | Protect; inventory only |
| Ready published derived avatar/garment/look/preview | Retain according to the reviewed server's source-retention policy; separate derived-delete action if requested | Protect |
| Unpublished derived or mixed/unknown cache | Policy decision and private quarantine/pending classification; do not claim cleaned | Protect |
| Models, environments, compiler/runtime, source repositories, shared lock | Outside source-retention scope | Not scanned/deleted |
| Checkpoint004, valid fitting, 005/006 research meshes/textures/bundles | Research provenance; no authenticated live job binding | Protect |
| User's original external photos/Downloads/Drive files | Outside worker-copy tombstone scope | Not searched/deleted |
| Own historical unit-test temporary directory | Separate explicit test-artifact policy; no age-based global sweep | Two files retained |

No deletion code, cleanup daemon, server endpoint, storage call or capability was enabled. Physical source cleanup remains NOT VERIFIED. The next owner action is transport contract/quiescence review, followed by disposable owner/job isolation fixtures and fault-injection receipt tests; no personal source is needed for those tests.
