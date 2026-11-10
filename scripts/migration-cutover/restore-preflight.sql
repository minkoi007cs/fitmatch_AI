-- APP-RECOVERY-32 — READ-ONLY preflight for a RESTORE TARGET (a fresh, disposable project, never canonical).
-- Fails (ERROR, non-zero psql exit with ON_ERROR_STOP) unless the target is empty: no relations in public and
-- no rows in auth.users / storage.buckets / storage.objects. Role conflicts are checked separately against
-- the CREATE ROLE lines of roles.sql (README §3.1).
-- Usage: psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -f restore-preflight.sql
do $$
declare rels int; rows_ bigint;
begin
  select count(*) into rels from pg_class k join pg_namespace n on n.oid = k.relnamespace
   where n.nspname = 'public' and k.relkind in ('r', 'p', 'v', 'm', 'S', 'f');
  select (select count(*) from auth.users) + (select count(*) from storage.buckets) + (select count(*) from storage.objects) into rows_;
  if rels <> 0 then raise exception 'restore target is not fresh: % relation(s) in schema public', rels; end if;
  if rows_ <> 0 then raise exception 'restore target is not fresh: % row(s) in auth.users/storage', rows_; end if;
end $$;
select 'restore target is fresh';
