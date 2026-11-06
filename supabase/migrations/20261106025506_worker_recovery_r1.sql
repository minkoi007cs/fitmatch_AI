-- R1 worker recovery (APP-01 / QA-01A, session CL-RECOVERY-R1-20261105-01).
-- Additive on top of 20261105_studio_control_plane.sql. No wardrobe/profile/model data is rewritten.
-- New RPC names instead of overloads, so PostgREST never has to choose between candidates.
begin;

-- R1C: capabilities the operator granted. Default deny: a worker only claims kinds that it
-- declares in heartbeat AND that appear here (set through scripts/worker/manage.mjs).
alter table public.fm_v2_workers add column allowed_capabilities text[] not null default '{}'
  check (allowed_capabilities <@ array['avatar.reconstruct','garment.reconstruct','garment.drape']::text[]);

-- R1B: which worker process instance / claim request received the current lease.
-- claim_instance is cleared on the first job heartbeat, after which redelivery is impossible.
alter table public.fm_v2_jobs add column claim_instance uuid, add column claim_request uuid;

-- R1A: output identity, so output-intent is idempotent and finalize can verify bytes.
alter table public.fm_v2_assets add column expected_sha256 text check (expected_sha256 ~ '^[0-9a-f]{64}$'),
  add column job_attempt integer;
alter table public.fm_v2_assets drop constraint fm_v2_assets_state_check;
alter table public.fm_v2_assets add constraint fm_v2_assets_state_check check (state in ('pending','ready','rejected'));
create index fm_v2_assets_job_output on public.fm_v2_assets(job_id, expected_sha256) where kind = 'glb';

-- R1A: durable completion receipt. A replay of the same worker + lease + asset is accepted
-- idempotently; anything else is refused. Never projected to browser APIs.
create table public.fm_v2_job_receipts (
  job_id uuid primary key references public.fm_v2_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  worker_id uuid not null references public.fm_v2_workers(id),
  attempt integer not null,
  lease_token uuid not null,
  asset_id uuid not null references public.fm_v2_assets(id),
  created_at timestamptz not null default now()
);
alter table public.fm_v2_job_receipts enable row level security;
revoke all on public.fm_v2_job_receipts from public, anon, authenticated;
grant all on public.fm_v2_job_receipts to service_role;

