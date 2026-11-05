-- Additive control plane. No existing wardrobe/profile data changed.
begin;
create table public.fm_v2_assets (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('photo','glb')), state text not null default 'pending' check(state in ('pending','ready')),
 path text not null unique, source_path text not null unique, expected_bytes bigint not null check(expected_bytes between 1 and 41943040),
 bytes bigint, sha256 text, job_id uuid, created_at timestamptz not null default now()
);
create table public.fm_v2_models (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('avatar','garment','fitting')), name text not null,
 wardrobe_item_id uuid, avatar_id uuid references public.fm_v2_models(id), garment_id uuid references public.fm_v2_models(id),
 input_assets uuid[] not null default '{}', params jsonb not null default '{}',
 output_asset_id uuid references public.fm_v2_assets(id), created_at timestamptz not null default now()
);
create unique index fm_v2_fitting_cache on public.fm_v2_models(user_id,avatar_id,garment_id) where kind='fitting';
create table public.fm_v2_workers (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique, name text not null, capabilities jsonb not null default '{}',
 enabled boolean not null default true, last_seen timestamptz, created_at timestamptz not null default now()
);
create table public.fm_v2_jobs (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 model_id uuid not null unique references public.fm_v2_models(id), kind text not null,
 state text not null default 'queued' check(state in ('queued','running','succeeded','failed','canceled')),
 idempotency_key text not null, payload_hash text not null,
 worker_id uuid references public.fm_v2_workers(id), lease_token uuid, lease_until timestamptz,
 attempt integer not null default 0, error_code text, stage text, engine jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,idempotency_key)
);
alter table public.fm_v2_assets add constraint fm_v2_asset_job foreign key(job_id) references public.fm_v2_jobs(id);
create table public.fm_v2_profiles (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 answers jsonb not null, created_at timestamptz not null default now()
);
create table public.fm_v2_recommendations (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid references public.fm_v2_profiles(id), snapshot_hash text not null, data jsonb not null,
 created_at timestamptz not null default now()
);
create table public.fm_v2_looks (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, avatar_id uuid not null references public.fm_v2_models(id),
 fitting_id uuid references public.fm_v2_models(id), recommendation_id uuid references public.fm_v2_recommendations(id),
 created_at timestamptz not null default now()
);
create table public.fm_v2_feedback (
 user_id uuid not null references auth.users(id) on delete cascade, item_id uuid not null,
 recommendation_id uuid not null references public.fm_v2_recommendations(id),
 value text not null check(value in ('like','skip')), updated_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
create index fm_v2_jobs_queue on public.fm_v2_jobs(user_id,created_at,id) where state='queued';
create index fm_v2_jobs_lease on public.fm_v2_jobs(lease_until) where state='running';
create index fm_v2_assets_owner on public.fm_v2_assets(user_id,created_at desc);
create index fm_v2_models_owner on public.fm_v2_models(user_id,created_at desc);
create index fm_v2_models_wardrobe on public.fm_v2_models(user_id,wardrobe_item_id);
create index fm_v2_jobs_owner on public.fm_v2_jobs(user_id,created_at desc);
create index fm_v2_profiles_owner on public.fm_v2_profiles(user_id,created_at desc,id desc);
create index fm_v2_recs_owner on public.fm_v2_recommendations(user_id,created_at desc);
create index fm_v2_looks_owner on public.fm_v2_looks(user_id,created_at desc);
create index fm_v2_workers_owner on public.fm_v2_workers(user_id);
do $$ declare t text; begin
 foreach t in array array['assets','models','jobs','profiles','recommendations','looks','workers','feedback'] loop
  execute format('alter table public.fm_v2_%I enable row level security',t);
  execute format('revoke all on public.fm_v2_%I from public,anon,authenticated',t);
  execute format('grant all on public.fm_v2_%I to service_role',t);
  -- Browser never receives worker/lease secrets. User APIs explicitly project safe fields.
  if t not in ('workers','jobs') then
   execute format('grant select on public.fm_v2_%I to authenticated',t);
   execute format('create policy owner_read on public.fm_v2_%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end if;
 end loop;
end $$;

-- Server-authenticated create is serialized per actor: quota, cache and dedupe are atomic.
create function public.fm_v2_asset_intent(p_user uuid,p_id uuid,p_kind text,p_bytes bigint,p_source text,p_path text,p_job uuid default null)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,74));
 if (select count(*) from fm_v2_assets where user_id=p_user and created_at>now()-interval '24 hours')>=100 then raise exception 'QUOTA_EXCEEDED'; end if;
 if p_job is not null and not exists(select 1 from fm_v2_jobs where id=p_job and user_id=p_user and state='running') then raise exception 'INVALID_INPUT'; end if;
 insert into fm_v2_assets(id,user_id,kind,source_path,path,expected_bytes,job_id) values(p_id,p_user,p_kind,p_source,p_path,p_bytes,p_job);
 return true;
