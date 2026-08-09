# V-SHAPE 90

App pessoal (PWA) para acompanhar uma transformação corporal de 90 dias: musculação com progressão de carga, corrida rumo aos 10km, recuperação, medidas/fotos de evolução e relatórios semanais.

*Nota: acompanhamento de água e alimentação foi removido de propósito nesta versão pra manter o app focado em treino — a ideia é reintroduzir isso depois, redesenhado, não que tenha sido esquecido.*

Feito para **uma única pessoa**, 100% offline, com todos os dados salvos apenas neste dispositivo.

## Como usar

1. Abra `index.html` num navegador (ou publique a pasta inteira num host estático — Vercel, GitHub Pages, Netlify etc.).
2. No celular, use "Adicionar à tela inicial" (Android/Chrome) ou "Adicionar à Tela de Início" (iOS/Safari) para instalar como app.
3. Depois do primeiro carregamento, o app funciona sem internet (Service Worker cacheia o app shell).

## Estrutura do projeto

```
vshape90/
  index.html
  manifest.json
  service-worker.js
  css/
    style.css
  js/
    storage.js         -> persistência (localStorage + IndexedDB para fotos), modelo de dados
    onboarding.js       -> wizard de configuração inicial, templates de grade semanal
    workouts.js         -> musculação: registro, progressão dupla, histórico, CORE, PRs, streak, platô/deload
    running.js          -> corrida: registro, cálculo de pace, plano progressivo de 90 dias
    recovery.js         -> check-in diário e semáforo de recuperação
    charts.js           -> gráficos em <canvas>, sem dependências externas
    exercise-demos.js   -> animações originais (boneco-palito SVG) do padrão de movimento de cada exercício
    exercise-catalog.js -> catálogo de exercícios alternativos por grupo muscular (troca/adição de exercício)
    app.js              -> orquestração da UI (navegação, dashboard, modo treino, onboarding, conta/PRO, etc.)
  assets/
    icon-192.png, icon-512.png
  test/
    run-tests.js    -> suíte automatizada (jsdom) cobrindo os testes obrigatórios + extras
```

## Onboarding

Na primeira vez que o app abre, um wizard de 6 passos coleta altura/peso/idade/sexo, objetivo (V-Shape+Força / Emagrecimento+Condicionamento / Corrida+Resistência) e dias de treino por semana (3 a 6). A partir disso:
- Monta a grade semanal automaticamente (templates de Full Body, Superior/Inferior, ou o split completo, conforme a disponibilidade).
- Calcula metas de calorias/proteína/carboidrato/gordura com a fórmula de Mifflin-St Jeor — sempre editável depois em Configurações.
- Marca o Dia 1/90 a partir de hoje.

Quem já usava o app antes dessa funcionalidade existir não é levado ao onboarding — a migração de dados detecta isso automaticamente.

## Dados e backup

* Todos os dados ficam em `localStorage` (treinos, corridas, recuperação, medidas) e `IndexedDB` (fotos de progresso).
* Em **Mais → Backup**, é possível exportar um arquivo `.json` com tudo (incluindo fotos) e reimportá-lo depois — útil para trocar de aparelho ou manter uma cópia de segurança.
* "Apagar todos os dados" reinicia o app do zero.

## Lembrete diário

Em Configurações (ou no passo 5 do onboarding), dá pra ativar um lembrete que dispara via `Notification`/Service Worker quando o horário configurado chega e ainda não houve check-in no dia. **Limitação real, documentada na própria interface**: como o app não tem servidor, isso só funciona com o navegador aberto ou rodando em segundo plano recente — não é um push garantido a qualquer hora com o app fechado (isso exigiria um backend de push).

## RIR/RPE por série

No Modo Treino, cada série tem uma escala opcional de RIR (repetições restantes ao falhar, 0 a 4+), salva junto com carga/reps e editável depois no histórico.

## Conta / PRO (sem backend real conectado)

A seção **Mais → Conta** mostra o que seria um plano PRO (comparação de fotos sem limite de 4 semanas, exportação de relatório em PDF) e um botão que **só liga uma flag local** para testar essa experiência — não é uma cobrança real. O texto na própria tela explica exatamente o que falta pra virar produto de verdade: conta de usuário autenticada, integração de pagamento (Stripe/Pix) e um backend pra validar o status. Nada disso existe nesta versão — é a decisão certa até haver uma razão real pra adicionar essa complexidade.

## Progressão de carga

Cada exercício guarda séries individuais (carga × repetições). Quando todas as séries atingem o topo da faixa de repetições da meta (ex.: 4×8–12, todas com 12 reps) **e não há dor registrada**, o app apenas *sugere* aumentar a carga — o aumento nunca é automático. Se um exercício fica **4+ sessões sem evoluir a carga máxima** ao longo de pelo menos ~10 dias, o app avisa sobre possível platô e sugere uma semana de deload.

## Animações de execução

Cada exercício tem uma pequena animação (boneco-palito em SVG) mostrando o padrão de movimento — puxada vertical, remada, agachamento, etc. Não é vídeo nem gif de terceiros: é desenhado inteiramente em código (`js/exercise-demos.js` + CSS), então não pesa nada e continua funcionando 100% offline. Cada card também tem um link opcional para o Gif do Treino (site externo, com direitos próprios) pra quem quiser ver a execução realista — o app nunca baixa/reproduz esse conteúdo, só linka pra lá.

## Testes

Uma suíte automatizada roda o app real dentro de um DOM headless (jsdom) e cobre os testes obrigatórios do briefing original (registrar carga, persistência, histórico, cronômetro, corrida/pace, medidas, fotos, check-in, dashboard, backup export/import, offline/service worker, manifest PWA, responsividade) mais dezenas de testes extras adicionados a cada funcionalidade nova. Para rodar:

```
cd test && npm install jsdom fake-indexeddb && node run-tests.js
```

(Essa pasta é apenas para desenvolvimento — não é necessária para usar o app.)

## Aviso

Os indicadores (índice V, semáforo de recuperação, sugestões de progressão) são apenas ferramentas de acompanhamento pessoal, **não constituem diagnóstico médico ou nutricional**.
