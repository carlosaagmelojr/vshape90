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

    const weekSessions = Workouts.sessionsInRange(7);
    const totalPossibleWorkouts = 6; // seg-sáb
    const doneWorkouts = weekSessions.filter(s => s.completed && s.dayKey !== 'domingo').length;

    const weekRunKm = Running.totalDistance(7);

    const sem = Recovery.semaphore();

    const cards = [
      { label: 'Peso', value: `${weight.toFixed(1)} kg`, sub: lastBody ? '' : 'sem registro ainda' },
      { label: 'Cintura', value: waist ? `${waist.toFixed(1)} cm` : '--', sub: '' },
      { label: 'Ombros', value: shoulders ? `${shoulders.toFixed(1)} cm` : '--', sub: '' },
      { label: 'Índice V', value: vIndex ? vIndex.toFixed(2) : '--', sub: 'ombros / cintura' },
      { label: 'Treinos (7 dias)', value: `${doneWorkouts}/${totalPossibleWorkouts}`, sub: '' },
      { label: 'Corrida (7 dias)', value: `${weekRunKm.toFixed(1)} km`, sub: '' },
      { label: 'Recuperação', dot: sem.level, value: sem.label, sub: '', wide: true }
    ];

    const grid = document.getElementById('dashboard-cards');
    grid.innerHTML = cards.map(c => `
      <div class="dash-card ${c.wide ? 'wide' : ''} ${c.accent ? 'accent' : ''}">
        <div class="label">${c.label}</div>
        <div class="value" style="${c.dot ? 'display:flex;align-items:center;gap:9px' : ''}">
          ${c.dot ? `<span class="status-dot ${c.dot}"></span>` : ''}${c.value}
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
      el.innerHTML = `<p class="muted">Hoje é dia de recuperação ativa. Sem musculação programada.</p>`;
      return;
    }
    el.innerHTML = `
      <p style="font-size:16px;font-weight:800;margin-bottom:10px">${plan.name}</p>
      <button class="btn-primary" id="btn-start-today-workout">INICIAR TREINO</button>
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
        <p class="muted" style="margin-top:8px">${Recovery.recommendation(sem)}</p>
        <button class="btn-ghost" id="btn-edit-checkin" style="margin-top:10px">Editar check-in de hoje</button>
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
        <input type="number" id="ci-sleephours" min="0" max="14" step="0.5" value="${v.sleepHours}" style="margin-top:5px">
      </label>
      <p class="muted" style="margin-bottom:6px">Está sentindo alguma dor?</p>
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
      <button class="btn-primary" id="btn-save-checkin">Salvar check-in</button>
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
      content.innerHTML = `<div class="panel"><p class="muted">Dia de recuperação ativa: caminhada leve, mobilidade e alongamento. Sem musculação pesada.</p></div>`;
      return;
    }

    const routine = Workouts.coreRoutine(plan.core);
    content.innerHTML = `
      <div class="panel">
        <h3>${plan.name}</h3>
        <button class="btn-primary" id="btn-start-day">Iniciar treino do dia</button>
      </div>
      ${plan.exercises.map((ex, idx) => this.exerciseCardHTML(ex, dayKey, idx)).join('')}
      <div class="panel">
        <h3>${routine.label}</h3>
        <p class="muted">${routine.minutes}</p>
        <ul style="margin:8px 0 0 18px;padding:0;font-size:13.5px;color:var(--text-secondary)">
          ${routine.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `;

    document.getElementById('btn-start-day').addEventListener('click', () => this.openWorkoutMode(dayKey, 0));
    plan.exercises.forEach((ex, idx) => {
      const btn = content.querySelector(`[data-record="${ex.id}"]`);
      if (btn) btn.addEventListener('click', () => this.openWorkoutMode(dayKey, idx));
      const histBtn = content.querySelector(`[data-hist="${ex.id}"]`);
      if (histBtn) histBtn.addEventListener('click', () => this.showHistory(ex.id));
    });
  },

  exerciseCardHTML(ex, dayKey, idx) {
    const last = Workouts.lastLog(ex.id);
    const suggestion = Workouts.progressionSuggestion(ex.id);
    const lastText = last
      ? last.sets.map(s => `${s.weight}kg×${s.reps}`).join(' · ')
      : 'sem registros ainda';
    return `
      <div class="exercise-card">
        <div class="ex-head-row">
          ${ExerciseDemos.thumb(ex.pattern)}
          <div style="flex:1; min-width:0">
            <div class="ex-head">
              <div class="ex-name">${ex.name}</div>
              <div class="rest-chip">${ex.restSec}s</div>
            </div>
            <div class="ex-meta">${ex.sets}× ${ex.repsLow}–${ex.repsHigh} · última: ${lastText}</div>
          </div>
        </div>
        ${suggestion ? `<div class="ex-suggestion ${suggestion.level}">${suggestion.text}</div>` : ''}
        <div class="ex-actions">
          <button class="btn-secondary" data-hist="${ex.id}">Histórico</button>
          <button class="btn-primary" data-record="${ex.id}">Registrar</button>
        </div>
        <a class="ex-external-link" href="${EXTERNAL_GIF_SITE}" target="_blank" rel="noopener noreferrer">
          Ver execução real no Gif do Treino
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
      <div class="ex-history-row">
        <span>${h.date}</span>
        <span>${h.maxWeight}kg</span>
        <span>${h.volume}kg vol</span>
      </div>
    `).join('') || '<p class="empty-state">Sem histórico ainda.</p>';
    const headerRow = hist.length ? `<div class="ex-history-row"><span>Data</span><span>Carga</span><span>Volume</span></div>` : '';

    const wrap = document.createElement('div');
    wrap.className = 'workout-mode';
    wrap.innerHTML = `
      <button class="icon-btn wm-close" id="hist-close">✕</button>
      <div class="wm-inner" style="text-align:left">
        <h3 style="margin-bottom:2px">${ex.name}</h3>
        <p class="muted" style="margin-bottom:14px">Histórico e evolução</p>
        ${stats ? `
          <div class="card-grid" style="margin-bottom:14px">
            <div class="dash-card"><div class="label">Carga máx.</div><div class="value">${stats.maxWeight}kg</div></div>
            <div class="dash-card"><div class="label">Volume máx.</div><div class="value">${stats.maxVolume}kg</div></div>
            <div class="dash-card"><div class="label">Últ. carga</div><div class="value">${Workouts.maxWeightOf(stats.last) || stats.last.maxWeight}kg</div></div>
            <div class="dash-card"><div class="label">Evolução 30d</div><div class="value">${stats.evolution30 !== null ? stats.evolution30.toFixed(1) + '%' : '--'}</div></div>
          </div>
          <canvas id="hist-chart" class="chart-canvas" style="margin-bottom:14px"></canvas>
        ` : '<p class="empty-state">Sem histórico ainda.</p>'}
        <div>${headerRow}${rows}</div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('hist-close').addEventListener('click', () => wrap.remove());
    if (stats) {
      const points = hist.map(h => ({ label: h.date.slice(5), value: h.maxWeight }));
      Charts.lineChart(document.getElementById('hist-chart'), points, { color: '#C6FA3E' });
    }
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
  },

  openWorkoutMode(dayKey, startIndex) {
    const plan = Workouts.planForDay(dayKey);
    if (!plan.exercises.length) return;
    const session = Workouts.startSession(dayKey);
    this.wm = {
      dayKey,
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

  closeWorkoutMode() {
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

    document.getElementById('wm-eyebrow').textContent = (Workouts.planForDay(this.wm.dayKey).name || '').toUpperCase();
    document.getElementById('wm-demo').innerHTML = ExerciseDemos.large(ex.pattern);
    document.getElementById('wm-exname').textContent = ex.name.toUpperCase();
    document.getElementById('wm-external-link').firstChild.textContent = `Ver "${ex.name}" no Gif do Treino `;
    document.getElementById('wm-series').textContent = `Série ${this.wm.setIndex + 1}/${ex.sets}`;
    document.getElementById('wm-prev').textContent = lastSet
      ? `Anterior: ${lastSet.weight}kg × ${lastSet.reps}`
      : 'Anterior: sem registro';

    const suggestedWeight = lastSet ? lastSet.weight : 0;
    const suggestedReps = lastSet ? lastSet.reps : ex.repsLow;
    document.getElementById('wm-weight').value = suggestedWeight;
    document.getElementById('wm-reps').value = suggestedReps;
    document.getElementById('wm-pain').checked = false;

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
    this.wm.buffer.push({ weight, reps });
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
      <div class="card-grid" style="margin-top:10px">
        <div class="dash-card"><div class="label">Leve (seg)</div><div class="value">${week.leve} km</div></div>
        <div class="dash-card"><div class="label">Intervalado (qua)</div><div class="value">${week.intervalado} km</div></div>
        <div class="dash-card"><div class="label">Longão (sex)</div><div class="value">${week.longao} km</div></div>
      </div>
      ${workout ? `<p style="margin-top:10px" class="muted">Hoje: ${workout.label} · meta ~${workout.targetKm}km</p>` : `<p style="margin-top:10px" class="muted">Sem corrida programada para hoje.</p>`}
    `;

    const logs = Running.all();
    const points = logs.filter(l => l.paceMinKm).map(l => ({ label: l.date.slice(5), value: Number(l.paceMinKm.toFixed(2)) }));
    Charts.lineChart(document.getElementById('run-pace-chart'), points, { color: '#57D9A3', fillColor: 'rgba(87,217,163,0.14)' });

    const histEl = document.getElementById('run-history');
    if (!logs.length) {
      histEl.innerHTML = '<p class="empty-state">Nenhuma corrida registrada ainda.</p>';
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
        <p class="muted" style="margin-top:4px">Indicador apenas para acompanhamento visual — não é diagnóstico médico.</p>
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
    if (!metas.length) { gallery.innerHTML = '<p class="empty-state">Nenhuma foto ainda.</p>'; return; }
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
    const opts = Array.from({ length: curWeek }, (_, i) => i + 1);
    const controls = document.getElementById('week-compare-controls');
    controls.innerHTML = `
      <select id="cmp-week-a">${opts.map(w => `<option value="${w}" ${w === 1 ? 'selected' : ''}>Semana ${w}</option>`).join('')}</select>
      <span style="align-self:center;color:var(--text-secondary)">vs</span>
      <select id="cmp-week-b">${opts.map(w => `<option value="${w}" ${w === curWeek ? 'selected' : ''}>Semana ${w}</option>`).join('')}</select>
    `;
    const update = () => this.renderWeekCompare(Number(document.getElementById('cmp-week-a').value), Number(document.getElementById('cmp-week-b').value));
    document.getElementById('cmp-week-a').addEventListener('change', update);
    document.getElementById('cmp-week-b').addEventListener('change', update);
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
        ${d.body ? `<div class="muted" style="margin-top:4px">${d.body.weight}kg${d.body.waist ? ` · cintura ${d.body.waist}cm` : ''}</div>` : `<div class="muted" style="margin-top:4px">sem registro</div>`}
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
    if (!last) { el.innerHTML = '<p class="empty-state">Nenhum relatório gerado ainda.</p>'; return; }
    const fmt = (v, unit, digits = 1) => v === null || v === undefined ? '--' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;
    el.innerHTML = `
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
    `;
  },

  /* ============================================================
     VIEW: MAIS (água, alimentação, configurações, backup)
     ============================================================ */
  bindMais() {
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Storage.load();
      data.settings.waterGoalMl = Number(document.getElementById('set-water').value) || data.settings.waterGoalMl;
      data.settings.calorieGoal = Number(document.getElementById('set-cal').value) || data.settings.calorieGoal;
      data.settings.proteinGoal = Number(document.getElementById('set-prot').value) || data.settings.proteinGoal;
      data.settings.carbGoal = Number(document.getElementById('set-carb').value) || data.settings.carbGoal;
      data.settings.fatGoal = Number(document.getElementById('set-fat').value) || data.settings.fatGoal;
      data.settings.restTimerDefault = Number(document.getElementById('set-rest').value) || data.settings.restTimerDefault;
      Storage.save();
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
    this.renderWater();
    this.renderNutrition();
    const data = Storage.load();
    document.getElementById('set-water').value = data.settings.waterGoalMl;
    document.getElementById('set-cal').value = data.settings.calorieGoal;
    document.getElementById('set-prot').value = data.settings.proteinGoal;
    document.getElementById('set-carb').value = data.settings.carbGoal;
    document.getElementById('set-fat').value = data.settings.fatGoal;
    document.getElementById('set-rest').value = data.settings.restTimerDefault;
  },

  renderWater() {
    const data = Storage.load();
    const date = todayISO();
    const current = data.waterLogs[date] || 0;
    const goal = data.settings.waterGoalMl;
    const pct = Math.min(100, (current / goal) * 100);
    const el = document.getElementById('water-content');
    el.innerHTML = `
      <p>${current} / ${goal} mL</p>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="water-btns">
        <button class="btn-secondary" data-add="250">+250 mL</button>
        <button class="btn-secondary" data-add="500">+500 mL</button>
        <button class="btn-ghost" id="btn-water-reset">Zerar</button>
      </div>
    `;
    el.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        data.waterLogs[date] = (data.waterLogs[date] || 0) + Number(btn.dataset.add);
        Storage.save();
        this.renderWater();
      });
    });
    document.getElementById('btn-water-reset').addEventListener('click', () => {
      data.waterLogs[date] = 0;
      Storage.save();
      this.renderWater();
    });
  },

  renderNutrition() {
    const data = Storage.load();
    const date = todayISO();
    if (!data.nutritionLogs[date]) data.nutritionLogs[date] = {};
    const meals = [
      ['breakfast', 'Café da manhã'], ['lunch', 'Almoço'], ['snack', 'Lanche'],
      ['dinner', 'Jantar'], ['supper', 'Ceia']
    ];
    const totals = { cal: 0, prot: 0, carb: 0, fat: 0 };
    meals.forEach(([key]) => {
      const m = data.nutritionLogs[date][key];
      if (m) { totals.cal += m.cal || 0; totals.prot += m.prot || 0; totals.carb += m.carb || 0; totals.fat += m.fat || 0; }
    });
    const g = data.settings;
    const el = document.getElementById('nutrition-content');
    el.innerHTML = `
      <p>Calorias: ${totals.cal} / ${g.calorieGoal} kcal</p>
      <div class="progress-bar"><div class="fill" style="width:${Math.min(100, totals.cal / g.calorieGoal * 100)}%"></div></div>
      <p style="font-size:12px;color:var(--text-secondary)">Prot ${totals.prot}/${g.proteinGoal}g · Carb ${totals.carb}/${g.carbGoal}g · Gord ${totals.fat}/${g.fatGoal}g</p>
      <div style="margin-top:10px">
        ${meals.map(([key, label]) => {
          const m = data.nutritionLogs[date][key] || {};
          return `
          <div class="meal-row">
            <div>
              <div class="meal-name">${label}</div>
              <div class="meal-macro">${m.cal || 0}kcal · P${m.prot || 0} C${m.carb || 0} G${m.fat || 0}</div>
            </div>
            <button class="btn-secondary btn-sm" data-meal="${key}" data-label="${label}">Editar</button>
          </div>`;
        }).join('')}
      </div>
    `;
    el.querySelectorAll('[data-meal]').forEach(btn => {
      btn.addEventListener('click', () => this.editMeal(date, btn.dataset.meal, btn.dataset.label));
    });
  },

  editMeal(date, key, label) {
    const data = Storage.load();
    const m = data.nutritionLogs[date][key] || { cal: 0, prot: 0, carb: 0, fat: 0 };
    const cal = prompt(`${label} — Calorias (kcal):`, m.cal || 0);
    if (cal === null) return;
    const prot = prompt(`${label} — Proteína (g):`, m.prot || 0);
    if (prot === null) return;
    const carb = prompt(`${label} — Carboidrato (g):`, m.carb || 0);
    if (carb === null) return;
    const fat = prompt(`${label} — Gordura (g):`, m.fat || 0);
    if (fat === null) return;
    data.nutritionLogs[date][key] = {
      cal: Number(cal) || 0, prot: Number(prot) || 0, carb: Number(carb) || 0, fat: Number(fat) || 0
    };
    Storage.save();
    this.renderNutrition();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW falhou:', err));
      });
    }
  }
};

/* ---------------- Utilidades globais ---------------- */

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
