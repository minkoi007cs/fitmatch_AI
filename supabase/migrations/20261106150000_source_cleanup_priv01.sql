-- CL-PRIV-01: durable physical cleanup for user-requested source deletion. Additive.
-- C2 tombstoned the asset rows, then removed storage objects best effort. If storage failed, a
-- second request returned no paths and nothing ever retried, so objects could stay forever while
-- the UI said "deleted". Here every object of a tombstoned source gets a persisted cleanup intent
-- (pending -> completed | failed) owned by the user. Removal is retried by the user's own repeated
-- request and by an operator-run collector that only processes these intents (never a bulk GC).
-- Derived avatars/fittings/looks are never touched: only fm_v2_assets rows already tombstoned as
-- inputs are referenced.
begin;

create table public.fm_v2_source_cleanup (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.fm_v2_assets(id) on delete cascade,
  path text not null check (length(path) between 1 and 300),
  state text not null default 'pending' check (state in ('pending','completed','failed')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or length(last_error) <= 200),
  requested_by_model uuid references public.fm_v2_models(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (asset_id, path),
  check ((state = 'completed') = (completed_at is not null))
);
create index fm_v2_source_cleanup_due on public.fm_v2_source_cleanup(next_attempt_at) where state = 'pending';
create index fm_v2_source_cleanup_user on public.fm_v2_source_cleanup(user_id, asset_id);
alter table public.fm_v2_source_cleanup enable row level security;
-- Paths contain user ids: no browser role may read or write intents.
revoke all on public.fm_v2_source_cleanup from public, anon, authenticated;
grant all on public.fm_v2_source_cleanup to service_role;

-- Per-model summary the UI reads after reload (null = no deletion touched this model's sources).
alter table public.fm_v2_models
  add column source_cleanup text check (source_cleanup in ('pending','completed','failed'));

-- Backfill: sources tombstoned before this migration may still have objects; their removal outcome
-- was never recorded, so they are pending (removing an absent object is a no-op).
insert into public.fm_v2_source_cleanup(user_id, asset_id, path, created_at)
select a.user_id, a.id, p.path, coalesce(a.deleted_at, now())
  from public.fm_v2_assets a
  cross join lateral (values (a.path), (a.source_path)) p(path)
 where a.state = 'deleted' and p.path is not null
on conflict (asset_id, path) do nothing;

create function public.fm_v2_source_cleanup_refresh(p_user uuid, p_assets uuid[])
returns void language sql security invoker set search_path = public as $$
  update fm_v2_models dm set source_cleanup = (
    select case when count(*) = 0 then null
                when bool_or(c.state = 'failed') then 'failed'
                when bool_or(c.state = 'pending') then 'pending'
                else 'completed' end
      from fm_v2_source_cleanup c
     where c.user_id = p_user and c.asset_id = any(dm.input_assets))
   where dm.user_id = p_user and dm.input_assets && coalesce(p_assets, '{}');
$$;
select public.fm_v2_source_cleanup_refresh(u.user_id, u.assets)
  from (select user_id, array_agg(distinct asset_id) assets from public.fm_v2_source_cleanup group by user_id) u;

-- Same signature as C2. 'delete' is now idempotent: the first call tombstones and records intents;
-- every call returns the objects still outstanding for this model's sources (including sources
-- tombstoned earlier through another avatar that shares them), so a retry never loses paths.
create or replace function public.fm_v2_source_retention(p_user uuid,p_model uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare m fm_v2_models; paths jsonb; canceled int := 0; affected jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into m from fm_v2_models where id=p_model and user_id=p_user and kind='avatar' for update;
 if not found then raise exception 'MODEL_NOT_FOUND'; end if;
 if p_action='keep' then
  if m.source_retention='deleted' then raise exception 'SOURCE_ALREADY_DELETED'; end if;
  update fm_v2_models set source_retention='keep' where id=p_model;
  return jsonb_build_object('retention','keep','paths','[]'::jsonb,'canceledJobs',0,'affectedModels','[]'::jsonb,'cleanup',m.source_cleanup);
 elsif p_action<>'delete' then raise exception 'INVALID_INPUT';
 end if;
 if m.source_retention is distinct from 'deleted' then
  insert into fm_v2_source_cleanup(user_id,asset_id,path,requested_by_model)
  select p_user,a.id,p.path,p_model
    from fm_v2_assets a cross join lateral (values (a.path),(a.source_path)) p(path)
   where a.user_id=p_user and a.id = any(m.input_assets) and a.state<>'deleted' and p.path is not null
  on conflict (asset_id,path) do nothing;
  update fm_v2_assets set state='deleted',deleted_at=now()
   where user_id=p_user and id = any(m.input_assets) and state<>'deleted';
  with dep as (
    update fm_v2_jobs jb set state='canceled',lease_token=null,lease_until=null,error_code='SOURCE_DELETED',updated_at=now()
    from fm_v2_models dm
    where jb.model_id=dm.id and dm.user_id=p_user and jb.state in ('queued','running')
      and dm.input_assets && m.input_assets
    returning jb.id)
  select count(*) into canceled from dep;
  update fm_v2_models set source_retention='deleted' where id=p_model;
 end if;
 perform fm_v2_source_cleanup_refresh(p_user, m.input_assets);
 -- Other versions built from (some of) the same files: they keep their derived outputs but can no
 -- longer be rebuilt from these sources; the UI says so.
 select coalesce(jsonb_agg(dm.id order by dm.created_at),'[]'::jsonb) into affected
   from fm_v2_models dm where dm.user_id=p_user and dm.id<>p_model and dm.input_assets && m.input_assets;
 select coalesce(jsonb_agg(c.path order by c.path),'[]'::jsonb) into paths
   from fm_v2_source_cleanup c where c.user_id=p_user and c.asset_id = any(m.input_assets) and c.state<>'completed';
 return jsonb_build_object('retention','deleted','paths',paths,'canceledJobs',canceled,'affectedModels',affected,
   'cleanup',(select source_cleanup from fm_v2_models where id=p_model));
end $$;
revoke all on function public.fm_v2_source_retention(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.fm_v2_source_retention(uuid,uuid,text) to service_role;

-- Outcome of one storage removal attempt for paths of this user's intents. Completed rows are never
-- reopened, so a late failure report from a racing request cannot undo a success.
create function public.fm_v2_source_cleanup_report(p_user uuid, p_paths text[], p_ok boolean, p_error text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare touched uuid[]; n int; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 if coalesce(array_length(p_paths,1),0) = 0 then return jsonb_build_object('updated',0); end if;
 if array_length(p_paths,1) > 1000 then raise exception 'INVALID_INPUT'; end if;
 with upd as (
   update fm_v2_source_cleanup c set
     attempts = c.attempts + 1,
     state = case when p_ok then 'completed' when c.attempts + 1 >= 5 then 'failed' else 'pending' end,
     last_error = case when p_ok then null else left(coalesce(nullif(p_error,''),'STORAGE_ERROR'),200) end,
     completed_at = case when p_ok then now() end,
     next_attempt_at = case when p_ok then c.next_attempt_at
                            else now() + least(interval '1 minute' * power(2, c.attempts), interval '6 hours') end,
     updated_at = now()
   where c.user_id = p_user and c.path = any(p_paths) and c.state <> 'completed'
   returning c.asset_id)
 select array_agg(distinct asset_id), count(*) into touched, n from upd;
 perform fm_v2_source_cleanup_refresh(p_user, touched);
 return jsonb_build_object('updated', n);
end $$;
revoke all on function public.fm_v2_source_cleanup_report(uuid,text[],boolean,text) from public, anon, authenticated;
grant execute on function public.fm_v2_source_cleanup_report(uuid,text[],boolean,text) to service_role;

-- Collector input: pending intents whose backoff elapsed, bounded per call. Failed intents (5
-- automatic attempts) wait for the user's explicit retry or an operator decision.
create function public.fm_v2_source_cleanup_due(p_limit int default 100)
returns jsonb language sql stable security invoker set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('userId',d.user_id,'path',d.path,'attempts',d.attempts)),'[]'::jsonb) from (
    select c.user_id, c.path, c.attempts from fm_v2_source_cleanup c
     where c.state = 'pending' and c.attempts < 5 and c.next_attempt_at <= now()
     order by c.next_attempt_at, c.id
     limit least(greatest(coalesce(p_limit,100),1),500)) d
$$;
revoke all on function public.fm_v2_source_cleanup_due(int) from public, anon, authenticated;
grant execute on function public.fm_v2_source_cleanup_due(int) to service_role;
revoke all on function public.fm_v2_source_cleanup_refresh(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.fm_v2_source_cleanup_refresh(uuid,uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
