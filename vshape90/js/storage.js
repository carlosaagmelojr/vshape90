/* ============================================================
   V-SHAPE 90 — storage.js
   Camada de persistência: localStorage (dados) + IndexedDB (fotos)
   ============================================================ */

const DB_KEY = 'vshape90_data_v1';
const IDB_NAME = 'vshape90_photos';
const IDB_STORE = 'photos';

/* ---------- Modelo de dados padrão ---------- */
function defaultData() {
  const today = todayISO();
  return {
    meta: { version: 1, createdAt: today, startDate: today },
    profile: { heightCm: 169, startWeightKg: 76 },
    settings: {
      waterGoalMl: 3000,
      calorieGoal: 2050,
      proteinGoal: 155,
      carbGoal: 220,
      fatGoal: 60,
      restTimerDefault: 90,
      soundOnTimer: true
    },
    plan: buildDefaultPlan(),
    exerciseLogs: {},      // { exerciseId: [ {date, sets:[{weight,reps}], note, rir, painFlag} ] }
    workoutSessions: [],   // { id, date, dayKey, completed, exerciseIds:[] }
    runLogs: [],           // { id, date, type, distanceKm, durationMin, paceMinKm, rpe, hr, notes }
    recoveryLogs: [],      // { id, date, sleep, energy, soreness, stress, sleepHours, pain, painRegion }
    bodyLogs: [],          // { id, date, weight, waist, shoulders, chest, armR, armL, thigh }
    photoMeta: [],         // { id, date, type }  (dataURL fica no IndexedDB)
    nutritionLogs: {},     // { 'YYYY-MM-DD': { breakfast:{cal,prot,carb,fat}, lunch:{...}, snack:{...}, dinner:{...}, supper:{...} } }
    waterLogs: {},         // { 'YYYY-MM-DD': ml }
    streak: { count: 0, lastCompletedDate: null },
    weeklyReports: []      // gerados aos domingos
  };
}

function buildDefaultPlan() {
  const ex = (id, name, sets, repsLow, repsHigh, pattern) => ({ id, name, sets, repsLow, repsHigh, restSec: 90, pattern });
  return {
    segunda: { name: 'Costas + Deltoide Lateral', core: 'A', exercises: [
      ex('seg_1', 'Barra fixa / Puxada', 4, 8, 12, 'pull-vertical'),
      ex('seg_2', 'Puxada alta aberta', 4, 8, 12, 'pull-vertical'),
      ex('seg_3', 'Remada', 4, 8, 12, 'row'),
      ex('seg_4', 'Remada unilateral', 3, 10, 12, 'row'),
      ex('seg_5', 'Pulldown', 3, 10, 12, 'pull-vertical'),
      ex('seg_6', 'Elevação lateral', 3, 12, 15, 'lateral')
    ]},
    terca: { name: 'Peito + Tríceps', core: 'B', exercises: [
      ex('ter_1', 'Supino reto', 4, 8, 12, 'press-h'),
      ex('ter_2', 'Supino inclinado', 4, 8, 12, 'press-h'),
      ex('ter_3', 'Crucifixo / Crossover', 3, 10, 12, 'fly'),
      ex('ter_4', 'Desenvolvimento', 3, 8, 12, 'press-v'),
      ex('ter_5', 'Tríceps polia', 3, 10, 15, 'triceps'),
      ex('ter_6', 'Tríceps francês', 3, 10, 15, 'triceps')
    ]},
    quarta: { name: 'Pernas', core: 'C', exercises: [
      ex('qua_1', 'Agachamento', 4, 8, 12, 'squat'),
      ex('qua_2', 'Leg press', 4, 8, 12, 'squat'),
      ex('qua_3', 'Cadeira extensora', 3, 10, 15, 'legext'),
      ex('qua_4', 'Mesa flexora', 3, 10, 15, 'legcurl'),
      ex('qua_5', 'Stiff', 3, 8, 12, 'hinge'),
      ex('qua_6', 'Panturrilha', 4, 12, 20, 'calf')
    ]},
    quinta: { name: 'Costas + Bíceps (largura)', core: 'A', exercises: [
      ex('qui_1', 'Barra fixa / Puxada', 4, 8, 12, 'pull-vertical'),
      ex('qui_2', 'Puxada neutra', 4, 8, 12, 'pull-vertical'),
      ex('qui_3', 'Remada baixa', 3, 10, 12, 'row'),
      ex('qui_4', 'Pullover / Pulldown', 3, 10, 12, 'pull-vertical'),
      ex('qui_5', 'Rosca direta', 3, 10, 15, 'curl'),
      ex('qui_6', 'Rosca martelo', 3, 10, 15, 'curl')
    ]},
    sexta: { name: 'Ombros + Trapézio', core: 'B', exercises: [
      ex('sex_1', 'Desenvolvimento', 4, 8, 12, 'press-v'),
      ex('sex_2', 'Elevação lateral', 4, 10, 15, 'lateral'),
      ex('sex_3', 'Elevação lateral na polia', 3, 12, 15, 'lateral'),
      ex('sex_4', 'Crucifixo inverso', 3, 12, 15, 'reardelt'),
      ex('sex_5', 'Face pull', 3, 12, 15, 'reardelt'),
      ex('sex_6', 'Encolhimento', 3, 10, 15, 'shrug')
    ]},
    sabado: { name: 'Peito + Braços', core: 'C', exercises: [
      ex('sab_1', 'Supino inclinado', 4, 8, 12, 'press-h'),
      ex('sab_2', 'Crossover', 3, 10, 12, 'fly'),
      ex('sab_3', 'Rosca direta', 3, 10, 15, 'curl'),
      ex('sab_4', 'Rosca martelo', 3, 10, 15, 'curl'),
      ex('sab_5', 'Tríceps polia', 3, 10, 15, 'triceps'),
      ex('sab_6', 'Mergulho / complementar', 3, 8, 12, 'triceps')
    ]},
    domingo: { name: 'Recuperação ativa', core: null, exercises: [] }
  };
}

