# V-SHAPE

App pessoal de treino. HTML, CSS e JavaScript puros — sem build, sem dependências, sem servidor. Todos os dados ficam no aparelho (`localStorage`).

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `index.html` | Estrutura das cinco telas |
| `app.css` | Estilos |
| `app.js` | Toda a lógica |
| `treinos.js` | **Os treinos.** Fonte única de verdade — mexer aqui muda o app |
| `sw.js` | Service worker (funciona offline) |
| `manifest.json` | Instalação como app no celular |
| `assets/` | Ícones 192 e 512 px |
| `FICHA-V-SHAPE.md` | A ficha em texto, para ler ou imprimir |
| `treinos.json` | Cópia dos dados em JSON, só para referência — o app lê o `.js` |

Todos na **raiz** do repositório. Não vão em subpasta — a Vercel publica a raiz, e um arquivo numa subpasta dá 404.

## O que o app faz

**Guia de cadência.** Cada exercício traz sua cadência (`3-1-1-1`) e um guia visual que conta cada fase: puxando, segura, soltando, alongado. Com bipe e vibração na troca de fase, e a tela fica acesa enquanto roda. Começa pela fase concêntrica — a ordem real de execução — depois de 3 s de preparação.

**Dupla progressão.** Você anota carga e repetições de cada série. Quando bater o topo da faixa em todas as séries, o app avisa para subir a carga e voltar ao piso.

**Descanso.** Ao marcar uma série, o cronômetro do descanso daquele exercício dispara sozinho.

**Índice V.** Ombro ÷ cintura, com gráfico ao longo do tempo. É o número que mostra o formato V mudando — melhor que a balança.

**Dois programas.** A Ficha V (45 dias, por dia da semana) e o programa prescrito ABCD (30 dias, rotativo). Trocável em Mais.

**Fichas próprias.** Em Mais dá para copiar uma ficha pronta e editar a cópia, ou criar uma do zero. No editor você monta cada dia da semana: nome do treino e lista de exercícios, com séries, faixa de repetições (ou tempo, para isométricos), descanso, cadência e tipo de movimento. Dá para reordenar, editar e apagar. Dia sem exercício nenhum conta como descanso.

Na tela de treino há um botão para acrescentar exercício no treino do dia. Se a ficha ativa for uma das prontas, o app oferece criar uma cópia editável antes — as prontas nunca são alteradas.

**Backup.** Exportar e importar JSON em Mais. O arquivo leva tudo: registros, medidas, corridas e as fichas que você criou. Exporte de vez em quando — os dados vivem só neste aparelho.

## Publicar

Suba os arquivos na raiz do repositório. A Vercel faz o deploy sozinha.

**Toda vez que publicar, mude a versão do cache** na primeira linha do `sw.js`:

```js
var CACHE = 'vshape-v2.0.1';   // era v2.0.0
```

Sem isso o celular continua servindo a versão antiga. O `sw.js` usa rede primeiro e cache como reserva, então na prática a versão nova chega sozinha — mas a troca de versão garante.

Se ainda aparecer a versão velha: no computador, Ctrl+Shift+R. No celular, remova o app da tela inicial e adicione de novo.

## Mudar os treinos

Para mudanças do dia a dia, use o editor dentro do app (Mais → Minhas fichas). Mexer no código só é necessário para alterar as fichas **prontas**, que ficam em `treinos.js`. Um exercício é assim:

```js
{ nome: "Puxada aberta", series: 4, min: 8, max: 12, descanso: 90, cadencia: "3-1-1-1", padrao: "puxar" }
```

- `min` / `max` — faixa de repetições; iguais para repetição fixa
- `duracao` — em vez de min/max, para isométricos (prancha)
- `cadencia` — `"excêntrica-pausa alongado-concêntrica-pausa contraído"`, ou `"isometrico"`
- `padrao` — `puxar`, `empurrar`, `isometrico` ou `outro`; define o rótulo da fase de esforço no guia
