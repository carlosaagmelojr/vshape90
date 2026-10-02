/* V-SHAPE — dados dos programas
   Fonte única de verdade dos treinos. Alterar aqui muda o app inteiro.
   cadencia: "excentrica-pausa_alongado-concentrica-pausa_contraido" em segundos
   padrao:   puxar | empurrar | isometrico | outro  (define o rótulo da fase de esforço)
*/
window.TREINOS = {
  versao: "2.0.0",
  atualizado: "2026-10-02",

  cadencia: {
    notacao: "excêntrica · pausa alongado · concêntrica · pausa contraído",
    padrao: "3-1-1-0",
    regras: [
      { tipo: "Puxadas e remadas", cadencia: "3-1-1-1", nota: "a pausa de 1 s com o cotovelo junto ao corpo é o que faz o dorsal trabalhar em vez do bíceps" },
      { tipo: "Elevação lateral e crucifixo inverso", cadencia: "3-0-1-1", nota: "1 s no topo; a carga aqui é sempre menor do que o ego pede" },
      { tipo: "Multiarticulares pesados", cadencia: "2-1-1-0", nota: "descida controlada em 2 s; não vale cair" }
    ],
    respiracao: "Solte o ar na fase de esforço, puxe o ar na fase de retorno."
  },

  programas: {
    "ficha-v": {
      id: "ficha-v",
      nome: "Ficha V — Academia + CrossFit",
      resumo: "45 dias · academia de manhã/almoço + CrossFit à noite",
      duracao_dias: 45,
      tipo: "semanal",
      principio: "Não repetir na academia o que o CrossFit já faz. Perna pesada só no sábado.",
      // 0 = domingo … 6 = sábado
      semana: {
        1: {
          id: "seg", nome: "Dorsal largura + bíceps", foco: "costas",
          exercicios: [
            { nome: "Puxada aberta",        series: 4, min: 8,  max: 12, descanso: 90, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Pulldown braço reto",  series: 3, min: 12, max: 15, descanso: 60, cadencia: "3-0-1-1", padrao: "puxar" },
            { nome: "Remada unilateral",    series: 3, min: 10, max: 12, descanso: 75, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Rosca direta",         series: 3, min: 10, max: 10, descanso: 60, cadencia: "3-0-1-0", padrao: "puxar" }
          ]
        },
        2: {
          id: "ter", nome: "Ombro + peito superior", foco: "ombro",
          exercicios: [
            { nome: "Desenvolvimento halteres", series: 3, min: 8,  max: 10, descanso: 120, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Elevação lateral",         series: 5, min: 12, max: 20, descanso: 60,  cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Supino inclinado",         series: 3, min: 8,  max: 12, descanso: 120, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Crossover baixo→alto",     series: 3, min: 12, max: 15, descanso: 60,  cadencia: "3-0-1-1", padrao: "outro" }
          ]
        },
        3: {
          id: "qua", nome: "Costas espessura + deltoide posterior", foco: "costas",
          exercicios: [
            { nome: "Remada cavalinho",  series: 4, min: 8,  max: 12, descanso: 90, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Puxada neutra",     series: 3, min: 10, max: 12, descanso: 90, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Crucifixo inverso", series: 4, min: 15, max: 20, descanso: 60, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Face pull",         series: 3, min: 15, max: 15, descanso: 60, cadencia: "2-0-1-2", padrao: "puxar" }
          ]
        },
        4: {
          id: "qui", nome: "Ombro + braços", foco: "ombro",
          exercicios: [
            { nome: "Elevação lateral halteres", series: 5, min: 12, max: 20, descanso: 60, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Elevação lateral no cabo",  series: 3, min: 15, max: 15, descanso: 60, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Rosca Scott",               series: 3, min: 10, max: 12, descanso: 60, cadencia: "3-1-1-0", padrao: "puxar" },
            { nome: "Tríceps corda",             series: 3, min: 12, max: 12, descanso: 60, cadencia: "3-0-1-1", padrao: "empurrar" }
          ]
        },
        5: {
          id: "sex", nome: "V pump (leve)", foco: "ombro",
          nota: "Dia curto e de baixa carga. Você vem de quatro noites de CrossFit — aqui o objetivo é volume de qualidade, não intensidade.",
          exercicios: [
            { nome: "Puxada",            series: 3, min: 12, max: 12, descanso: 60, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Elevação lateral",  series: 4, min: 15, max: 20, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Crucifixo inverso", series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Pullover no cabo",  series: 3, min: 15, max: 15, descanso: 60, cadencia: "3-1-1-1", padrao: "puxar" }
          ]
        },
        6: {
          id: "sab", nome: "Pernas + core", foco: "perna",
          nota: "Sem CrossFit à noite — é o único dia em que perna pode ser pesada.",
          exercicios: [
            { nome: "Hack ou agachamento", series: 4, min: 8,  max: 12, descanso: 180, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Flexora",             series: 4, min: 10, max: 15, descanso: 75,  cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Búlgaro",             series: 3, min: 10, max: 10, descanso: 90,  cadencia: "3-1-1-0", padrao: "empurrar", nota: "por perna" },
            { nome: "Panturrilha",         series: 4, min: 15, max: 15, descanso: 45,  cadencia: "2-2-1-1", padrao: "empurrar" },
            { nome: "Prancha",             series: 3, duracao: 45,      descanso: 45,  cadencia: "isometrico", padrao: "isometrico" }
          ]
        },
        0: {
          id: "dom", nome: "Corrida 5 km", foco: "corrida", corrida: true,
          nota: "Ritmo confortável, em que você consiga conversar. Não é dia de buscar tempo.",
          exercicios: []
        }
      },
      ciclo: [
        { semanas: "1–2", academia: "Terminar com 2–3 reps sobrando", crossfit: "Intensidade moderada", objetivo: "Fixar cadência e adaptar ao volume" },
        { semanas: "3–4", academia: "Dupla progressão em todos os exercícios", crossfit: "Intensidade normal", objetivo: "Progressão de carga" },
        { semanas: "5",   academia: "~40% menos séries", crossfit: "Só 3 noites", objetivo: "Descarga, recuperar" },
        { semanas: "6",   academia: "Voltar a apertar, 1–2 reps sobrando", crossfit: "Intensidade normal", objetivo: "Fechar os 45 dias" }
      ]
    },

    "abcd": {
      id: "abcd",
      nome: "V-Shape Fase 1 — Base (ABCD)",
      resumo: "Programa prescrito · 30 dias · divisão ABCD",
      duracao_dias: 30,
      tipo: "rotativo",
      sequencia: ["A", "B", "C", "D"],
      padrao_sessao: {
        aquecimento: "20 min de bike",
        core: "3 × 30 s de prancha isométrica",
        finalizar: "10 min de escada, bike ou transport"
      },
      observacoes: [
        "A página de metodologia diz 3–4 × 8–12 com 60–90 s; as fichas dizem 3 × 15 com 45 s. São dois treinos diferentes.",
        "Treino B e Treino D compartilham 6 dos 8 exercícios — metade da semana é perna.",
        "Dorsal e deltoide recebem estímulo apenas 1× por semana cada."
      ],
      treinos: {
        A: {
          id: "A", nome: "Treino A — Dorsal e ombro", rotulo: "UPPER 1", foco: "costas",
          exercicios: [
            { nome: "Prancha isométrica",                  series: 3, duracao: 30,       descanso: 45, cadencia: "isometrico", padrao: "isometrico" },
            { nome: "Puxada aberta frente",                series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Remada aberta máquina",               series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Remada serrote",                      series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Desenvolvimento halteres",            series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Elevação lateral + crucifixo máquina", series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro", nota: "bi-set" },
            { nome: "Supino máquina",                      series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Abdominal remador",                   series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" }
          ]
        },
        B: {
          id: "B", nome: "Treino B — Pernas", rotulo: "LOWER 1", foco: "perna",
          exercicios: [
            { nome: "Prancha isométrica",                 series: 3, duracao: 30,       descanso: 45, cadencia: "isometrico", padrao: "isometrico" },
            { nome: "Cadeira extensora",                  series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Leg press 45 pés afastados",         series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Agachamento Smith ou leg horizontal", series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Cadeira flexora",                    series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Cadeira abdutora",                   series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" },
            { nome: "Cadeira adutora",                    series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" },
            { nome: "Extensão de coluna banco 45",        series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" }
          ]
        },
        C: {
          id: "C", nome: "Treino C — Peito e ombro", rotulo: "UPPER 2", foco: "peito",
          nota: "Três supinos antes do deltoide e do dorsal deixa o que você quer desenvolver para o fim, já cansado.",
          exercicios: [
            { nome: "Prancha isométrica",                     series: 3, duracao: 30,       descanso: 45, cadencia: "isometrico", padrao: "isometrico" },
            { nome: "Supino inclinado com halteres",          series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Supino máquina",                         series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Supino reto no smith",                   series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Desenvolvimento halteres",               series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-1-1-0", padrao: "empurrar" },
            { nome: "Elevação lateral + puxada frente supinada", series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro", nota: "bi-set" },
            { nome: "Remada máquina neutra",                  series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Abdominal remador",                      series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" }
          ]
        },
        D: {
          id: "D", nome: "Treino D — Pernas", rotulo: "UPPER 2", foco: "perna",
          nota: "Apesar do rótulo \"Upper 2\", este dia é inteiramente de pernas e repete 6 dos 8 exercícios do Treino B.",
          exercicios: [
            { nome: "Prancha isométrica",                 series: 3, duracao: 30,       descanso: 45, cadencia: "isometrico", padrao: "isometrico" },
            { nome: "Cadeira flexora",                    series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-1", padrao: "puxar" },
            { nome: "Elevação pélvica",                   series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-2", padrao: "empurrar" },
            { nome: "Agachamento Smith ou leg horizontal", series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-1-1-0", padrao: "empurrar" },
            { nome: "Cadeira extensora",                  series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" },
            { nome: "Cadeira abdutora",                   series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" },
            { nome: "Cadeira adutora",                    series: 3, min: 15, max: 15, descanso: 45, cadencia: "2-0-1-1", padrao: "outro" },
            { nome: "Extensão de coluna banco 45",        series: 3, min: 15, max: 15, descanso: 45, cadencia: "3-0-1-1", padrao: "outro" }
          ]
        }
      }
    }
  }
};
