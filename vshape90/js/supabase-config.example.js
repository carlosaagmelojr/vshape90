/* ============================================================
   V-SHAPE 90 — supabase-config.example.js
   Copie este arquivo pra "js/supabase-config.js" (SEM o .example)
   e preencha com os valores do SEU projeto Supabase:

   1. Crie um projeto em https://supabase.com (grátis).
   2. Rode supabase/schema.sql no SQL Editor do projeto.
   3. Vá em Project Settings > API.
   4. Copie "Project URL" e "anon public key" pros campos abaixo.

   IMPORTANTE — e diferente do que parece à primeira vista: a "anon
   key" é FEITA pra ficar exposta no frontend e pode (deve) ser
   commitada no repositório. A segurança real vem das políticas de
   RLS (Row Level Security) definidas em supabase/schema.sql, não de
   esconder essa chave — sem RLS, esconder a chave não protegeria
   nada mesmo. Isso é diferente de uma API key tradicional.

   O que NUNCA pode aparecer aqui, em nenhuma hipótese, é a
   "service_role key" do Supabase — essa sim ignora toda a RLS e dá
   acesso total ao banco. Este app não usa a service_role key em
   lugar nenhum do frontend, de propósito.
   ============================================================ */

const SUPABASE_CONFIG = {
  url: 'https://SEU-PROJETO.supabase.co',
  anonKey: 'SUA_ANON_KEY_AQUI'
};

if (typeof window !== 'undefined') { window.SUPABASE_CONFIG = SUPABASE_CONFIG; }
