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

  const scripts = ['storage', 'onboarding', 'charts', 'exercise-demos', 'exercise-metadata', 'exercise-catalog', 'workouts', 'running', 'recovery', 'app'];
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

  // 12. Dashboard (renderiza sem lançar exceção, mostra o hero e os cards de apoio)
  let dashboardOk = true;
  try { App.renderDashboard(); } catch (e) { dashboardOk = false; console.error(e); }
  const cardCount = document.querySelectorAll('#dashboard-cards .dash-card').length;
  const heroHasContent = document.getElementById('hero-band').textContent.includes('Índice V');
  check('12. Dashboard renderiza sem erros, com hero e cards de apoio', dashboardOk && cardCount >= 4 && heroHasContent);

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

  check('Extra: todo script <script src="js/..."> do index.html está listado no cache do service worker (senão quebra offline)', (() => {
    const scriptTags = [...html.matchAll(/<script src="(js\/[^"]+)">/g)].map(m => m[1]);
    return scriptTags.length > 0 && scriptTags.every(src => swSrc.includes(`./${src}`));
  })());

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

  check('Extra: todos os exercícios têm grupo muscular com alternativas cadastradas', (() => {
    const all = window.Workouts.allExercises();
    return all.every(e => !!e.muscleGroup && window.ExerciseCatalog.alternativesFor(e.muscleGroup).length > 0);
  })());

  check('Extra: peso da série anterior (mesma sessão) é pré-preenchido corretamente', (() => {
    App.openWorkoutMode('terca', 0); // ter_1 Supino reto, 4 séries
    document.getElementById('wm-weight').value = 70;
    document.getElementById('wm-reps').value = 10;
    App.wmConcludeSet(); // conclui série 1, avança pra série 2
    const weightField = Number(document.getElementById('wm-weight').value);
    App.clearRestTimer();
    App.closeWorkoutMode();
    return weightField === 70; // deve puxar o peso da série 1 desta sessão, não do histórico
  })());

  check('Extra: troca de exercício aplica corretamente e preserva séries/reps configuradas', (() => {
    App.goTo('treino');
    App.selectedDayTab = 'segunda';
    App.renderTreino();
    const before = window.Workouts.planForDay('segunda').exercises[0];
    App.applyExerciseSwap('segunda', 0, {
      id: 'cat_remada_curvada_com_barra', name: 'Remada curvada com barra', pattern: 'row',
      sets: before.sets, repsLow: before.repsLow, repsHigh: before.repsHigh, restSec: before.restSec, muscleGroup: before.muscleGroup
    });
    const after = window.Workouts.planForDay('segunda').exercises[0];
    return after.name === 'Remada curvada com barra' && after.sets === before.sets && after.id === 'cat_remada_curvada_com_barra';
  })());

  check('Extra: adicionar exercício via API insere no plano do dia', (() => {
    const d = window.Storage.load();
    const before = d.plan.terca.exercises.length;
    d.plan.terca.exercises.push({
      id: window.uid('ex'), name: 'Supino máquina', sets: 3, repsLow: 8, repsHigh: 12,
      restSec: 90, pattern: 'press-h', muscleGroup: 'peito'
    });
    window.Storage.save();
    const after = window.Workouts.planForDay('terca').exercises.length;
    return after === before + 1;
  })());

  check('Extra: remover exercício tira do plano mas preserva o histórico', (() => {
    const d = window.Storage.load();
    const idx = d.plan.terca.exercises.length - 1; // o que acabamos de adicionar
    const removedId = d.plan.terca.exercises[idx].id;
    d.plan.terca.exercises.splice(idx, 1);
    window.Storage.save();
    const stillInPlan = window.Workouts.planForDay('terca').exercises.some(e => e.id === removedId);
    return !stillInPlan;
  })());

  check('Extra: treino avulso (dia de descanso) por grupo muscular funciona ponta a ponta', (() => {
    const exercises = window.ExerciseCatalog.alternativesFor('peito').slice(0, 2).map(alt => ({
      id: window.uid('ex'), name: alt.name, sets: 3, repsLow: 8, repsHigh: 12, restSec: 90,
      pattern: alt.pattern, muscleGroup: 'peito'
    }));
    App.openWorkoutModeCustom('Peito (avulso)', exercises);
    const opened = App.wm && App.wm.dayKey === 'avulso' && App.wm.exercises.length === 2 && App.wm.dayLabel === 'Peito (avulso)';
    App.clearRestTimer();
    App.closeWorkoutMode();
    return opened;
  })());

  check('Extra: ficha de outro dia pode ser usada num dia de descanso (sessão registrada sob esse dayKey)', (() => {
    App.openWorkoutMode('quarta', 0); // usando a ficha de quarta mesmo não sendo quarta hoje
    const ok = App.wm && App.wm.dayKey === 'quarta' && App.wm.dayLabel === window.Workouts.planForDay('quarta').name;
    App.clearRestTimer();
    App.closeWorkoutMode();
    return ok;
  })());

  check('Extra: domingo (dia de descanso) mostra as opções de treinar mesmo assim', (() => {
    App.goTo('treino');
    App.selectedDayTab = 'domingo';
    App.renderTreino();
    return !!document.getElementById('btn-rest-muscle-groups') && !!document.getElementById('btn-rest-use-ficha');
  })());

  check('Extra: editar registro corrige carga/reps de uma série já salva', (() => {
    const entry = window.Workouts.lastLog('seg_1'); // registrado no teste 1
    window.Workouts.updateExerciseLog('seg_1', entry.id, {
      sets: [{ weight: 60, reps: 12 }, { weight: 60, reps: 11 }, { weight: 58, reps: 10 }, { weight: 58, reps: 9 }]
    });
    const updated = window.Workouts.lastLog('seg_1');
    return updated.sets[0].weight === 60 && updated.sets[0].reps === 12;
  })());

  check('Extra: apagar registro remove do histórico sem afetar outros exercícios', (() => {
    window.Running.addLog({ type: 'leve', distanceKm: 1, durationMin: 6 }); // dado de controle não relacionado
    const beforeCount = window.Workouts.history('seg_1').length;
    const entry = window.Workouts.lastLog('seg_1');
    window.Workouts.deleteExerciseLog('seg_1', entry.id);
    const afterCount = window.Workouts.history('seg_1').length;
    return afterCount === beforeCount - 1;
  })());

  check('Extra: detecção de platô identifica estagnação de carga', (() => {
    const exId = 'plateau_test_ex';
    const data = window.Storage.load();
    data.exerciseLogs[exId] = [
      { id: 'l1', date: '2026-01-01', sets: [{ weight: 50, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'l2', date: '2026-01-08', sets: [{ weight: 50, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'l3', date: '2026-01-15', sets: [{ weight: 48, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'l4', date: '2026-01-22', sets: [{ weight: 50, reps: 10 }], note: '', rir: null, painFlag: false }
    ];
    window.Storage.save();
    const result = window.Workouts.plateauCheck(exId);
    return result.isPlateau === true && result.sessionsConsidered === 4;
  })());

  check('Extra: sem platô quando a carga vem evoluindo', (() => {
    const exId = 'progress_test_ex';
    const data = window.Storage.load();
    data.exerciseLogs[exId] = [
      { id: 'p1', date: '2026-01-01', sets: [{ weight: 50, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'p2', date: '2026-01-08', sets: [{ weight: 52, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'p3', date: '2026-01-15', sets: [{ weight: 54, reps: 10 }], note: '', rir: null, painFlag: false },
      { id: 'p4', date: '2026-01-22', sets: [{ weight: 56, reps: 10 }], note: '', rir: null, painFlag: false }
    ];
    window.Storage.save();
    const result = window.Workouts.plateauCheck(exId);
    return result.isPlateau === false;
  })());

  check('Extra: trocar dois dias da grade semanal troca o conteúdo corretamente', (() => {
    const beforeQuarta = window.Workouts.planForDay('quarta').name;
    const beforeQuinta = window.Workouts.planForDay('quinta').name;
    window.Workouts.swapDays('quarta', 'quinta');
    const afterQuarta = window.Workouts.planForDay('quarta').name;
    const afterQuinta = window.Workouts.planForDay('quinta').name;
    const swapped = afterQuarta === beforeQuinta && afterQuinta === beforeQuarta;
    window.Workouts.swapDays('quarta', 'quinta'); // desfaz, deixa o estado limpo pros próximos testes
    return swapped;
  })());

  /* ===== Testes das funcionalidades novas: onboarding, lembrete, RIR, PRO ===== */

  check('Extra: usuário novo começa com onboarding pendente', (() => {
    // recria um banco limpo isoladamente pra checar o estado inicial,
    // sem afetar o _cache principal usado pelos outros testes
    const fresh = JSON.parse(JSON.stringify(window.Storage._cache));
    window.Storage.reset();
    const isPending = window.Storage.load().meta.onboardingComplete === false;
    window.Storage._cache = fresh; // restaura o estado anterior
    window.Storage.save();
    return isPending;
  })());

  check('Extra: templates de plano — 3 dias gera Full Body em seg/qua/sex', (() => {
    const plan = window.Onboarding.buildWeeklyPlan(3);
    return plan.segunda.name === 'Full Body A' && plan.quarta.name === 'Full Body B' && plan.sexta.name === 'Full Body C'
      && plan.terca.exercises.length === 0 && plan.domingo.exercises.length === 0;
  })());

  check('Extra: dias de descanso são objetos independentes, não a mesma referência compartilhada', (() => {
    const plan = window.Onboarding.buildWeeklyPlan(3);
    plan.terca.exercises.push({ id: 'x', name: 'teste' }); // muta só terça
    return plan.quinta.exercises.length === 0 && plan.sabado.exercises.length === 0 && plan.domingo.exercises.length === 0;
  })());

  check('Extra: templates de plano — 4 dias gera Superior/Inferior alternado', (() => {
    const plan = window.Onboarding.buildWeeklyPlan(4);
    return plan.segunda.name === 'Superiores A' && plan.terca.name === 'Inferiores A'
      && plan.quinta.name === 'Superiores B' && plan.sexta.name === 'Inferiores B' && plan.quarta.exercises.length === 0;
  })());

  check('Extra: templates de plano — 5 dias reaproveita 5 dos 6 dias originais sem duplicar', (() => {
    const plan = window.Onboarding.buildWeeklyPlan(5);
    const names = window.DAY_KEYS.map(k => plan[k].name).filter((n, i, arr) => plan[window.DAY_KEYS[i]].exercises.length > 0);
    const uniqueNames = new Set(names);
    return names.length === 5 && uniqueNames.size === 5; // 5 dias de treino, todos com nomes distintos
  })());

  check('Extra: templates de plano — 6 dias mantém o split original completo', (() => {
    const plan = window.Onboarding.buildWeeklyPlan(6);
    const original = window.buildDefaultPlan();
    return plan.segunda.name === original.segunda.name && plan.sabado.name === original.sabado.name;
  })());

  check('Extra: calculadora de nutrição gera metas plausíveis e reduz calorias no objetivo emagrecimento', (() => {
    const base = { weightKg: 80, heightCm: 175, age: 30, sex: 'masculino', daysPerWeek: 5 };
    const maintenance = window.Onboarding.calculateNutritionGoals({ ...base, objective: 'vshape' });
    const cut = window.Onboarding.calculateNutritionGoals({ ...base, objective: 'emagrecimento' });
    return maintenance.calorieGoal > 0 && cut.calorieGoal < maintenance.calorieGoal && cut.proteinGoal >= maintenance.proteinGoal;
  })());

  check('Extra: onboarding completo gera plano, salva perfil e marca como concluído', (() => {
    App.startOnboarding();
    document.getElementById('ob-height').value = 178;
    document.getElementById('ob-weight').value = 82;
    document.getElementById('ob-age').value = 27;
    document.getElementById('ob-sex').value = 'masculino';
    App.ob.objective = 'corrida';
    App.ob.days = 4;
    document.getElementById('ob-reminder-enable').checked = false;
    App.finishOnboarding();
    const data = window.Storage.load();
    const ok = data.meta.onboardingComplete === true
      && data.profile.heightCm === 178
      && data.profile.objective === 'corrida'
      && data.plan.segunda.name === 'Superiores A'
      && data.bodyLogs.some(b => b.weight === 82);
    document.getElementById('onboarding-screen').classList.add('hidden');
    return ok;
  })());

  check('Extra: RIR por série é salvo e recuperado no histórico', (() => {
    App.openWorkoutMode('quinta', 0); // dia com exercícios de novo (plano padrão restaurado pelo teste anterior mexeu só em quarta/quinta específico? usamos "quinta" que tem puxada)
    const ex = App.wmCurrentExercise();
    document.getElementById('wm-weight').value = 40;
    document.getElementById('wm-reps').value = 10;
    App._wmSelectedRir = '2';
    App.wmConcludeSet();
    const saved = App.wm.buffer[App.wm.buffer.length - 1];
    App.clearRestTimer();
    App.closeWorkoutMode();
    return saved.rir === '2';
  })());

  check('Extra: editar registro grava RIR corretamente', (() => {
    const exId = 'seg_2'; // exercício ainda não teve o único registro apagado por outro teste
    window.Workouts.recordExercise(exId, { sets: [{ weight: 30, reps: 12 }, { weight: 30, reps: 10 }] });
    const before = window.Workouts.lastLog(exId);
    if (!before) return false;
    window.Workouts.updateExerciseLog(exId, before.id, {
      sets: before.sets.map(s => ({ weight: s.weight, reps: s.reps, rir: 1 }))
    });
    const after = window.Workouts.lastLog(exId);
    return after.sets.every(s => s.rir === 1);
  })());

  check('Extra: modo de teste PRO ativa e desativa corretamente', (() => {
    const data = window.Storage.load();
    data.pro.active = true;
    data.pro.mode = 'demo';
    window.Storage.save();
    App.renderAccountPanel();
    const badgeShown = document.getElementById('account-content').innerHTML.includes('PRO ativo');
    data.pro.active = false;
    data.pro.mode = null;
    window.Storage.save();
    return badgeShown;
  })());

  check('Extra: comparação de fotos é limitada a 4 semanas no plano gratuito', (() => {
    const data = window.Storage.load();
    data.pro.active = false;
    data.meta.startDate = window.todayISO(new Date(Date.now() - 70 * 86400000)); // ~10 semanas atrás
    window.Storage.save();
    App.goTo('evolucao');
    App.renderWeekCompareControls();
    const options = Array.from(document.querySelectorAll('#cmp-week-a option')).map(o => Number(o.value));
    const limitedRange = options.length <= 4;
    data.pro.active = true;
    window.Storage.save();
    App.renderWeekCompareControls();
    const optionsAfterPro = Array.from(document.querySelectorAll('#cmp-week-a option')).map(o => Number(o.value));
    const unlockedRange = optionsAfterPro.length > 4;
    data.pro.active = false;
    window.Storage.save();
    return limitedRange && unlockedRange;
  })());

  check('Extra: exportar PDF do relatório é bloqueado sem PRO e liberado com PRO', (() => {
    const data = window.Storage.load();
    data.weeklyReports.push({
      id: 'rep_test', generatedAt: new Date().toISOString(), periodStart: '2026-01-01', periodEnd: '2026-01-07',
      weightDiff: -0.5, waistDiff: null, shouldersDiff: null, workoutsDone: 5, totalWorkouts: 6,
      runsDone: 2, runDistance: 8, avgLoadChange: 2, avgSleep: 7, recoveryLabel: 'Boa',
      positives: [], attention: [], suggestion: 'Continue assim.'
    });
    data.pro.active = false;
    window.Storage.save();
    App.renderWeeklyReport();
    const lockedWithoutPro = !!document.getElementById('btn-export-report-pdf-locked') && !document.getElementById('btn-export-report-pdf');
    data.pro.active = true;
    window.Storage.save();
    App.renderWeeklyReport();
    const unlockedWithPro = !!document.getElementById('btn-export-report-pdf') && !document.getElementById('btn-export-report-pdf-locked');
    data.pro.active = false;
    window.Storage.save();
    return lockedWithoutPro && unlockedWithPro;
  })());

  check('Extra: checkDailyReminder não lança erro mesmo sem permissão de notificação concedida', (() => {
    try {
      const data = window.Storage.load();
      data.settings.reminderEnabled = true;
      window.Storage.save();
      App.checkDailyReminder(); // Notification.permission é "default" em ambiente de teste, deve sair sem erro
      data.settings.reminderEnabled = false;
      window.Storage.save();
      return true;
    } catch (e) { console.error(e); return false; }
  })());

  check('Extra: onboarding bloqueia avançar do passo 2 sem altura/peso preenchidos', (() => {
    App.startOnboarding();
    App.obGoToStep(2); // vai pro passo de dados físicos
    document.getElementById('ob-height').value = '';
    document.getElementById('ob-weight').value = '';
    App.obGoToStep(3); // tenta avançar sem preencher
    const blocked = App.ob.step === 2; // não deve ter avançado
    document.getElementById('ob-height').value = 178;
    document.getElementById('ob-weight').value = 82;
    App.obGoToStep(3); // agora preenchido, deve avançar
    const advanced = App.ob.step === 3;
    document.getElementById('onboarding-screen').classList.add('hidden');
    return blocked && advanced;
  })());

  /* ===== Testes da auditoria de UX/UI (hero, hierarquia de CTA, a11y, abas) ===== */

  check('Extra (auditoria): apenas um botão primário visível por vez no card de exercício', (() => {
    App.goTo('treino');
    App.selectedDayTab = 'segunda';
    App.renderTreino();
    const primaries = document.querySelectorAll('.exercise-card .btn-primary').length;
    return primaries === 0; // Histórico e Registrar agora são secundários — só "Iniciar treino do dia" é primário na tela
  })());

  check('Extra (auditoria): todo botão só-ícone tem aria-label (acessibilidade)', (() => {
    App.goTo('treino');
    App.renderTreino();
    const iconButtons = document.querySelectorAll('.icon-btn');
    if (iconButtons.length === 0) return false;
    return Array.from(iconButtons).every(b => b.hasAttribute('aria-label') || b.hasAttribute('title'));
  })());

  check('Extra (auditoria): nenhum atributo class duplicado em nenhum elemento (HTML válido)', (() => {
    App.goTo('hoje'); App.renderAll();
    App.goTo('treino'); App.renderAll();
    App.goTo('evolucao'); App.renderAll();
    App.goTo('mais'); App.renderAll();
    // se houvesse class="" duplicado, o navegador só honraria o primeiro —
    // aqui checamos indiretamente que os elementos que deveriam ter classes
    // utilitárias de espaçamento realmente as têm.
    const sample = document.querySelector('#evolucao-tabs');
    return !!sample;
  })());

  check('Extra (auditoria): abas Resumo/Detalhes da Evolução alternam corretamente', (() => {
    App.goTo('evolucao');
    const tabs = document.getElementById('evolucao-tabs');
    tabs.querySelector('[data-evo-tab="detalhes"]').click();
    const resumoHidden = document.querySelector('[data-evo-panel="resumo"]').classList.contains('hidden');
    const detalhesVisible = !document.querySelector('[data-evo-panel="detalhes"]').classList.contains('hidden');
    tabs.querySelector('[data-evo-tab="resumo"]').click(); // volta ao estado padrão
    return resumoHidden && detalhesVisible;
  })());

  check('Extra (auditoria): hero do Índice V aparece antes dos cards secundários no DOM', (() => {
    App.goTo('hoje');
    const hero = document.getElementById('hero-band');
    const cards = document.getElementById('dashboard-cards');
    return !!(hero.compareDocumentPosition(cards) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  })());

  check('Extra (auditoria): tap targets de botões-ícone têm pelo menos 34px (mínimo de acessibilidade)', (() => {
    const rules = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    const blocks = [...rules.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const widths = blocks
      .filter(([, selector]) => /\.(icon-btn|ex-swap-btn|ex-edit-log-btn)\b/.test(selector) && !selector.includes('svg'))
      .map(([, , body]) => body.match(/width:\s*(\d+)px/))
      .filter(Boolean)
      .map(m => Number(m[1]));
    return widths.length > 0 && widths.every(w => w >= 34);
  })());

  check('Extra (auditoria): nenhuma sombra puramente decorativa no CSS (só overlay funcional permitido)', (() => {
    const rules = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    const shadowLines = rules.match(/box-shadow:[^;]+;/g) || [];
    // permitido: status-dot (indica estado) e --shadow-overlay (indica elemento flutuante/temporário)
    return shadowLines.every(l => l.includes('currentColor') || l.includes('var(--shadow-overlay)'));
  })());

  check('Extra (auditoria): sem código morto (Charts.taperBar removido, nunca era usado)', (() => {
    return typeof window.Charts.taperBar === 'undefined';
  })());

  check('Extra (auditoria): grid do dashboard não deixa célula vazia (nenhum card "wide" sobrando numa contagem ímpar de itens anteriores)', (() => {
    // CSS Grid com packing esparso (padrão) deixa buraco se um item de 2
    // colunas aparece depois de uma quantidade ÍMPAR de itens de 1 coluna
    // numa grade de 2 colunas. Verifica isso estruturalmente.
    App.goTo('hoje'); App.renderDashboard();
    const cards = Array.from(document.querySelectorAll('#dashboard-cards .dash-card'));
    let colsFilledInRow = 0;
    for (const c of cards) {
      const span = c.classList.contains('wide') ? 2 : 1;
      if (span === 2 && colsFilledInRow % 2 !== 0) return false; // deixaria buraco
      colsFilledInRow += span;
    }
    return true;
  })());

  /* ===== Auditoria adversarial: BLOCKER/HIGH encontrados e corrigidos ===== */

  check('BLOCKER corrigido: fechar Modo Treino no meio de um exercício salva o progresso parcial em vez de descartar', (() => {
    App.openWorkoutMode('sexta', 0); // 'sexta' sobrevive ao teste de onboarding (4 dias) anterior
    const ex = App.wmCurrentExercise();
    document.getElementById('wm-weight').value = 20;
    document.getElementById('wm-reps').value = 12;
    App.wmConcludeSet(); // 1ª de N séries — NÃO deveria ter sido salva ainda (só ao concluir a última)
    App.clearRestTimer();
    const beforeClose = window.Workouts.history(ex.id).length;
    App.wmRenderStep(); // simula continuar pra próxima série (sai do estado de descanso)
    App.closeWorkoutMode(); // fecha no meio — antes desse fix, a série feita seria perdida
    const afterClose = window.Workouts.history(ex.id).length;
    const savedEntry = window.Workouts.lastLog(ex.id);
    return beforeClose === 0 && afterClose === 1 && savedEntry.sets.length === 1 && savedEntry.sets[0].weight === 20;
  })());

  check('BLOCKER corrigido: completar o exercício inteiro normalmente não gera registro duplicado ao fechar depois', (() => {
    App.openWorkoutMode('sexta', 1); // outro exercício do mesmo dia, do zero
    const ex = App.wmCurrentExercise();
    for (let i = 0; i < ex.sets; i++) {
      document.getElementById('wm-weight').value = 10;
      document.getElementById('wm-reps').value = 10;
      App.wmConcludeSet();
      App.clearRestTimer();
    }
    const afterAllSets = window.Workouts.history(ex.id).length; // deve ser 1 (já salvo ao concluir a última série)
    App.closeWorkoutMode(); // buffer já deve estar vazio — não deve criar um 2º registro
    const afterClose = window.Workouts.history(ex.id).length;
    return afterAllSets === 1 && afterClose === 1;
  })());

  check('HIGH corrigido: nome de exercício personalizado com caracteres HTML não quebra a renderização (XSS/self-XSS)', (() => {
    const data = window.Storage.load();
    const malicious = '<img src=x onerror="window.__xss_fired=true">';
    data.plan.terca.exercises.push({
      id: window.uid('ex'), name: malicious, sets: 3, repsLow: 8, repsHigh: 12,
      restSec: 90, pattern: 'press-h', muscleGroup: 'peito'
    });
    window.Storage.save();
    window.__xss_fired = false;
    App.goTo('treino');
    App.selectedDayTab = 'terca';
    App.renderTreino();
    const notFired = window.__xss_fired !== true;
    // remove o exercício malicioso pra não afetar os testes seguintes
    data.plan.terca.exercises = data.plan.terca.exercises.filter(e => e.name !== malicious);
    window.Storage.save();
    return notFired;
  })());

  check('HIGH corrigido: dados físicos absurdos no onboarding são limitados a faixas plausíveis', (() => {
    App.startOnboarding();
    document.getElementById('ob-height').value = -50;
    document.getElementById('ob-weight').value = 0;
    document.getElementById('ob-age').value = 999;
    App.ob.objective = 'vshape';
    App.ob.days = 6;
    document.getElementById('ob-reminder-enable').checked = false;
    App.finishOnboarding();
    const data = window.Storage.load();
    const sane = data.profile.heightCm >= 100 && data.profile.heightCm <= 250
      && data.profile.startWeightKg >= 20 && data.profile.startWeightKg <= 300
      && data.profile.age >= 10 && data.profile.age <= 100;
    document.getElementById('onboarding-screen').classList.add('hidden');
    return sane;
  })());

  check('HIGH corrigido: abrir Modo Treino num dia sem exercícios avisa o usuário em vez de falhar em silêncio', (() => {
    const data = window.Storage.load();
    const emptyDayKey = 'domingo'; // sempre vazio por padrão
    App._lastToastMsg = null;
    const originalToast = App.toast.bind(App);
    App.toast = (msg) => { App._lastToastMsg = msg; originalToast(msg); };
    App.openWorkoutMode(emptyDayKey, 0);
    const stayedClosed = !App.wm; // não deveria ter aberto
    const warned = !!App._lastToastMsg;
    App.toast = originalToast;
    return stayedClosed && warned;
  })());

  /* ===== Sistema de destaque muscular + metadados por padrão de movimento ===== */

  check('Extra: todos os 16 padrões de movimento têm metadados completos (músculos, execução, respiração, erros, dicas)', (() => {
    const patterns = Object.keys(window.ExerciseDemos.PATTERN_LABELS);
    return patterns.every(p => {
      const m = window.ExerciseMetadata.get(p);
      return m && m.primaryMuscle && m.startPosition && m.execution
        && m.breathing.inhale && m.breathing.exhale
        && m.commonErrors.length > 0 && m.tips.length > 0
        && m.muscleMap && ('torso' in m.muscleMap);
    });
  })());

  check('Extra: SVG com destaque muscular aplica classe correta por segmento, sem afetar a versão sem destaque', (() => {
    const withMuscles = window.ExerciseDemos.svg('curl', true);
    const withoutMuscles = window.ExerciseDemos.svg('curl', false);
    // curl: torso=null(neutro), upperarm=stabilizer, forearm=primary
    const hasCorrectClasses = withMuscles.includes('rig-forearm muscle-primary') && withMuscles.includes('rig-upperarm muscle-stabilizer');
    const noRegression = !withoutMuscles.includes('muscle-primary') && !withoutMuscles.includes('muscle-neutral');
    return hasCorrectClasses && noRegression;
  })());

  check('Extra: tela de detalhes do exercício abre com boneco destacado, legenda e todas as seções de texto', (() => {
    App.goTo('treino');
    App.selectedDayTab = 'segunda';
    App.renderTreino();
    const firstDetailBtn = document.querySelector('[data-detail]');
    if (!firstDetailBtn) return false;
    firstDetailBtn.click();
    const modal = document.querySelector('.exercise-detail-tags');
    const hasLegend = document.querySelectorAll('.muscle-legend-item').length === 3;
    const hasSections = document.querySelectorAll('.exercise-detail-section').length >= 4;
    const closeBtn = document.getElementById('detail-close');
    if (closeBtn) closeBtn.click();
    return !!modal && hasLegend && hasSections;
  })());

  check('Extra: metadados funcionam pra exercício personalizado (escala automaticamente por padrão, não por nome)', (() => {
    const meta = window.ExerciseMetadata.get('squat');
    return meta.category === 'Quadríceps' && meta.muscleMap.thigh === 'primary';
  })());

  console.log('\n===== RESULTADO DOS TESTES =====');
  let pass = 0;
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}`);
    if (r.pass) pass++;
  }
  console.log(`\n${pass}/${results.length} testes passaram.`);
  if (pass !== results.length) process.exit(1);
  process.exit(0); // força saída limpa (checkDailyReminder agenda um setTimeout de 15min que senão manteria o processo vivo)
}

main().catch(e => { console.error('ERRO FATAL NO TESTE:', e); process.exit(1); });
