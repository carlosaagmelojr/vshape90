-- ============================================================
-- TESTE DE ISOLAMENTO RLS — verifica de verdade que um usuário
-- NUNCA consegue ler/escrever dados de outro usuário.
-- ============================================================

\set ON_ERROR_STOP on

-- Cria dois usuários de teste
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'usuario1@teste.com'),
  ('22222222-2222-2222-2222-222222222222', 'usuario2@teste.com')
on conflict do nothing;

-- Precisamos simular o role "authenticated" do Supabase (RLS só é
-- aplicada pra roles que não sejam o dono da tabela/superuser)
create role authenticated;
grant all on public.user_data to authenticated;
grant all on public.photos to authenticated;
alter table public.user_data force row level security;
alter table public.photos force row level security;

-- ---- Como usuário 1: insere seus próprios dados ----
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.user_data (user_id, data) values
  ('11111111-1111-1111-1111-111111111111', '{"segredo": "dados do usuario 1"}');

-- ---- Como usuário 2: insere seus próprios dados ----
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.user_data (user_id, data) values
  ('22222222-2222-2222-2222-222222222222', '{"segredo": "dados do usuario 2"}');

-- ---- TESTE CRÍTICO: usuário 2 tenta ler os dados do usuário 1 ----
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select
  case
    when count(*) = 0 then 'PASSOU: usuario 2 NAO consegue ver dados do usuario 1'
    else 'FALHOU (VULNERAVEL): usuario 2 conseguiu ver dados de outro usuario!'
  end as resultado_teste_isolamento
from public.user_data
where user_id = '11111111-1111-1111-1111-111111111111';

-- ---- TESTE: usuário 2 só vê o próprio registro num SELECT * ----
select
  case
    when count(*) = 1 and bool_and(user_id = '22222222-2222-2222-2222-222222222222')
      then 'PASSOU: usuario 2 so enxerga o proprio registro'
    else 'FALHOU: usuario 2 enxerga registros que nao sao dele'
  end as resultado_teste_visibilidade
from public.user_data;

-- ---- TESTE: usuário 2 tenta ATUALIZAR os dados do usuário 1 (deve afetar 0 linhas) ----
update public.user_data
set data = '{"segredo": "HACKEADO PELO USUARIO 2"}'
where user_id = '11111111-1111-1111-1111-111111111111';

select
  case
    when data->>'segredo' = 'dados do usuario 1' then 'PASSOU: usuario 2 NAO conseguiu alterar dados do usuario 1'
    else 'FALHOU (VULNERAVEL): usuario 2 conseguiu alterar dados do usuario 1!'
  end as resultado_teste_update
from public.user_data
where user_id = '11111111-1111-1111-1111-111111111111';

-- ---- TESTE: usuário 2 tenta inserir uma linha com user_id de outra pessoa ----
-- (deve falhar com erro de RLS policy violation)
do $$
begin
  begin
    insert into public.user_data (user_id, data) values
      ('11111111-1111-1111-1111-111111111111', '{"segredo": "insercao maliciosa"}')
    on conflict (user_id) do nothing;
    raise notice 'FALHOU (VULNERAVEL): insercao com user_id alheio nao foi bloqueada';
  exception when others then
    raise notice 'PASSOU: insercao com user_id alheio foi bloqueada pela RLS (%.)  ', sqlerrm;
  end;
end $$;

reset role;
