-- C1 full look: independent top/bottom slots, jeans as a real bottom category, whole-outfit looks.
-- Additive: existing rows keep working. Existing garments/fittings are tops (enqueue only allowed
-- shirt/t-shirt before), so they are backfilled to slot 'top'. Old workers keep their capabilities;
-- bottoms use new job kinds so a top-only adapter can never receive jeans (default deny).
begin;

-- 1. Slot on garment/fitting versions. A model row is an immutable version: its id is the
--    item/avatar version, its output asset sha256 is the material/geometry version.
alter table public.fm_v2_models add column slot text check (slot in ('top','bottom'));
update public.fm_v2_models set slot = 'top' where kind in ('garment','fitting') and slot is null;
alter table public.fm_v2_models add constraint fm_v2_models_slot_kind
  check ((kind = 'avatar' and slot is null) or (kind in ('garment','fitting') and slot is not null));
create index fm_v2_models_slot on public.fm_v2_models(user_id, avatar_id, slot) where kind = 'fitting';

-- 2. Capabilities for bottoms. Widening a check constraint only.
alter table public.fm_v2_workers drop constraint fm_v2_workers_allowed_capabilities_check;
alter table public.fm_v2_workers add constraint fm_v2_workers_allowed_capabilities_check
  check (allowed_capabilities <@ array['avatar.reconstruct','garment.reconstruct','garment.drape',
                                       'bottom.reconstruct','bottom.drape']::text[]);

-- 3. Enqueue: same signature (PostgREST callers unchanged). Category decides the slot server-side;
--    the client cannot label jeans as a shirt or the reverse.
create or replace function public.fm_v2_enqueue(p_user uuid,p_key text,p_hash text,p_kind text,p_name text,p_inputs uuid[],p_params jsonb,p_wardrobe uuid default null,p_avatar uuid default null,p_garment uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare j fm_v2_jobs; m fm_v2_models; g fm_v2_models; a uuid; c text; s text; begin
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
  s := case when c in ('shirt','t-shirt') then 'top' when c = 'jeans' then 'bottom' end;
  if s is null or coalesce(array_length(p_inputs,1),0)<2 then raise exception 'INVALID_GARMENT'; end if;
 end if;
 if p_kind='fitting' then
  select * into g from fm_v2_models where id=p_garment and user_id=p_user and kind='garment' and output_asset_id is not null;
  if not found or not exists(select 1 from fm_v2_models where id=p_avatar and user_id=p_user and kind='avatar' and output_asset_id is not null)
   then raise exception 'MODEL_NOT_READY'; end if;
  s := g.slot;
  select * into m from fm_v2_models where user_id=p_user and kind='fitting' and avatar_id=p_avatar and garment_id=p_garment;
  if found then
   select * into j from fm_v2_jobs where model_id=m.id;
   -- One cache entry per immutable (avatar version, item version); per item, never per outfit combination.
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

-- 4. Whole-outfit looks: both slots, camera and the exact asset versions at save time.
alter table public.fm_v2_looks
  add column top_fitting_id uuid references public.fm_v2_models(id),
  add column bottom_fitting_id uuid references public.fm_v2_models(id),
  add column camera jsonb,
  add column snapshot jsonb;

create function public.fm_v2_save_look(p_user uuid,p_name text,p_avatar uuid,p_top uuid,p_bottom uuid,p_camera jsonb,p_recommendation uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare av fm_v2_models; f fm_v2_models; slot_name text; fit uuid; versions jsonb := '{}'; sha text; l fm_v2_looks; begin
 if length(trim(p_name)) not between 1 and 80 then raise exception 'INVALID_INPUT'; end if;
 select * into av from fm_v2_models where id=p_avatar and user_id=p_user and kind='avatar' and output_asset_id is not null;
 if not found then raise exception 'MODEL_NOT_READY'; end if;
 select sha256 into sha from fm_v2_assets where id=av.output_asset_id and user_id=p_user and state='ready';
 if sha is null then raise exception 'MODEL_NOT_READY'; end if;
 versions := jsonb_build_object('avatar',jsonb_build_object('modelId',av.id,'sha256',sha));
 foreach slot_name in array array['top','bottom'] loop
  fit := case slot_name when 'top' then p_top else p_bottom end;
  continue when fit is null;
  select * into f from fm_v2_models where id=fit and user_id=p_user and kind='fitting' and avatar_id=p_avatar and slot=slot_name and output_asset_id is not null;
  if not found then raise exception 'FITTING_NOT_READY'; end if;
  select sha256 into sha from fm_v2_assets where id=f.output_asset_id and user_id=p_user and state='ready';
  if sha is null then raise exception 'FITTING_NOT_READY'; end if;
  versions := versions || jsonb_build_object(slot_name,jsonb_build_object('fittingId',f.id,'garmentId',f.garment_id,'sha256',sha));
 end loop;
 if p_recommendation is not null and not exists(select 1 from fm_v2_recommendations where id=p_recommendation and user_id=p_user)
  then raise exception 'LOOK_NOT_FOUND'; end if;
 insert into fm_v2_looks(id,user_id,name,avatar_id,fitting_id,top_fitting_id,bottom_fitting_id,camera,snapshot,recommendation_id)
 values(gen_random_uuid(),p_user,trim(p_name),p_avatar,p_top,p_top,p_bottom,p_camera,versions,p_recommendation)
 returning * into l;
 return to_jsonb(l);
end $$;
revoke all on function public.fm_v2_save_look(uuid,text,uuid,uuid,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.fm_v2_save_look(uuid,text,uuid,uuid,uuid,jsonb,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
