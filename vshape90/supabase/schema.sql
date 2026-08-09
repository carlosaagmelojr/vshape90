-- ============================================================
-- V-SHAPE 90 — schema.sql
-- Rode isto no SQL Editor do seu projeto Supabase (supabase.com)
-- depois de criar o projeto. Idempotente (pode rodar mais de uma vez).
-- ============================================================

-- Extensão pra gerar UUIDs (já vem habilitada por padrão no Supabase,
-- mas deixamos aqui por garantia caso rode num Postgres genérico)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABELA PRINCIPAL: user_data
-- Decisão de arquitetura: em vez de normalizar cada entidade
-- (treinos, corridas, medidas, etc.) em tabelas separadas, guardamos
-- o MESMO formato de dados que já existe no localStorage do app
-- (ver js/storage.js -> defaultData()) numa única coluna JSONB por
-- usuário. Isso torna o sync trivial (push = upsert do blob inteiro,
-- pull = select do blob) e evita reescrever toda a lógica de negócio
-- que já roda no cliente. Trade-off consciente: fica mais difícil
-- fazer analytics agregada via SQL puro no futuro — se isso virar
-- necessário, normalizar tabelas específicas (ex.: exercise_logs)
-- pode ser feito depois sem quebrar o formato do blob.
-- ------------------------------------------------------------
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_data is 'Espelha o formato de defaultData() do app (js/storage.js). Um registro por usuário.';

-- Atualiza updated_at automaticamente a cada UPDATE
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- TABELA: photos (metadados — o arquivo em si vai pro Storage bucket)
-- ------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('frente', 'costas', 'perfil')),
  storage_path text not null, -- caminho dentro do bucket 'progress-photos'
  created_at   timestamptz not null default now()
);

create index if not exists idx_photos_user_date on public.photos (user_id, date);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — cada usuário só enxerga/altera as próprias
-- linhas. Isso é a ÚNICA camada de segurança real aqui (a anon key
-- do Supabase É PRA FICAR no frontend — a proteção vem da RLS, não
-- de esconder a chave). Sem essas policies, QUALQUER usuário
-- autenticado poderia ler os dados de qualquer outro (IDOR/Broken
-- Access Control) — por isso RLS é habilitado e testado ANTES de
-- qualquer coisa ir pra produção.
-- ------------------------------------------------------------
alter table public.user_data enable row level security;
alter table public.photos enable row level security;

drop policy if exists "user_data: select own" on public.user_data;
create policy "user_data: select own" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "user_data: insert own" on public.user_data;
create policy "user_data: insert own" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_data: update own" on public.user_data;
create policy "user_data: update own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_data: delete own" on public.user_data;
create policy "user_data: delete own" on public.user_data
  for delete using (auth.uid() = user_id);

drop policy if exists "photos: select own" on public.photos;
create policy "photos: select own" on public.photos
  for select using (auth.uid() = user_id);

drop policy if exists "photos: insert own" on public.photos;
create policy "photos: insert own" on public.photos
  for insert with check (auth.uid() = user_id);

drop policy if exists "photos: update own" on public.photos;
create policy "photos: update own" on public.photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "photos: delete own" on public.photos;
create policy "photos: delete own" on public.photos
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- STORAGE: bucket de fotos de progresso
-- Rode isto também no SQL Editor — cria o bucket e as políticas de
-- acesso (cada usuário só acessa arquivos dentro de uma pasta com
-- o próprio user_id como prefixo, ex.: "{user_id}/frente_2026-08-09.jpg")
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "progress-photos: select own" on storage.objects;
create policy "progress-photos: select own" on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progress-photos: insert own" on storage.objects;
create policy "progress-photos: insert own" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progress-photos: delete own" on storage.objects;
create policy "progress-photos: delete own" on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- Fim do schema. Depois de rodar isto:
-- 1. Vá em Authentication > Providers e confirme que "Email" está habilitado.
-- 2. Vá em Project Settings > API e copie a "Project URL" e a "anon public key".
-- 3. Cole esses dois valores em js/supabase-config.js (ver supabase-config.example.js).
-- ------------------------------------------------------------
