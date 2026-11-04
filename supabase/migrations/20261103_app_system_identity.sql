-- Additive: preserves all existing wardrobe, profile, outfit and auth user IDs.
begin;
create table if not exists public.fm_auth_identities (
  issuer text not null,
  app_id text not null,
  subject text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issuer, app_id, subject),
  unique (issuer, app_id, user_id)
);
alter table public.fm_auth_identities enable row level security;
revoke all on public.fm_auth_identities from anon, authenticated;
grant select, insert on public.fm_auth_identities to service_role;

-- Cross-instance single-flight for rotating refresh tokens. Only HMAC fingerprints and
-- AES-GCM encrypted results are stored. Retain a result for the token's full 30-day lifetime
-- so delayed requests can never send a spent token back to the hub.
create table if not exists public.fm_auth_refreshes (
  refresh_hash text primary key check (refresh_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null,
  sealed_result text,
  created_at timestamptz not null default now()
);
alter table public.fm_auth_refreshes enable row level security;
revoke all on public.fm_auth_refreshes from anon, authenticated;
grant select, insert, update, delete on public.fm_auth_refreshes to service_role;

create or replace function public.fm_begin_auth_refresh(p_hash text, p_owner uuid)
returns table(is_owner boolean, sealed_result text)
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.fm_auth_refreshes where created_at < now() - interval '31 days';
  insert into public.fm_auth_refreshes(refresh_hash, owner_id)
    values(p_hash, p_owner) on conflict (refresh_hash) do nothing;
  return query select r.owner_id = p_owner, r.sealed_result
    from public.fm_auth_refreshes r where r.refresh_hash = p_hash;
end;
$$;

create or replace function public.fm_finish_auth_refresh(p_hash text, p_owner uuid, p_result text)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update public.fm_auth_refreshes set sealed_result = p_result
    where refresh_hash = p_hash and owner_id = p_owner and sealed_result is null;
  return found;
end;
$$;
revoke all on function public.fm_begin_auth_refresh(text, uuid) from public, anon, authenticated;
revoke all on function public.fm_finish_auth_refresh(text, uuid, text) from public, anon, authenticated;
grant execute on function public.fm_begin_auth_refresh(text, uuid) to service_role;
grant execute on function public.fm_finish_auth_refresh(text, uuid, text) to service_role;
commit;