create function public.fm_v2_claim_r1(p_worker uuid, p_instance uuid, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare w fm_v2_workers; j fm_v2_jobs; begin
 -- Worker row lock serializes every claim/transition of this worker.
 select * into w from fm_v2_workers where id = p_worker and enabled for update;
 if not found or w.last_seen is null or w.last_seen < now() - interval '90 seconds' then return null; end if;
 update fm_v2_jobs set state = case when attempt >= 3 then 'failed' else 'queued' end,
  error_code = 'LEASE_EXPIRED', worker_id = null, lease_token = null, lease_until = null,
  claim_instance = null, claim_request = null, updated_at = now()
 where user_id = w.user_id and state = 'running' and lease_until < now();
 select * into j from fm_v2_jobs where worker_id = p_worker and state = 'running' for update;
 if found then
  -- Lost claim reply: the same process instance gets the same assignment back (same token and
  -- attempt) as long as it never reported progress. Any other caller gets nothing.
  if p_instance is not null and j.claim_instance = p_instance and j.lease_until > now() then
   update fm_v2_jobs set lease_until = now() + interval '120 seconds',
    claim_request = coalesce(p_request, claim_request), updated_at = now()
   where id = j.id returning * into j;
   return to_jsonb(j) || jsonb_build_object('redelivered', true);
  end if;
  return null;
 end if;
 select * into j from fm_v2_jobs where user_id = w.user_id and state = 'queued'
  and w.capabilities ? kind and kind = any(w.allowed_capabilities)
 order by created_at, id for update skip locked limit 1;
 if not found then return null; end if;
 update fm_v2_jobs set state = 'running', worker_id = p_worker, lease_token = gen_random_uuid(),
  lease_until = now() + interval '120 seconds', attempt = attempt + 1, error_code = null, stage = 'starting',
  engine = w.capabilities -> j.kind, claim_instance = p_instance, claim_request = p_request, updated_at = now()
 where id = j.id returning * into j;
 return to_jsonb(j) || jsonb_build_object('redelivered', false);
end $$;

-- Legacy signature (old worker.py): same rules, including default-deny grants, no redelivery.
create or replace function public.fm_v2_claim(p_worker uuid)
returns jsonb language sql security invoker set search_path = public as $$
 select public.fm_v2_claim_r1(p_worker, null, null) - 'redelivered'
$$;

create or replace function public.fm_v2_transition(p_worker uuid, p_job uuid, p_token uuid, p_action text, p_stage text default null, p_asset uuid default null)
returns boolean language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; begin
 -- Revoked credentials never mutate or replay anything.
 perform 1 from fm_v2_workers where id = p_worker and enabled for update;
 if not found then return false; end if;
 if p_action = 'complete' and exists(
   select 1 from fm_v2_job_receipts r
   join fm_v2_jobs x on x.id = r.job_id
   join fm_v2_models m on m.id = x.model_id
   where r.job_id = p_job and r.worker_id = p_worker and r.lease_token = p_token and r.asset_id = p_asset
     and x.state = 'succeeded' and m.output_asset_id = p_asset) then
  return true; -- identical replay of an accepted completion (reply was lost)
 end if;
 select * into j from fm_v2_jobs where id = p_job and worker_id = p_worker and state = 'running'
  and lease_token = p_token and lease_until > now() for update;
 if not found then return false; end if;
 if p_action = 'heartbeat' then
  update fm_v2_jobs set lease_until = now() + interval '120 seconds', stage = left(p_stage, 80),
   claim_instance = null, updated_at = now() where id = p_job;
 elsif p_action = 'complete' then
  if not exists(select 1 from fm_v2_assets where id = p_asset and user_id = j.user_id and job_id = j.id and state = 'ready' and kind = 'glb') then return false; end if;
  update fm_v2_models set output_asset_id = p_asset where id = j.model_id and user_id = j.user_id;
  update fm_v2_jobs set state = 'succeeded', stage = 'ready', lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = p_job;
  insert into fm_v2_job_receipts(job_id, user_id, worker_id, attempt, lease_token, asset_id)
   values (j.id, j.user_id, p_worker, j.attempt, p_token, p_asset);
 elsif p_action = 'fail' then
  -- An attempt that already published a verified output must complete, not fail.
  if exists(select 1 from fm_v2_assets where job_id = j.id and kind = 'glb' and state = 'ready' and job_attempt = j.attempt) then return false; end if;
  update fm_v2_jobs set state = 'failed', error_code = p_stage, lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = p_job;
 else return false;
 end if;
 return true;
end $$;

-- Idempotent output intent: same job + same bytes/sha256 returns the existing pending/ready asset
-- (fresh upload URL is signed by the API), so retries never create a new logical artifact.
create function public.fm_v2_output_intent(p_worker uuid, p_job uuid, p_token uuid, p_id uuid, p_bytes bigint, p_sha text, p_source text, p_path text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; a fm_v2_assets; begin
 perform 1 from fm_v2_workers where id = p_worker and enabled for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 select * into j from fm_v2_jobs where id = p_job and worker_id = p_worker and state = 'running'
  and lease_token = p_token and lease_until > now() for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 if p_sha !~ '^[0-9a-f]{64}$' or p_bytes not between 20 and 41943040 then raise exception 'INVALID_INPUT'; end if;
 select * into a from fm_v2_assets where job_id = j.id and kind = 'glb' and expected_sha256 = p_sha
  and expected_bytes = p_bytes and state in ('pending', 'ready')
 order by (state = 'ready') desc, created_at desc limit 1;
 if found then
  return jsonb_build_object('assetId', a.id, 'state', a.state, 'sourcePath', a.source_path, 'created', false);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(j.user_id::text, 74));
 if (select count(*) from fm_v2_assets where user_id = j.user_id and created_at > now() - interval '24 hours') >= 100 then raise exception 'QUOTA_EXCEEDED'; end if;
 insert into fm_v2_assets(id, user_id, kind, source_path, path, expected_bytes, job_id, expected_sha256, job_attempt)
  values (p_id, j.user_id, 'glb', p_source, p_path, p_bytes, j.id, p_sha, j.attempt);
 return jsonb_build_object('assetId', p_id, 'state', 'pending', 'sourcePath', p_source, 'created', true);
end $$;

revoke all on function public.fm_v2_claim_r1(uuid, uuid, uuid), public.fm_v2_output_intent(uuid, uuid, uuid, uuid, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.fm_v2_claim_r1(uuid, uuid, uuid), public.fm_v2_output_intent(uuid, uuid, uuid, uuid, bigint, text, text, text) to service_role;
-- create or replace keeps the existing grants of fm_v2_claim(uuid) and fm_v2_transition(...).
commit;
notify pgrst, 'reload schema';
