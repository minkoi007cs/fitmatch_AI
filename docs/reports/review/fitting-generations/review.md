# MAC-14B — fitting generation recovery

Baseline849ffbb. Adds explicit regeneration of exhausted failed/canceled fittings, keeping immutable old models/jobs/looks. Partial unique current-pair index plus owner advisory lock prevent duplicate successors. Replaying regeneration for the same old job returns success without creating another job; retry of a superseded job is rejected. Every generation retains three-attempt cap and queue/day quotas. Original input deletion does not delete retained derived assets; regeneration requires ready owned derived body and garment and refuses SOURCE_DELETED.

UI offers "Tạo lượt mặc thử mới" in Prepare only after exhausted attempts, with busy guard. Studio and recommendation preparation select the current generation; saved looks use explicit version IDs. New preparation requests use fresh keys and pair-based SQL dedupe, rather than replaying the first generation's receipt. This does not automatically regenerate ready outputs when engine revisions change (MAC-14C).

Validation:48 unit tests, lint/build pass. PostgreSQL regression passes (existing populated migration checks plus eight concurrent regeneration calls, foreign owner, active job, source-deleted, quota rollback, old retry denied, cache lookup and saved-look pinning). HTTP/browser final result recorded below. Local Docker PostgreSQL16, fake private storage and synthetic geometry; no real inference/Supabase/Windows. Migration created using Supabase CLI, security-invoker/service-role-only grants retained. No production migration or deployment performed. Supabase advisors unavailable for this standalone PostgreSQL harness; explicit role-denial SQL assertions run instead.

Rollback app only does not remove generations; do not restore the original unique pair index after multiple generations exist. Keep additive column/index and current enqueue selection, deploy old UI only if needed. Test migration before rollout.

Final HTTP/browser: npm run test:v2 exit0,13PASS blocks including real regeneration route with4parallel requests and supersededretry409. First run had capture timeout while rebuild overlapped; subsequent stable-build run fully passed.
