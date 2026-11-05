# Worker protocol v1 — implemented S1

05/11/2026. This document describes current code, not future endpoints. Browser/user routes require existing verified Fitmatch authentication and same-origin mutations; worker routes use a separate scoped bearer credential.

## Transport and scope

PC polls outbound HTTPS. `Authorization: Bearer fmw_…` is supplied in the environment, hashed in DB, never stored in browser state. One worker is bound to one owner; disabled tokens fail authentication. `manage.mjs` enrolls/revokes through trusted server credentials. No service-role key on PC. Heartbeats20s; online90s; lease120s; maximum3claimed attempts. One running job per worker process. Registration alone does not prove engine health: capability claims are operator configuration and real-data conformance is still required.

## Worker endpoints

All are POST under `/api/v2/worker/`:

| Path | Request | Response |
|---|---|---|
| `heartbeat` | `{capabilities:{"avatar.reconstruct":{model,revision},…}}` (subset of 3 capabilities, empty allowed) | `{success:true}` |
| `claim` | `{}` | 204 if no eligible job; otherwise lease envelope below |
| `jobs/:id/heartbeat` | `{leaseToken,stage}` | 200 or409 if lease lost |
| `jobs/:id/input-url` | `{leaseToken,assetId}` | fresh `{assetId,url,sha256,bytes}` for an input of this job only |
| `jobs/:id/output-intent` | `{leaseToken,bytes}` | `{assetId,uploadUrl}`; PUT GLB directly to signed URL |
| `jobs/:id/finalize` | `{leaseToken,assetId}` | validates staged GLB and publishes immutable verified bytes/hash; does not yet complete job |
| `jobs/:id/complete` | `{leaseToken,assetId}` | atomically sets model output and success, only valid active lease and ready GLB for same owner/job |
| `jobs/:id/fail` | `{leaseToken,code}` | stores constrained failure; not success |

Stages: starting, preprocessing, reconstructing, texturing, draping, exporting, uploading. Failure codes: OOM, INVALID_INPUT, MODEL_UNAVAILABLE, INFERENCE_FAILED, EXPORT_FAILED. Generic transport maps unknown adapter failure to INFERENCE_FAILED; richer adapter error mapping needs integration. Errors JSON `{success:false,error,requestId}`; HTTP400/401/403/404/409/429/503.429 carries Retry-After60.

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
