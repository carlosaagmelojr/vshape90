/* ============================================================
   V-SHAPE 90 — workouts.js
   Musculação: registro de cargas, progressão dupla, histórico, CORE, PRs
   ============================================================ */

const Workouts = {

  planForDay(dayKey) {
    const data = Storage.load();
    return data.plan[dayKey];
  },

  allExercises() {
    const data = Storage.load();
    const list = [];
    for (const dayKey of Object.keys(data.plan)) {
      for (const ex of data.plan[dayKey].exercises) {
        list.push({ ...ex, dayKey });
      }
    }
    return list;
  },

  findExercise(exerciseId) {
    return this.allExercises().find(e => e.id === exerciseId) || null;
  },

  logsFor(exerciseId) {
    const data = Storage.load();
    return data.exerciseLogs[exerciseId] || [];
  },

  lastLog(exerciseId) {
    const logs = this.logsFor(exerciseId);
    return logs.length ? logs[logs.length - 1] : null;
  },

  /* Registra uma sessão completa de um exercício:
     sets = [{weight, reps}], note, rir, painFlag */
  recordExercise(exerciseId, { sets, note = '', rir = null, painFlag = false }) {
    const data = Storage.load();
    if (!data.exerciseLogs[exerciseId]) data.exerciseLogs[exerciseId] = [];
    const entry = {
      id: uid('log'),
      date: todayISO(),
      sets: sets.map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      note,
      rir,
      painFlag: !!painFlag
    };
    data.exerciseLogs[exerciseId].push(entry);
    Storage.save();
    return entry;
  },

  volumeOf(entry) {
    return entry.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
  },

  maxWeightOf(entry) {
    return entry.sets.reduce((m, s) => Math.max(m, s.weight), 0);
  },

  history(exerciseId) {
    const logs = this.logsFor(exerciseId);
    return logs.map(e => ({
      date: e.date,
      maxWeight: this.maxWeightOf(e),
      volume: this.volumeOf(e),
      sets: e.sets,
      painFlag: e.painFlag
    }));
  },

  stats(exerciseId) {
    const hist = this.history(exerciseId);
    if (!hist.length) return null;
    const maxWeight = Math.max(...hist.map(h => h.maxWeight));
    const maxVolume = Math.max(...hist.map(h => h.volume));
    const last = hist[hist.length - 1];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = todayISO(cutoff);
    const within30 = hist.filter(h => h.date >= cutoffStr);
    let evolution30 = null;
    if (within30.length >= 2) {
      const first = within30[0].maxWeight;
      const lastW = within30[within30.length - 1].maxWeight;
      evolution30 = first > 0 ? ((lastW - first) / first) * 100 : null;
    }
    return { maxWeight, maxVolume, last, evolution30 };
  },

  /* Recomendação de progressão dupla:
     Se todas as séries atingiram o topo da faixa de reps e não há dor -> sugerir aumento. */
  progressionSuggestion(exerciseId) {
    const ex = this.findExercise(exerciseId);
    const last = this.lastLog(exerciseId);
    if (!ex || !last) return null;
    if (last.painFlag) {
      return { level: 'warning', text: 'Dor registrada na última sessão. Não é recomendado aumentar a carga agora.' };
    }
    const hitTop = last.sets.length > 0 && last.sets.every(s => s.reps >= ex.repsHigh);
    if (hitTop) {
      return { level: 'success', text: 'Você atingiu a meta. Considere aumentar ligeiramente a carga na próxima sessão.' };
    }
    const hitBottom = last.sets.every(s => s.reps < ex.repsLow);
    if (hitBottom) {
      return { level: 'info', text: 'Repetições abaixo da faixa alvo. Mantenha a carga atual até recuperar o volume.' };
    }
    return { level: 'neutral', text: `Continue na faixa de ${ex.repsLow}–${ex.repsHigh} repetições.` };
  },

  /* CORE: escolhe rotina conforme o dia */
  coreRoutine(coreType) {
    const routines = {
      A: {
        label: 'CORE A — Força',
        minutes: '8–12 min',
        items: ['Abdominal na polia — 4x15', 'Elevação de pernas — 3x15', 'Prancha — 3x45s']
      },
      B: {
        label: 'CORE B — Estabilidade',
        minutes: '6–10 min',
        items: ['Prancha — 3x40s', 'Dead bug — 3x12 (cada lado)', 'Bird dog — 3x12 (cada lado)']
      },
      C: {
        label: 'CORE C — Leve / Recuperação',
        minutes: '5–8 min',
        items: ['Prancha curta — 3x20s', 'Mobilidade de quadril — 5 min', 'Respiração / bracing — 3x10']
      },
      null: { label: 'Sem CORE hoje', minutes: '', items: [] }
    };
    return routines[coreType] || routines.null;
  },

  /* Sessões de treino (para dashboard / streak / consistência) */
  startSession(dayKey) {
    const data = Storage.load();
    const existing = data.workoutSessions.find(s => s.date === todayISO() && s.dayKey === dayKey);
    if (existing) return existing;
    const session = { id: uid('sess'), date: todayISO(), dayKey, completed: false, exerciseIds: [] };
    data.workoutSessions.push(session);
    Storage.save();
    return session;
  },

  completeSession(sessionId) {
    const data = Storage.load();
    const s = data.workoutSessions.find(s => s.id === sessionId);
    if (!s) return;
    s.completed = true;
    Storage.save();
    Streaks.registerCompletedDay(s.date);
  },

  sessionsInRange(days) {
    const data = Storage.load();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = todayISO(cutoff);
    return data.workoutSessions.filter(s => s.date >= cutoffStr);
  },

  /* Recordes pessoais */
  personalRecords() {
    const data = Storage.load();
    let bestWeight = { value: 0, exercise: null };
    let bestVolume = { value: 0, exercise: null };
    for (const ex of this.allExercises()) {
      const st = this.stats(ex.id);
      if (!st) continue;
      if (st.maxWeight > bestWeight.value) bestWeight = { value: st.maxWeight, exercise: ex.name };
      if (st.maxVolume > bestVolume.value) bestVolume = { value: st.maxVolume, exercise: ex.name };
    }
    return { bestWeight, bestVolume };
  }
};

/* ---------- Streak / consistência ---------- */
const Streaks = {
  registerCompletedDay(dateStr) {
    const data = Storage.load();
    const s = data.streak;
    if (s.lastCompletedDate === dateStr) return; // já contado hoje
    const prevDate = s.lastCompletedDate ? new Date(s.lastCompletedDate) : null;
    const curDate = new Date(dateStr);
    if (prevDate) {
      const diffDays = Math.round((curDate - prevDate) / 86400000);
      if (diffDays === 1) {
        s.count += 1;
      } else if (diffDays > 1) {
        s.count = 1;
      }
      // diffDays <= 0 (mesmo dia ou retroativo): não altera
    } else {
      s.count = 1;
    }
    s.lastCompletedDate = dateStr;
    Storage.save();
  },

  /* Domingo planejado como recuperação conta como "plano cumprido" sem quebrar sequência */
  registerRestDay(dateStr) {
    this.registerCompletedDay(dateStr);
  },

  current() {
    return Storage.load().streak.count;
  }
};

if (typeof window !== 'undefined') { window.Workouts = Workouts; window.Streaks = Streaks; }
