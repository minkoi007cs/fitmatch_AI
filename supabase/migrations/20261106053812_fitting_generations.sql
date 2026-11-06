begin;
alter table public.fm_v2_models add column superseded_by uuid references public.fm_v2_models(id) deferrable initially deferred;
drop index public.fm_v2_fitting_cache;
create unique index fm_v2_fitting_cache on public.fm_v2_models(user_id,avatar_id,garment_id) where kind='fitting' and superseded_by is null;
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
  select * into m from fm_v2_models where user_id=p_user and kind='fitting' and avatar_id=p_avatar and garment_id=p_garment and superseded_by is null;
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


alter function public.fm_v2_job_action(uuid,uuid,text) rename to fm_v2_job_action_legacy;
create function public.fm_v2_job_action(p_user uuid,p_job uuid,p_action text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; m fm_v2_models; successor uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,73));
 select * into j from fm_v2_jobs where id=p_job and user_id=p_user for update;
 if not found then return false; end if;
 select * into m from fm_v2_models where id=j.model_id and user_id=p_user;
 if m.superseded_by is not null then return p_action='regenerate'; end if;
 if p_action<>'regenerate' then return fm_v2_job_action_legacy(p_user,p_job,p_action); end if;
 if m.kind<>'fitting' or m.output_asset_id is not null or j.state not in ('failed','canceled') or j.attempt<3 or j.error_code='SOURCE_DELETED' then return false; end if;
 -- Fitting reads derived GLBs; deletion of original photos does not invalidate these retained assets.
 if (select count(*) from fm_v2_models d join fm_v2_assets a on a.id=d.output_asset_id
     where d.id in (m.avatar_id,m.garment_id) and d.user_id=p_user and a.user_id=p_user and a.state='ready')<>2 then return false; end if;
 if exists(select 1 from fm_v2_assets where id=any(m.input_assets) and state='deleted') then return false; end if;
 if (select count(*) from fm_v2_jobs where user_id=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=50
 or (select count(*) from fm_v2_jobs where user_id=p_user and state in ('queued','running'))>=20 then raise exception 'QUOTA_EXCEEDED'; end if;
 successor=gen_random_uuid();
 update fm_v2_models set superseded_by=successor where id=m.id;
 insert into fm_v2_models(id,user_id,kind,name,input_assets,params,wardrobe_item_id,avatar_id,garment_id,slot)
 values(successor,p_user,m.kind,m.name,m.input_assets,m.params,m.wardrobe_item_id,m.avatar_id,m.garment_id,m.slot);
 insert into fm_v2_jobs(id,user_id,model_id,kind,idempotency_key,payload_hash)
 values(gen_random_uuid(),p_user,successor,j.kind,'regen_'||j.id::text,'regen_'||j.id::text);
 return true;
end $$;
revoke all on function public.fm_v2_job_action(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fm_v2_job_action(uuid,uuid,text) to service_role;
notify pgrst, 'reload schema';
commit;
