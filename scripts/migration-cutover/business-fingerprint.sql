-- APP-RECOVERY-32 — READ-ONLY business fingerprint (line 1) and per-table counts (line 2) of the data that must
-- survive backup → restore → cutover. Uses only columns that exist before and after the cutover; buckets
-- created by the cutover (fitmatch-v2) are excluded. Prints hashes/counts only, never row contents.
-- Rows created afterwards by smoke tests must be excluded by id when comparing.
-- Usage: psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -f business-fingerprint.sql
select md5(string_agg(t, '|' order by t)) from (
  select 'au:'||row(id,email)::text t from auth.users
  union all select 'u:'||row(id,email,style_profile,quiz_answers,created_at,updated_at)::text from public.fm_users
  union all select 'w:'||row(id,user_id,name,category,color,style,image_path,is_favorite,created_at,updated_at)::text from public.fm_wardrobe_items
  union all select 'o:'||row(id,user_id,source_item_id,data_json,style_category,is_saved,created_at)::text from public.fm_outfits
  union all select 'i:'||row(issuer,app_id,subject,user_id)::text from public.fm_auth_identities
  union all select 'r:'||row(refresh_hash,owner_id,sealed_result)::text from public.fm_auth_refreshes
  union all select 'so:'||row(bucket_id,name,owner,metadata)::text from storage.objects where bucket_id = 'fitmatch-wardrobe'
  union all select 'sb:'||row(id,public)::text from storage.buckets where id = 'fitmatch-wardrobe') x;
select string_agg(k||'='||n, ',' order by k) from (
  select 'auth.users' k, count(*) n from auth.users union all select 'fm_users', count(*) from public.fm_users
  union all select 'fm_wardrobe_items', count(*) from public.fm_wardrobe_items union all select 'fm_outfits', count(*) from public.fm_outfits
  union all select 'fm_auth_identities', count(*) from public.fm_auth_identities union all select 'fm_auth_refreshes', count(*) from public.fm_auth_refreshes
  union all select 'storage.objects(fitmatch-wardrobe)', count(*) from storage.objects where bucket_id = 'fitmatch-wardrobe') x;
