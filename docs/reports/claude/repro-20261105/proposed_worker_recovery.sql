-- PROPOSAL ONLY (CL-REVIEW-20261105-01). Not applied to any real project. Additive on top of
-- 20261105_studio_control_plane.sql. Owner Mac reviews, renames to a dated migration, adds tests.
begin;
-- P1: remember the token that completed the job, so a replay of the same completion is idempotent.
alter table public.fm_v2_jobs add column if not exists completed_token uuid;
-- P2: which worker process instance received the current lease (claim reply may be lost).
alter table public.fm_v2_jobs add column if not exists claim_instance uuid;
-- P4: capabilities granted by the operator; heartbeat claims are intersected with this list.
alter table public.fm_v2_workers add column if not exists allowed_capabilities text[] not null default '{}';
-- P5: a new generation for the same avatar/garment pair after the previous one exhausted attempts.
alter table public.fm_v2_models add column if not exists generation integer not null default 1;
drop index if exists public.fm_v2_fitting_cache;
create unique index fm_v2_fitting_cache on public.fm_v2_models(user_id,avatar_id,garment_id,generation) where kind='fitting';

create or replace function public.fm_v2_claim(p_worker uuid, p_instance uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare w fm_v2_workers; j fm_v2_jobs; begin
 select * into w from fm_v2_workers where id=p_worker and enabled for update;
 if not found or w.last_seen is null or w.last_seen<now()-interval '90 seconds' then return null; end if;
 update fm_v2_jobs set state=case when attempt>=3 then 'failed' else 'queued' end,
 error_code='LEASE_EXPIRED',worker_id=null,lease_token=null,lease_until=null,claim_instance=null,updated_at=now()
 where user_id=w.user_id and state='running' and lease_until<now();
 select * into j from fm_v2_jobs where worker_id=p_worker and state='running' for update;
 if found then
  -- Re-deliver only to the same process instance, only before it ever reported progress.
  if p_instance is not null and j.claim_instance=p_instance and j.stage='starting' and j.lease_until>now() then
   update fm_v2_jobs set lease_until=now()+interval '120 seconds',updated_at=now() where id=j.id returning * into j;
   return to_jsonb(j);
  end if;
  return null;
 end if;
 select * into j from fm_v2_jobs where user_id=w.user_id and state='queued'
  and w.capabilities ? kind and kind = any(w.allowed_capabilities)
 order by created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update fm_v2_jobs set state='running',worker_id=p_worker,lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',
 attempt=attempt+1,error_code=null,stage='starting',engine=w.capabilities->j.kind,claim_instance=p_instance,updated_at=now()
 where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
-- Old signature keeps working for an old worker.py (no redelivery).
create or replace function public.fm_v2_claim(p_worker uuid)
returns jsonb language sql security invoker set search_path=public as $$ select public.fm_v2_claim(p_worker, null::uuid) $$;

create or replace function public.fm_v2_transition(p_worker uuid,p_job uuid,p_token uuid,p_action text,p_stage text default null,p_asset uuid default null)
returns boolean language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; begin
 perform 1 from fm_v2_workers where id=p_worker and enabled for update;
 if not found then return false; end if;
 if p_action='complete' and exists(select 1 from fm_v2_jobs x join fm_v2_models m on m.id=x.model_id
   where x.id=p_job and x.worker_id=p_worker and x.state='succeeded' and x.completed_token=p_token and m.output_asset_id=p_asset) then
  return true; -- P1: identical replay after success
 end if;
 select * into j from fm_v2_jobs where id=p_job and worker_id=p_worker and state='running' and lease_token=p_token and lease_until>now() for update;
 if not found then return false; end if;
 if p_action='heartbeat' then
  update fm_v2_jobs set lease_until=now()+interval '120 seconds',stage=left(p_stage,80),updated_at=now() where id=p_job;
 elsif p_action='complete' then
  if not exists(select 1 from fm_v2_assets where id=p_asset and user_id=j.user_id and job_id=j.id and state='ready' and kind='glb') then return false; end if;
  update fm_v2_models set output_asset_id=p_asset where id=j.model_id and user_id=j.user_id;
  update fm_v2_jobs set state='succeeded',stage='ready',completed_token=p_token,lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 elsif p_action='fail' then
  update fm_v2_jobs set state='failed',error_code=p_stage,lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 else return false;
 end if;
 return true;
end $$;
revoke all on function public.fm_v2_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fm_v2_claim(uuid,uuid) to service_role;
commit;
-- P5 enqueue change (not included as code here): when the cached fitting's job is failed with attempt>=3,
-- insert a new fitting model with generation=max(generation)+1 instead of returning the dead job.
