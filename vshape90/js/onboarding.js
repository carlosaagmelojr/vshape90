/* ============================================================
   V-SHAPE 90 — onboarding.js
   Lógica pura do onboarding: gera a grade semanal a partir da
   disponibilidade informada, e calcula metas de calorias/proteína
   a partir de altura/peso/idade/sexo (fórmula de Mifflin-St Jeor).
   Nenhuma função aqui toca o DOM — só dados.
   ============================================================ */

const Onboarding = {

  OBJECTIVES: {
    vshape: { label: 'V-Shape + Força', description: 'Hipertrofia com foco em costas, ombros e definição.' },
    emagrecimento: { label: 'Emagrecimento + Condicionamento', description: 'Déficit calórico moderado, mais frequência cardiovascular.' },
    corrida: { label: 'Corrida + Resistência', description: 'Progressão de corrida mais acelerada, musculação de manutenção.' }
  },

  /* -------- Templates de grade semanal por dias/semana -------- */

  templateFullBody3() {
    const ex = (id, name, sets, repsLow, repsHigh, pattern, muscleGroup) => ({ id, name, sets, repsLow, repsHigh, restSec: 90, pattern, muscleGroup });
    return {
      A: { name: 'Full Body A', core: 'A', exercises: [
        ex('fb_a1', 'Agachamento', 4, 8, 12, 'squat', 'quadriceps'),
        ex('fb_a2', 'Supino reto', 4, 8, 12, 'press-h', 'peito'),
        ex('fb_a3', 'Remada', 3, 10, 12, 'row', 'costas'),
        ex('fb_a4', 'Elevação lateral', 3, 12, 15, 'lateral', 'ombro'),
        ex('fb_a5', 'Rosca direta', 3, 10, 12, 'curl', 'biceps')
      ]},
      B: { name: 'Full Body B', core: 'B', exercises: [
        ex('fb_b1', 'Leg press', 4, 8, 12, 'squat', 'quadriceps'),
        ex('fb_b2', 'Desenvolvimento', 3, 8, 12, 'press-v', 'ombro'),
        ex('fb_b3', 'Puxada alta', 4, 8, 12, 'pull-vertical', 'costas'),
        ex('fb_b4', 'Tríceps polia', 3, 10, 15, 'triceps', 'triceps'),
        ex('fb_b5', 'Panturrilha', 4, 12, 20, 'calf', 'panturrilha')
      ]},
      C: { name: 'Full Body C', core: 'C', exercises: [
        ex('fb_c1', 'Stiff', 3, 8, 12, 'hinge', 'posterior'),
        ex('fb_c2', 'Supino inclinado', 4, 8, 12, 'press-h', 'peito'),
        ex('fb_c3', 'Remada baixa', 3, 10, 12, 'row', 'costas'),
        ex('fb_c4', 'Rosca martelo', 3, 10, 15, 'curl', 'biceps'),
        ex('fb_c5', 'Elevação lateral na polia', 3, 12, 15, 'lateral', 'ombro')
      ]}
    };
  },

  templateUpperLower4() {
    const ex = (id, name, sets, repsLow, repsHigh, pattern, muscleGroup) => ({ id, name, sets, repsLow, repsHigh, restSec: 90, pattern, muscleGroup });
    return {
      UA: { name: 'Superiores A', core: 'A', exercises: [
        ex('ul_1a', 'Supino reto', 4, 8, 12, 'press-h', 'peito'),
        ex('ul_1b', 'Remada', 4, 8, 12, 'row', 'costas'),
        ex('ul_1c', 'Desenvolvimento', 3, 8, 12, 'press-v', 'ombro'),
        ex('ul_1d', 'Rosca direta', 3, 10, 12, 'curl', 'biceps'),
        ex('ul_1e', 'Tríceps polia', 3, 10, 15, 'triceps', 'triceps')
      ]},
      LA: { name: 'Inferiores A', core: 'B', exercises: [
        ex('ul_2a', 'Agachamento', 4, 8, 12, 'squat', 'quadriceps'),
        ex('ul_2b', 'Stiff', 3, 8, 12, 'hinge', 'posterior'),
        ex('ul_2c', 'Cadeira extensora', 3, 10, 15, 'legext', 'quadriceps'),
        ex('ul_2d', 'Panturrilha', 4, 12, 20, 'calf', 'panturrilha')
      ]},
      UB: { name: 'Superiores B', core: 'C', exercises: [
        ex('ul_3a', 'Puxada alta', 4, 8, 12, 'pull-vertical', 'costas'),
        ex('ul_3b', 'Supino inclinado', 4, 8, 12, 'press-h', 'peito'),
        ex('ul_3c', 'Elevação lateral', 3, 12, 15, 'lateral', 'ombro'),
        ex('ul_3d', 'Rosca martelo', 3, 10, 15, 'curl', 'biceps'),
        ex('ul_3e', 'Tríceps francês', 3, 10, 15, 'triceps', 'triceps')
      ]},
      LB: { name: 'Inferiores B', core: 'A', exercises: [
        ex('ul_4a', 'Leg press', 4, 8, 12, 'squat', 'quadriceps'),
        ex('ul_4b', 'Mesa flexora', 3, 10, 15, 'legcurl', 'posterior'),
        ex('ul_4c', 'Encolhimento', 3, 10, 15, 'shrug', 'trapezio'),
        ex('ul_4d', 'Panturrilha', 4, 12, 20, 'calf', 'panturrilha')
      ]}
    };
  },

  /* Monta a grade semanal completa (7 dias) a partir da disponibilidade.
     3/4 dias usam templates dedicados (full body / upper-lower).
     5/6 dias reaproveitam os dias já testados do split padrão de 6 dias,
     só selecionando quais entram (evita duplicar conteúdo). */
  buildWeeklyPlan(daysPerWeek) {
    // função (não objeto compartilhado) — cada dia de descanso precisa ser
    // uma instância própria, senão mutar um afetaria todos os outros.
    const restDay = () => ({ name: 'Recuperação ativa', core: null, exercises: [] });
    const six = buildDefaultPlan(); // split original: segunda..sábado

    if (daysPerWeek <= 3) {
      const t = this.templateFullBody3();
      return {
        segunda: t.A, terca: restDay(), quarta: t.B, quinta: restDay(), sexta: t.C, sabado: restDay(), domingo: restDay()
      };
    }
    if (daysPerWeek === 4) {
      const t = this.templateUpperLower4();
      return {
        segunda: t.UA, terca: t.LA, quarta: restDay(), quinta: t.UB, sexta: t.LB, sabado: restDay(), domingo: restDay()
      };
    }
    if (daysPerWeek === 5) {
      return {
        segunda: six.segunda, terca: six.terca, quarta: six.quarta, quinta: six.sexta, sexta: six.sabado,
        sabado: restDay(), domingo: restDay()
      };
    }
    // 6 dias: split original, sem alterações
    return six;
  },

  /* -------- Metas de nutrição (Mifflin-St Jeor) -------- */
  /* Estimativa, não é orientação médica — sempre editável depois em Configurações. */
  calculateNutritionGoals({ weightKg, heightCm, age, sex, daysPerWeek, objective }) {
    if (!weightKg || !heightCm || !age || !sex) return null;
    const bmr = sex === 'feminino'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

    const activityFactorByDays = { 3: 1.4, 4: 1.5, 5: 1.6, 6: 1.7 };
    const activityFactor = activityFactorByDays[Math.min(6, Math.max(3, daysPerWeek))] || 1.5;
    const tdee = bmr * activityFactor;

    const calorieGoal = Math.round((objective === 'emagrecimento' ? tdee - 400 : tdee) / 10) * 10;
    const proteinGoal = Math.round(weightKg * (objective === 'emagrecimento' ? 2.0 : 1.8));
    const proteinCals = proteinGoal * 4;
    const remaining = Math.max(0, calorieGoal - proteinCals);
    const carbGoal = Math.round((remaining * 0.55) / 4);
    const fatGoal = Math.round((remaining * 0.45) / 9);

    return { calorieGoal, proteinGoal, carbGoal, fatGoal };
  }
};

if (typeof window !== 'undefined') { window.Onboarding = Onboarding; }
