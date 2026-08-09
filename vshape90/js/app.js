/* ============================================================
   V-SHAPE 90 — app.js
   Orquestração da UI: navegação, dashboard, modo treino,
   corrida, evolução, nutrição/água, backup.
   ============================================================ */

/* Site externo de referência (GIFs reais de execução, com direitos próprios).
   O app NUNCA baixa/reproduz esse conteúdo — só linka para lá quando o
   usuário quiser conferir a execução com mais detalhe. Requer internet. */
const EXTERNAL_GIF_SITE = 'https://gifdotreino.com/';

const App = {
  currentView: 'hoje',
  selectedDayTab: dayKeyFromDate(),
  wm: null, // estado do modo treino em andamento

  init() {
    this.bindNav();
    this.bindHoje();
    this.bindTreino();
    this.bindWorkoutMode();
    this.bindCorrida();
    this.bindEvolucao();
    this.bindMais();
    this.renderAll();
    this.registerServiceWorker();
    this.checkDailyReminder();

    const data = Storage.load();
    if (!data.meta.onboardingComplete) {
      this.startOnboarding();
    }
  },

  /* ---------------- Navegação ---------------- */
  bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.view));
    });
    document.getElementById('btn-more-shortcut').addEventListener('click', () => this.goTo('mais'));
  },

  goTo(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    this.renderAll();
    window.scrollTo(0, 0);
  },

  renderAll() {
    this.renderDashboard();
    this.renderTreino();
    this.renderCorrida();
    this.renderEvolucao();
    this.renderMais();
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  },

  /* ============================================================
     VIEW: HOJE (Dashboard)
     ============================================================ */
  bindHoje() {
    // delegação de eventos para o check-in rápido é feita em renderCheckin()
  },

  renderDashboard() {
    const data = Storage.load();
    const start = new Date(data.meta.startDate);
    const dayNum = Math.min(90, Math.max(1, Math.floor((new Date() - start) / 86400000) + 1));
    document.getElementById('header-day').textContent = `DIA ${dayNum} / 90`;
    document.getElementById('header-progress').style.width = `${Math.min(100, (dayNum / 90) * 100)}%`;

    const lastBody = data.bodyLogs[data.bodyLogs.length - 1];
    const weight = lastBody ? lastBody.weight : data.profile.startWeightKg;
    const waist = lastBody ? lastBody.waist : null;
    const shoulders = lastBody ? lastBody.shoulders : null;
    const vIndex = (waist && shoulders) ? (shoulders / waist) : null;

    const withV = data.bodyLogs.filter(b => b.waist && b.shoulders);
    const firstV = withV.length ? withV[0].shoulders / withV[0].waist : null;
    const vTrendText = (vIndex && firstV && withV.length > 1)
      ? `<strong>${vIndex >= firstV ? '+' : ''}${((vIndex - firstV) / firstV * 100).toFixed(1)}%</strong> desde o início`
      : 'registre ombros e cintura pra acompanhar a evolução';

    // Hero: o resultado principal do app (Índice V) recebe tratamento
    // tipográfico próprio, sem borda de card — não compete com as
    // métricas secundárias abaixo.
    document.getElementById('hero-band').innerHTML = `
      <div class="hero-label">Índice V — dia ${dayNum} de 90</div>
      <div class="hero-value">${vIndex ? vIndex.toFixed(2) : '--'}<span class="hero-unit">ombros / cintura</span></div>
      <div class="hero-sub">${vIndex ? vTrendText : 'Registre suas medidas em Evolução pra ver seu Índice V aqui.'}</div>
    `;

    const weekSessions = Workouts.sessionsInRange(7);
    const totalPossibleWorkouts = 6; // seg-sáb
    const doneWorkouts = weekSessions.filter(s => s.completed && s.dayKey !== 'domingo').length;

    const weekRunKm = Running.totalDistance(7);

    const sem = Recovery.semaphore();

    // Métricas secundárias (apoiam o resultado principal, não competem com ele)
    const cards = [
      { label: 'Peso', value: `${weight.toFixed(1)} kg`, sub: lastBody ? '' : 'sem registro ainda' },
      { label: 'Treinos (7 dias)', value: `${doneWorkouts}/${totalPossibleWorkouts}`, sub: '' },
      { label: 'Corrida (7 dias)', value: `${weekRunKm.toFixed(1)} km`, sub: '' },
      { label: 'Recuperação', dot: sem.level, value: sem.label, sub: '' }
    ];

    const grid = document.getElementById('dashboard-cards');
    grid.innerHTML = cards.map(c => `
      <div class="dash-card ${c.wide ? 'wide' : ''} ${c.accent ? 'accent' : ''}">
        <div class="label">${c.label}</div>
        <div class="value" style="${c.dot ? 'display:flex;align-items:flex-start;gap:8px' : ''}">
          ${c.dot ? `<span class="status-dot ${c.dot}" style="margin-top:6px"></span>` : ''}${c.value}
        </div>
        ${c.sub ? `<div class="sub">${c.sub}</div>` : ''}
      </div>
    `).join('');

    this.renderTodayWorkoutPanel();
    this.renderTodayRunPanel();
    this.renderTodayCorePanel();
    this.renderCheckin();

    document.getElementById('streak-count').textContent = Streaks.current();
    const prs = Workouts.personalRecords();
    document.getElementById('pr-mini').innerHTML = prs.bestWeight.exercise
      ? `<svg class="icon" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h8v3a4 4 0 0 1-8 0V4z"/><path d="M7 5H4.5a2 2 0 0 0 0 4H7M15 5h2.5a2 2 0 0 1 0 4H15"/><path d="M11 11v3M8.5 17h5M9 17c0-1.2.5-2 2-2s2 .8 2 2"/></svg>${prs.bestWeight.exercise}: ${prs.bestWeight.value}kg`
      : '';
  },

  renderTodayWorkoutPanel() {
    const dayKey = dayKeyFromDate();
    const plan = Workouts.planForDay(dayKey);
    const el = document.getElementById('today-workout-content');
    if (!plan || !plan.exercises.length) {
      el.innerHTML = `
        <p class="muted">Hoje é dia de recuperação ativa. Sem musculação programada — mas se quiser treinar, dá pra escolher grupos musculares ou usar a ficha de outro dia.</p>
        <button class="btn-secondary mt-3" id="btn-goto-rest-options">Ver opções de treino</button>
      `;
      document.getElementById('btn-goto-rest-options').addEventListener('click', () => {
        this.goTo('treino');
        this.selectedDayTab = dayKey;
        this.renderTreino();
      });
      return;
    }
    el.innerHTML = `
      <p style="font-size:16px;font-weight:800;margin-bottom:10px">${plan.name}</p>
      <button class="btn-primary" id="btn-start-today-workout">Iniciar treino</button>
    `;
    document.getElementById('btn-start-today-workout').addEventListener('click', () => {
      this.goTo('treino');
      this.selectedDayTab = dayKey;
      this.renderTreino();
    });
  },

  renderTodayRunPanel() {
    const panel = document.getElementById('today-run-panel');
    const workout = Running.todaysWorkout();
    if (!workout) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    document.getElementById('today-run-content').innerHTML = `
      <p style="font-size:16px;font-weight:800">${workout.label}</p>
      <p class="muted">Meta de hoje: ~${workout.targetKm} km</p>
      <button class="btn-secondary" id="btn-goto-run">Registrar corrida</button>
    `;
    document.getElementById('btn-goto-run').addEventListener('click', () => this.goTo('corrida'));
  },

  renderTodayCorePanel() {
    const dayKey = dayKeyFromDate();
    const plan = Workouts.planForDay(dayKey);
    const routine = Workouts.coreRoutine(plan ? plan.core : null);
    const el = document.getElementById('today-core-content');
    if (!routine.items.length) {
      el.innerHTML = `<p class="muted">Sem CORE programado hoje.</p>`;
      return;
    }
    el.innerHTML = `
      <p style="font-weight:700">${routine.label} · <span class="muted">${routine.minutes}</span></p>
      <ul style="margin:8px 0 0 18px;padding:0;font-size:13.5px;color:var(--text-secondary)">
        ${routine.items.map(i => `<li>${i}</li>`).join('')}
      </ul>
    `;
  },

  renderCheckin() {
    const el = document.getElementById('checkin-content');
    const existing = Recovery.todayCheckIn();
    const sem = Recovery.semaphore(existing);

    if (existing) {
      el.innerHTML = `
        <div class="semaphore-badge ${sem.level}"><span class="status-dot ${sem.level}"></span> ${sem.label}</div>
        <p class="muted mt-2">${Recovery.recommendation(sem)}</p>
        <button class="btn-ghost mt-3" id="btn-edit-checkin">Editar check-in de hoje</button>
      `;
      document.getElementById('btn-edit-checkin').addEventListener('click', () => this.renderCheckinForm(existing));
      return;
    }
    this.renderCheckinForm(null);
  },

  renderCheckinForm(existing) {
    const el = document.getElementById('checkin-content');
    const v = existing || { sleep: 3, energy: 3, soreness: 3, stress: 3, sleepHours: 7, pain: false, painRegion: null };
    const scaleRow = (key, label, val) => `
      <div class="scale-row">
        <div class="scale-label">${label}</div>
        <div class="scale-btns" data-key="${key}">
          ${[1,2,3,4,5].map(n => `<button type="button" data-val="${n}" class="${n === val ? 'active' : ''}">${n}</button>`).join('')}
        </div>
      </div>`;
    el.innerHTML = `
      ${scaleRow('sleep', 'Sono', v.sleep)}
      ${scaleRow('energy', 'Energia', v.energy)}
      ${scaleRow('soreness', 'Dor muscular', v.soreness)}
      ${scaleRow('stress', 'Estresse', v.stress)}
      <label style="display:block;font-size:12.5px;color:var(--text-secondary);margin-bottom:10px">
        Horas de sono
        <input type="number" id="ci-sleephours" min="0" max="14" step="0.5" value="${v.sleepHours}" class="mt-1">
      </label>
      <p class="muted mb-2">Está sentindo alguma dor?</p>
      <div class="pain-toggle">
        <button type="button" id="ci-pain-yes" class="${v.pain ? 'active' : ''}">Sim</button>
        <button type="button" id="ci-pain-no" class="${!v.pain ? 'active' : ''}">Não</button>
      </div>
      <div id="ci-region-wrap" style="${v.pain ? '' : 'display:none'};margin-bottom:10px">
        <select id="ci-region">
          ${['ombro','cotovelo','lombar','joelho','quadril','tornozelo','outro'].map(r =>
            `<option value="${r}" ${v.painRegion === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}
        </select>
      </div>
      <button class="btn-secondary" id="btn-save-checkin">Salvar check-in</button>
    `;

    const state = { ...v };
    el.querySelectorAll('.scale-btns').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const key = row.dataset.key;
        state[key] = Number(e.target.dataset.val);
        row.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.val) === state[key]));
      });
    });
    document.getElementById('ci-pain-yes').addEventListener('click', () => {
      state.pain = true;
      document.getElementById('ci-pain-yes').classList.add('active');
      document.getElementById('ci-pain-no').classList.remove('active');
      document.getElementById('ci-region-wrap').style.display = '';
    });
    document.getElementById('ci-pain-no').addEventListener('click', () => {
      state.pain = false;
      document.getElementById('ci-pain-no').classList.add('active');
      document.getElementById('ci-pain-yes').classList.remove('active');
      document.getElementById('ci-region-wrap').style.display = 'none';
    });
    document.getElementById('btn-save-checkin').addEventListener('click', () => {
      state.sleepHours = document.getElementById('ci-sleephours').value;
      state.painRegion = document.getElementById('ci-region') ? document.getElementById('ci-region').value : null;
      Recovery.addCheckIn(state);
      this.toast('Check-in salvo.');
      this.renderDashboard();
    });
  },

  /* ============================================================
     VIEW: TREINO
     ============================================================ */
  bindTreino() {
    const tabs = document.getElementById('day-tabs');
    const labels = { domingo: 'Dom', segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' };
    tabs.innerHTML = DAY_KEYS.map(k => `<button class="tab-btn" data-day="${k}">${labels[k]}</button>`).join('');
    tabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDayTab = btn.dataset.day;
        this.renderTreino();
      });
    });
  },

  renderTreino() {
    document.querySelectorAll('#day-tabs .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.day === this.selectedDayTab);
    });
    const dayKey = this.selectedDayTab;
    const plan = Workouts.planForDay(dayKey);
    const content = document.getElementById('treino-content');

    if (!plan.exercises.length) {
      content.innerHTML = `
        <div class="panel">
          <h3>Dia de recuperação ativa</h3>
          <p class="muted">Caminhada leve, mobilidade e alongamento. Sem musculação pesada programada — mas se quiser treinar mesmo assim, escolha uma opção abaixo.</p>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px">
            <button class="btn-secondary" id="btn-rest-muscle-groups">Escolher grupos musculares</button>
            <button class="btn-secondary" id="btn-rest-use-ficha">Usar a ficha de outro dia</button>
          </div>
        </div>
      `;
      document.getElementById('btn-rest-muscle-groups').addEventListener('click', () => this.showMuscleGroupPicker());
      document.getElementById('btn-rest-use-ficha').addEventListener('click', () => this.showFichaPicker());
      return;
    }

    const routine = Workouts.coreRoutine(plan.core);
    content.innerHTML = `
      <div class="panel">
        <h3>${plan.name}</h3>
        <button class="btn-primary" id="btn-start-day">Iniciar treino do dia</button>
      </div>
      ${plan.exercises.map((ex, idx) => this.exerciseCardHTML(ex, dayKey, idx)).join('')}
      <button class="btn-ghost mb-3" id="btn-add-exercise">+ Adicionar exercício</button>
      <div class="panel">
        <h3>${routine.label}</h3>
        <p class="muted">${routine.minutes}</p>
        <ul style="margin:8px 0 0 18px;padding:0;font-size:13.5px;color:var(--text-secondary)">
          ${routine.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `;

    document.getElementById('btn-add-exercise').addEventListener('click', () => this.showAddExercisePicker(dayKey));
    document.getElementById('btn-start-day').addEventListener('click', () => this.openWorkoutMode(dayKey, 0));
    plan.exercises.forEach((ex, idx) => {
      const btn = content.querySelector(`[data-record="${ex.id}"]`);
      if (btn) btn.addEventListener('click', () => this.openWorkoutMode(dayKey, idx));
      const histBtn = content.querySelector(`[data-hist="${ex.id}"]`);
      if (histBtn) histBtn.addEventListener('click', () => this.showHistory(ex.id));
    });
    content.querySelectorAll('[data-swap]').forEach(btn => {
      btn.addEventListener('click', () => this.showSwapPicker(dayKey, Number(btn.dataset.swap)));
    });
    content.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => this.removeExercise(dayKey, Number(btn.dataset.remove)));
    });
    content.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => this.showExerciseDetail(plan.exercises[Number(btn.dataset.detail)]));
    });
  },

  /* Tela de detalhes do exercício: boneco com destaque muscular +
     metadados (músculos, execução, respiração, erros comuns, dicas).
     Metadados vêm por PADRÃO DE MOVIMENTO (ExerciseMetadata), então
     cobrem automaticamente qualquer exercício — catálogo, trocado ou
     personalizado — sem precisar cadastrar cada um manualmente. */
  showExerciseDetail(ex) {
    const meta = ExerciseMetadata.get(ex.pattern);
    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="detail-close" aria-label="Fechar detalhes">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px; overflow-y:auto; max-height:90vh">
        <div style="text-align:center">
          ${ExerciseDemos.xl(ex.pattern, true)}
        </div>
        <div class="muscle-legend" style="justify-content:center">
          <div class="muscle-legend-item"><span class="muscle-legend-dot" style="background:${ExerciseMetadata.MUSCLE_COLORS.primary}"></span>Principal</div>
          <div class="muscle-legend-item"><span class="muscle-legend-dot" style="background:${ExerciseMetadata.MUSCLE_COLORS.secondary}"></span>Secundário</div>
          <div class="muscle-legend-item"><span class="muscle-legend-dot" style="background:${ExerciseMetadata.MUSCLE_COLORS.stabilizer}"></span>Estabilizador</div>
        </div>
        <h2 style="font-size:20px; text-align:center; margin-bottom:2px">${escapeHtml(ex.name)}</h2>
        <p class="muted" style="text-align:center; margin-bottom:16px">${meta.category} · ${meta.type} · ${meta.level}</p>

        <div class="exercise-detail-tags">
          <span class="exercise-detail-tag">Principal: ${meta.primaryMuscle}</span>
          ${meta.secondaryMuscles.map(m => `<span class="exercise-detail-tag">${m}</span>`).join('')}
          <span class="exercise-detail-tag">${meta.equipment}</span>
        </div>

        <div class="exercise-detail-section">
          <h4>Posição inicial</h4>
          <p>${meta.startPosition}</p>
        </div>
        <div class="exercise-detail-section">
          <h4>Execução</h4>
          <p>${meta.execution}</p>
        </div>

        <div class="breathing-row">
          <div class="breathing-item"><div class="label">Inspire</div><div class="value">${meta.breathing.inhale}</div></div>
          <div class="breathing-item"><div class="label">Expire</div><div class="value">${meta.breathing.exhale}</div></div>
        </div>

        <div class="exercise-detail-section">
          <h4>Erros comuns</h4>
          <ul>${meta.commonErrors.map(e => `<li>${e}</li>`).join('')}</ul>
        </div>
        <div class="exercise-detail-section">
          <h4>Dicas</h4>
          <ul>${meta.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>
        <p class="muted" style="font-size:11px">Ilustração esquemática original (não é anatomia real) — músculos estabilizadores relevantes variam por pessoa e execução.</p>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('detail-close').addEventListener('click', () => wrap.remove());
  },

  removeExercise(dayKey, idx) {
    const plan = Workouts.planForDay(dayKey);
    const ex = plan.exercises[idx];
    if (!confirm(`Remover "${ex.name}" do treino de hoje? O histórico de cargas já registrado é mantido.`)) return;
    const data = Storage.load();
    data.plan[dayKey].exercises.splice(idx, 1);
    Storage.save();
    this.toast('Exercício removido.');
    this.renderTreino();
  },

  /* Adicionar exercício ao dia: escolhe grupo muscular, exercício (do
     catálogo ou personalizado) e configura séries/reps/descanso. */
  showAddExercisePicker(dayKey) {
    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    const groupEntries = Object.entries(ExerciseCatalog.GROUP_LABELS);
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="add-ex-close" aria-label="Fechar">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px">
        <h3 style="margin-bottom:2px; font-size:18px">Adicionar exercício</h3>
        <p class="muted mb-4">Escolha o grupo muscular</p>
        <div class="swap-list" id="add-ex-groups">
          ${groupEntries.map(([key, label]) => `<button class="swap-option swap-option-text" data-group="${key}"><span>${label}</span></button>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('add-ex-close').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('[data-group]').forEach(btn => {
      btn.addEventListener('click', () => this.showAddExerciseStep2(wrap, dayKey, btn.dataset.group));
    });
  },

  showAddExerciseStep2(wrap, dayKey, muscleGroup) {
    const alternatives = ExerciseCatalog.alternativesFor(muscleGroup);
    const groupLabel = ExerciseCatalog.GROUP_LABELS[muscleGroup];
    wrap.querySelector('.wm-inner').innerHTML = `
      <div class="wm-eyebrow">${groupLabel}</div>
      <h3 style="margin-bottom:2px; font-size:18px">Escolha o exercício</h3>
      <p class="muted mb-4">Ou digite um exercício personalizado</p>
      <div class="swap-list mb-4">
        ${alternatives.map(alt => `
          <button class="swap-option" data-name="${alt.name}" data-pattern="${alt.pattern}">
            ${ExerciseDemos.thumb(alt.pattern)}
            <span>${alt.name}</span>
          </button>
        `).join('')}
        <button class="swap-option swap-option-text" data-custom="1"><span>+ Exercício personalizado</span></button>
      </div>
      <div id="add-ex-custom-name" style="display:none; margin-bottom:14px">
        <label style="display:block; font-size:11px; color:var(--text-tertiary); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px">Nome do exercício</label>
        <input type="text" id="add-ex-custom-input" placeholder="Ex: Remada cavalinho">
      </div>
      <div id="add-ex-config" style="display:none">
        <div class="form-grid mb-4">
          <label>Séries<input type="number" id="add-ex-sets" value="3" min="1" max="8"></label>
          <label>Descanso (s)<input type="number" id="add-ex-rest" value="90" min="0" step="15"></label>
          <label>Reps mín.<input type="number" id="add-ex-repslow" value="8" min="1"></label>
          <label>Reps máx.<input type="number" id="add-ex-repshigh" value="12" min="1"></label>
        </div>
        <button class="btn-primary" id="add-ex-confirm">Adicionar ao treino</button>
      </div>
    `;
    let chosen = null;
    const showConfig = () => { wrap.querySelector('#add-ex-config').style.display = ''; };
    wrap.querySelectorAll('[data-name]').forEach(btn => {
      btn.addEventListener('click', () => {
        chosen = { name: btn.dataset.name, pattern: btn.dataset.pattern };
        wrap.querySelector('#add-ex-custom-name').style.display = 'none';
        wrap.querySelectorAll('.swap-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showConfig();
      });
    });
    wrap.querySelector('[data-custom]').addEventListener('click', (e) => {
      chosen = { name: '', pattern: 'core' };
      wrap.querySelector('#add-ex-custom-name').style.display = '';
      wrap.querySelectorAll('.swap-option').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      showConfig();
    });
    wrap.querySelector('#add-ex-confirm').addEventListener('click', () => {
      const customInput = wrap.querySelector('#add-ex-custom-input');
      const finalName = customInput && customInput.value.trim() ? customInput.value.trim() : chosen.name;
      if (!finalName) { this.toast('Digite um nome para o exercício.'); return; }
      const data = Storage.load();
      data.plan[dayKey].exercises.push({
        id: uid('ex'),
        name: finalName,
        sets: Number(wrap.querySelector('#add-ex-sets').value) || 3,
        repsLow: Number(wrap.querySelector('#add-ex-repslow').value) || 8,
        repsHigh: Number(wrap.querySelector('#add-ex-repshigh').value) || 12,
        restSec: Number(wrap.querySelector('#add-ex-rest').value) || 90,
        pattern: chosen.pattern,
        muscleGroup
      });
      Storage.save();
      this.toast(`"${finalName}" adicionado ao treino.`);
      wrap.remove();
      this.renderTreino();
    });
  },

  /* Dia de descanso — opção 1: montar treino avulso escolhendo grupos musculares */
  showMuscleGroupPicker() {
    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    const groupEntries = Object.entries(ExerciseCatalog.GROUP_LABELS);
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="mg-close" aria-label="Fechar">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px">
        <h3 style="margin-bottom:2px; font-size:18px">Escolher grupos musculares</h3>
        <p class="muted mb-4">Selecione um ou mais grupos. Monto 2 exercícios de cada.</p>
        <div class="swap-list mb-4" id="mg-list">
          ${groupEntries.map(([key, label]) => `<button class="swap-option swap-option-text" data-group="${key}"><span>${label}</span></button>`).join('')}
        </div>
        <button class="btn-primary" id="mg-confirm">Montar treino</button>
      </div>
    `;
    document.body.appendChild(wrap);
    const selected = new Set();
    document.getElementById('mg-close').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('[data-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        if (selected.has(g)) { selected.delete(g); btn.classList.remove('active'); }
        else { selected.add(g); btn.classList.add('active'); }
      });
    });
    document.getElementById('mg-confirm').addEventListener('click', () => {
      if (!selected.size) { this.toast('Escolha ao menos um grupo muscular.'); return; }
      const exercises = [];
      selected.forEach(group => {
        const alts = ExerciseCatalog.alternativesFor(group).slice(0, 2);
        alts.forEach(alt => exercises.push({
          id: uid('ex'), name: alt.name, sets: 3, repsLow: 8, repsHigh: 12, restSec: 90,
          pattern: alt.pattern, muscleGroup: group
        }));
      });
      const label = Array.from(selected).map(g => ExerciseCatalog.GROUP_LABELS[g]).join(' + ');
      wrap.remove();
      this.openWorkoutModeCustom(label, exercises);
    });
  },

  /* Dia de descanso — opção 2: usar a ficha (plano) de outro dia da semana */
  showFichaPicker() {
    const data = Storage.load();
    const labels = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
    const options = DAY_KEYS.filter(k => data.plan[k].exercises.length > 0);
    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="ficha-close" aria-label="Fechar">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px">
        <h3 style="margin-bottom:2px; font-size:18px">Usar ficha de outro dia</h3>
        <p class="muted mb-4">O treino de hoje será registrado normalmente, contando pra sua sequência.</p>
        <div class="swap-list">
          ${options.map(k => `
            <button class="swap-option swap-option-text" data-day="${k}">
              <span>${labels[k]} — ${data.plan[k].name} <span class="muted" style="font-weight:400">(${data.plan[k].exercises.length} exercícios)</span></span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('ficha-close').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('[data-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.remove();
        this.openWorkoutMode(btn.dataset.day, 0);
      });
    });
  },

  /* Substituição de exercício: mostra alternativas do mesmo grupo
     muscular. Trocar cria um novo id de exercício (o histórico do
     exercício antigo fica preservado, só não aparece mais no plano). */
  showSwapPicker(dayKey, idx) {
    const plan = Workouts.planForDay(dayKey);
    const current = plan.exercises[idx];
    const alternatives = ExerciseCatalog.alternativesFor(current.muscleGroup);
    const groupLabel = ExerciseCatalog.GROUP_LABELS[current.muscleGroup] || 'Exercício';
    const defaultPlan = window.buildDefaultPlan();
    const defaultEx = defaultPlan[dayKey] && defaultPlan[dayKey].exercises[idx];
    const isCustomized = defaultEx && defaultEx.id !== current.id;

    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="swap-close" aria-label="Fechar">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px">
        <div class="wm-eyebrow">${groupLabel}</div>
        <h3 style="margin-bottom:2px; font-size:18px">Trocar exercício</h3>
        <p class="muted mb-4">Exercício atual: ${escapeHtml(current.name)}</p>
        <div class="swap-list">
          ${alternatives.map(alt => `
            <button class="swap-option ${alt.name === current.name ? 'active' : ''}" data-alt-id="${alt.id}" data-alt-name="${alt.name}" data-alt-pattern="${alt.pattern}">
              ${ExerciseDemos.thumb(alt.pattern)}
              <span>${alt.name}</span>
            </button>
          `).join('')}
        </div>
        ${isCustomized ? `<button class="btn-ghost mt-4" id="swap-restore">Restaurar exercício padrão do dia</button>` : ''}
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('swap-close').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('.swap-option').forEach(opt => {
      opt.addEventListener('click', () => {
        this.applyExerciseSwap(dayKey, idx, {
          id: opt.dataset.altId,
          name: opt.dataset.altName,
          pattern: opt.dataset.altPattern,
          sets: current.sets,
          repsLow: current.repsLow,
          repsHigh: current.repsHigh,
          restSec: current.restSec,
          muscleGroup: current.muscleGroup
        });
        wrap.remove();
      });
    });
    const restoreBtn = document.getElementById('swap-restore');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        this.applyExerciseSwap(dayKey, idx, defaultEx);
        wrap.remove();
      });
    }
  },

  applyExerciseSwap(dayKey, idx, newExercise) {
    const data = Storage.load();
    data.plan[dayKey].exercises[idx] = { ...newExercise };
    Storage.save();
    this.toast(`Exercício trocado para ${newExercise.name}.`);
    this.renderTreino();
  },

  exerciseCardHTML(ex, dayKey, idx) {
    const last = Workouts.lastLog(ex.id);
    const suggestion = Workouts.progressionSuggestion(ex.id);
    const plateau = Workouts.plateauCheck(ex.id);
    const lastText = last
      ? last.sets.map(s => `${s.weight}kg×${s.reps}`).join(' · ')
      : 'sem registros ainda';
    return `
      <div class="exercise-card">
        <div class="ex-head-row">
          <button class="ex-thumb-btn" data-detail="${idx}" aria-label="Ver detalhes de ${escapeHtml(ex.name)}" title="Ver detalhes">
            ${ExerciseDemos.thumb(ex.pattern)}
          </button>
          <div style="flex:1; min-width:0">
            <div class="ex-head">
              <div class="ex-name">${escapeHtml(ex.name)}</div>
              <div style="display:flex; align-items:center; gap:6px; flex:none">
                <div class="rest-chip">${ex.restSec}s</div>
                <button class="icon-btn ex-swap-btn" data-swap="${idx}" title="Trocar exercício" aria-label="Trocar ${escapeHtml(ex.name)} por outro exercício">
                  <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h11M13 4.5 16 8l-3 3.5"/><path d="M17 14H6M9 10.5 6 14l3 3.5"/></svg>
                </button>
                <button class="icon-btn ex-remove-btn" data-remove="${idx}" title="Remover exercício" aria-label="Remover ${escapeHtml(ex.name)} do treino">
                  <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h12M9 6V4.5h4V6M6.5 6l.7 11a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-11"/></svg>
                </button>
              </div>
            </div>
            <div class="ex-meta">${ex.sets}× ${ex.repsLow}–${ex.repsHigh} · última: ${lastText}</div>
          </div>
        </div>
        ${suggestion ? `<div class="ex-suggestion ${suggestion.level}">${suggestion.text}</div>` : ''}
        ${plateau.isPlateau ? `<div class="ex-suggestion plateau">Sem evolução de carga há ${plateau.sessionsConsidered} sessões (~${plateau.daysSpan} dias). Considere uma semana de deload: reduza cerca de 10–20% do peso por 5–7 dias.</div>` : ''}
        <div class="ex-actions">
          <button class="btn-secondary" data-hist="${ex.id}">Histórico</button>
          <button class="btn-secondary" data-record="${ex.id}">Registrar</button>
        </div>
        <a class="ex-external-link" href="${EXTERNAL_GIF_SITE}" target="_blank" rel="noopener noreferrer">
          Ver execução ↗
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v10h10v-3"/><path d="M9 3h4v4"/><path d="M13 3 7 9"/></svg>
        </a>
      </div>
    `;
  },

  showHistory(exerciseId) {
    const ex = Workouts.findExercise(exerciseId);
    const hist = Workouts.history(exerciseId);
    const stats = Workouts.stats(exerciseId);
    const rows = hist.slice().reverse().slice(0, 15).map(h => `
      <div class="ex-history-row ex-history-row-editable">
        <span>${h.date}</span>
        <span>${h.maxWeight}kg</span>
        <span>${h.volume}kg vol</span>
        <button class="icon-btn ex-edit-log-btn" data-log-id="${h.id}" title="Editar registro" aria-label="Editar registro de ${h.date}">
          <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5 17.5 7.5 8 17H5v-3z"/></svg>
        </button>
      </div>
    `).join('') || '<p class="empty-state">Sem histórico ainda. Toque em "Registrar" para começar.</p>';
    const headerRow = hist.length ? `<div class="ex-history-row ex-history-row-editable"><span>Data</span><span>Carga</span><span>Volume</span><span></span></div>` : '';

    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="hist-close" aria-label="Fechar histórico">✕</button>
      <div class="wm-inner" style="text-align:left">
        <h3 class="mb-1">${escapeHtml(ex.name)}</h3>
        <p class="muted mb-4">Histórico e evolução</p>
        ${stats ? `
          <div class="card-grid mb-4">
            <div class="dash-card"><div class="label">Carga máx.</div><div class="value">${stats.maxWeight}kg</div></div>
            <div class="dash-card"><div class="label">Volume máx.</div><div class="value">${stats.maxVolume}kg</div></div>
            <div class="dash-card"><div class="label">Últ. carga</div><div class="value">${Workouts.maxWeightOf(stats.last) || stats.last.maxWeight}kg</div></div>
            <div class="dash-card"><div class="label">Evolução 30d</div><div class="value">${stats.evolution30 !== null ? stats.evolution30.toFixed(1) + '%' : '--'}</div></div>
          </div>
          <canvas id="hist-chart" class="chart-canvas mb-4"></canvas>
        ` : '<p class="empty-state">Sem histórico ainda. Toque em "Registrar" para começar.</p>'}
        <div id="hist-rows-container">${headerRow}${rows}</div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('hist-close').addEventListener('click', () => wrap.remove());
    if (stats) {
      const points = hist.map(h => ({ label: h.date.slice(5), value: h.maxWeight }));
      Charts.lineChart(document.getElementById('hist-chart'), points, { color: '#C6FA3E' });
    }
    wrap.querySelectorAll('.ex-edit-log-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showEditLogForm(wrap, exerciseId, btn.dataset.logId));
    });
  },

  /* Corrige um registro já salvo (erro de digitação de carga/reps) ou apaga
     o registro inteiro, sem precisar refazer o exercício. */
  showEditLogForm(historyWrap, exerciseId, logId) {
    const data = Storage.load();
    const entry = (data.exerciseLogs[exerciseId] || []).find(l => l.id === logId);
    if (!entry) return;

    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="edit-log-close" aria-label="Fechar edição">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:380px">
        <h3 style="margin-bottom:2px; font-size:18px">Editar registro</h3>
        <p class="muted mb-4">${entry.date}</p>
        <div id="edit-log-sets" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px">
          ${entry.sets.map((s, i) => `
            <div class="form-grid">
              <label>Série ${i + 1} — Carga (kg)<input type="number" step="0.5" class="edit-set-weight" data-idx="${i}" value="${s.weight}"></label>
              <label>Repetições<input type="number" class="edit-set-reps" data-idx="${i}" value="${s.reps}"></label>
              <label class="span-2">RIR (opcional)<input type="number" min="0" max="10" class="edit-set-rir" data-idx="${i}" value="${s.rir ?? ''}"></label>
            </div>
          `).join('')}
        </div>
        <label class="wm-pain-check" style="justify-content:flex-start">
          <input type="checkbox" id="edit-log-pain" ${entry.painFlag ? 'checked' : ''}> Houve dor nesta sessão
        </label>
        <button class="btn-primary mt-4" id="edit-log-save">Salvar correção</button>
        <button class="btn-danger mt-3" id="edit-log-delete">Apagar este registro</button>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('edit-log-close').addEventListener('click', () => wrap.remove());
    document.getElementById('edit-log-save').addEventListener('click', () => {
      const weights = wrap.querySelectorAll('.edit-set-weight');
      const reps = wrap.querySelectorAll('.edit-set-reps');
      const rirs = wrap.querySelectorAll('.edit-set-rir');
      const sets = Array.from(weights).map((w, i) => ({ weight: w.value, reps: reps[i].value, rir: rirs[i].value }));
      Workouts.updateExerciseLog(exerciseId, logId, { sets, painFlag: document.getElementById('edit-log-pain').checked });
      this.toast('Registro corrigido.');
      wrap.remove();
      historyWrap.remove();
      this.showHistory(exerciseId);
      this.renderTreino();
    });
    document.getElementById('edit-log-delete').addEventListener('click', () => {
      if (!confirm('Apagar este registro do histórico? Essa ação não pode ser desfeita.')) return;
      Workouts.deleteExerciseLog(exerciseId, logId);
      this.toast('Registro apagado.');
      wrap.remove();
      historyWrap.remove();
      this.showHistory(exerciseId);
      this.renderTreino();
    });
  },

  /* ============================================================
     MODO TREINO (fullscreen)
     ============================================================ */
  bindWorkoutMode() {
    document.getElementById('wm-close').addEventListener('click', () => this.closeWorkoutMode());
    document.getElementById('wm-weight-minus').addEventListener('click', () => this.wmAdjust('weight', -1));
    document.getElementById('wm-weight-plus').addEventListener('click', () => this.wmAdjust('weight', 1));
    document.getElementById('wm-reps-minus').addEventListener('click', () => this.wmAdjust('reps', -1));
    document.getElementById('wm-reps-plus').addEventListener('click', () => this.wmAdjust('reps', 1));
    document.getElementById('wm-conclude').addEventListener('click', () => this.wmConcludeSet());
    document.getElementById('wm-skip-rest').addEventListener('click', () => this.wmSkipRest());
    document.getElementById('wm-rir-scale').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this._wmSelectedRir = btn.dataset.rir;
        document.getElementById('wm-rir-scale').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  openWorkoutMode(dayKey, startIndex) {
    const plan = Workouts.planForDay(dayKey);
    if (!plan.exercises.length) {
      // HIGH corrigido: antes falhava em silêncio (clique sem nenhum
      // feedback) se chamado num dia sem exercícios.
      this.toast('Esse dia não tem exercícios programados.');
      return;
    }
    const session = Workouts.startSession(dayKey);
    this.wm = {
      dayKey,
      dayLabel: plan.name,
      session,
      exercises: plan.exercises,
      exIndex: startIndex,
      setIndex: 0,
      buffer: [], // sets concluídos do exercício atual
      restTimer: null
    };
    document.getElementById('workout-mode').classList.remove('hidden');
    this.wmRenderStep();
  },

  /* Treino avulso (fora da grade semanal) — usado no dia de descanso
     quando o usuário escolhe grupos musculares em vez de uma ficha fixa. */
  openWorkoutModeCustom(dayLabel, exercises) {
    if (!exercises.length) return;
    const session = Workouts.startSession('avulso');
    this.wm = {
      dayKey: 'avulso',
      dayLabel,
      session,
      exercises,
      exIndex: 0,
      setIndex: 0,
      buffer: [],
      restTimer: null
    };
    document.getElementById('workout-mode').classList.remove('hidden');
    this.wmRenderStep();
  },

  closeWorkoutMode() {
    // BLOCKER corrigido: fechar no meio de um exercício descartava em
    // silêncio as séries já concluídas (ficavam só em memória, nunca
    // salvas até a ÚLTIMA série do exercício ser concluída). Agora, em
    // vez de só avisar, salvamos o progresso parcial de verdade — o
    // usuário nunca perde uma série que já registrou.
    if (this.wm && this.wm.buffer && this.wm.buffer.length > 0) {
      const ex = this.wmCurrentExercise();
      Workouts.recordExercise(ex.id, { sets: this.wm.buffer, painFlag: !!this.wm.painFlag });
      this.toast(`${this.wm.buffer.length} série(s) salvas antes de sair.`);
    }
    this.clearRestTimer();
    document.getElementById('workout-mode').classList.add('hidden');
    document.getElementById('wm-rest').classList.add('hidden');
    this.wm = null;
    this.renderAll();
  },

  wmCurrentExercise() {
    return this.wm.exercises[this.wm.exIndex];
  },

  wmRenderStep() {
    const ex = this.wmCurrentExercise();
    const last = Workouts.lastLog(ex.id);
    const lastSet = last ? last.sets[this.wm.setIndex] : null;
    const prevInSession = this.wm.buffer.length ? this.wm.buffer[this.wm.buffer.length - 1] : null;

    document.getElementById('wm-eyebrow').textContent = (this.wm.dayLabel || '').toUpperCase();
    document.getElementById('wm-demo').innerHTML = ExerciseDemos.large(ex.pattern, true);
    document.getElementById('wm-exname').textContent = ex.name.toUpperCase();
    document.getElementById('wm-external-link').firstChild.textContent = `Ver "${ex.name}" no Gif do Treino `;
    document.getElementById('wm-series').textContent = `Série ${this.wm.setIndex + 1}/${ex.sets}`;
    document.getElementById('wm-prev').textContent = prevInSession
      ? `Série anterior (hoje): ${prevInSession.weight}kg × ${prevInSession.reps}`
      : lastSet
        ? `Última vez: ${lastSet.weight}kg × ${lastSet.reps}`
        : 'Sem registro anterior';

    // A carga já vem preenchida com o peso usado na série anterior desta
    // mesma sessão (o mais comum é manter o mesmo peso entre séries).
    // Só cai para o histórico de sessões passadas na primeira série.
    const suggestedWeight = prevInSession ? prevInSession.weight : (lastSet ? lastSet.weight : 0);
    const suggestedReps = lastSet ? lastSet.reps : ex.repsLow;
    document.getElementById('wm-weight').value = suggestedWeight;
    document.getElementById('wm-reps').value = suggestedReps;
    document.getElementById('wm-pain').checked = false;
    this._wmSelectedRir = '';
    document.getElementById('wm-rir-scale').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.rir === ''));

    document.getElementById('wm-rest').classList.add('hidden');
    document.getElementById('wm-conclude').style.display = '';
    document.querySelectorAll('.wm-field').forEach(f => f.style.display = '');
    document.querySelector('.wm-pain-check').style.display = '';
  },

  wmAdjust(field, dir) {
    const input = document.getElementById(field === 'weight' ? 'wm-weight' : 'wm-reps');
    const step = field === 'weight' ? 1 : 1;
    const val = (Number(input.value) || 0) + dir * step;
    input.value = Math.max(0, val);
  },

  wmConcludeSet() {
    const weight = Number(document.getElementById('wm-weight').value) || 0;
    const reps = Number(document.getElementById('wm-reps').value) || 0;
    const pain = document.getElementById('wm-pain').checked;
    const rir = this._wmSelectedRir || '';
    this.wm.buffer.push({ weight, reps, rir });
    if (pain) this.wm.painFlag = true;

    const ex = this.wmCurrentExercise();
    const isLastSetOfExercise = this.wm.setIndex >= ex.sets - 1;

    if (isLastSetOfExercise) {
      // salva o exercício completo
      Workouts.recordExercise(ex.id, { sets: this.wm.buffer, painFlag: !!this.wm.painFlag });
      this.wm.buffer = [];
      this.wm.painFlag = false;
      this.wm.setIndex = 0;

      const isLastExercise = this.wm.exIndex >= this.wm.exercises.length - 1;
      if (isLastExercise) {
        Workouts.completeSession(this.wm.session.id);
        this.toast('Treino concluído.');
        this.startRest(ex.restSec, true);
        return;
      }
      this.wm.exIndex += 1;
    } else {
      this.wm.setIndex += 1;
    }
    this.startRest(ex.restSec, false);
  },

  startRest(seconds, isFinal) {
    document.getElementById('wm-conclude').style.display = 'none';
    document.querySelectorAll('.wm-field').forEach(f => f.style.display = 'none');
    document.querySelector('.wm-pain-check').style.display = 'none';

    const restEl = document.getElementById('wm-rest');
    restEl.classList.remove('hidden');
    const presets = [45, 60, 90, 120, 180];
    document.getElementById('wm-rest-options').innerHTML = presets.map(p =>
      `<button data-sec="${p}" class="${p === seconds ? 'active' : ''}">${p}s</button>`).join('');
    document.getElementById('wm-rest-options').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        this.clearRestTimer();
        document.querySelectorAll('#wm-rest-options button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.runRestTimer(Number(b.dataset.sec), isFinal);
      });
    });
    document.getElementById('wm-skip-rest').textContent = isFinal ? 'Fechar treino' : 'Pular descanso';
    this.runRestTimer(seconds, isFinal);
  },

  runRestTimer(seconds, isFinal) {
    this.clearRestTimer();
    let remaining = seconds;
    const timeEl = document.getElementById('wm-rest-time');
    const render = () => {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    render();
    this.wm.restTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this.clearRestTimer();
        timeEl.textContent = '00:00';
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        playBeep();
        if (isFinal) {
          this.toast('Próxima série: concluído!');
          this.closeWorkoutMode();
        } else {
          this.toast('Próxima série!');
          this.wmRenderStep();
        }
        return;
      }
      render();
    }, 1000);
  },

  wmSkipRest() {
    this.clearRestTimer();
    const isFinal = document.getElementById('wm-skip-rest').textContent === 'Fechar treino';
    if (isFinal) {
      this.closeWorkoutMode();
    } else {
      this.wmRenderStep();
    }
  },

  clearRestTimer() {
    if (this.wm && this.wm.restTimer) {
      clearInterval(this.wm.restTimer);
      this.wm.restTimer = null;
    }
  },

  /* ============================================================
     VIEW: CORRIDA
     ============================================================ */
  bindCorrida() {
    document.getElementById('run-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('run-type').value;
      const distanceKm = document.getElementById('run-distance').value;
      const durationMin = document.getElementById('run-duration').value;
      const rpe = document.getElementById('run-rpe').value || null;
      const hr = document.getElementById('run-hr').value || null;
      const notes = document.getElementById('run-notes').value;
      if (!distanceKm || !durationMin) { this.toast('Informe distância e duração.'); return; }
      Running.addLog({ type, distanceKm, durationMin, rpe, hr, notes });
      e.target.reset();
      this.toast('Corrida registrada!');
      this.renderAll();
    });
  },

  renderCorrida() {
    const workout = Running.todaysWorkout();
    const week = Running.planForWeek(Running.currentWeekNumber());
    document.getElementById('run-plan-content').innerHTML = `
      <p class="muted">Semana ${week.week} do plano de 90 dias rumo aos 10km.</p>
      <div class="card-grid mt-3">
        <div class="dash-card"><div class="label">Leve (seg)</div><div class="value">${week.leve} km</div></div>
        <div class="dash-card"><div class="label">Intervalado (qua)</div><div class="value">${week.intervalado} km</div></div>
        <div class="dash-card"><div class="label">Longão (sex)</div><div class="value">${week.longao} km</div></div>
      </div>
      ${workout ? `<p class="mt-3 muted">Hoje: ${workout.label} · meta ~${workout.targetKm}km</p>` : `<p class="mt-3 muted">Sem corrida programada para hoje.</p>`}
    `;

    const logs = Running.all();
    const points = logs.filter(l => l.paceMinKm).map(l => ({ label: l.date.slice(5), value: Number(l.paceMinKm.toFixed(2)) }));
    Charts.lineChart(document.getElementById('run-pace-chart'), points, { color: '#57D9A3', fillColor: 'rgba(87,217,163,0.14)' });

    const histEl = document.getElementById('run-history');
    if (!logs.length) {
      histEl.innerHTML = '<p class="empty-state">Nenhuma corrida registrada ainda. Registre a próxima logo acima.</p>';
    } else {
      const header = `<div class="ex-history-row"><span>Data</span><span>Distância</span><span>Pace</span></div>`;
      const rows = logs.slice().reverse().slice(0, 20).map(l => `
        <div class="ex-history-row">
          <span>${l.date} · ${l.type}</span>
          <span>${l.distanceKm}km</span>
          <span>${Running.formatPace(l.paceMinKm)}</span>
        </div>
      `).join('');
      histEl.innerHTML = header + rows;
    }
  },

  /* ============================================================
     VIEW: EVOLUÇÃO
     ============================================================ */
  bindEvolucao() {
    document.getElementById('evolucao-tabs').querySelectorAll('[data-evo-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.evoTab;
        document.getElementById('evolucao-tabs').querySelectorAll('[data-evo-tab]').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.evo-tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.evoPanel !== tab));
      });
    });

    document.getElementById('body-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Storage.load();
      const date = todayISO();
      const entry = {
        id: uid('body'),
        date,
        weight: Number(document.getElementById('bf-weight').value),
        waist: Number(document.getElementById('bf-waist').value) || null,
        shoulders: Number(document.getElementById('bf-shoulders').value) || null,
        chest: Number(document.getElementById('bf-chest').value) || null,
        armR: Number(document.getElementById('bf-armr').value) || null,
        armL: Number(document.getElementById('bf-arml').value) || null,
        thigh: Number(document.getElementById('bf-thigh').value) || null
      };
      data.bodyLogs = data.bodyLogs.filter(b => b.date !== date);
      data.bodyLogs.push(entry);
      data.bodyLogs.sort((a, b) => a.date.localeCompare(b.date));
      Storage.save();
      e.target.reset();
      this.toast('Medidas salvas.');
      this.renderAll();
    });

    document.getElementById('photo-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const type = document.getElementById('photo-type').value;
      const dataURL = await fileToDataURL(file, 1000);
      const id = uid('photo');
      const data = Storage.load();
      data.photoMeta.push({ id, date: todayISO(), type });
      Storage.save();
      await Photos.put({ id, dataURL });
      e.target.value = '';
      this.toast('Foto salva.');
      this.renderEvolucao();
    });

    document.getElementById('btn-generate-report').addEventListener('click', () => this.generateWeeklyReport());
  },

  async renderEvolucao() {
    const data = Storage.load();

    // Índice V
    const withV = data.bodyLogs.filter(b => b.waist && b.shoulders).map(b => ({ ...b, vIndex: b.shoulders / b.waist }));
    const vEl = document.getElementById('vindex-content');
    if (withV.length) {
      const first = withV[0].vIndex;
      const last = withV[withV.length - 1].vIndex;
      const variation = ((last - first) / first) * 100;
      vEl.innerHTML = `
        <p>Início: <strong>${first.toFixed(2)}</strong> → Atual: <strong>${last.toFixed(2)}</strong>
        (<span style="color:${variation >= 0 ? 'var(--positive)' : 'var(--danger)'}">${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%</span>)</p>
        <p class="muted mt-1">Indicador apenas para acompanhamento visual — não é diagnóstico médico.</p>
      `;
    } else {
      vEl.innerHTML = '<p class="empty-state">Registre ombros e cintura para ver o índice V.</p>';
    }
    Charts.lineChart(document.getElementById('vindex-chart'),
      withV.map(b => ({ label: b.date.slice(5), value: Number(b.vIndex.toFixed(2)) })),
      { color: '#C6FA3E' });

    // Peso
    Charts.lineChart(document.getElementById('weight-chart'),
      data.bodyLogs.map(b => ({ label: b.date.slice(5), value: b.weight })),
      { color: '#57D9A3', fillColor: 'rgba(87,217,163,0.14)' });

    await this.renderPhotoGallery();
    this.renderWeekCompareControls();
    this.renderRecords();
    this.renderCheckpoints();
    this.renderWeeklyReport();
  },

  async renderPhotoGallery() {
    const data = Storage.load();
    const gallery = document.getElementById('photo-gallery');
    const metas = data.photoMeta.slice().reverse().slice(0, 12);
    if (!metas.length) { gallery.innerHTML = '<p class="empty-state">Nenhuma foto ainda. Tire a primeira foto de frente para começar a comparação semanal.</p>'; return; }
    gallery.innerHTML = metas.map(m => `<div class="photo-item" data-id="${m.id}">
        <img id="img-${m.id}" alt="${m.type}">
        <span class="photo-tag">${m.type} · ${m.date.slice(5)}</span>
        <button class="photo-del" data-del="${m.id}">✕</button>
      </div>`).join('');
    for (const m of metas) {
      const photo = await Photos.get(m.id);
      const img = document.getElementById(`img-${m.id}`);
      if (img && photo) img.src = photo.dataURL;
    }
    gallery.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del;
        const d = Storage.load();
        d.photoMeta = d.photoMeta.filter(p => p.id !== id);
        Storage.save();
        await Photos.delete(id);
        this.renderPhotoGallery();
      });
    });
  },

  renderWeekCompareControls() {
    const data = Storage.load();
    const start = new Date(data.meta.startDate);
    const curWeek = Math.max(1, Math.ceil((new Date() - start) / 86400000 / 7));
    const isPro = data.pro.active;
    const FREE_WEEK_LIMIT = 4;
    const minAllowedWeek = isPro ? 1 : Math.max(1, curWeek - FREE_WEEK_LIMIT + 1);
    const opts = Array.from({ length: curWeek - minAllowedWeek + 1 }, (_, i) => minAllowedWeek + i);
    const controls = document.getElementById('week-compare-controls');
    controls.innerHTML = `
      <select id="cmp-week-a">${opts.map(w => `<option value="${w}" ${w === opts[0] ? 'selected' : ''}>Semana ${w}</option>`).join('')}</select>
      <span style="align-self:center;color:var(--text-secondary)">vs</span>
      <select id="cmp-week-b">${opts.map(w => `<option value="${w}" ${w === curWeek ? 'selected' : ''}>Semana ${w}</option>`).join('')}</select>
      ${!isPro && curWeek > FREE_WEEK_LIMIT ? `<p class="muted" style="width:100%; margin-top:4px">Plano gratuito compara só as últimas ${FREE_WEEK_LIMIT} semanas. <a href="#" id="cmp-pro-link" style="color:var(--accent)">Ver plano PRO</a></p>` : ''}
    `;
    const update = () => this.renderWeekCompare(Number(document.getElementById('cmp-week-a').value), Number(document.getElementById('cmp-week-b').value));
    document.getElementById('cmp-week-a').addEventListener('change', update);
    document.getElementById('cmp-week-b').addEventListener('change', update);
    const proLink = document.getElementById('cmp-pro-link');
    if (proLink) proLink.addEventListener('click', (e) => { e.preventDefault(); this.goTo('mais'); });
    update();
  },

  async renderWeekCompare(weekA, weekB) {
    const content = document.getElementById('week-compare-content');
    const dataFor = async (week) => {
      const data = Storage.load();
      const start = new Date(data.meta.startDate);
      const weekStart = new Date(start.getTime() + (week - 1) * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      const wsStr = todayISO(weekStart), weStr = todayISO(weekEnd);
      const body = data.bodyLogs.filter(b => b.date >= wsStr && b.date < weStr).pop();
      const photoMeta = data.photoMeta.filter(p => p.date >= wsStr && p.date < weStr && p.type === 'frente').pop();
      let photo = null;
      if (photoMeta) photo = await Photos.get(photoMeta.id);
      return { body, photo };
    };
    const a = await dataFor(weekA);
    const b = await dataFor(weekB);
    const col = (label, d) => `
      <div class="compare-col">
        ${d.photo ? `<img src="${d.photo.dataURL}">` : ''}
        <strong>${label}</strong>
        ${d.body ? `<div class="muted mt-1">${d.body.weight}kg${d.body.waist ? ` · cintura ${d.body.waist}cm` : ''}</div>` : `<div class="muted mt-1">sem registro</div>`}
      </div>`;
    content.innerHTML = `<div class="compare-grid">${col('Semana ' + weekA, a)}${col('Semana ' + weekB, b)}</div>`;
  },

  renderRecords() {
    const prs = Workouts.personalRecords();
    const run = { longest: Running.longestRun(), bestPace: Running.bestPace() };
    const items = [
      prs.bestWeight.exercise ? { label: `Maior carga (${prs.bestWeight.exercise})`, value: `${prs.bestWeight.value}kg` } : null,
      prs.bestVolume.exercise ? { label: `Maior volume (${prs.bestVolume.exercise})`, value: `${prs.bestVolume.value}kg` } : null,
      run.longest ? { label: 'Maior distância corrida', value: `${run.longest.distanceKm}km` } : null,
      run.bestPace ? { label: 'Melhor pace', value: Running.formatPace(run.bestPace.paceMinKm) } : null,
      { label: 'Maior sequência de treinos', value: `${Streaks.current()} dias` }
    ].filter(Boolean);
    const el = document.getElementById('records-content');
    el.innerHTML = items.length
      ? `<div class="pr-list">${items.map(i => `<div class="pr-item"><span>${i.label}</span><span class="pr-value">${i.value}</span></div>`).join('')}</div>`
      : '<p class="empty-state">Registre treinos para ver seus recordes.</p>';
  },

  renderCheckpoints() {
    const data = Storage.load();
    const start = new Date(data.meta.startDate);
    const dayNum = Math.floor((new Date() - start) / 86400000) + 1;
    const el = document.getElementById('checkpoints-content');
    const checkpoints = [30, 60, 90];
    el.innerHTML = checkpoints.map(cp => {
      if (dayNum < cp) return `<p class="muted">Dia ${cp}: ainda não atingido (faltam ${cp - dayNum} dias).</p>`;
      const targetDate = todayISO(new Date(start.getTime() + (cp - 1) * 86400000));
      const closest = data.bodyLogs.filter(b => b.date <= targetDate).pop();
      const first = data.bodyLogs[0];
      if (!closest || !first) return `<p class="muted">Dia ${cp}: sem dados suficientes.</p>`;
      const diffW = (closest.weight - first.weight).toFixed(1);
      return `<p><strong>Dia ${cp}</strong> — peso: ${closest.weight}kg (${diffW >= 0 ? '+' : ''}${diffW}kg desde o início)</p>`;
    }).join('');
  },

  generateWeeklyReport() {
    const data = Storage.load();
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const wa = todayISO(weekAgo), wb = todayISO(today);

    const bodyInRange = data.bodyLogs.filter(b => b.date >= wa && b.date <= wb);
    const weightDiff = bodyInRange.length >= 2 ? (bodyInRange[bodyInRange.length - 1].weight - bodyInRange[0].weight) : null;
    const waistDiff = bodyInRange.length >= 2 && bodyInRange[0].waist ? (bodyInRange[bodyInRange.length - 1].waist - bodyInRange[0].waist) : null;
    const shouldersDiff = bodyInRange.length >= 2 && bodyInRange[0].shoulders ? (bodyInRange[bodyInRange.length - 1].shoulders - bodyInRange[0].shoulders) : null;

    const sessions = data.workoutSessions.filter(s => s.date >= wa && s.date <= wb);
    const workoutsDone = sessions.filter(s => s.completed && s.dayKey !== 'domingo').length;
    const runsInRange = data.runLogs.filter(r => r.date >= wa && r.date <= wb);
    const runDistance = runsInRange.reduce((s, r) => s + r.distanceKm, 0);

    // evolução média de carga (compara primeiro e último registro de cada exercício na semana)
    let deltas = [];
    for (const exId of Object.keys(data.exerciseLogs)) {
      const logs = data.exerciseLogs[exId].filter(l => l.date >= wa && l.date <= wb);
      if (logs.length >= 2) {
        const w1 = Workouts.maxWeightOf(logs[0]), w2 = Workouts.maxWeightOf(logs[logs.length - 1]);
        if (w1 > 0) deltas.push(((w2 - w1) / w1) * 100);
      }
    }
    const avgLoadChange = deltas.length ? (deltas.reduce((a, b) => a + b, 0) / deltas.length) : null;

    const recInRange = data.recoveryLogs.filter(r => r.date >= wa && r.date <= wb);
    const avgSleep = recInRange.length ? (recInRange.reduce((s, r) => s + (r.sleepHours || 0), 0) / recInRange.length) : null;
    const sem = Recovery.semaphore();

    const positives = [];
    const attention = [];
    if (workoutsDone >= 5) positives.push('Ótima consistência nos treinos de musculação.');
    else if (workoutsDone <= 2) attention.push('Poucos treinos concluídos esta semana.');
    if (weightDiff !== null && weightDiff < 0) positives.push('Peso em tendência de queda.');
    if (waistDiff !== null && waistDiff < 0) positives.push('Redução na circunferência da cintura.');
    if (avgLoadChange !== null && avgLoadChange > 0) positives.push('Progressão de carga positiva nos principais exercícios.');
    if (sem.level === 'red') attention.push('Sinais de recuperação ruim — considere priorizar sono e reduzir volume.');
    if (avgSleep !== null && avgSleep < 6.5) attention.push('Média de sono abaixo do ideal.');
    if (runDistance === 0) attention.push('Nenhuma corrida registrada esta semana.');

    const suggestion = sem.level === 'red'
      ? 'Priorize sono e recuperação ativa antes de aumentar cargas ou volume.'
      : (avgLoadChange !== null && avgLoadChange <= 0)
        ? 'Mantenha a consistência; pequenos aumentos de carga podem ser retomados na próxima semana.'
        : 'Continue com a progressão gradual de cargas e volume de corrida.';

    const report = {
      id: uid('report'),
      generatedAt: new Date().toISOString(),
      periodStart: wa,
      periodEnd: wb,
      weightDiff, waistDiff, shouldersDiff,
      workoutsDone, totalWorkouts: 6,
      runsDone: runsInRange.length, runDistance,
      avgLoadChange, avgSleep,
      recoveryLabel: sem.label,
      positives, attention, suggestion
    };
    data.weeklyReports.push(report);
    Storage.save();
    this.toast('Relatório gerado.');
    this.renderWeeklyReport();
  },

  renderWeeklyReport() {
    const data = Storage.load();
    const el = document.getElementById('weekly-report-content');
    const last = data.weeklyReports[data.weeklyReports.length - 1];
    if (!last) { el.innerHTML = '<p class="empty-state">Nenhum relatório gerado ainda. Toque em "Gerar relatório desta semana" abaixo.</p>'; return; }
    const fmt = (v, unit, digits = 1) => v === null || v === undefined ? '--' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;
    const isPro = data.pro.active;
    el.innerHTML = `
      <div id="weekly-report-printable">
        <p class="muted">Período: ${last.periodStart} a ${last.periodEnd}</p>
        <div class="card-grid" style="margin:10px 0">
          <div class="dash-card"><div class="label">Peso</div><div class="value">${fmt(last.weightDiff, 'kg')}</div></div>
          <div class="dash-card"><div class="label">Cintura</div><div class="value">${fmt(last.waistDiff, 'cm')}</div></div>
          <div class="dash-card"><div class="label">Ombros</div><div class="value">${fmt(last.shouldersDiff, 'cm')}</div></div>
          <div class="dash-card"><div class="label">Treinos</div><div class="value">${last.workoutsDone}/${last.totalWorkouts}</div></div>
          <div class="dash-card"><div class="label">Corridas</div><div class="value">${last.runsDone}</div></div>
          <div class="dash-card"><div class="label">Distância</div><div class="value">${last.runDistance.toFixed(1)}km</div></div>
          <div class="dash-card"><div class="label">Carga</div><div class="value">${fmt(last.avgLoadChange, '%')}</div></div>
          <div class="dash-card"><div class="label">Sono médio</div><div class="value">${last.avgSleep ? last.avgSleep.toFixed(1) + 'h' : '--'}</div></div>
        </div>
        <p><strong>Pontos positivos</strong></p>
        <ul style="margin:4px 0 10px 18px;font-size:13px;color:var(--text-secondary)">${last.positives.map(p => `<li>${p}</li>`).join('') || '<li>--</li>'}</ul>
        <p><strong>Pontos de atenção</strong></p>
        <ul style="margin:4px 0 10px 18px;font-size:13px;color:var(--text-secondary)">${last.attention.map(p => `<li>${p}</li>`).join('') || '<li>--</li>'}</ul>
        <p><strong>Sugestão para a próxima semana</strong></p>
        <p class="muted">${last.suggestion}</p>
      </div>
      ${isPro
        ? `<button class="btn-secondary mt-3" id="btn-export-report-pdf">Exportar como PDF</button>`
        : `<button class="btn-ghost mt-3" id="btn-export-report-pdf-locked">Exportar como PDF 🔒 PRO</button>`
      }
    `;
    const exportBtn = document.getElementById('btn-export-report-pdf');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportWeeklyReportPDF(last));
    const lockedBtn = document.getElementById('btn-export-report-pdf-locked');
    if (lockedBtn) lockedBtn.addEventListener('click', () => { this.toast('Exportar PDF é um recurso PRO.'); this.goTo('mais'); });
  },

  /* Exporta o relatório como PDF usando a caixa de diálogo de impressão
     do próprio navegador (window.print → "Salvar como PDF"). Funciona
     100% offline, sem biblioteca externa. */
  exportWeeklyReportPDF(report) {
    const printable = document.getElementById('weekly-report-printable');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Relatório semanal V-SHAPE 90</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 30px; color: #111; }
        h1 { font-size: 20px; }
        .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
        .dash-card { border: 1px solid #ccc; border-radius: 8px; padding: 10px; }
        .label { font-size: 10px; text-transform: uppercase; color: #666; }
        .value { font-size: 18px; font-weight: 700; }
        ul { margin: 4px 0 12px 18px; font-size: 13px; }
        .muted { color: #555; }
      </style></head>
      <body>
        <h1>V-SHAPE 90 — Relatório Semanal</h1>
        ${printable.innerHTML}
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  },

  /* ============================================================
     VIEW: MAIS (água, alimentação, configurações, backup)
     ============================================================ */
  bindMais() {
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Storage.load();
      data.settings.restTimerDefault = Number(document.getElementById('set-rest').value) || data.settings.restTimerDefault;
      const reminderEnable = document.getElementById('set-reminder-enable').checked;
      data.settings.reminderEnabled = reminderEnable;
      data.settings.reminderTime = document.getElementById('set-reminder-time').value || data.settings.reminderTime;
      Storage.save();
      if (reminderEnable && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      this.toast('Configurações salvas.');
      this.renderMais();
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
      const json = await Storage.exportFull();
      downloadFile(json, `vshape90-backup-${todayISO()}.json`, 'application/json');
      document.getElementById('backup-status').textContent = 'Backup exportado com sucesso.';
    });

    document.getElementById('import-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await Storage.importFull(text);
        document.getElementById('backup-status').textContent = 'Backup importado com sucesso.';
        this.toast('Backup importado!');
        this.renderAll();
      } catch (err) {
        document.getElementById('backup-status').textContent = 'Erro: ' + err.message;
      }
      e.target.value = '';
    });

    document.getElementById('btn-reset-all').addEventListener('click', () => {
      if (confirm('Isso apagará todos os dados salvos neste dispositivo. Deseja continuar?')) {
        Storage.reset();
        Photos.clearAll();
        this.toast('Dados apagados.');
        this.renderAll();
      }
    });
  },

  renderMais() {
    this.renderWeeklyGrid();
    this.renderAccountPanel();
    const data = Storage.load();
    document.getElementById('set-rest').value = data.settings.restTimerDefault;
    document.getElementById('set-reminder-enable').checked = data.settings.reminderEnabled;
    document.getElementById('set-reminder-time').value = data.settings.reminderTime;
  },

  renderWeeklyGrid() {
    const data = Storage.load();
    const labels = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
    const el = document.getElementById('weekly-grid-content');
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px">
        ${DAY_KEYS.map(k => {
          const plan = data.plan[k];
          const summary = plan.exercises.length ? `${plan.name} · ${plan.exercises.length} exercícios` : 'Recuperação ativa';
          return `
            <button class="day-row" data-swap-day="${k}" style="cursor:pointer; border:1px solid var(--border); background:var(--surface)">
              <div>
                <div class="day-name">${labels[k]}</div>
                <div class="day-summary">${summary}</div>
              </div>
              <svg class="chevron" viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h11M13 4.5 16 8l-3 3.5"/><path d="M17 14H6M9 10.5 6 14l3 3.5"/></svg>
            </button>
          `;
        }).join('')}
      </div>
    `;
    el.querySelectorAll('[data-swap-day]').forEach(btn => {
      btn.addEventListener('click', () => this.showDaySwapPicker(btn.dataset.swapDay));
    });
  },

  showDaySwapPicker(dayA) {
    const data = Storage.load();
    const labels = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
    const others = DAY_KEYS.filter(k => k !== dayA);
    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="dayswap-close" aria-label="Fechar">✕</button>
      <div class="wm-inner" style="text-align:left; max-width:420px">
        <div class="wm-eyebrow">${labels[dayA]} — ${data.plan[dayA].name}</div>
        <h3 style="margin-bottom:2px; font-size:18px">Trocar com qual dia?</h3>
        <p class="muted mb-4">O conteúdo (exercícios e CORE) dos dois dias será trocado entre si.</p>
        <div class="swap-list">
          ${others.map(k => `
            <button class="swap-option swap-option-text" data-target="${k}">
              <span>${labels[k]} — ${data.plan[k].exercises.length ? data.plan[k].name : 'Recuperação ativa'}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('dayswap-close').addEventListener('click', () => wrap.remove());
    wrap.querySelectorAll('[data-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayB = btn.dataset.target;
        Workouts.swapDays(dayA, dayB);
        this.toast(`${labels[dayA]} e ${labels[dayB]} trocados.`);
        wrap.remove();
        this.renderWeeklyGrid();
        this.renderTreino();
      });
    });
  },

  /* ============================================================
     ONBOARDING
     ============================================================ */
  ob: { step: 1, totalSteps: 6, objective: null, days: 6, reminderEnabled: false },

  startOnboarding() {
    this.ob = { step: 1, totalSteps: 6, objective: null, days: 6, reminderEnabled: false };
    const screen = document.getElementById('onboarding-screen');
    screen.classList.remove('hidden');

    const objectivesEl = document.getElementById('ob-objectives');
    objectivesEl.innerHTML = Object.entries(Onboarding.OBJECTIVES).map(([key, o]) => `
      <button class="swap-option swap-option-text" data-objective="${key}" style="text-align:left; display:block">
        <strong style="display:block">${o.label}</strong>
        <span class="muted" style="font-weight:400; font-size:12px">${o.description}</span>
      </button>
    `).join('');
    objectivesEl.querySelectorAll('[data-objective]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ob.objective = btn.dataset.objective;
        objectivesEl.querySelectorAll('[data-objective]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ob-obj-next').disabled = false;
      });
    });

    document.getElementById('ob-days').querySelectorAll('[data-days]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ob.days = Number(btn.dataset.days);
        document.getElementById('ob-days').querySelectorAll('[data-days]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('ob-reminder-enable').addEventListener('change', (e) => {
      document.getElementById('ob-reminder-time-wrap').style.display = e.target.checked ? '' : 'none';
    });

    screen.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => this.obGoToStep(this.ob.step + 1));
    });
    screen.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => this.obGoToStep(this.ob.step - 1));
    });
    document.getElementById('ob-finish').addEventListener('click', () => this.finishOnboarding());

    this.obGoToStep(1);
  },

  obGoToStep(step) {
    // valida ao SAIR do passo 2 (dados físicos) pra frente — o bug original
    // checava a condição errada e nunca disparava; corrigido aqui.
    if (this.ob.step === 2 && step > 2) {
      const h = document.getElementById('ob-height').value;
      const w = document.getElementById('ob-weight').value;
      if (!h || !w) { this.toast('Informe altura e peso pra continuar.'); return; }
    }
    this.ob.step = Math.max(1, Math.min(this.ob.totalSteps, step));
    document.querySelectorAll('.ob-step').forEach(el => {
      el.classList.toggle('hidden', Number(el.dataset.step) !== this.ob.step);
    });
    document.getElementById('ob-progress-fill').style.width = `${(this.ob.step / this.ob.totalSteps) * 100}%`;

    if (this.ob.step === 6) this.renderOnboardingSummary();
  },

  renderOnboardingSummary() {
    const height = Number(document.getElementById('ob-height').value) || 169;
    const weight = Number(document.getElementById('ob-weight').value) || 76;
    const objLabel = this.ob.objective ? Onboarding.OBJECTIVES[this.ob.objective].label : 'V-Shape + Força';
    const reminderOn = document.getElementById('ob-reminder-enable').checked;
    const reminderTime = document.getElementById('ob-reminder-time').value || '07:00';

    document.getElementById('ob-summary').innerHTML = `
      <p><strong>${height}cm · ${weight}kg</strong></p>
      <p>Objetivo: <strong>${objLabel}</strong></p>
      <p>Grade semanal: <strong>${this.ob.days} dias de treino/semana</strong></p>
      <p>Lembrete diário: <strong>${reminderOn ? `ativado às ${reminderTime}` : 'desativado'}</strong></p>
    `;
  },

  async finishOnboarding() {
    const data = Storage.load();
    // HIGH corrigido: sem limites, valores absurdos (altura negativa, peso
    // 0, idade 999) quebravam silenciosamente a calculadora de nutrição
    // (podia gerar meta calórica negativa). Agora tudo é limitado a uma
    // faixa fisiologicamente plausível antes de ser salvo.
    const height = clampNumber(Number(document.getElementById('ob-height').value) || 169, 100, 250);
    const weight = clampNumber(Number(document.getElementById('ob-weight').value) || 76, 20, 300);
    const age = clampNumber(Number(document.getElementById('ob-age').value) || 30, 10, 100);
    const sex = document.getElementById('ob-sex').value;
    const objective = this.ob.objective || 'vshape';
    const days = this.ob.days;
    const reminderOn = document.getElementById('ob-reminder-enable').checked;
    const reminderTime = document.getElementById('ob-reminder-time').value || '07:00';

    data.profile.heightCm = height;
    data.profile.startWeightKg = weight;
    data.profile.age = age;
    data.profile.sex = sex;
    data.profile.objective = objective;
    data.profile.daysPerWeek = days;
    data.meta.startDate = todayISO();
    data.meta.onboardingComplete = true;

    data.plan = Onboarding.buildWeeklyPlan(days);

    data.settings.reminderEnabled = reminderOn;
    data.settings.reminderTime = reminderTime;

    // registra o peso inicial como primeiro ponto do gráfico de evolução
    data.bodyLogs.push({ id: uid('body'), date: todayISO(), weight, waist: null, shoulders: null, chest: null, armR: null, armL: null, thigh: null });

    Storage.save();

    if (reminderOn && 'Notification' in window) {
      try { await Notification.requestPermission(); } catch (e) { /* usuário pode negar, segue sem notificação */ }
    }

    document.getElementById('onboarding-screen').classList.add('hidden');
    this.selectedDayTab = dayKeyFromDate();
    this.renderAll();
    this.toast('Plano criado! Bem-vindo ao V-SHAPE 90.');
  },

  /* ============================================================
     LEMBRETE DIÁRIO (best-effort, sem servidor de push)
     ============================================================ */
  checkDailyReminder() {
    const data = Storage.load();
    if (!data.settings.reminderEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const [h, m] = (data.settings.reminderTime || '07:00').split(':').map(Number);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const already = data.settings.lastReminderShownDate === todayISO();
    const pastTime = now >= target;
    const doneToday = !!Recovery.todayCheckIn();

    if (pastTime && !already && !doneToday) {
      this.fireReminderNotification();
      data.settings.lastReminderShownDate = todayISO();
      Storage.save();
    }
    // reagenda a checagem pra daqui 15 min, enquanto o app estiver aberto
    setTimeout(() => this.checkDailyReminder(), 15 * 60 * 1000);
  },

  fireReminderNotification() {
    const dayKey = dayKeyFromDate();
    const plan = Workouts.planForDay(dayKey);
    const body = plan.exercises.length ? `Hoje: ${plan.name}. Bora treinar?` : 'Dia de recuperação — que tal um check-in rápido?';
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification('V-SHAPE 90', { body, icon: 'assets/icon-192.png' }));
      } else {
        new Notification('V-SHAPE 90', { body, icon: 'assets/icon-192.png' });
      }
    } catch (e) { console.warn('Notificação falhou:', e); }
  },

  /* ============================================================
     CONTA / PRO
     Sem backend real conectado nesta versão. O toggle abaixo é
     100% local — não é uma cobrança de verdade. Ver README para
     onde a integração de pagamento/backend deve entrar.
     ============================================================ */
  renderAccountPanel() {
    const data = Storage.load();
    const el = document.getElementById('account-content');
    const isPro = data.pro.active;
    el.innerHTML = `
      ${isPro ? '<span class="pro-badge">PRO ativo (modo de teste)</span>' : '<span class="pro-badge" style="background:var(--surface-2); color:var(--text-tertiary)">Plano gratuito</span>'}
      <div class="pro-feature-list">
        ${this.proFeatureRow('Comparação de fotos sem limite de semanas', isPro)}
        ${this.proFeatureRow('Exportar relatório semanal em PDF', isPro)}
        ${this.proFeatureRow('Sync entre dispositivos', false, true)}
      </div>
      ${isPro
        ? `<button class="btn-ghost" id="btn-pro-toggle">Desativar modo de teste PRO</button>`
        : `<button class="btn-primary" id="btn-pro-toggle">Ativar modo de teste PRO (sem cobrança real)</button>`
      }
      <div class="pro-lock-note">
        Esta versão não tem backend nem processador de pagamento conectado. O botão acima só liga uma flag local (<code>pro.active</code>) pra você testar a experiência PRO. Uma assinatura real exigiria: conta de usuário autenticada, integração de pagamento (ex.: Stripe/Pix) e um backend pra validar o status — nenhum dos três existe nesta versão.
      </div>
    `;
    document.getElementById('btn-pro-toggle').addEventListener('click', () => {
      data.pro.active = !data.pro.active;
      data.pro.activatedAt = data.pro.active ? new Date().toISOString() : null;
      data.pro.mode = data.pro.active ? 'demo' : null;
      Storage.save();
      this.toast(data.pro.active ? 'Modo de teste PRO ativado.' : 'Modo de teste PRO desativado.');
      this.renderAccountPanel();
      this.renderEvolucao();
    });
  },

  proFeatureRow(label, unlocked, alwaysLocked) {
    const icon = alwaysLocked
      ? '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="12" height="8" rx="1.5"/><path d="M7.5 10V7a3.5 3.5 0 0 1 7 0v3"/></svg>'
      : unlocked
        ? '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 9 16l9-10.5"/></svg>'
        : '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="12" height="8" rx="1.5"/><path d="M7.5 10V7a3.5 3.5 0 0 1 7 0v3"/></svg>';
    return `<div class="pro-feature-row">${icon}<span>${label}${alwaysLocked ? ' <span class="muted">(requer backend — ver nota abaixo)</span>' : ''}</span></div>`;
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW falhou:', err));

        // Sem isso, um Service Worker novo pode instalar em segundo plano e o
        // app continuar mostrando a versão antiga em memória até o usuário
        // fechar e reabrir manualmente (ou pior, nunca perceber). Ao detectar
        // que um SW novo assumiu o controle, recarrega a página automaticamente.
        let refreshed = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshed) return;
          refreshed = true;
          window.location.reload();
        });
      });
    }
  }
};

/* ---------------- Utilidades globais ---------------- */

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function fileToDataURL(file, maxDim = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { /* som opcional, ignora falha */ }
}

if (typeof window !== 'undefined') { window.App = App; }

document.addEventListener('DOMContentLoaded', () => App.init());
