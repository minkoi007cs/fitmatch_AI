# Reviewed HTTPS revision and real-Qwen smoke — handoff (CL-MIGRATION-26)

Status: **plan only.** No deploy, no worker grant and no GPU job were done in this package. The steps
below run only after the cutover gates in `README.md` §6 are met, in this order.

## Ownership (unchanged contract)

| Area | Owner |
|---|---|
| App, migrations, transport (`scripts/worker/worker.py`), HTTPS revision | Claude / Mac |
| Coordinator policy, the `pc-ai` finite slot, the shared OS lock, 3D jobs | PC3D chat |
| Qwen adapter/runtime, model and cache, private worker config | PC Qwen chat |
| Review of each gate | Codex |

The GPU rules stay the same:

- One canonical lock, pinned by policy identity and hash.
- One OS lock byte 0, held by the worker process only.
- No nesting.
- The lock is retained until the owned process tree drains.
- Qwen and 3D never use the GPU at the same time.

## 1. HTTPS revision (Codex reviews the exact commit before anyone deploys it)

- Revision: a descendant of this branch's final commit, with the cutover executed and history adopted.
- Server env, set privately in the host's secret store and never in Git or chat:
  - `NEXT_PUBLIC_SUPABASE_URL=https://gohczmqykjkrgdblgbog.supabase.co`, the anon key and the service-role
    key (server only).
  - `FITMATCH_EXPECTED_SUPABASE_REF=gohczmqykjkrgdblgbog` (the backend identity guard refuses anything else).
  - `FITMATCH_BACKEND_MODE` unset (canonical), `APP_URL=https://<reviewed origin>` and the auth provider
    settings already in use.
  - `QWEN_ANALYSIS_ENABLED` **unset**: it is OFF on the first deploy.
- Smoke with the flag OFF:
  - Sign up a new synthetic account, then confirm the account has a profile row.
  - Wardrobe upload and edit.
  - Outfit save and reopen.
  - A second account cannot see the first account's data.
  - The analysis routes answer `403 FEATURE_DISABLED`.

## 2. PC prerequisites (PC chats report; Claude does not edit PC files)

- **PC3D:** a native Windows ACK of the coordinator binding for this exact worker sha. That means policy
  written and verified, the foreign lock or slot refused, and the canonical path admitted. Then a finite
  `pc-ai` slot.
- **PC Qwen:** the private config contains `appUrl`, `expectedBackend {projectRef: "gohczmqykjkrgdblgbog",
  appOrigin: "<reviewed origin>"}` and `gpuCoordinator`.
  - `gpu_coordinator_policy.py verify` reports `admitted: true`.
  - The adapter and runtime revision are reported.
  - The worker is enrolled for the owner account with capability `garment.analyze` only.

## 3. Real-Qwen smoke (one owner, one item, flag ON in the test window only)

1. The owner turns `QWEN_ANALYSIS_ENABLED=1` on for the reviewed revision only. PC3D grants the slot.
2. Analyse one synthetic or owner-approved wardrobe photo. Expect, in order:
   - reserve, enqueue, claim, result, then a human review of the proposal;
   - approve applies only the confirmed fields;
   - the snapshot is cleaned up per retention.
3. Record:
   - job id, worker sha and adapter revision;
   - duration and VRAM;
   - that no 3D job overlapped;
   - the audit trail;
   - that a second owner's worker saw nothing.
4. Turn the flag OFF again (or keep it ON only by an owner decision), then hand the evidence to Codex.

## Rollback

Unset `QWEN_ANALYSIS_ENABLED`. Remove `garment.analyze` from that worker's `allowed_capabilities`, or set
`enabled = false` on the worker row. PC3D withdraws the slot. No schema rollback is needed for this smoke.