const DAY_KEYS = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];

function todayISO(d = new Date()) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function dayKeyFromDate(d = new Date()) {
  return DAY_KEYS[d.getDay()];
}

/* ---------- Storage core ---------- */
const Storage = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        this._cache = defaultData();
        this.save();
      } else {
        this._cache = JSON.parse(raw);
        this._migrate(this._cache);
      }
    } catch (e) {
      console.error('Erro ao carregar dados, iniciando novo banco:', e);
      this._cache = defaultData();
      this.save();
    }
    return this._cache;
  },

  save() {
    if (!this._cache) return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this._cache));
      return true;
    } catch (e) {
      console.error('Erro ao salvar dados:', e);
      alert('Não foi possível salvar os dados. O armazenamento local pode estar cheio.');
      return false;
    }
  },

  _migrate(data) {
    const def = defaultData();
    for (const k of Object.keys(def)) {
      if (!(k in data)) data[k] = def[k];
    }
    if (!data.settings) data.settings = def.settings;
    for (const k of Object.keys(def.settings)) {
      if (!(k in data.settings)) data.settings[k] = def.settings[k];
    }
    // Backfill do campo "pattern" (usado nas animações de execução) em
    // planos salvos antes dessa funcionalidade existir.
    if (data.plan) {
      for (const dayKey of Object.keys(def.plan)) {
        const defDay = def.plan[dayKey];
        const savedDay = data.plan[dayKey];
        if (!savedDay || !savedDay.exercises) continue;
        for (const savedEx of savedDay.exercises) {
          if (!savedEx.pattern) {
            const match = defDay.exercises.find(e => e.id === savedEx.id);
            if (match) savedEx.pattern = match.pattern;
          }
        }
      }
    }
  },

  reset() {
    this._cache = defaultData();
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this._cache, null, 2);
  },

  async exportFull() {
    const photos = await Photos.getAll();
    const payload = { data: this._cache, photos, exportedAt: new Date().toISOString() };
    return JSON.stringify(payload);
  },

  async importFull(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      throw new Error('Arquivo inválido: não é um JSON válido.');
    }
    // aceita tanto backup completo {data, photos} quanto apenas os dados
    const data = parsed.data || parsed;
    if (!data || typeof data !== 'object' || !data.meta) {
      throw new Error('Arquivo inválido: estrutura de dados não reconhecida.');
    }
    this._migrate(data);
    this._cache = data;
    this.save();
    if (Array.isArray(parsed.photos)) {
      await Photos.clearAll();
      for (const p of parsed.photos) {
        await Photos.put(p);
      }
    }
    return true;
  }
};

/* ---------- IndexedDB para fotos ---------- */
const Photos = {
  _dbPromise: null,

  _openDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },

  async put(photo) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(photo);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(id) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll() {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll() {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
};

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* Exposição explícita para testes automatizados headless (não afeta o navegador) */
if (typeof window !== 'undefined') {
  window.Storage = Storage; window.Photos = Photos; window.uid = uid;
  window.todayISO = todayISO; window.dayKeyFromDate = dayKeyFromDate; window.DAY_KEYS = DAY_KEYS;
}
