/* ============================================================
   V-SHAPE 90 — exercise-catalog.js
   Catálogo de exercícios alternativos por grupo muscular, usado
   na função "trocar exercício" (mantém séries/reps/padrão de
   movimento equivalentes, só muda o exercício em si).
   ============================================================ */

const ExerciseCatalog = {

  GROUP_LABELS: {
    costas: 'Costas',
    peito: 'Peito',
    ombro: 'Ombro',
    triceps: 'Tríceps',
    biceps: 'Bíceps',
    trapezio: 'Trapézio',
    quadriceps: 'Quadríceps',
    posterior: 'Posterior de coxa',
    panturrilha: 'Panturrilha'
  },

  ALTERNATIVES: {
    costas: [
      { name: 'Barra fixa / Puxada', pattern: 'pull-vertical' },
      { name: 'Puxada alta aberta', pattern: 'pull-vertical' },
      { name: 'Puxada neutra', pattern: 'pull-vertical' },
      { name: 'Pulldown', pattern: 'pull-vertical' },
      { name: 'Remada baixa (cabo)', pattern: 'row' },
      { name: 'Remada curvada com barra', pattern: 'row' },
      { name: 'Remada unilateral (halter)', pattern: 'row' },
      { name: 'Remada cavalinho (T-bar)', pattern: 'row' },
      { name: 'Pullover na polia', pattern: 'pull-vertical' }
    ],
    peito: [
      { name: 'Supino reto (barra)', pattern: 'press-h' },
      { name: 'Supino reto (halteres)', pattern: 'press-h' },
      { name: 'Supino inclinado (barra)', pattern: 'press-h' },
      { name: 'Supino inclinado (halteres)', pattern: 'press-h' },
      { name: 'Supino na máquina', pattern: 'press-h' },
      { name: 'Crucifixo (halteres)', pattern: 'fly' },
      { name: 'Crossover (polia)', pattern: 'fly' },
      { name: 'Peck deck (voador)', pattern: 'fly' },
      { name: 'Flexão de braço', pattern: 'press-h' }
    ],
    ombro: [
      { name: 'Desenvolvimento (barra)', pattern: 'press-v' },
      { name: 'Desenvolvimento (halteres)', pattern: 'press-v' },
      { name: 'Desenvolvimento na máquina', pattern: 'press-v' },
      { name: 'Elevação lateral (halteres)', pattern: 'lateral' },
      { name: 'Elevação lateral (polia)', pattern: 'lateral' },
      { name: 'Elevação frontal', pattern: 'lateral' },
      { name: 'Crucifixo inverso', pattern: 'reardelt' },
      { name: 'Face pull', pattern: 'reardelt' },
      { name: 'Remada alta', pattern: 'lateral' }
    ],
    triceps: [
      { name: 'Tríceps na polia (corda)', pattern: 'triceps' },
      { name: 'Tríceps na polia (barra)', pattern: 'triceps' },
      { name: 'Tríceps francês', pattern: 'triceps' },
      { name: 'Tríceps testa', pattern: 'triceps' },
      { name: 'Mergulho entre bancos', pattern: 'triceps' },
      { name: 'Supino fechado', pattern: 'press-h' },
      { name: 'Kickback (coice)', pattern: 'triceps' }
    ],
    biceps: [
      { name: 'Rosca direta (barra)', pattern: 'curl' },
      { name: 'Rosca direta (halteres)', pattern: 'curl' },
      { name: 'Rosca martelo', pattern: 'curl' },
      { name: 'Rosca alternada', pattern: 'curl' },
      { name: 'Rosca scott', pattern: 'curl' },
      { name: 'Rosca na polia', pattern: 'curl' },
      { name: 'Rosca concentrada', pattern: 'curl' }
    ],
    trapezio: [
      { name: 'Encolhimento (barra)', pattern: 'shrug' },
      { name: 'Encolhimento (halteres)', pattern: 'shrug' },
      { name: 'Encolhimento na polia', pattern: 'shrug' },
      { name: 'Face pull', pattern: 'reardelt' }
    ],
    quadriceps: [
      { name: 'Agachamento livre', pattern: 'squat' },
      { name: 'Agachamento no smith', pattern: 'squat' },
      { name: 'Leg press', pattern: 'squat' },
      { name: 'Cadeira extensora', pattern: 'legext' },
      { name: 'Afundo / Passada', pattern: 'squat' },
      { name: 'Agachamento búlgaro', pattern: 'squat' },
      { name: 'Hack machine', pattern: 'squat' }
    ],
    posterior: [
      { name: 'Stiff (barra)', pattern: 'hinge' },
      { name: 'Stiff (halteres)', pattern: 'hinge' },
      { name: 'Levantamento terra romeno', pattern: 'hinge' },
      { name: 'Mesa flexora', pattern: 'legcurl' },
      { name: 'Cadeira flexora', pattern: 'legcurl' },
      { name: 'Flexora em pé (unilateral)', pattern: 'legcurl' }
    ],
    panturrilha: [
      { name: 'Panturrilha em pé', pattern: 'calf' },
      { name: 'Panturrilha sentado', pattern: 'calf' },
      { name: 'Panturrilha no leg press', pattern: 'calf' },
      { name: 'Panturrilha unilateral', pattern: 'calf' }
    ]
  },

  /* Retorna a lista de alternativas para um grupo muscular, cada uma com
     um id estável (gerado a partir do nome) para poder ser referenciada. */
  alternativesFor(muscleGroup) {
    const list = this.ALTERNATIVES[muscleGroup] || [];
    return list.map(item => ({
      ...item,
      id: 'cat_' + item.name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    }));
  }
};

if (typeof window !== 'undefined') { window.ExerciseCatalog = ExerciseCatalog; }
