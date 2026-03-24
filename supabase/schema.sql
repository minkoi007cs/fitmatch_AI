begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  style_profile jsonb,
  quiz_answers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists email text not null default '',
  add column if not exists style_profile jsonb,
  add column if not exists quiz_answers jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  color text not null,
  secondary_color text,
  style text not null,
  pattern text,
  material text,
  description text,
  notes text,
  image_path text,
  image_url text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wardrobe_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists name text not null default 'Untitled item',
  add column if not exists category text not null default 'other',
  add column if not exists color text not null default 'unknown',
  add column if not exists secondary_color text,
  add column if not exists style text not null default 'casual',
  add column if not exists pattern text,
  add column if not exists material text,
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists image_path text,
  add column if not exists image_url text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.uploaded_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_path text not null,
  detected_type text not null,
  detected_color text not null,
  detected_style text not null,
  detected_pattern text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.uploaded_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists image_path text,
  add column if not exists detected_type text,
  add column if not exists detected_color text,
  add column if not exists detected_style text,
  add column if not exists detected_pattern text,
  add column if not exists metadata_json jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_item_id uuid references public.wardrobe_items (id) on delete set null,
  data_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.outfits
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists source_item_id uuid references public.wardrobe_items (id) on delete set null,
  add column if not exists data_json jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.users
set updated_at = coalesce(updated_at, now()),
    created_at = coalesce(created_at, now());

update public.wardrobe_items
set updated_at = coalesce(updated_at, now()),
    created_at = coalesce(created_at, now());

update public.uploaded_items
set created_at = coalesce(created_at, now());

update public.outfits
set created_at = coalesce(created_at, now());

create index if not exists users_email_idx on public.users (email);
create index if not exists wardrobe_items_user_id_idx on public.wardrobe_items (user_id);
create index if not exists wardrobe_items_category_idx on public.wardrobe_items (category);
create index if not exists wardrobe_items_style_idx on public.wardrobe_items (style);
create index if not exists uploaded_items_user_id_idx on public.uploaded_items (user_id);
create index if not exists outfits_user_id_idx on public.outfits (user_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_wardrobe_items_updated_at on public.wardrobe_items;
create trigger set_wardrobe_items_updated_at
before update on public.wardrobe_items
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.uploaded_items enable row level security;
alter table public.outfits enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users
for insert
with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "wardrobe_select_own" on public.wardrobe_items;
create policy "wardrobe_select_own"
on public.wardrobe_items
for select
using (auth.uid() = user_id);

drop policy if exists "wardrobe_insert_own" on public.wardrobe_items;
create policy "wardrobe_insert_own"
on public.wardrobe_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "wardrobe_update_own" on public.wardrobe_items;
create policy "wardrobe_update_own"
on public.wardrobe_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "wardrobe_delete_own" on public.wardrobe_items;
create policy "wardrobe_delete_own"
on public.wardrobe_items
for delete
using (auth.uid() = user_id);

drop policy if exists "uploaded_select_own" on public.uploaded_items;
create policy "uploaded_select_own"
on public.uploaded_items
for select
using (auth.uid() = user_id);

drop policy if exists "uploaded_insert_own" on public.uploaded_items;
create policy "uploaded_insert_own"
on public.uploaded_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "outfits_select_own" on public.outfits;
create policy "outfits_select_own"
on public.outfits
for select
using (auth.uid() = user_id);

drop policy if exists "outfits_insert_own" on public.outfits;
create policy "outfits_insert_own"
on public.outfits
for insert
with check (auth.uid() = user_id);

drop policy if exists "outfits_delete_own" on public.outfits;
create policy "outfits_delete_own"
on public.outfits
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('fitmatch-wardrobe', 'fitmatch-wardrobe', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "storage_select_own" on storage.objects;
create policy "storage_select_own"
on storage.objects
for select
using (
  bucket_id = 'fitmatch-wardrobe'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_insert_own" on storage.objects;
create policy "storage_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'fitmatch-wardrobe'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_update_own" on storage.objects;
create policy "storage_update_own"
on storage.objects
for update
using (
  bucket_id = 'fitmatch-wardrobe'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'fitmatch-wardrobe'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_delete_own" on storage.objects;
create policy "storage_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'fitmatch-wardrobe'
  and auth.uid()::text = (storage.foldername(name))[1]
);

commit;
