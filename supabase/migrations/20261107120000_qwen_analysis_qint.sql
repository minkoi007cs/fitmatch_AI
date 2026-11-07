-- QINT-C: garment analysis (Qwen) as a JSON-result job in the existing V2 control plane. Additive.
-- A job is now about either a 3D model (model_id, unchanged) or an analysis (analysis_id). Analysis
-- jobs never touch models/assets outputs, never produce a GLB and are only claimable by a worker the
-- operator granted 'garment.analyze'. Results are proposals; only an authenticated human
-- confirmation writes wardrobe metadata (fm_v2_analysis_confirm).
begin;

alter table public.fm_v2_workers drop constraint fm_v2_workers_allowed_capabilities_check;
alter table public.fm_v2_workers add constraint fm_v2_workers_allowed_capabilities_check
  check (allowed_capabilities <@ array['avatar.reconstruct','garment.reconstruct','garment.drape',
                                       'bottom.reconstruct','bottom.drape','garment.analyze']::text[]);

create table public.fm_v2_analyses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.fm_wardrobe_items(id) on delete cascade,
  -- Wardrobe image_path at request time; the item must still point at it when a human confirms.
  source_path text not null check (length(source_path) between 1 and 1024),
  -- Immutable normalized snapshot the worker analyzes (private bucket, signed URL per claim).
  image_asset_id uuid not null references public.fm_v2_assets(id),
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  policy_revision text not null check (length(policy_revision) between 1 and 40),
  status text not null default 'pending' check (status in ('pending','review','confirmed','rejected','stale')),
  result_json text check (result_json is null or octet_length(result_json) <= 8192),
  result jsonb,
  result_sha256 text check (result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$'),
  model_revision jsonb,
  result_worker uuid references public.fm_v2_workers(id) on delete set null,
  result_lease_token uuid,
  result_at timestamptz,
  confirmation_id uuid unique,
  confirmation_digest text,
  confirmed_fields jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, image_sha256, policy_revision),
  check ((result_json is null) = (result_sha256 is null)),
  check ((status in ('review','confirmed','rejected')) <= (result_json is not null)),
  check ((status in ('confirmed','rejected')) = (confirmation_id is not null))
);
create index fm_v2_analyses_item on public.fm_v2_analyses(user_id, item_id, created_at desc);
alter table public.fm_v2_analyses enable row level security;
revoke all on public.fm_v2_analyses from public, anon, authenticated;
grant all on public.fm_v2_analyses to service_role;

alter table public.fm_v2_jobs alter column model_id drop not null;
alter table public.fm_v2_jobs
  add column analysis_id uuid unique references public.fm_v2_analyses(id) on delete cascade,
  add column not_before timestamptz,
  add column deferrals integer not null default 0 check (deferrals >= 0),
  add constraint fm_v2_jobs_subject check ((model_id is null) <> (analysis_id is null)),
  add constraint fm_v2_jobs_analysis_kind check ((analysis_id is not null) = (kind = 'garment.analyze'));

