/* ============================================================
   V-SHAPE 90 — exercise-metadata.js
   Metadados biomecânicos por PADRÃO DE MOVIMENTO (não por exercício
   individual) — é isso que faz o sistema escalar automaticamente pra
   qualquer exercício do catálogo, trocado ou personalizado, sem
   precisar cadastrar cada um manualmente. Alimenta duas coisas:

   1. O destaque muscular sobre o boneco-palito (vermelho = principal,
      laranja = secundário, amarelo = estabilizador) — mapeado pros
      segmentos do boneco (torso/braço/antebraço/coxa/perna), já que
      é um boneco esquemático 2D, não um modelo anatômico 3D real.
   2. A tela de detalhes do exercício (posição inicial, execução,
      respiração, erros comuns, dicas).

   Limitação assumida conscientemente: como o boneco é esquemático,
   o destaque é por SEGMENTO DO CORPO (ex.: "braço"), não por músculo
   individual real (ex.: não dá pra diferenciar visualmente bíceps de
   tríceps no mesmo segmento) — o nome do músculo certo aparece no
   texto, o destaque visual é uma aproximação didática, não anatômica.
   ============================================================ */

const ExerciseMetadata = {

  MUSCLE_COLORS: {
    primary: '#E85B5F',    // vermelho — músculo principal
    secondary: '#F0954B',  // laranja — músculos secundários
    stabilizer: '#F0D23E'  // amarelo — estabilizadores
  },

  BY_PATTERN: {
    'pull-vertical': {
      category: 'Costas', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra fixa, puxador alto ou polia',
      primaryMuscle: 'Grande dorsal',
      secondaryMuscles: ['Bíceps braquial', 'Redondo maior'],
      stabilizers: ['Trapézio', 'Core'],
      startPosition: 'Sentado ou pendurado, pegada mais larga que os ombros, escápulas neutras, tronco ligeiramente inclinado pra trás.',
      execution: 'Puxe o peso levando os cotovelos pra baixo e um pouco pra trás, aproximando as escápulas, até a barra chegar perto do peito/queixo. Retorne controlando o peso até a extensão quase completa dos braços.',
      breathing: { inhale: 'na descida/retorno (fase excêntrica)', exhale: 'ao puxar (fase concêntrica)' },
      commonErrors: ['Usar embalo do corpo pra puxar', 'Encolher os ombros em vez de deprimir as escápulas', 'Não completar a amplitude'],
      tips: ['Imagine puxar os cotovelos até o bolso de trás', 'Controle a volta, não deixe o peso "cair"'],
      muscleMap: { torso: 'primary', upperarm: 'secondary', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'row': {
      category: 'Costas', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra, halteres, máquina ou polia baixa',
      primaryMuscle: 'Grande dorsal / trapézio médio',
      secondaryMuscles: ['Bíceps braquial', 'Deltoide posterior'],
      stabilizers: ['Lombar', 'Core'],
      startPosition: 'Tronco inclinado à frente (~45°) com a coluna neutra, braços estendidos segurando o peso, escápulas levemente protraídas.',
      execution: 'Puxe o peso em direção ao abdômen/quadril, levando os cotovelos pra trás e aproximando as escápulas. Retorne controlando até a extensão dos braços, sem perder a postura da coluna.',
      breathing: { inhale: 'na extensão dos braços', exhale: 'ao puxar o peso' },
      commonErrors: ['Arredondar a lombar', 'Usar impulso do quadril pra puxar', 'Elevar demais o tronco durante a puxada'],
      tips: ['Mantenha o peito aberto e o olhar à frente', 'Aperte as escápulas no final do movimento'],
      muscleMap: { torso: 'primary', upperarm: 'secondary', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'press-h': {
      category: 'Peito', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra, halteres ou máquina',
      primaryMuscle: 'Peitoral maior',
      secondaryMuscles: ['Tríceps braquial', 'Deltoide anterior'],
      stabilizers: ['Core', 'Manguito rotador'],
      startPosition: 'Deitado ou sentado, pegada um pouco mais larga que os ombros, escápulas retraídas e apoiadas, pés firmes no chão.',
      execution: 'Desça o peso controladamente até a linha do peito, cotovelos numa trajetória levemente diagonal (não retos a 90°). Empurre de volta até a quase extensão dos cotovelos, sem travar bruscamente.',
      breathing: { inhale: 'na descida', exhale: 'ao empurrar' },
      commonErrors: ['Arquear excessivamente a lombar', 'Deixar os cotovelos abrirem 90° (sobrecarrega o ombro)', 'Descer rápido demais e "quicar" o peso'],
      tips: ['Mantenha as escápulas apoiadas e retraídas o tempo todo', 'Desça até uma amplitude confortável pro seu ombro, não force'],
      muscleMap: { torso: 'primary', upperarm: 'secondary', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'press-v': {
      category: 'Ombro', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra, halteres ou máquina',
      primaryMuscle: 'Deltoide anterior',
      secondaryMuscles: ['Tríceps braquial', 'Deltoide lateral'],
      stabilizers: ['Core', 'Trapézio superior'],
      startPosition: 'Em pé ou sentado, peso na altura dos ombros, cotovelos levemente à frente do corpo, core contraído.',
      execution: 'Empurre o peso pra cima até a quase extensão dos cotovelos, sem hiperextender a lombar. Desça controladamente até a altura dos ombros.',
      breathing: { inhale: 'na descida', exhale: 'ao empurrar pra cima' },
      commonErrors: ['Arquear a lombar pra "ajudar" a empurrar', 'Descer rápido demais', 'Elevar os ombros em vez de empurrar com o braço'],
      tips: ['Mantenha o core firme o tempo todo', 'Evite travar os cotovelos com força no topo'],
      muscleMap: { torso: 'secondary', upperarm: 'primary', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'fly': {
      category: 'Peito', type: 'Isolador', level: 'Iniciante',
      equipment: 'Halteres, crossover ou peck deck',
      primaryMuscle: 'Peitoral maior',
      secondaryMuscles: ['Deltoide anterior'],
      stabilizers: ['Core', 'Manguito rotador'],
      startPosition: 'Braços abertos lateralmente com leve flexão de cotovelo, alinhados na altura do peito.',
      execution: 'Feche os braços em arco à frente do corpo, contraindo o peitoral, mantendo a flexão do cotovelo constante. Retorne controlando até sentir o alongamento do peitoral, sem forçar o ombro.',
      breathing: { inhale: 'na abertura', exhale: 'ao fechar/contrair' },
      commonErrors: ['Flexionar/estender o cotovelo durante o movimento (vira tríceps, não peito)', 'Abrir demais e forçar o ombro', 'Usar carga alta demais que impede controle'],
      tips: ['Pense em "abraçar um tronco de árvore"', 'Priorize a contração no final do movimento'],
      muscleMap: { torso: 'primary', upperarm: 'secondary', forearm: null, thigh: null, shin: null }
    },
    'curl': {
      category: 'Bíceps', type: 'Isolador', level: 'Iniciante',
      equipment: 'Barra, halteres ou polia',
      primaryMuscle: 'Bíceps braquial',
      secondaryMuscles: ['Braquial', 'Braquiorradial'],
      stabilizers: ['Deltoide anterior', 'Core'],
      startPosition: 'Em pé, braços estendidos ao lado do corpo, cotovelos próximos ao tronco, pegada supinada (ou neutra, conforme a variação).',
      execution: 'Flexione o cotovelo levando o peso em direção ao ombro, mantendo o cotovelo fixo ao lado do corpo. Desça controladamente até a extensão quase completa.',
      breathing: { inhale: 'na descida', exhale: 'ao flexionar/subir' },
      commonErrors: ['Balançar o tronco pra impulsionar o peso', 'Mover o cotovelo pra frente durante a subida', 'Não controlar a descida'],
      tips: ['Cotovelo "colado" ao lado do corpo o tempo todo', 'Aperte o bíceps no topo do movimento'],
      muscleMap: { torso: null, upperarm: 'stabilizer', forearm: 'primary', thigh: null, shin: null }
    },
    'triceps': {
      category: 'Tríceps', type: 'Isolador', level: 'Iniciante',
      equipment: 'Polia, barra ou halteres',
      primaryMuscle: 'Tríceps braquial',
      secondaryMuscles: ['Ancôneo'],
      stabilizers: ['Deltoide', 'Core'],
      startPosition: 'Cotovelo fixo (ao lado do corpo ou acima da cabeça, conforme a variação), antebraço flexionado.',
      execution: 'Estenda o cotovelo até a quase extensão completa, mantendo o braço fixo, sem mover o ombro. Retorne controlando até a flexão inicial.',
      breathing: { inhale: 'na flexão/descida', exhale: 'ao estender' },
      commonErrors: ['Mover o cotovelo/ombro durante o movimento', 'Travar o cotovelo com força no final', 'Usar o corpo pra empurrar o peso'],
      tips: ['Mantenha o cotovelo apontando pro mesmo lugar o tempo todo', 'Foque em "trancar" e "destrancar" só o antebraço'],
      muscleMap: { torso: null, upperarm: 'stabilizer', forearm: 'primary', thigh: null, shin: null }
    },
    'lateral': {
      category: 'Ombro', type: 'Isolador', level: 'Iniciante',
      equipment: 'Halteres ou polia',
      primaryMuscle: 'Deltoide lateral',
      secondaryMuscles: ['Deltoide anterior', 'Trapézio superior'],
      stabilizers: ['Core'],
      startPosition: 'Em pé, braços ao lado do corpo, leve flexão de cotovelo, palmas voltadas pro corpo.',
      execution: 'Eleve os braços lateralmente até a altura dos ombros, liderando o movimento com os cotovelos, não com as mãos. Desça controladamente.',
      breathing: { inhale: 'na descida', exhale: 'ao elevar' },
      commonErrors: ['Usar embalo/impulso do tronco', 'Elevar acima da linha dos ombros (sobrecarrega o trapézio)', 'Girar o pulso pra "despejar água" com carga alta'],
      tips: ['Imagine que está derramando um copo d\'água lentamente', 'Priorize controle sobre carga alta'],
      muscleMap: { torso: 'stabilizer', upperarm: 'primary', forearm: 'secondary', thigh: null, shin: null }
    },
    'reardelt': {
      category: 'Ombro', type: 'Isolador', level: 'Iniciante',
      equipment: 'Halteres, polia ou máquina',
      primaryMuscle: 'Deltoide posterior',
      secondaryMuscles: ['Trapézio médio', 'Romboides'],
      stabilizers: ['Core', 'Lombar'],
      startPosition: 'Tronco inclinado à frente ou sentado no peck deck invertido, braços à frente do corpo com leve flexão de cotovelo.',
      execution: 'Abra os braços lateralmente/pra trás, aproximando as escápulas, liderando com os cotovelos. Retorne controlando até a posição inicial.',
      breathing: { inhale: 'no retorno', exhale: 'ao abrir/puxar' },
      commonErrors: ['Usar embalo do tronco', 'Fazer amplitude curta demais', 'Deixar os ombros subirem em vez de puxar com os braços'],
      tips: ['Foque em aproximar as escápulas no final do movimento', 'Mantenha a coluna estável, sem balançar'],
      muscleMap: { torso: 'secondary', upperarm: 'primary', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'shrug': {
      category: 'Trapézio', type: 'Isolador', level: 'Iniciante',
      equipment: 'Barra, halteres ou polia',
      primaryMuscle: 'Trapézio superior',
      secondaryMuscles: ['Levantador da escápula'],
      stabilizers: ['Core', 'Antebraços (pegada)'],
      startPosition: 'Em pé, braços estendidos ao lado do corpo segurando o peso, ombros relaxados.',
      execution: 'Eleve os ombros diretamente pra cima (não circule), aproximando-os das orelhas. Desça controladamente.',
      breathing: { inhale: 'na descida', exhale: 'ao elevar' },
      commonErrors: ['Fazer movimento circular com os ombros', 'Usar os braços/cotovelos pra ajudar a elevar', 'Amplitude exagerada com carga alta demais'],
      tips: ['Movimento é só de "para cima e para baixo", em linha reta', 'Segure 1 segundo no topo antes de descer'],
      muscleMap: { torso: 'primary', upperarm: 'stabilizer', forearm: 'stabilizer', thigh: null, shin: null }
    },
    'squat': {
      category: 'Quadríceps', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra, máquina ou peso corporal',
      primaryMuscle: 'Quadríceps',
      secondaryMuscles: ['Glúteo máximo', 'Isquiotibiais'],
      stabilizers: ['Core', 'Lombar', 'Panturrilha'],
      startPosition: 'Pés na largura dos ombros, coluna neutra, peito aberto, olhar à frente.',
      execution: 'Flexione quadril e joelhos simultaneamente, descendo o quadril pra trás e pra baixo, mantendo os joelhos alinhados com os pés. Desça até onde a mobilidade permitir com boa técnica, depois retorne estendendo quadril e joelhos.',
      breathing: { inhale: 'na descida', exhale: 'ao subir' },
      commonErrors: ['Joelhos "caindo" pra dentro', 'Tirar o calcanhar do chão', 'Arredondar a lombar na descida'],
      tips: ['Empurre o chão com os pés inteiros, não só a ponta', 'Mantenha o core contraído a descida toda'],
      muscleMap: { torso: 'stabilizer', upperarm: null, forearm: null, thigh: 'primary', shin: 'secondary' }
    },
    'hinge': {
      category: 'Posterior de coxa', type: 'Composto', level: 'Intermediário',
      equipment: 'Barra ou halteres',
      primaryMuscle: 'Isquiotibiais',
      secondaryMuscles: ['Glúteo máximo', 'Lombar'],
      stabilizers: ['Core', 'Panturrilha'],
      startPosition: 'Pés na largura do quadril, joelhos com leve flexão fixa, peso próximo ao corpo.',
      execution: 'Incline o tronco à frente levando o quadril pra trás (dobradiça no quadril, não nos joelhos), mantendo a coluna neutra, até sentir o alongamento do posterior de coxa. Retorne estendendo o quadril.',
      breathing: { inhale: 'na descida/inclinação', exhale: 'ao voltar à posição em pé' },
      commonErrors: ['Arredondar a lombar', 'Flexionar demais os joelhos (vira agachamento)', 'Afastar o peso do corpo durante o movimento'],
      tips: ['Mantenha a barra/peso raspando as pernas', 'Imagine "fechar uma porta" com o quadril pra trás'],
      muscleMap: { torso: 'stabilizer', upperarm: null, forearm: null, thigh: 'primary', shin: 'stabilizer' }
    },
    'legext': {
      category: 'Quadríceps', type: 'Isolador', level: 'Iniciante',
      equipment: 'Cadeira extensora',
      primaryMuscle: 'Quadríceps',
      secondaryMuscles: [],
      stabilizers: ['Core'],
      startPosition: 'Sentado, joelhos flexionados a 90°, encosto ajustado, apoio no tornozelo.',
      execution: 'Estenda os joelhos até a quase extensão completa, contraindo o quadríceps. Retorne controlando até a flexão inicial, sem soltar o peso.',
      breathing: { inhale: 'na flexão/descida', exhale: 'ao estender' },
      commonErrors: ['Travar o joelho com força no topo', 'Soltar o peso na volta (sem controle excêntrico)', 'Tirar o quadril do encosto pra "ajudar"'],
      tips: ['Segure 1 segundo no topo antes de descer', 'Movimento controlado nas duas fases, não só na subida'],
      muscleMap: { torso: null, upperarm: null, forearm: null, thigh: 'primary', shin: 'secondary' }
    },
    'legcurl': {
      category: 'Posterior de coxa', type: 'Isolador', level: 'Iniciante',
      equipment: 'Mesa ou cadeira flexora',
      primaryMuscle: 'Isquiotibiais',
      secondaryMuscles: ['Panturrilha'],
      stabilizers: ['Core', 'Glúteo'],
      startPosition: 'Deitado ou sentado, pernas estendidas, apoio logo acima do tornozelo.',
      execution: 'Flexione os joelhos levando o calcanhar em direção ao glúteo, contraindo o posterior de coxa. Retorne controlando até a extensão inicial.',
      breathing: { inhale: 'na extensão/descida', exhale: 'ao flexionar' },
      commonErrors: ['Elevar o quadril do banco pra "ajudar"', 'Fazer o movimento rápido demais, sem controle', 'Amplitude incompleta'],
      tips: ['Mantenha o quadril fixo no banco o tempo todo', 'Aperte o posterior de coxa no ponto de maior flexão'],
      muscleMap: { torso: null, upperarm: null, forearm: null, thigh: 'primary', shin: 'secondary' }
    },
    'calf': {
      category: 'Panturrilha', type: 'Isolador', level: 'Iniciante',
      equipment: 'Peso corporal, máquina ou leg press',
      primaryMuscle: 'Gastrocnêmio',
      secondaryMuscles: ['Sóleo'],
      stabilizers: ['Core', 'Tornozelo'],
      startPosition: 'Em pé (ou sentado, na variação sóleo), apoio na ponta dos pés, calcanhares livres pra descer.',
      execution: 'Eleve os calcanhares o máximo possível, contraindo a panturrilha no topo. Desça controladamente até sentir o alongamento.',
      breathing: { inhale: 'na descida', exhale: 'ao elevar' },
      commonErrors: ['Fazer o movimento rápido, tipo "pulinho"', 'Amplitude curta (não descer o suficiente)', 'Não segurar a contração no topo'],
      tips: ['Segure 1-2 segundos no ponto mais alto', 'Desça até sentir o alongamento completo da panturrilha'],
      muscleMap: { torso: null, upperarm: null, forearm: null, thigh: 'stabilizer', shin: 'primary' }
    },
    'core': {
      category: 'Abdômen', type: 'Isolador', level: 'Iniciante',
      equipment: 'Peso corporal, polia ou anilha',
      primaryMuscle: 'Reto abdominal',
      secondaryMuscles: ['Oblíquos', 'Transverso do abdômen'],
      stabilizers: ['Lombar', 'Quadril'],
      startPosition: 'Posição estável (prancha, deitado ou sentado, conforme o exercício), coluna neutra.',
      execution: 'Contraia o abdômen mantendo a coluna estável durante todo o movimento, evitando compensar com a lombar. Movimento controlado, sem embalo.',
      breathing: { inhale: 'na fase de menor contração', exhale: 'na fase de maior contração' },
      commonErrors: ['Prender a respiração o tempo todo', 'Compensar com a lombar (arquear/hiperextender)', 'Usar embalo em vez de contração controlada'],
      tips: ['Respire de forma constante, sem prender o ar', 'Priorize qualidade da contração sobre quantidade de repetições'],
      muscleMap: { torso: 'primary', upperarm: 'stabilizer', forearm: null, thigh: 'stabilizer', shin: null }
    }
  },

  get(pattern) {
    return this.BY_PATTERN[pattern] || this.BY_PATTERN['core'];
  }
};

if (typeof window !== 'undefined') { window.ExerciseMetadata = ExerciseMetadata; }
