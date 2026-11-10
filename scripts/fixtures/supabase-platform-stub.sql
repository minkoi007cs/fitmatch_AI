-- APP-RECOVERY-32 — SYNTHETIC stand-in for what a FRESH Supabase project already has before a restore:
-- reserved roles, schemas auth/storage/extensions with their platform tables, pgcrypto in `extensions`.
-- Lines below are byte-identical to the platform part (lines 15-39) of legacy-canonical-shape.sql, so the
-- restore target matches the source's platform layer. NOT the real Supabase Auth/Storage stack.
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
