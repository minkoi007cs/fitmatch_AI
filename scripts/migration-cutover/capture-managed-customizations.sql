-- APP-RECOVERY-32 — READ-ONLY. Emits DDL for OUR objects inside the Supabase-managed schemas auth/storage,
-- which `supabase db dump` (schema) skips: triggers on auth/storage tables that call non-platform functions,
-- and RLS policies on auth/storage tables. Review the output before restoring it; platform objects are excluded.
-- Usage: psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -f capture-managed-customizations.sql > auth-storage-custom.sql
\set QUIET 1
SET search_path = ''; -- empty search_path: every name in the output is schema-qualified
select string_agg(ddl, E'\n' order by ord, ddl) from (
  select 1 as ord, pg_get_triggerdef(t.oid) || ';' as ddl
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where n.nspname in ('auth', 'storage') and not t.tgisinternal and pn.nspname not in ('auth', 'storage')
  union all
  select 2, format('create policy %I on %I.%I as %s for %s to %s%s%s;', policyname, schemaname, tablename,
    lower(permissive), lower(cmd), array_to_string(roles, ', '),
    coalesce(' using (' || qual || ')', ''), coalesce(' with check (' || with_check || ')', ''))
  from pg_policies where schemaname in ('auth', 'storage')
) x;
