-- C2: avatar capture with optional video/face/measurements, draft decision, source retention.
-- Additive. Deleting a source is a tombstone: the asset row stays (state 'deleted') so no late
-- completion, retry or re-enqueue can bring the source back; dependent unfinished jobs are canceled.
begin;

-- 1. Private video uploads (container checked at finalize; decoding is the adapter's job).
alter table public.fm_v2_assets drop constraint fm_v2_assets_kind_check;
alter table public.fm_v2_assets add constraint fm_v2_assets_kind_check check (kind in ('photo','glb','video'));
alter table public.fm_v2_assets drop constraint fm_v2_assets_expected_bytes_check;
alter table public.fm_v2_assets add constraint fm_v2_assets_expected_bytes_check
  check (expected_bytes >= 1 and expected_bytes <= (case when kind = 'video' then 157286400 else 41943040 end));
alter table public.fm_v2_assets drop constraint fm_v2_assets_state_check;
alter table public.fm_v2_assets add constraint fm_v2_assets_state_check check (state in ('pending','ready','rejected','deleted'));
alter table public.fm_v2_assets add column deleted_at timestamptz;
update storage.buckets set file_size_limit = 157286400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','model/gltf-binary','application/octet-stream','video/mp4','video/webm','video/quicktime']
  where id = 'fitmatch-v2';

-- 2. Avatar draft decision and source retention choice.
alter table public.fm_v2_models
  add column accepted_at timestamptz,
  add column source_retention text check (source_retention in ('keep','deleted'));

-- 3. Enqueue (same signature). Avatar inputs: 3 body photos, or one video plus at least one photo
--    (face); at most 6 inputs. Roles travel in params.roles, one per input, validated here.
create or replace function public.fm_v2_enqueue(p_user uuid,p_key text,p_hash text,p_kind text,p_name text,p_inputs uuid[],p_params jsonb,p_wardrobe uuid default null,p_avatar uuid default null,p_garment uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; m fm_v2_models; g fm_v2_models; a uuid; c text; s text; n int; videos int := 0; photos int := 0; k text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into j from fm_v2_jobs where user_id=p_user and idempotency_key=p_key;
 if found then
  if j.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('jobId',j.id,'modelId',j.model_id,'reused',true);
 end if;
 if p_kind not in ('avatar','garment','fitting') or length(p_name) not between 1 and 80 or length(p_key)>100 then raise exception 'INVALID_INPUT'; end if;
 n := coalesce(array_length(p_inputs,1),0);
 if n > (case when p_kind='avatar' then 6 else 4 end) then raise exception 'INVALID_INPUT'; end if;
 foreach a in array p_inputs loop
  select kind into k from fm_v2_assets where id=a and user_id=p_user and state='ready';
  if k is null or k not in ('photo','video') or (k='video' and p_kind<>'avatar') then raise exception 'INVALID_ASSET'; end if;
  if k='video' then videos := videos+1; else photos := photos+1; end if;
 end loop;
 if p_kind='avatar' then
  if videos>1 or (videos=0 and photos<3) or (videos=1 and photos<1) then raise exception 'INVALID_INPUT'; end if;
  if p_params ? 'roles' and (jsonb_typeof(p_params->'roles')<>'array' or jsonb_array_length(p_params->'roles')<>n) then raise exception 'INVALID_INPUT'; end if;
 end if;
 if p_kind='garment' then
  select category into c from fm_wardrobe_items where id=p_wardrobe and user_id=p_user;
  s := case when c in ('shirt','t-shirt') then 'top' when c = 'jeans' then 'bottom' end;
  if s is null or n<2 then raise exception 'INVALID_GARMENT'; end if;
 end if;
 if p_kind='fitting' then
  select * into g from fm_v2_models where id=p_garment and user_id=p_user and kind='garment' and output_asset_id is not null;
  if not found or not exists(select 1 from fm_v2_models where id=p_avatar and user_id=p_user and kind='avatar' and output_asset_id is not null)
   then raise exception 'MODEL_NOT_READY'; end if;
  s := g.slot;
  select * into m from fm_v2_models where user_id=p_user and kind='fitting' and avatar_id=p_avatar and garment_id=p_garment;
  if found then
   select * into j from fm_v2_jobs where model_id=m.id;
   return jsonb_build_object('jobId',j.id,'modelId',m.id,'reused',true,'slot',m.slot);
  end if;
 end if;
 if (select count(*) from fm_v2_jobs where user_id=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=50
  or (select count(*) from fm_v2_jobs where user_id=p_user and state in ('queued','running'))>=20 then raise exception 'QUOTA_EXCEEDED'; end if;
 m.id=gen_random_uuid(); j.id=gen_random_uuid();
 insert into fm_v2_models(id,user_id,kind,name,input_assets,params,wardrobe_item_id,avatar_id,garment_id,slot)
 values(m.id,p_user,p_kind,p_name,p_inputs,p_params || case when p_kind='garment' then jsonb_build_object('category',c) else '{}'::jsonb end,p_wardrobe,p_avatar,p_garment,s);
 insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash)
 values(j.id,p_user,m.id,case
   when p_kind='avatar' then 'avatar.reconstruct'
   when p_kind='garment' and s='top' then 'garment.reconstruct'
   when p_kind='garment' then 'bottom.reconstruct'
   when s='top' then 'garment.drape'
   else 'bottom.drape' end,p_key,p_hash);
 return jsonb_build_object('jobId',j.id,'modelId',m.id,'reused',false,'slot',s);
end $$;

-- 4. Retry never revives a job whose inputs were deleted.
create or replace function public.fm_v2_job_action(p_user uuid,p_job uuid,p_action text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into j from fm_v2_jobs where id=p_job and user_id=p_user for update;
 if not found then return false; end if;
 if p_action='cancel' and j.state in ('queued','running','failed') then
  update fm_v2_jobs set state='canceled',lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 elsif p_action='retry' and j.state in ('failed','canceled') and j.attempt<3 then
  if exists(select 1 from fm_v2_models m join fm_v2_assets a on a.id = any(m.input_assets)
            where m.id=j.model_id and a.state='deleted') then return false; end if;
  if (select count(*) from fm_v2_jobs where user_id=p_user and state in ('queued','running'))>=20 then raise exception 'QUOTA_EXCEEDED'; end if;
  update fm_v2_jobs set state='queued',error_code=null,stage=null,worker_id=null,lease_token=null,lease_until=null,updated_at=now() where id=p_job;
 else return false;
 end if;
 return true;
end $$;

-- 5. Source retention. 'keep' records the choice; 'delete' tombstones the avatar's source assets,
--    cancels every unfinished job that reads them, and returns the storage objects to remove.
--    The derived avatar GLB, fittings and looks are kept.
create function public.fm_v2_source_retention(p_user uuid,p_model uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare m fm_v2_models; paths jsonb; canceled int; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into m from fm_v2_models where id=p_model and user_id=p_user and kind='avatar' for update;
 if not found then raise exception 'MODEL_NOT_FOUND'; end if;
 if p_action='keep' then
  if m.source_retention='deleted' then raise exception 'SOURCE_ALREADY_DELETED'; end if;
  update fm_v2_models set source_retention='keep' where id=p_model;
  return jsonb_build_object('retention','keep','paths','[]'::jsonb,'canceledJobs',0);
 elsif p_action<>'delete' then raise exception 'INVALID_INPUT';
 end if;
 select coalesce(jsonb_agg(jsonb_build_array(a.path,a.source_path)),'[]'::jsonb) into paths
   from fm_v2_assets a where a.user_id=p_user and a.id = any(m.input_assets) and a.state<>'deleted';
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
 return jsonb_build_object('retention','deleted','paths',paths,'canceledJobs',canceled);
end $$;
revoke all on function public.fm_v2_source_retention(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.fm_v2_source_retention(uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';
commit;