end $$;

create function public.fm_v2_enqueue(p_user uuid,p_key text,p_hash text,p_kind text,p_name text,p_inputs uuid[],p_params jsonb,p_wardrobe uuid default null,p_avatar uuid default null,p_garment uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; m fm_v2_models; a uuid; c text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into j from fm_v2_jobs where user_id=p_user and idempotency_key=p_key;
 if found then
  if j.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('jobId',j.id,'modelId',j.model_id,'reused',true);
 end if;
 if p_kind not in ('avatar','garment','fitting') or length(p_name) not between 1 and 80 or length(p_key)>100 then raise exception 'INVALID_INPUT'; end if;
 if coalesce(array_length(p_inputs,1),0)>4 then raise exception 'INVALID_INPUT'; end if;
 foreach a in array p_inputs loop
  if not exists(select 1 from fm_v2_assets where id=a and user_id=p_user and state='ready' and kind='photo') then raise exception 'INVALID_ASSET'; end if;
 end loop;
 if p_kind='avatar' and coalesce(array_length(p_inputs,1),0)<3 then raise exception 'INVALID_INPUT'; end if;
 if p_kind='garment' then
  select category into c from fm_wardrobe_items where id=p_wardrobe and user_id=p_user;
  if c is null or c not in ('shirt','t-shirt') or coalesce(array_length(p_inputs,1),0)<2 then raise exception 'INVALID_GARMENT'; end if;
 end if;
 if p_kind='fitting' then
  if not exists(select 1 from fm_v2_models where id=p_avatar and user_id=p_user and kind='avatar' and output_asset_id is not null)
   or not exists(select 1 from fm_v2_models where id=p_garment and user_id=p_user and kind='garment' and output_asset_id is not null) then raise exception 'MODEL_NOT_READY'; end if;
  select * into m from fm_v2_models where user_id=p_user and kind='fitting' and avatar_id=p_avatar and garment_id=p_garment;
  if found then
   select * into j from fm_v2_jobs where model_id=m.id;
   -- Same immutable avatar/garment pair has one cache entry; callers can retry failed jobs.
   return jsonb_build_object('jobId',j.id,'modelId',m.id,'reused',true);
  end if;
 end if;
 if (select count(*) from fm_v2_jobs where user_id=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=50
  or (select count(*) from fm_v2_jobs where user_id=p_user and state in ('queued','running'))>=20 then raise exception 'QUOTA_EXCEEDED'; end if;
 m.id=gen_random_uuid(); j.id=gen_random_uuid();
 insert into fm_v2_models(id,user_id,kind,name,input_assets,params,wardrobe_item_id,avatar_id,garment_id)
 values(m.id,p_user,p_kind,p_name,p_inputs,p_params || case when p_kind='garment' then jsonb_build_object('category',c) else '{}'::jsonb end,p_wardrobe,p_avatar,p_garment);
 insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash)
 values(j.id,p_user,m.id,case p_kind when 'avatar' then 'avatar.reconstruct' when 'garment' then 'garment.reconstruct' else 'garment.drape' end,p_key,p_hash);
 return jsonb_build_object('jobId',j.id,'modelId',m.id,'reused',false);
end $$;

create function public.fm_v2_claim(p_worker uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare w fm_v2_workers; j fm_v2_jobs; begin
 select * into w from fm_v2_workers where id=p_worker and enabled for update;
 if not found or w.last_seen is null or w.last_seen<now()-interval '90 seconds' then return null; end if;
 -- Lost leases recover only within this worker's owner's scope. At most three attempts.
 update fm_v2_jobs set state=case when attempt>=3 then 'failed' else 'queued' end,
 error_code='LEASE_EXPIRED',worker_id=null,lease_token=null,lease_until=null,updated_at=now()
 where user_id=w.user_id and state='running' and lease_until<now();
 if exists(select 1 from fm_v2_jobs where worker_id=p_worker and state='running') then return null; end if;
 select * into j from fm_v2_jobs where user_id=w.user_id and state='queued' and w.capabilities ? kind
 order by created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update fm_v2_jobs set state='running',worker_id=p_worker,lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',
 attempt=attempt+1,error_code=null,stage='starting',engine=w.capabilities->j.kind,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

create function public.fm_v2_transition(p_worker uuid,p_job uuid,p_token uuid,p_action text,p_stage text default null,p_asset uuid default null)
returns boolean language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; begin
 -- Serialize credential revocation with mutations, and lock job before publishing.
 perform 1 from fm_v2_workers where id=p_worker and enabled for update;
 if not found then return false; end if;
 select * into j from fm_v2_jobs where id=p_job and worker_id=p_worker and state='running' and lease_token=p_token and lease_until>now() for update;
 if not found then return false; end if;
 if p_action='heartbeat' then
  update fm_v2_jobs set lease_until=now()+interval '120 seconds',stage=left(p_stage,80),updated_at=now() where id=p_job;
 elsif p_action='complete' then
  if not exists(select 1 from fm_v2_assets where id=p_asset and user_id=j.user_id and job_id=j.id and state='ready' and kind='glb') then return false; end if;
  update fm_v2_models set output_asset_id=p_asset where id=j.model_id and user_id=j.user_id;
  update fm_v2_jobs set state='succeeded',stage='ready',lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 elsif p_action='fail' then
  update fm_v2_jobs set state='failed',error_code=p_stage,lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 else return false;
 end if;
 return true;
end $$;

create function public.fm_v2_job_action(p_user uuid,p_job uuid,p_action text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into j from fm_v2_jobs where id=p_job and user_id=p_user for update;
 if not found then return false; end if;
 if p_action='cancel' and j.state in ('queued','running','failed') then
  update fm_v2_jobs set state='canceled',lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 elsif p_action='retry' and j.state in ('failed','canceled') and j.attempt<3 then
  if (select count(*) from fm_v2_jobs where user_id=p_user and state in ('queued','running'))>=20 then raise exception 'QUOTA_EXCEEDED'; end if;
  update fm_v2_jobs set state='queued',error_code=null,stage=null,worker_id=null,lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 else return false;
 end if;
 return true;
end $$;

revoke all on function public.fm_v2_asset_intent(uuid,uuid,text,bigint,text,text,uuid), public.fm_v2_enqueue(uuid,text,text,text,text,uuid[],jsonb,uuid,uuid,uuid), public.fm_v2_claim(uuid), public.fm_v2_transition(uuid,uuid,uuid,text,text,uuid), public.fm_v2_job_action(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fm_v2_asset_intent(uuid,uuid,text,bigint,text,text,uuid), public.fm_v2_enqueue(uuid,text,text,text,text,uuid[],jsonb,uuid,uuid,uuid), public.fm_v2_claim(uuid), public.fm_v2_transition(uuid,uuid,uuid,text,text,uuid), public.fm_v2_job_action(uuid,uuid,text) to service_role;
-- Bucket is private; browser uses server-issued upload URLs only. No broad storage policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fitmatch-v2','fitmatch-v2',false,41943040,array['image/jpeg','image/png','image/webp','model/gltf-binary','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
