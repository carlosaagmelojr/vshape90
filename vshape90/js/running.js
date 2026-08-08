/* ============================================================
   V-SHAPE 90 — running.js
   Corrida: registro, cálculo de pace, plano progressivo 90 dias
   ============================================================ */

const Running = {

  addLog({ type, distanceKm, durationMin, rpe = null, hr = null, notes = '' }) {
    const data = Storage.load();
    const distance = Number(distanceKm) || 0;
    const duration = Number(durationMin) || 0;
    const paceMinKm = distance > 0 ? duration / distance : null;
    const avgSpeedKmh = duration > 0 ? (distance / (duration / 60)) : null;
    const entry = {
      id: uid('run'),
      date: todayISO(),
      type, // 'leve' | 'intervalado' | 'longao'
      distanceKm: distance,
      durationMin: duration,
      paceMinKm,
      avgSpeedKmh,
      rpe,
      hr,
      notes
    };
    data.runLogs.push(entry);
    Storage.save();
    Streaks.registerCompletedDay(entry.date);
    return entry;
  },

  deleteLog(id) {
    const data = Storage.load();
    data.runLogs = data.runLogs.filter(r => r.id !== id);
    Storage.save();
  },

  all() {
    return Storage.load().runLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  },

  totalDistance(days = null) {
    let logs = this.all();
    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = todayISO(cutoff);
      logs = logs.filter(l => l.date >= cutoffStr);
    }
    return logs.reduce((sum, l) => sum + l.distanceKm, 0);
  },

  bestPace() {
    const logs = this.all().filter(l => l.paceMinKm);
    if (!logs.length) return null;
    return logs.reduce((best, l) => (l.paceMinKm < best.paceMinKm ? l : best));
  },

  longestRun() {
    const logs = this.all();
    if (!logs.length) return null;
    return logs.reduce((best, l) => (l.distanceKm > best.distanceKm ? l : best));
  },

  formatPace(paceMinKm) {
    if (!paceMinKm || !isFinite(paceMinKm)) return '--:--';
    const min = Math.floor(paceMinKm);
    const sec = Math.round((paceMinKm - min) * 60);
    return `${min}:${String(sec).padStart(2, '0')} /km`;
  },

  /* Plano progressivo simples de 90 dias rumo a 10km.
     Semana 1: leve 2km / interv 2km / longão 3km
     Cresce ~10% por semana até aproximar de 10km no longão por volta da semana 10-11. */
  planForWeek(weekNumber) {
    const w = Math.max(1, weekNumber);
    const base = { leve: 2, intervalado: 2, longao: 3 };
    const growth = Math.min(1 + (w - 1) * 0.12, 3.2); // limita o crescimento
    const round5 = n => Math.round(n * 2) / 2; // arredonda para 0.5 km
    return {
      week: w,
      leve: round5(base.leve * growth),
      intervalado: round5(base.intervalado * growth),
      longao: round5(base.longao * growth)
    };
  },

  currentWeekNumber() {
    const data = Storage.load();
    const start = new Date(data.meta.startDate);
    const now = new Date();
    const diffDays = Math.floor((now - start) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  },

  todaysWorkout() {
    const dayKey = dayKeyFromDate();
    const map = { segunda: 'leve', quarta: 'intervalado', sexta: 'longao' };
    const type = map[dayKey];
    if (!type) return null;
    const plan = this.planForWeek(this.currentWeekNumber());
    const labels = { leve: 'Corrida leve', intervalado: 'Intervalado / progressivo', longao: 'Longão' };
    return { type, label: labels[type], targetKm: plan[type] };
  }
};

if (typeof window !== 'undefined') { window.Running = Running; }
