# V-SHAPE 90

App pessoal (PWA) para acompanhar uma transformação corporal de 90 dias: musculação com progressão de carga, corrida rumo aos 10km, recuperação, medidas/fotos de evolução, nutrição, água e relatórios semanais.

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
    storage.js     -> persistência (localStorage + IndexedDB para fotos), modelo de dados
    workouts.js     -> musculação: registro, progressão dupla, histórico, CORE, PRs, streak
    running.js      -> corrida: registro, cálculo de pace, plano progressivo de 90 dias
    recovery.js     -> check-in diário e semáforo de recuperação
    charts.js       -> gráficos em <canvas>, sem dependências externas
    exercise-demos.js -> animações originais (boneco-palito SVG) do padrão de movimento de cada exercício
    app.js          -> orquestração da UI (navegação, dashboard, modo treino, etc.)
  assets/
    icon-192.png, icon-512.png
  test/
    run-tests.js    -> suíte automatizada (jsdom) cobrindo os 17 testes obrigatórios
```

## Dados e backup

* Todos os dados ficam em `localStorage` (treinos, corridas, recuperação, medidas, nutrição, água) e `IndexedDB` (fotos de progresso).
* Em **Mais → Backup**, é possível exportar um arquivo `.json` com tudo (incluindo fotos) e reimportá-lo depois — útil para trocar de aparelho ou manter uma cópia de segurança.
* "Apagar todos os dados" reinicia o app do zero.

## Progressão de carga

Cada exercício guarda séries individuais (carga × repetições). Quando todas as séries atingem o topo da faixa de repetições da meta (ex.: 4×8–12, todas com 12 reps) **e não há dor registrada**, o app apenas *sugere* aumentar a carga — o aumento nunca é automático.

## Animações de execução

Cada exercício tem uma pequena animação (boneco-palito em SVG) mostrando o padrão de movimento — puxada vertical, remada, agachamento, etc. Não é vídeo nem gif de terceiros: é desenhado inteiramente em código (`js/exercise-demos.js` + CSS), então não pesa nada e continua funcionando 100% offline.

## Testes

Uma suíte automatizada roda o app real dentro de um DOM headless (jsdom) e cobre os 17 testes obrigatórios do briefing (registrar carga, persistência, histórico, cronômetro, corrida/pace, medidas, fotos, check-in, dashboard, backup export/import, offline/service worker, manifest PWA, responsividade), além de 2 testes extras. Para rodar:

```
cd test && npm install jsdom fake-indexeddb && node run-tests.js
```

(Essa pasta é apenas para desenvolvimento — não é necessária para usar o app.)

## Aviso

Os indicadores (índice V, semáforo de recuperação, sugestões de progressão) são apenas ferramentas de acompanhamento pessoal, **não constituem diagnóstico médico ou nutricional**.
