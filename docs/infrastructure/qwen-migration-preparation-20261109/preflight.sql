-- READ ONLY. Explicitly target fitmatch-ai/gohczmqykjkrgdblgbog in the client.
-- A database name/current_user does not prove project identity.
begin read only;
select current_setting('server_version') as server_version,
       to_regclass('public.fm_users') is not null as profiles_exist,
       to_regclass('public.users') is not null as obsolete_auth_target_exists,
       to_regclass('supabase_migrations.schema_migrations') is not null as cli_history_exists,
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r' and c.relname like 'fm\_v2\_%' escape '\') as v2_tables;

select c.relname as table_name,a.attname as column_name,
       format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,
       pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where n.nspname='public' and c.relname in ('fm_users','fm_wardrobe_items','fm_outfits','fm_uploaded_items')
order by c.relname,a.attnum;

select c.relname as table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('fm_users','fm_wardrobe_items','fm_outfits','fm_uploaded_items')
order by c.relname,k.conname;

select n.nspname as schema_name,c.relname as table_name,t.tgname,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and (t.tgfoid=to_regprocedure('public.handle_new_user()')
       or (n.nspname='public' and c.relname in ('fm_users','fm_wardrobe_items')));

select p.proname,pg_get_functiondef(p.oid) as definition,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('handle_new_user','set_updated_at') and p.prokind='f';

select e.extname,n.nspname as extension_schema,e.extversion
from pg_extension e join pg_namespace n on n.oid=e.extnamespace;

select schemaname,tablename,policyname,cmd,roles,permissive,qual,with_check
from pg_policies where (schemaname='public' and tablename in ('fm_users','fm_wardrobe_items','fm_outfits','fm_uploaded_items'))
or (schemaname='storage' and (coalesce(qual,'') like '%fitmatch%' or coalesce(with_check,'') like '%fitmatch%'));

select id,public,file_size_limit,allowed_mime_types from storage.buckets where id in ('fitmatch-wardrobe','fitmatch-v2');
rollback;
