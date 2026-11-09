-- CL-MIGRATION-26 — legacy compatibility for the canonical fitmatch-ai project (gohczmqykjkrgdblgbog).
-- Generated as an empty file by Supabase CLI 3.0.0 (`supabase migration new legacy_compat_auth_outfits`).
--
-- Additive, guarded, rerunnable. Works on BOTH baselines:
--   * legacy (canonical): on_auth_user_created -> public.handle_new_user() inserts into public.users, which
--     does not exist (every new signup fails); fm_outfits already has style_category (NOT NULL, no default)
--     and is_saved (default false); wardrobe/outfit owner FKs reference public.fm_users;
--   * fresh (supabase/schema.sql): handle_new_user() already targets fm_users; fm_outfits lacks both columns.
--
-- What it does:
--   1. Refuses (raises, whole transaction rolls back) on any unexpected shape instead of guessing.
--   2. Corrects the provisioning target to public.fm_users with CREATE OR REPLACE of the SAME function
--      (same OID): the existing trigger keeps calling it; no trigger is created, dropped or duplicated.
--      SECURITY DEFINER with an empty search_path and schema-qualified names; EXECUTE revoked from
--      public/anon/authenticated (trigger invocation does not need it).
--   3. Adds fm_outfits.style_category / is_saved only where missing (fresh schema). Existing legacy columns,
--      their NOT NULL/defaults, values, FK targets, cascades and policies are untouched. No backfill.
-- It never touches existing rows, identities, refresh records, wardrobe data or storage.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  fn oid := to_regprocedure('public.handle_new_user()');
  id_attnum int2;
  bad text;
begin
  if to_regclass('public.fm_users') is null then
    raise exception 'COMPAT_PRECONDITION: public.fm_users is missing';
  end if;
  if to_regclass('public.fm_outfits') is null then
    raise exception 'COMPAT_PRECONDITION: public.fm_outfits is missing';
  end if;
  if fn is null then
    raise exception 'COMPAT_PRECONDITION: public.handle_new_user() is missing';
  end if;
  if (select prorettype <> 'trigger'::regtype from pg_proc where oid = fn) then
    raise exception 'COMPAT_PRECONDITION: public.handle_new_user() is not a trigger function';
  end if;
  if not (select pg_has_role(current_user, proowner, 'USAGE') from pg_proc where oid = fn) then
    raise exception 'COMPAT_PRECONDITION: run as the owner of public.handle_new_user() (no ownership change is made)';
  end if;
  -- With FORCE ROW LEVEL SECURITY even the definer (table owner) would be filtered by policies; refuse.
  if (select relforcerowsecurity from pg_class where oid = 'public.fm_users'::regclass) then
    raise exception 'COMPAT_PRECONDITION: fm_users has FORCE ROW LEVEL SECURITY; review provisioning first';
  end if;
  -- The only expected caller is a row trigger on auth.users; anything else is unknown territory.
  select string_agg(n.nspname || '.' || c.relname || ':' || t.tgname, ', ') into bad
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where t.tgfoid = fn and not t.tgisinternal and not (n.nspname = 'auth' and c.relname = 'users');
  if bad is not null then
    raise exception 'COMPAT_PRECONDITION: handle_new_user() has unexpected trigger callers: %', bad;
  end if;
  -- The corrected body writes (id, email) only: any other required column without a default would fail.
  select string_agg(column_name, ', ') into bad from information_schema.columns
  where table_schema = 'public' and table_name = 'fm_users' and is_nullable = 'NO' and column_default is null
    and column_name not in ('id', 'email');
  if bad is not null then
    raise exception 'COMPAT_PRECONDITION: fm_users has required columns without defaults: %', bad;
  end if;
  select attnum into id_attnum from pg_attribute where attrelid = 'public.fm_users'::regclass and attname = 'id';
  if id_attnum is null or not exists (select 1 from pg_index i where i.indrelid = 'public.fm_users'::regclass
       and i.indisunique and i.indnkeyatts = 1 and i.indkey[0] = id_attnum) then
    raise exception 'COMPAT_PRECONDITION: fm_users.id has no unique index (ON CONFLICT (id) would fail)';
  end if;
  -- Existing legacy outfit columns must have the observed types; never coerce them.
  select string_agg(column_name || ' ' || data_type, ', ') into bad from information_schema.columns
  where table_schema = 'public' and table_name = 'fm_outfits'
    and ((column_name = 'style_category' and data_type not in ('text', 'character varying'))
      or (column_name = 'is_saved' and data_type <> 'boolean'));
  if bad is not null then
    raise exception 'COMPAT_PRECONDITION: unexpected fm_outfits column types: %', bad;
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fm_users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.fm_outfits add column if not exists style_category text;
alter table public.fm_outfits add column if not exists is_saved boolean not null default false;
comment on column public.fm_outfits.style_category is
  'Style shared by every outfit in data_json (the app refuses mixed-style archives). Legacy rows keep their value.';

-- Postconditions (fail the transaction rather than leave a half-correct state).
do $$
begin
  if not exists (select 1 from pg_proc where oid = to_regprocedure('public.handle_new_user()')
                 and prosrc like '%public.fm_users%' and prosrc not like '%public.users %' and prosecdef) then
    raise exception 'COMPAT_POSTCONDITION: handle_new_user() does not target public.fm_users';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'fm_outfits'
      and column_name in ('style_category', 'is_saved')) <> 2 then
    raise exception 'COMPAT_POSTCONDITION: fm_outfits compatibility columns missing';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
