# Worker protocol v1 — implemented S1, revision v1-r1

Revision **v1-r1** (R1, 05/11/2026, migration `20261106025506_worker_recovery_r1.sql`) is backward compatible on the wire: old workers keep working once the operator grants capabilities. Changes are listed in [R1 changes](#r1-changes-v1-r1) at the end.

05/11/2026. This document describes current code, not future endpoints. Browser/user routes require existing verified Fitmatch authentication and same-origin mutations; worker routes use a separate scoped bearer credential.

## Transport and scope

PC polls outbound HTTPS. `Authorization: Bearer fmw_…` is supplied in the environment, hashed in DB, never stored in browser state. One worker is bound to one owner; disabled tokens fail authentication. `manage.mjs` enrolls/grants/rotates/revokes through trusted server credentials. No service-role key on PC. Heartbeats20s; online90s; lease120s; maximum3claimed attempts. One running job per worker process. Registration alone does not prove engine health: a worker claims a kind only if it **declares** it in heartbeat **and** the operator **granted** it (default deny since v1-r1).

## Worker endpoints

All are POST under `/api/v2/worker/`:

| Path | Request | Response |
|---|---|---|
| `heartbeat` | `{capabilities:{"avatar.reconstruct":{model,revision},…}}` (subset of 3 capabilities, empty allowed) | `{success:true, grantedCapabilities:[…]}` (declared ∩ granted) |
| `claim` | `{instanceId?, requestId?}` (UUIDs; `{}` still accepted) | 204 if no eligible job; otherwise lease envelope below, with `protocolRevision` and `redelivered` |
| `jobs/:id/heartbeat` | `{leaseToken,stage}` | 200 or409 if lease lost |
| `jobs/:id/input-url` | `{leaseToken,assetId}` | fresh `{assetId,url,sha256,bytes}` for an input of this job only |
| `jobs/:id/output-intent` | `{leaseToken,bytes,sha256}` | `{assetId,state,uploadUrl,created}`; same job+bytes+sha256 returns the same asset (fresh URL; `uploadUrl:null` when already `ready`). Without `sha256`: legacy non-idempotent intent |
| `jobs/:id/finalize` | `{leaseToken,assetId}` | validates staged GLB, checks bytes **and sha256** against the intent, publishes immutable verified bytes; replay of a finalized asset returns it. 404 `ASSET_NOT_UPLOADED` / 400 `*_MISMATCH` / `INVALID_GLB` mark what to do next |
| `jobs/:id/complete` | `{leaseToken,assetId}` | atomically sets model output and success with a durable receipt. **Identical replay** (same worker, lease token, asset) after success returns 200; other token/asset/worker, revoked worker, canceled or stale lease → 409 |
| `jobs/:id/fail` | `{leaseToken,code}` | stores constrained failure; refused (409) if this attempt already published a verified output |

Stages: starting, preprocessing, reconstructing, texturing, draping, exporting, uploading. Failure codes: OOM, INVALID_INPUT, MODEL_UNAVAILABLE, INFERENCE_FAILED, EXPORT_FAILED, TIMEOUT. Adapter failure classification (provisional, from the PC adapter conformance report PC-CONF-01 / draft PR1, adapter revision `37213bc`; not yet jointly accepted): a nonzero exit maps to a protocol code only if the exit is in the engine table **and** the last stderr line is one bounded JSON object `{"success":false,"code":<same code>}`. Default table = the codes the real adapter implements: **78 → MODEL_UNAVAILABLE**, **2 → INVALID_INPUT**. Argparse usage text, unknown exits, malformed or mismatched records → INFERENCE_FAILED. No traceback pattern matching. Operators may add agreed codes per engine with `exitCodes` (e.g. a future OOM exit). Exit 0 without a valid GLB → EXPORT_FAILED. Raw stderr stays in the private job folder and is never forwarded. Parent time limit → TIMEOUT (new v1-r1 code; the PC report proposes INFERENCE_FAILED instead — to be agreed). Engine/protocol revision mismatch → MODEL_UNAVAILABLE immediately. Errors JSON `{success:false,error,requestId}`; HTTP400/401/403/404/409/429/503.429 carries Retry-After60.

Claim envelope:

```json
{
  "protocolVersion": 1,
  "jobId": "uuid",
  "kind": "garment.drape",
  "modelId": "uuid",
  "modelRevision": {"model":"operator-configured-engine","revision":"pinned-local-revision"},
  "lease": {"token":"uuid-secret","expiresAt":"ISO8601","attempt":1},
  "input": {
    "params": {"pose":"a-pose-v1"},
    "avatarVersionId": "uuid",
    "garmentVersionId": "uuid",
    "assets": [{"assetId":"uuid","role":"body","url":"short-lived-signed-url","sha256":"hex","bytes":1234}]
  },
  "outputContract": {
    "format":"glb-v2","units":"meters","up":"+Y","front":"+Z",
    "embeddedTextures":true,"content":"garment-only-aligned-to-avatar","maxFileBytes":41943040
  }
}
```

Avatar input order/roles: front, side, back; `params.heightCm`. Garment: front, back, optionaldetail; `params.category` shirt/t-shirt + preserveSource. Drape: body then garment GLB; output only fitted garment, same transform as avatar. Output must contain reachable mesh, finite position data and bounded embedded binary buffers; textures embedded, no Draco/KTX2. This gate is not a full glTF/appearance/fit quality validator.

Source photos are normalized by server to oriented JPEG max2048px/quality95 with metadata stripped. Hash/bytes refer to verified normalized input, not original upload. Signed input links last300s; renew only with valid current lease. Avoid logging URLs/tokens/photos. Adapter sees a local JSON manifest and local files; job data cannot supply executable commands. Default engine list is empty, and synthetic test fixtures are never production engines.

## Browser API under `/api/v2/`

- POST `assets/upload-intent` `{kind:"photo",bytes}` → signed PUT URL; POST `assets/:id/finalize` verifies the stored upload. Client cannot choose path or register GLB as user photo. Pending uploads cannot enqueue reconstruction.
- GET/POST `models`: list owned versions or enqueue avatar/garment/fitting. POST requires `Idempotency-Key`8–100chars. Same key/different payload409. Fitting cache uses exact immutable avatar+garment IDs. GET `models/:id` returns owned model plus signed ready output.
- GET `jobs` exposes state/stage/attempt/error, never lease/worker credential. POST `jobs/:id/cancel|retry`; retry only failed/canceled attempts<3.
- GET `compute/status`: online/capabilities/lastSeen without worker IDs/tokens.
- GET/POST `style-profiles`: latest version / strict answer version append.
- GET/POST `recommendations`: latest snapshot / rank owned wardrobe plus preferences and feedback. A repeated current profile+snapshot reuses the latest generation. Returning to an older snapshot appends a new generation so latest GET stays correct after undo.
- GET/POST `feedback` `{itemId,recommendationId,value:"like"|"skip"}`; DELETE `feedback/:itemId` resets preference. Validates owned recommendation membership and current owned item.
- GET/POST `looks`: immutable avatar+optional fitting+recommendation links; validates same owner, ready versions and fitting belongs to avatar. DELETE `looks/:id` removes only owner's look.

States persisted: `queued`, `running`, `succeeded`, `failed`, `canceled`. Offline is computed from worker heartbeat, not a second queue state. Expired running leases recover when an online eligible worker calls claim; they may remain visually running while all workers are offline. Retry/cancel fences old completion tokens. No implicit provider switch or paid cloud fallback.

Limits:50newjobs/dayUTC,20queued/running perowner,100asset intents/rolling24h including pending,12MiB input photo,40MiBGLB,120MiB/12garments Studio session. List endpoints currently return latest100models/jobs/looks and up to500wardrobe candidates; pagination is needed beyond the small research beta.

## Evidence and integration boundary

`npm run test:v2:db` uses isolated real PostgreSQL to verify concurrency, grants/RLS, quotas and fencing. `npm run test:v2` exercises actual Next handlers/auth/Sharp, real SQL RPCs and Chromium with synthetic local storage and triangle meshes, plus Python worker transport. Neither validates real Supabase storage policies/service rollout nor actual SiTH/garment/drape inference. See `pc-worker-connect.md` for real PC handoff and acceptance.


## R1 changes (v1-r1)

**Migration order.** `20261105_studio_control_plane.sql` then `20261106025506_worker_recovery_r1.sql`. Additive: new columns (`fm_v2_workers.allowed_capabilities`, `fm_v2_jobs.claim_instance/claim_request`, `fm_v2_assets.expected_sha256/job_attempt`, asset state `rejected`), table `fm_v2_job_receipts` (service role only, RLS on), RPCs `fm_v2_claim_r1` and `fm_v2_output_intent` (new names, no overloads), `fm_v2_transition` and legacy `fm_v2_claim(uuid)` replaced in place with the same signatures and grants. Ends with `notify pgrst, 'reload schema'`.

**Default deny.** After the migration no worker claims anything until `manage.mjs grant` (or `create OWNER kind…`). `compute/status` shows only declared ∩ granted capabilities.

**Claim redelivery.** The claim stores the caller's `instanceId`/`requestId`. A claim from the same worker **and the same instance** while the lease is valid and before the first job heartbeat returns the same job, token and attempt (`redelivered:true`, lease extended). Another instance, the legacy claim, or a job that already reported progress gets 204; a restarted process waits for lease expiry (one attempt consumed, no output existed yet).

**Recovery policy (worker.py v1-r1).**

- Per-job checkpoint `workDir/jobs/<jobId>/checkpoint.json` (atomic replace) records engine revision, input digest, attempt, lease token and stage: `inferring → output_ready → uploading → finalized → completed` (`failed`/`interrupted`). Unreadable/unknown checkpoints are moved aside as `checkpoint.rejected.*.json`, never trusted, never deleted.
- An output is reused only if job, model, kind, engine revision, input digest, size, GLB header and sha256 all match and the file is inside the job folder.
- Retryable = network error, timeout, 429, 5xx: bounded exponential backoff with jitter (`retry` config). 409 = lease no longer ours (stop, keep checkpoint). 401/403 = credential gone. Other 4xx are definitive for that step.
- After an output exists the worker **never sends `fail`** except when the server rejects the GLB itself (`INVALID_GLB` → EXPORT_FAILED). Exhausted retries keep the checkpoint; each loop first reconciles it: replay `complete` if finalized, else `heartbeat` the stored lease and resume publishing. If the lease is gone, the server requeues the job and the next claim reuses the same verified bytes (output-intent returns the existing ready asset). Old tokens can never publish.
- Interrupted inference (worker died while the adapter ran) has no trusted output; the job runs again only on a new lease.
- One worker process per `workDir` (`.worker.lock`). On POSIX the adapter inherits the lock, so an orphaned adapter blocks a second inference until it exits. On Windows adapters are bound to a kill-on-close job object (**not yet verified on the PC**). This is not the two-owner GPU scheduler (R2 / FIX-MAC-05).
- The adapter environment drops variables whose name looks secret (TOKEN, SECRET, PASSW, CREDENTIAL, API_KEY, PRIVATE_KEY, SERVICE_ROLE, …), every `FITMATCH_WORKER*` variable and any value containing the worker token.

**Rollback.** Redeploy the previous app; keep the additive schema (no data deleted). The old app calls `fm_v2_claim(uuid)`, which keeps working but enforces grants, so keep grants in place. Old `worker.py` keeps working against the new server (no sha256 → legacy output-intent; duplicate complete now returns 200 instead of 409).