-- Same signature as R1. Only change: a deferred job (GPU busy / memory admission) waits for
-- not_before; ordering stays FIFO by created_at so a deferral cannot starve older work.
create or replace function public.fm_v2_claim_r1(p_worker uuid, p_instance uuid, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare w fm_v2_workers; j fm_v2_jobs; begin
 select * into w from fm_v2_workers where id = p_worker and enabled for update;
 if not found or w.last_seen is null or w.last_seen < now() - interval '90 seconds' then return null; end if;
 update fm_v2_jobs set state = case when attempt >= 3 then 'failed' else 'queued' end,
  error_code = 'LEASE_EXPIRED', worker_id = null, lease_token = null, lease_until = null,
  claim_instance = null, claim_request = null, updated_at = now()
 where user_id = w.user_id and state = 'running' and lease_until < now();
 select * into j from fm_v2_jobs where worker_id = p_worker and state = 'running' for update;
 if found then
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
  and (not_before is null or not_before <= now())
 order by created_at, id for update skip locked limit 1;
 if not found then return null; end if;
 update fm_v2_jobs set state = 'running', worker_id = p_worker, lease_token = gen_random_uuid(),
  lease_until = now() + interval '120 seconds', attempt = attempt + 1, error_code = null, stage = 'starting',
  engine = w.capabilities -> j.kind, claim_instance = p_instance, claim_request = p_request, updated_at = now()
 where id = j.id returning * into j;
 return to_jsonb(j) || jsonb_build_object('redelivered', false);
end $$;

-- Creates (or returns) the analysis for one owned item/snapshot. The caller has already stored
-- the normalized snapshot as a ready photo asset. A duplicate snapshot from a lost race is
-- tombstoned and scheduled for removal through the CL-PRIV-01 intents.
create function public.fm_v2_analysis_enqueue(p_user uuid, p_item uuid, p_source_path text, p_asset uuid,
  p_sha text, p_policy text, p_analysis uuid, p_job uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a fm_v2_analyses; s text; j fm_v2_jobs; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 perform 1 from fm_wardrobe_items where id = p_item and user_id = p_user and image_path = p_source_path;
 if not found then raise exception 'ITEM_NOT_FOUND'; end if;
 perform 1 from fm_v2_assets where id = p_asset and user_id = p_user and kind = 'photo' and state = 'ready' and sha256 = p_sha;
 if not found then raise exception 'INVALID_ASSET'; end if;
 select * into a from fm_v2_analyses where user_id = p_user and item_id = p_item and image_sha256 = p_sha and policy_revision = p_policy;
 if found then
  if a.image_asset_id <> p_asset then
   insert into fm_v2_source_cleanup(user_id, asset_id, path)
   select p_user, x.id, p.path from fm_v2_assets x cross join lateral (values (x.path), (x.source_path)) p(path)
    where x.id = p_asset on conflict (asset_id, path) do nothing;
   update fm_v2_assets set state = 'deleted', deleted_at = now() where id = p_asset and user_id = p_user;
  end if;
  select * into j from fm_v2_jobs where analysis_id = a.id;
  return jsonb_build_object('analysisId', a.id, 'jobId', j.id, 'deduped', true);
 end if;
 insert into fm_v2_analyses(id, user_id, item_id, source_path, image_asset_id, image_sha256, policy_revision)
  values (p_analysis, p_user, p_item, p_source_path, p_asset, p_sha, p_policy);
 insert into fm_v2_jobs(id, user_id, analysis_id, kind, idempotency_key, payload_hash)
  values (p_job, p_user, p_analysis, 'garment.analyze', 'analysis:' || p_analysis, p_sha);
 return jsonb_build_object('analysisId', p_analysis, 'jobId', p_job, 'deduped', false);
end $$;

-- Worker result, fenced by the lease. Returns 'ok' | 'replay' | 'lease_lost' | 'mismatch' | 'stale'.
-- The route validated schema/bytes; identity is re-checked here inside the transaction.
create function public.fm_v2_analysis_result(p_worker uuid, p_job uuid, p_token uuid, p_sha text, p_json text, p_result jsonb)
returns text language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; a fm_v2_analyses; begin
 perform 1 from fm_v2_workers where id = p_worker and enabled for update;
 if not found then return 'lease_lost'; end if;
 select * into a from fm_v2_analyses x where x.id = (select analysis_id from fm_v2_jobs where id = p_job) for update;
 if found and a.result_sha256 = p_sha and a.result_worker = p_worker and a.result_lease_token = p_token then
  return 'replay'; -- identical replay of an accepted result whose reply was lost
 end if;
 select * into j from fm_v2_jobs where id = p_job and worker_id = p_worker and state = 'running'
  and lease_token = p_token and lease_until > now() and kind = 'garment.analyze' for update;
 if not found or a.id is null then return 'lease_lost'; end if;
 if p_result #>> '{binding,jobId}' is distinct from j.id::text
    or p_result #>> '{binding,analysisId}' is distinct from a.id::text
    or p_result #>> '{binding,itemId}' is distinct from a.item_id::text
    or p_result #>> '{binding,imageAssetId}' is distinct from a.image_asset_id::text
    or p_result #>> '{binding,imageSha256}' is distinct from a.image_sha256
    or p_result -> 'modelRevision' is distinct from j.engine
    or p_result ->> 'policyRevision' is distinct from a.policy_revision
    or encode(sha256(convert_to(p_json, 'UTF8')), 'hex') <> p_sha then
  return 'mismatch';
 end if;
 -- Late result for a source that changed or was deleted meanwhile: never applied.
 if a.status <> 'pending'
    or not exists(select 1 from fm_wardrobe_items where id = a.item_id and user_id = a.user_id and image_path = a.source_path)
    or not exists(select 1 from fm_v2_assets where id = a.image_asset_id and state = 'ready') then
  update fm_v2_jobs set state = 'canceled', error_code = 'SOURCE_CHANGED', lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
  update fm_v2_analyses set status = 'stale', updated_at = now() where id = a.id and status = 'pending';
  return 'stale';
 end if;
 update fm_v2_analyses set status = 'review', result_json = p_json, result = p_result, result_sha256 = p_sha,
  model_revision = j.engine, result_worker = p_worker, result_lease_token = p_token, result_at = now(), updated_at = now()
  where id = a.id;
 update fm_v2_jobs set state = 'succeeded', stage = 'review', lease_token = null, lease_until = null,
  claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
 return 'ok';
end $$;

-- GPU_BUSY / MEMORY_PRESSURE: back to the queue after a bounded backoff without consuming an
-- inference attempt. After 5 deferrals the job fails with GPU_UNAVAILABLE.
create function public.fm_v2_analysis_defer(p_worker uuid, p_job uuid, p_token uuid, p_code text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; begin
 if p_code not in ('GPU_BUSY','MEMORY_PRESSURE') then return false; end if;
 perform 1 from fm_v2_workers where id = p_worker and enabled for update;
 if not found then return false; end if;
 select * into j from fm_v2_jobs where id = p_job and worker_id = p_worker and state = 'running'
  and lease_token = p_token and lease_until > now() and kind = 'garment.analyze' for update;
 if not found then return false; end if;
 if j.deferrals + 1 > 5 then
  update fm_v2_jobs set state = 'failed', error_code = 'GPU_UNAVAILABLE', lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
 else
  update fm_v2_jobs set state = 'queued', error_code = p_code, attempt = greatest(attempt - 1, 0),
   deferrals = deferrals + 1, worker_id = null, lease_token = null, lease_until = null, stage = 'waiting_gpu',
   not_before = now() + least(interval '15 seconds' * power(2, j.deferrals), interval '10 minutes'),
   claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
 end if;
 return true;
end $$;

-- Owner actions: cancel a queued/running analysis, or retry a failed one (bounded by attempts).
create function public.fm_v2_analysis_action(p_user uuid, p_analysis uuid, p_action text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; a fm_v2_analyses; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 select * into a from fm_v2_analyses where id = p_analysis and user_id = p_user for update;
 if not found then raise exception 'ANALYSIS_NOT_FOUND'; end if;
 select * into j from fm_v2_jobs where analysis_id = a.id for update;
 if p_action = 'cancel' then
  if a.status <> 'pending' or j.state not in ('queued','running') then return false; end if;
  update fm_v2_jobs set state = 'canceled', error_code = 'CANCELED', lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
  return true;
 elsif p_action = 'retry' then
  if a.status <> 'pending' or j.state not in ('failed','canceled') or j.attempt >= 3 then return false; end if;
  if not exists(select 1 from fm_wardrobe_items where id = a.item_id and user_id = p_user and image_path = a.source_path)
     or not exists(select 1 from fm_v2_assets where id = a.image_asset_id and state = 'ready') then
   raise exception 'SOURCE_CHANGED';
  end if;
  update fm_v2_jobs set state = 'queued', error_code = null, deferrals = 0, not_before = null, stage = null,
   updated_at = now() where id = j.id;
  return true;
 end if;
 raise exception 'INVALID_INPUT';
end $$;

-- Human decision. Writes ONLY the wardrobe columns in p_columns (already mapped and validated by the
-- route), only for the owner, only while the item still shows the analyzed image and the result is
-- the one the user looked at. Same confirmation id again is an idempotent replay.
create function public.fm_v2_analysis_confirm(p_user uuid, p_analysis uuid, p_confirmation uuid, p_digest text,
  p_expected_sha text, p_decision text, p_fields jsonb, p_columns jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a fm_v2_analyses; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 select * into a from fm_v2_analyses where id = p_analysis and user_id = p_user for update;
 if not found then raise exception 'ANALYSIS_NOT_FOUND'; end if;
 if a.confirmation_id = p_confirmation then
  if a.confirmation_digest is distinct from p_digest then raise exception 'CONFIRMATION_REUSED'; end if;
  return jsonb_build_object('status', a.status, 'replay', true);
 end if;
 if a.status in ('confirmed','rejected') then raise exception 'ALREADY_DECIDED'; end if;
 if a.status <> 'review' then raise exception 'NOT_REVIEWABLE'; end if;
 if a.result_sha256 is distinct from p_expected_sha then raise exception 'RESULT_CHANGED'; end if;
 perform 1 from fm_wardrobe_items where id = a.item_id and user_id = p_user and image_path = a.source_path for update;
 if not found then raise exception 'SOURCE_CHANGED'; end if;
 if p_decision = 'approve' then
  p_columns := coalesce(p_columns, '{}'::jsonb);
  if (p_columns = '{}'::jsonb and not coalesce(p_fields ? 'logoText', false))
     or exists(select 1 from jsonb_object_keys(p_columns) k where k not in ('category','color','secondary_color','pattern'))
     or (p_columns ? 'category' and p_columns ->> 'category' not in ('t-shirt','jeans'))
     or (p_columns ? 'color' and coalesce(p_columns ->> 'color', '') = '') then
   raise exception 'INVALID_INPUT';
  end if;
  if p_columns <> '{}'::jsonb then
  update fm_wardrobe_items set
   category = case when p_columns ? 'category' then p_columns ->> 'category' else category end,
   color = case when p_columns ? 'color' then p_columns ->> 'color' else color end,
   secondary_color = case when p_columns ? 'secondary_color' then p_columns ->> 'secondary_color' else secondary_color end,
   pattern = case when p_columns ? 'pattern' then p_columns ->> 'pattern' else pattern end,
   updated_at = now()
  where id = a.item_id and user_id = p_user;
  end if;
  update fm_v2_analyses set status = 'confirmed', confirmation_id = p_confirmation, confirmation_digest = p_digest,
   confirmed_fields = p_fields, confirmed_at = now(), updated_at = now() where id = a.id;
 elsif p_decision = 'reject' then
  update fm_v2_analyses set status = 'rejected', confirmation_id = p_confirmation, confirmation_digest = p_digest,
   confirmed_fields = '{}'::jsonb, confirmed_at = now(), updated_at = now() where id = a.id;
 else raise exception 'INVALID_INPUT';
 end if;
 return jsonb_build_object('status', case when p_decision = 'approve' then 'confirmed' else 'rejected' end, 'replay', false);
end $$;

-- Deleting an analysis (directly or because its wardrobe item was deleted) tombstones its private
-- snapshot and records removal intents; the CL-PRIV-01 route/collector removes the objects.
create function public.fm_v2_analysis_tombstone() returns trigger language plpgsql security definer
set search_path = public as $$ begin
 insert into fm_v2_source_cleanup(user_id, asset_id, path)
 select x.user_id, x.id, p.path from fm_v2_assets x cross join lateral (values (x.path), (x.source_path)) p(path)
  where x.id = old.image_asset_id and x.state <> 'deleted' on conflict (asset_id, path) do nothing;
 update fm_v2_assets set state = 'deleted', deleted_at = now() where id = old.image_asset_id and state <> 'deleted';
 return old;
end $$;
create trigger fm_v2_analysis_tombstone after delete on public.fm_v2_analyses
  for each row execute function public.fm_v2_analysis_tombstone();

revoke all on function public.fm_v2_analysis_enqueue(uuid,uuid,text,uuid,text,text,uuid,uuid),
  public.fm_v2_analysis_result(uuid,uuid,uuid,text,text,jsonb), public.fm_v2_analysis_defer(uuid,uuid,uuid,text),
  public.fm_v2_analysis_action(uuid,uuid,text), public.fm_v2_analysis_confirm(uuid,uuid,uuid,text,text,text,jsonb,jsonb),
  public.fm_v2_analysis_tombstone() from public, anon, authenticated;
grant execute on function public.fm_v2_analysis_enqueue(uuid,uuid,text,uuid,text,text,uuid,uuid),
  public.fm_v2_analysis_result(uuid,uuid,uuid,text,text,jsonb), public.fm_v2_analysis_defer(uuid,uuid,uuid,text),
  public.fm_v2_analysis_action(uuid,uuid,text), public.fm_v2_analysis_confirm(uuid,uuid,uuid,text,text,text,jsonb,jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;
