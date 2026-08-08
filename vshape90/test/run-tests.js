/* Test harness: carrega o app real num DOM headless (jsdom) e simula os
   17 testes obrigatórios do prompt master, usando fake-indexeddb + localStorage. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

require('fake-indexeddb/auto');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

async function main() {
  // Remove referências a arquivos locais (jsdom não carrega file:// bem) e
  // injeta o conteúdo diretamente como <style>/<script> inline.
  let inlineHtml = html
    .replace('<link rel="manifest" href="manifest.json">', '')
    .replace('<link rel="icon" href="assets/icon-192.png">', '')
    .replace('<link rel="apple-touch-icon" href="assets/icon-192.png">', '')
    .replace('<link rel="stylesheet" href="css/style.css">', `<style>${fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')}</style>`);

  const scripts = ['storage', 'charts', 'exercise-demos', 'workouts', 'running', 'recovery', 'app'];
  for (const s of scripts) {
    inlineHtml = inlineHtml.replace(
      `<script src="js/${s}.js"></script>`,
      `<script>${fs.readFileSync(path.join(root, `js/${s}.js`), 'utf8')}</script>`
    );
  }

  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole();
  vc.forwardTo(console);

  const dom = new JSDOM(inlineHtml, {
    url: 'http://localhost/vshape90/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    storageQuota: 10000000,
    virtualConsole: vc
  });
  const { window } = dom;

  // polyfills que jsdom não fornece
  window.indexedDB = global.indexedDB;
  window.IDBKeyRange = global.IDBKeyRange;
  window.navigator.vibrate = () => true;
  window.AudioContext = function () {
    return { createOscillator: () => ({ connect: () => ({connect(){}}), start(){}, stop(){}, frequency:{value:0}, type:'' }),
             createGain: () => ({ connect: () => ({}), gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }),
             destination: {}, currentTime: 0 };
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({
    setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
    fill(){}, closePath(){}, arc(){}, fillText(){}, fillRect(){}
  });
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.alert = () => {};

  await new Promise(resolve => setTimeout(resolve, 100));
  if (!window.App || !window.Storage) {
    throw new Error('App/Storage não carregaram no ambiente de teste.');
  }

  const { document } = window;
  const App = window.App;
  const results = [];
  const check = (name, cond) => results.push({ name, pass: !!cond });

  // 1. Registrar carga
  App.goTo('treino');
  App.selectedDayTab = 'segunda';
  App.renderTreino();
  App.openWorkoutMode('segunda', 0);
  document.getElementById('wm-weight').value = 52;
  document.getElementById('wm-reps').value = 12;
  App.wmConcludeSet();
  let data = window.Storage.load();
  check('1. Registrar carga (série salva em buffer)', App.wm.buffer.length === 1 && App.wm.buffer[0].weight === 52);

  // conclui as 3 séries restantes do primeiro exercício (seg_1 tem 4 séries)
  for (let i = 0; i < 3; i++) {
    document.getElementById('wm-weight').value = 52;
    document.getElementById('wm-reps').value = 10;
    App.wmConcludeSet();
  }
  data = window.Storage.load();
  check('1b. Exercício salvo em exerciseLogs', (data.exerciseLogs['seg_1'] || []).length === 1);
  App.closeWorkoutMode();

  // 2 & 3. Fechar e abrir novamente / persistência (recarrega módulo Storage)
  window.Storage._cache = null;
  const reloaded = window.Storage.load();
  check('2/3. Persistência após "reabrir" (novo load)', (reloaded.exerciseLogs['seg_1'] || []).length === 1);

  // 4. Registrar quatro séries diferentes (já feito acima: 4 séries com valores distintos)
  const entry = reloaded.exerciseLogs['seg_1'][0];
  check('4. Quatro séries registradas', entry.sets.length === 4);

  // 5. Conferir histórico
  const hist = window.Workouts.history('seg_1');
  check('5. Histórico contém a entrada', hist.length === 1 && hist[0].maxWeight === 52);

  // 6. Cronômetro (testa lógica de contagem regressiva isoladamente)
  App.openWorkoutMode('terca', 0);
  document.getElementById('wm-weight').value = 40;
  document.getElementById('wm-reps').value = 12;
  App.wmConcludeSet(); // deve iniciar descanso
  const restVisible = !document.getElementById('wm-rest').classList.contains('hidden');
  check('6. Cronômetro de descanso ativado após concluir série', restVisible);
  App.clearRestTimer();
  App.closeWorkoutMode();

  // 7. Registrar corrida
  window.Running.addLog({ type: 'leve', distanceKm: 3, durationMin: 18 });
  data = window.Storage.load();
  check('7. Corrida registrada', data.runLogs.length === 1);

  // 8. Calcular pace (18min / 3km = 6 min/km)
  const pace = data.runLogs[0].paceMinKm;
  check('8. Pace calculado corretamente', Math.abs(pace - 6) < 0.001);

  // 9. Registrar medidas
  const bodyForm = document.getElementById('body-form');
  document.getElementById('bf-weight').value = 75.4;
  document.getElementById('bf-waist').value = 82;
  document.getElementById('bf-shoulders').value = 118;
  bodyForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  data = window.Storage.load();
  check('9. Medidas corporais registradas', data.bodyLogs.length === 1 && data.bodyLogs[0].weight === 75.4);

  // 10. Registrar fotos (testa a camada Photos/IndexedDB diretamente, já que
  // simular <input type=file> em jsdom exige um File real)
  await window.Photos.put({ id: 'test_photo_1', dataURL: 'data:image/jpeg;base64,AAA' });
  const storedPhoto = await window.Photos.get('test_photo_1');
  check('10. Foto armazenada no IndexedDB', !!storedPhoto && storedPhoto.dataURL.startsWith('data:image'));

  // 11. Check-in de recuperação
  window.Recovery.addCheckIn({ sleep: 4, energy: 4, soreness: 2, stress: 2, sleepHours: 7.5, pain: false });
  const checkin = window.Recovery.todayCheckIn();
  check('11. Check-in de recuperação salvo', !!checkin && checkin.sleep === 4);
  const sem = window.Recovery.semaphore();
  check('11b. Semáforo calculado', ['green', 'yellow', 'red'].includes(sem.level));

  // 12. Dashboard (renderiza sem lançar exceção e exibe cards)
  let dashboardOk = true;
  try { App.renderDashboard(); } catch (e) { dashboardOk = false; console.error(e); }
  const cardCount = document.querySelectorAll('#dashboard-cards .dash-card').length;
  check('12. Dashboard renderiza sem erros e com cards', dashboardOk && cardCount >= 6);

  // 13. Exportar backup
  const exportedJSON = await window.Storage.exportFull();
  const parsedExport = JSON.parse(exportedJSON);
  check('13. Exportar backup gera JSON válido com dados e fotos', !!parsedExport.data && Array.isArray(parsedExport.photos) && parsedExport.photos.length >= 1);

  // 14. Importar backup (grava, altera, reimporta e confere restauração)
  const before = JSON.parse(exportedJSON);
  window.Storage._cache.profile.startWeightKg = 999; // corrompe dados atuais
  window.Storage.save();
  await window.Storage.importFull(JSON.stringify(before));
  const afterImport = window.Storage.load();
  check('14. Importar backup restaura dados corretamente', afterImport.profile.startWeightKg === before.data.profile.startWeightKg);

  // 15. Funcionamento offline -> validado pela existência e estrutura do service worker (cache-first / SWR)
  const swSrc = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  check('15. Service worker define cache do app shell', swSrc.includes('APP_SHELL') && swSrc.includes('caches.open'));

  // 16. Instalação como PWA -> valida manifest.json
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  check('16. Manifest válido para instalação PWA', manifest.display === 'standalone' && manifest.icons.length >= 2 && !!manifest.start_url);

  // 17. Responsividade mobile -> valida presença de media query e viewport meta
  const cssSrc = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  const hasViewportMeta = html.includes('name="viewport"');
  check('17. CSS mobile-first + meta viewport presentes', hasViewportMeta && cssSrc.includes('max-width'));

  // Testes extras de robustez
  check('Extra: navegação entre todas as views sem erro', (() => {
    try {
      ['hoje', 'treino', 'corrida', 'evolucao', 'mais', 'hoje'].forEach(v => App.goTo(v));
      return true;
    } catch (e) { console.error(e); return false; }
  })());

  check('Extra: água incrementa corretamente', (() => {
    const d = window.Storage.load();
    const dateKey = window.todayISO();
    const startVal = d.waterLogs[dateKey] || 0;
    document.querySelector('[data-add="250"]').click();
    const after = window.Storage.load().waterLogs[dateKey];
    return after === startVal + 250;
  })());

  check('Extra: todos os exercícios do plano têm padrão de animação definido', (() => {
    const all = window.Workouts.allExercises();
    return all.length > 0 && all.every(e => !!e.pattern && !!window.ExerciseDemos.PATTERN_LABELS[e.pattern]);
  })());

  check('Extra: ExerciseDemos gera SVG original (sem src externo) para cada padrão', (() => {
    const patterns = Object.keys(window.ExerciseDemos.PATTERN_LABELS);
    return patterns.every(p => {
      const svg = window.ExerciseDemos.svg(p);
      return svg.includes('<svg') && !svg.includes('<img') && !/https?:\/\//.test(svg);
    });
  })());

  check('Extra: card de exercício renderiza a animação de execução', (() => {
    App.goTo('treino');
    App.selectedDayTab = 'segunda';
    App.renderTreino();
    return document.querySelectorAll('.exercise-card .exercise-demo-svg').length > 0;
  })());

  // ---- Resultado ----
  console.log('\n===== RESULTADO DOS TESTES =====');
  let pass = 0;
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}`);
    if (r.pass) pass++;
  }
  console.log(`\n${pass}/${results.length} testes passaram.`);
  if (pass !== results.length) process.exit(1);
}

main().catch(e => { console.error('ERRO FATAL NO TESTE:', e); process.exit(1); });
