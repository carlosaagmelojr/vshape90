/* ============================================================
   V-SHAPE 90 — recovery.js
   Check-in de recuperação + semáforo (não é diagnóstico médico)
   ============================================================ */

const Recovery = {

  addCheckIn({ sleep, energy, soreness, stress, sleepHours, pain, painRegion = null }) {
    const data = Storage.load();
    const date = todayISO();
    // remove check-in duplicado do mesmo dia
    data.recoveryLogs = data.recoveryLogs.filter(r => r.date !== date);
    const entry = {
      id: uid('rec'),
      date,
      sleep: Number(sleep),
      energy: Number(energy),
      soreness: Number(soreness),
      stress: Number(stress),
      sleepHours: Number(sleepHours) || 0,
      pain: !!pain,
      painRegion: pain ? painRegion : null
    };
    data.recoveryLogs.push(entry);
    Storage.save();
    return entry;
  },

  todayCheckIn() {
    const data = Storage.load();
    return data.recoveryLogs.find(r => r.date === todayISO()) || null;
  },

  all() {
    return Storage.load().recoveryLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  },

  /* Semáforo: verde / amarelo / vermelho, considerando sono, energia, dor, estresse e volume recente */
  semaphore(entry) {
    entry = entry || this.todayCheckIn();
    if (!entry) return { level: 'gray', label: 'Sem check-in hoje', score: null };

    // Pontuação: sono/energia contam positivo, dor/estresse contam negativo
    let score = (entry.sleep + entry.energy) - (entry.soreness + entry.stress);
    if (entry.pain) score -= 3;
    if (entry.sleepHours && entry.sleepHours < 6) score -= 2;

    // volume recente: muitos treinos consecutivos sem folga penaliza levemente
    const recentSessions = Workouts.sessionsInRange(7).filter(s => s.completed).length;
    if (recentSessions >= 6) score -= 1;

    if (score >= 4) return { level: 'green', label: 'Boa recuperação', score };
    if (score >= 0) return { level: 'yellow', label: 'Recuperação intermediária', score };
    return { level: 'red', label: 'Recuperação ruim', score };
  },

  recommendation(sem) {
    if (sem.level === 'red') {
      return 'Considere reduzir volume/intensidade hoje ou realizar recuperação ativa.';
    }
    if (sem.level === 'yellow') {
      return 'Recuperação intermediária: treine normalmente, mas fique atento aos sinais do corpo.';
    }
    if (sem.level === 'green') {
      return 'Boa recuperação. Siga o plano do dia normalmente.';
    }
    return 'Faça o check-in de hoje para receber uma recomendação.';
  }
};

if (typeof window !== 'undefined') { window.Recovery = Recovery; }
