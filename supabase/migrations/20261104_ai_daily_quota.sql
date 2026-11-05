-- Apply before the application update. No existing user or wardrobe data changes.
begin;
create table if not exists public.fm_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  units integer not null check (units >= 0),
  primary key (user_id, usage_day)
);
alter table public.fm_ai_daily_usage enable row level security;
revoke all on public.fm_ai_daily_usage from public, anon, authenticated;
grant select, insert, update on public.fm_ai_daily_usage to service_role;

create or replace function public.fm_consume_ai_units(p_user_id uuid, p_units integer, p_limit integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare consumed integer;
begin
  if p_units is null or p_limit is null or p_units < 1 or p_limit < 1 or p_limit > 100000 or p_units > p_limit then
    return false;
  end if;
  insert into public.fm_ai_daily_usage(user_id, usage_day, units)
  values(p_user_id, (now() at time zone 'UTC')::date, p_units)
  on conflict (user_id, usage_day) do update
  set units = fm_ai_daily_usage.units + excluded.units
  where fm_ai_daily_usage.units + excluded.units <= p_limit
  returning units into consumed;
  return consumed is not null;
end;
$$;
revoke all on function public.fm_consume_ai_units(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.fm_consume_ai_units(uuid, integer, integer) to service_role;
commit;
