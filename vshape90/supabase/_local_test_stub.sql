-- ============================================================
-- STUB PARA TESTE LOCAL — simula o suficiente do ambiente Supabase
-- (schemas auth/storage, auth.uid(), storage.foldername()) pra
-- validar o schema.sql real contra um Postgres de verdade.
-- Isto NÃO roda no Supabase de produção — lá esses schemas já existem.
-- ============================================================

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
create or replace function storage.foldername(name text) returns text[] as $$
  select string_to_array(name, '/');
$$ language sql immutable;
