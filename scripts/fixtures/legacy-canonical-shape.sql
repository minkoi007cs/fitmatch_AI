-- CL-MIGRATION-26 — SYNTHETIC legacy fixture shaped like the canonical fitmatch-ai project, built only from the
-- sanitized facts in docs/infrastructure/qwen-migration-preparation-20261109/plan.md (Codex read-only
-- inventory): no cloud rows, names or values. Shape decisions that model the observed state:
--   * Supabase-like stub: roles (anon, authenticated, service_role, supabase_auth_admin), auth.users/uid(),
--     storage.buckets/objects/foldername, pgcrypto installed in schema `extensions` (not public);
--   * FitMatch tables whose objects keep pre-rename names (users_pkey, wardrobe_items_*, outfits_*), owner
--     FKs to public.fm_users (not auth.users), nullable wardrobe color/style, fm_users.email without default,
--     fm_outfits.style_category NOT NULL without default and is_saved default false;
--   * on_auth_user_created -> public.handle_new_user() whose body still inserts into public.users (absent);
--   * legacy-named, partly overlapping owner policies; private wardrobe bucket; an unrelated app table
--     without RLS and with anon write grants (must stay untouched);
--   * the app identity migration (20261103) is applied separately by the test, as on the cloud.
-- PostgreSQL 17 (hosted major). Synthetic identities only.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role; -- hosted Supabase defaults

create schema auth;
grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
create function auth.uid() returns uuid language sql stable
  as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
grant insert, select on auth.users to supabase_auth_admin;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable
  as $$select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]$$;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Pre-rename provisioning function: still points at public.users.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

create table public.fm_users (
  id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  style_profile jsonb,
  quiz_answers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_pkey primary key (id)
);
create index users_email_idx on public.fm_users (email);

create table public.fm_wardrobe_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text not null,
  color text,
  secondary_color text,
  style text,
  pattern text,
  material text,
  description text,
  notes text,
  image_path text,
  image_url text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_items_pkey primary key (id),
  constraint wardrobe_items_user_id_fkey foreign key (user_id) references public.fm_users (id) on delete cascade
);
create index wardrobe_items_user_id_idx on public.fm_wardrobe_items (user_id);
create index wardrobe_items_category_idx on public.fm_wardrobe_items (category);

create table public.fm_uploaded_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_path text not null,
  detected_type text not null,
  detected_color text not null,
  detected_style text not null,
  detected_pattern text,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  constraint uploaded_items_pkey primary key (id)
);

create table public.fm_outfits (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  source_item_id uuid,
  data_json jsonb not null,
  style_category text not null,
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint outfits_pkey primary key (id),
  constraint outfits_user_id_fkey foreign key (user_id) references public.fm_users (id) on delete cascade,
  constraint outfits_source_item_id_fkey foreign key (source_item_id) references public.fm_wardrobe_items (id) on delete set null
);
create index outfits_user_id_idx on public.fm_outfits (user_id);

create trigger update_users_updated_at before update on public.fm_users for each row execute function public.set_updated_at();
create trigger update_wardrobe_items_updated_at before update on public.fm_wardrobe_items for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.fm_users enable row level security;
alter table public.fm_wardrobe_items enable row level security;
alter table public.fm_uploaded_items enable row level security;
alter table public.fm_outfits enable row level security;
create policy "Users can view own profile" on public.fm_users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.fm_users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert own profile" on public.fm_users for insert with check (auth.uid() = id);
create policy "Users can manage own wardrobe" on public.fm_wardrobe_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wardrobe_select_own" on public.fm_wardrobe_items for select using (auth.uid() = user_id);
create policy "Users can manage own uploads" on public.fm_uploaded_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own outfits" on public.fm_outfits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.fm_users, public.fm_wardrobe_items, public.fm_uploaded_items, public.fm_outfits to authenticated;
grant all on public.fm_users, public.fm_wardrobe_items, public.fm_uploaded_items, public.fm_outfits to service_role;

insert into storage.buckets (id, name, public) values ('fitmatch-wardrobe', 'fitmatch-wardrobe', false);
create policy "wardrobe_storage_own" on storage.objects for all
  using (bucket_id = 'fitmatch-wardrobe' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'fitmatch-wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

-- Unrelated application in the same project (no RLS, anon writes): reported, never modified.
create table public.lifedashboard_entries (id bigint generated always as identity primary key, note text);
grant select, insert on public.lifedashboard_entries to anon;
