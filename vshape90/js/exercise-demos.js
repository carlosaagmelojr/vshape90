/* ============================================================
   V-SHAPE 90 — exercise-demos.js
   Animações ORIGINAIS (boneco-palito em SVG) mostrando o padrão
   de movimento de cada exercício. Não usa nenhuma imagem, gif ou
   vídeo de terceiros — tudo é desenhado por código e roda 100%
   offline, sem depender de nenhum servidor externo.

   Cada exercício do plano tem um "pattern" (ver storage.js) que
   define qual animação CSS (em style.css) é aplicada sobre o
   mesmo boneco base.
   ============================================================ */

const ExerciseDemos = {

  PATTERN_LABELS: {
    'pull-vertical': 'Puxada vertical',
    'row': 'Puxada horizontal (remada)',
    'press-h': 'Empurrar horizontal',
    'press-v': 'Empurrar vertical',
    'fly': 'Adução de ombro (voador)',
    'curl': 'Flexão de cotovelo',
    'triceps': 'Extensão de cotovelo',
    'lateral': 'Abdução de ombro',
    'reardelt': 'Puxada com abertura (deltoide posterior)',
    'shrug': 'Elevação de escápula',
    'squat': 'Agachamento (quadril + joelho)',
    'hinge': 'Dobradiça de quadril',
    'legext': 'Extensão de joelho',
    'legcurl': 'Flexão de joelho',
    'calf': 'Elevação de panturrilha',
    'core': 'Estabilização de core'
  },

  /* Retorna o SVG (string) do boneco-palito com a classe do padrão de
     movimento aplicada — a animação em si vive inteiramente no CSS. */
  svg(pattern) {
    const p = this.PATTERN_LABELS[pattern] ? pattern : 'core';
    return `
      <svg class="exercise-demo-svg pattern-${p}" viewBox="0 0 100 140" role="img" aria-label="Animação: ${this.PATTERN_LABELS[p]}">
        <g class="rig-root">
          <line class="rig-ground" x1="14" y1="136" x2="86" y2="136" stroke="currentColor" stroke-width="2" opacity="0.15"/>
          <g class="rig-torso">
            <line x1="50" y1="34" x2="50" y2="78" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
            <circle class="rig-head" cx="50" cy="20" r="9" fill="currentColor"/>
            <g class="rig-upperarm">
              <line x1="50" y1="36" x2="66" y2="52" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>
              <g class="rig-forearm">
                <line x1="66" y1="52" x2="62" y2="70" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>
              </g>
            </g>
          </g>
          <g class="rig-thigh">
            <line x1="50" y1="78" x2="46" y2="106" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
            <g class="rig-shin">
              <line x1="46" y1="106" x2="50" y2="132" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
            </g>
          </g>
        </g>
      </svg>
    `;
  },

  /* Card pequeno (thumbnail) usado nas listas de exercício */
  thumb(pattern) {
    return `<div class="exercise-demo exercise-demo-sm">${this.svg(pattern)}</div>`;
  },

  /* Card grande usado no Modo Treino */
  large(pattern) {
    return `<div class="exercise-demo exercise-demo-lg">${this.svg(pattern)}</div>`;
  }
};

if (typeof window !== 'undefined') { window.ExerciseDemos = ExerciseDemos; }
