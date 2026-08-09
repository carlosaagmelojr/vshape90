/* ============================================================
   V-SHAPE 90 — supabase-config.example.js
   Copie este arquivo pra "js/supabase-config.js" (SEM o .example)
   e preencha com os valores do SEU projeto Supabase:

   1. Crie um projeto em https://supabase.com (grátis).
   2. Rode supabase/schema.sql no SQL Editor do projeto.
   3. Vá em Project Settings > API.
   4. Copie "Project URL" e "anon public key" pros campos abaixo.

   IMPORTANTE: a "anon key" é feita pra ficar exposta no frontend —
   isso é por design do Supabase. A segurança real vem das políticas
   de RLS (Row Level Security) definidas em supabase/schema.sql, não
   de esconder essa chave. NUNCA cole aqui a "service_role key" —
   essa sim é secreta e nunca deve aparecer em código de frontend.

   js/supabase-config.js está no .gitignore — não sobe pro repositório.
   ============================================================ */

const SUPABASE_CONFIG = {
  url: 'https://placeholder.supabase.co',
  anonKey: 'placeholder-key-not-real'
};

if (typeof window !== 'undefined') { window.SUPABASE_CONFIG = SUPABASE_CONFIG; }
