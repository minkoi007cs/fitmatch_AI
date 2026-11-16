-- CAT54: human-confirmed analysis metadata only; no new 3D capabilities.
-- Keeps the existing invoker, owner/source/digest checks, replay handling and function grants.
create or replace function public.fm_v2_analysis_confirm(p_user uuid, p_analysis uuid, p_confirmation uuid, p_digest text,
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
     or (p_columns ? 'category' and p_columns ->> 'category' not in ('t-shirt','shirt','hoodie','jacket','sweater','jeans'))
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
