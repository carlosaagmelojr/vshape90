/* V-SHAPE — lógica do app
   Dados 100% locais (localStorage). Nenhuma requisição de rede.
*/
(function () {
  'use strict';

  var T = window.TREINOS;
  var CHAVE = 'vshape.v2';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ───────────── estado ───────────── */

  function hojeISO(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }

  function vazio() {
    return {
      versao: 2,
      inicio: hojeISO(),
      programa: 'ficha-v',
      som: true,
      fichas: {},    // fichas criadas por mim: id -> programa (mesmo formato dos prontos)
      trocas: {},    // "YYYY-MM-DD": chave do treino escolhido à mão, ou 'descanso'
      logs: {},      // "YYYY-MM-DD": { treino, exercicios:{nome:[{carga,reps}]}, feito }
      corridas: [],  // { data, km, min }
      medidas: [],   // { data, peso, cintura, ombro }
      checkins: {}   // "YYYY-MM-DD": "otimo"|"ok"|"cansado"|"dor"
    };
  }

  var S;
  try {
    S = JSON.parse(localStorage.getItem(CHAVE)) || vazio();
  } catch (e) {
    S = vazio();
  }
  // garante campos novos em bases antigas
  var base = vazio();
  for (var k in base) if (!(k in S)) S[k] = base[k];

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(S)); }
    catch (e) { toast('Não consegui salvar — armazenamento cheio?'); }
  }

  /* ───────────── utilidades ───────────── */

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function fmt(n, casas) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return n.toFixed(casas === undefined ? 1 : casas).replace('.', ',');
  }

  function dataCurta(iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1];
  }

  function diasEntre(a, b) {
    var d1 = new Date(a + 'T00:00:00');
    var d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }

  /* fichas prontas + minhas fichas, num mapa só */
  function todasFichas() {
    var m = {};
    for (var a in T.programas) m[a] = T.programas[a];
    for (var b in S.fichas) m[b] = S.fichas[b];
    return m;
  }
  function minhaFicha(id) { return !!S.fichas[id]; }
  function programa() { return todasFichas()[S.programa] || T.programas['ficha-v']; }

  function diaDoPlano() {
    return Math.max(1, Math.min(programa().duracao_dias, diasEntre(S.inicio, hojeISO()) + 1));
  }

  /* um treino da ficha, pela sua chave (dia da semana "0".."6", ou letra "A".."D") */
  function blocoPorChave(p, k) {
    if (k === null || k === undefined || k === 'descanso') return null;
    if (p.tipo === 'semanal') return p.semana[k] || null;
    return (p.treinos && p.treinos[k]) || null;
  }

  /* o que estava previsto, sem contar trocas manuais */
  function chavePadrao(p, iso) {
    if (p.tipo === 'semanal') return String(new Date(iso + 'T00:00:00').getDay());
    // rotativo: avança pelos treinos CONCLUÍDOS, não pelo calendário.
    // Assim pular um dia não embaralha a sequência.
    var feitos = 0;
    for (var d in S.logs) if (d < iso && S.logs[d].feito) feitos++;
    return p.sequencia[feitos % p.sequencia.length];
  }

  /* o que vale para a data: troca manual > o que já foi registrado > previsto */
  function chaveDe(p, iso) {
    if (S.trocas[iso] !== undefined) return S.trocas[iso];
    var log = S.logs[iso];
    if (log && log.chave !== undefined && blocoPorChave(p, log.chave)) return log.chave;
    return chavePadrao(p, iso);
  }

  function trocado(iso) { return S.trocas[iso] !== undefined; }

  /* treino de uma data — null quando é descanso */
  function treinoDe(iso) {
    var p = programa();
    var t = blocoPorChave(p, chaveDe(p, iso));
    if (!t) return null;
    // dia sem exercício nenhum conta como descanso (a não ser que seja dia de corrida)
    if (!t.corrida && (!t.exercicios || !t.exercicios.length)) return null;
    return t;
  }

  function slug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  }

  function logDe(iso) {
    if (!S.logs[iso]) S.logs[iso] = { treino: '', exercicios: {}, feito: false };
    return S.logs[iso];
  }

  /* ───────────── navegação ───────────── */

  var atual = 'hoje';
  function ir(nome) {
    atual = nome;
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + nome); });
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.go === nome); });
    window.scrollTo(0, 0);
    render();
  }
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { ir(b.dataset.go); });
  });

  /* ───────────── render ───────────── */

  function render() {
    renderTopo();
    if (atual === 'hoje') renderHoje();
    if (atual === 'treino') renderTreino();
    if (atual === 'corrida') renderCorrida();
    if (atual === 'evolucao') renderEvolucao();
    if (atual === 'mais') renderMais();
    if (atual === 'ficha') renderFicha();
    if (atual === 'dia') renderDia();
  }

  function renderTopo() {
    var p = programa(), d = diaDoPlano();
    $('#topDia').textContent = 'dia ' + d + ' / ' + p.duracao_dias;
    $('#topBar').style.width = (d / p.duracao_dias * 100) + '%';
  }

  function ultimaMedida() {
    return S.medidas.length ? S.medidas[S.medidas.length - 1] : null;
  }

  function indiceV(m) {
    if (!m || !m.ombro || !m.cintura) return null;
    return m.ombro / m.cintura;
  }

  function renderHoje() {
    var iso = hojeISO();
    var dt = new Date(iso + 'T00:00:00');
    var dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    $('#hojeData').textContent = dias[dt.getDay()] + ', ' + dataCurta(iso);

    // índice V
    var m = ultimaMedida(), iv = indiceV(m);
    $('#vIndice').textContent = iv ? fmt(iv, 2) : '—';
    if (iv) {
      var primeira = null;
      for (var i = 0; i < S.medidas.length; i++) {
        var x = indiceV(S.medidas[i]);
        if (x) { primeira = x; break; }
      }
      var dif = primeira ? iv - primeira : 0;
      $('#vIndiceHint').textContent = (S.medidas.length < 2 || Math.abs(dif) < 0.005)
        ? 'Primeira marca registrada. É este número que mostra o V mudando.'
        : (dif > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(dif), 2) + ' desde o começo';
    } else {
      $('#vIndiceHint').textContent = 'Registre ombro e cintura em Evolução.';
    }

    // stats
    $('#stPeso').textContent = m && m.peso ? fmt(m.peso, 1) : '—';
    $('#stPesoSub').textContent = m && m.peso ? dataCurta(m.data) : 'sem registro';

    var lim = hojeISO(new Date(Date.now() - 6 * 86400000));
    var nt = 0;
    for (var d in S.logs) if (d >= lim && S.logs[d].feito) nt++;
    $('#stTreinos').textContent = nt;

    var km = 0;
    S.corridas.forEach(function (c) { if (c.data >= lim) km += c.km; });
    $('#stKm').textContent = fmt(km, 1);

    var sem = Math.floor((diaDoPlano() - 1) / 7) + 1;
    $('#stSemana').textContent = sem;
    var p = programa();
    var fase = '—';
    if (p.ciclo) {
      if (sem <= 2) fase = 'base';
      else if (sem <= 4) fase = 'carga';
      else if (sem === 5) fase = 'descarga';
      else fase = 'pico';
    }
    $('#stFase').textContent = fase;

    // treino de hoje
    var tr = treinoDe(iso);
    var log = S.logs[iso];
    var pulado = S.trocas[iso] === 'descanso';
    if (!tr) {
      $('#hojeTreino').textContent = pulado ? 'Dia pulado' : 'Descanso';
      $('#hojeNota').textContent = pulado
        ? 'Você marcou hoje como descanso. Dá para escolher outro treino abaixo.'
        : 'Nada previsto para hoje nesta ficha.';
      $('#btnIniciar').hidden = true;
    } else {
      $('#hojeTreino').textContent = tr.nome;
      $('#hojeNota').textContent = (trocado(iso) ? 'Trocado por você. ' : '') + (tr.nota || '');
      $('#btnIniciar').hidden = false;
      $('#btnIniciar').textContent = (log && log.feito) ? 'Treino concluído ✓ — rever'
        : (log && Object.keys(log.exercicios).length) ? 'Continuar treino' : 'Iniciar treino';
    }

    // corrida
    var corridaHoje = tr && tr.corrida;
    $('#corridaTitulo').textContent = corridaHoje ? 'Corrida de hoje — 5 km' : 'Registrar corrida';

    // check-in
    var ci = S.checkins[iso];
    $$('#checkinChips .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.ci === ci); });
    $('#checkinMsg').textContent = ci ? 'Registrado hoje.' : 'Como você acordou hoje?';
  }

  /* ───────────── treino ───────────── */

  var trData = null; // { iso, treino }

  function abrirTreino(iso) {
    var tr = treinoDe(iso);
    if (!tr) { toast('Hoje é descanso.'); return; }
    trData = { iso: iso, treino: tr };
    ir('treino');
  }

  /* sugestão de dupla progressão: olha a última sessão deste exercício */
  function sugestao(ex) {
    var datas = Object.keys(S.logs).sort().reverse();
    for (var i = 0; i < datas.length; i++) {
      if (datas[i] >= hojeISO()) continue;
      var sets = S.logs[datas[i]].exercicios[slug(ex.nome)];
      if (!sets || !sets.length) continue;
      var cargas = sets.map(function (s) { return s.carga; }).filter(function (c) { return c; });
      if (!cargas.length) return null;
      var carga = Math.max.apply(null, cargas);
      if (ex.duracao) return { texto: 'Última vez: ' + carga + ' kg' };
      var todasNoTopo = sets.length >= ex.series && sets.every(function (s) { return s.reps >= ex.max; });
      if (todasNoTopo) {
        return { texto: 'Bateu ' + ex.max + ' em todas as séries com ' + carga + ' kg. Sobe a carga e volta para ' + ex.min + '.', subir: true };
      }
      return { texto: 'Última vez: ' + carga + ' kg · ' + sets.map(function (s) { return s.reps; }).join('/') + ' reps' };
    }
    return null;
  }

  function renderTreino() {
    var iso = hojeISO();
    if (!trData || trData.iso !== iso) {
      var tr = treinoDe(iso);
      trData = tr ? { iso: iso, treino: tr } : null;
    }
    var box = $('#trLista');
    if (!trData) {
      $('#trNome').textContent = S.trocas[iso] === 'descanso' ? 'Dia pulado' : 'Descanso';
      $('#trEyebrow').textContent = programa().nome;
      $('#trNota').textContent = 'Use "Trocar treino" para escolher outro.';
      box.innerHTML = '';
      $('#btnConcluir').hidden = true;
      return;
    }
    var t = trData.treino;
    $('#trEyebrow').textContent = programa().nome + (trocado(iso) ? ' · trocado' : '');
    $('#trNome').textContent = t.nome;
    $('#trNota').textContent = t.nota || '';
    $('#btnConcluir').hidden = false;

    var log = logDe(iso);
    log.treino = t.id;
    log.chave = chaveDe(programa(), iso);

    if (!t.exercicios.length) {
      box.innerHTML = '<p class="empty">Dia de corrida — registre na aba Corrida.</p>';
      return;
    }

    box.innerHTML = '';
    t.exercicios.forEach(function (ex, idx) {
      var id = slug(ex.nome);
      var sets = log.exercicios[id] || [];
      var feitas = sets.filter(function (s) { return s.ok; }).length;
      var alvo = ex.duracao ? (ex.duracao + ' s') : (ex.min === ex.max ? ex.min : ex.min + '–' + ex.max);

      var el = document.createElement('div');
      el.className = 'ex' + (feitas >= ex.series ? ' done' : '');
      el.innerHTML =
        '<div class="exhead">' +
          '<div class="exnum">' + (feitas >= ex.series ? '✓' : (idx + 1)) + '</div>' +
          '<div class="exinfo"><b></b><small>' + ex.series + ' × ' + alvo +
            ' · descanso ' + ex.descanso + ' s' + (ex.nota ? ' · ' + ex.nota : '') + '</small></div>' +
          '<div class="cadtag">' + (ex.cadencia === 'isometrico' ? 'ISO' : ex.cadencia) + '</div>' +
        '</div>' +
        '<div class="exbody"></div>';
      el.querySelector('.exinfo b').textContent = ex.nome;

      var body = el.querySelector('.exbody');

      var sug = sugestao(ex);
      if (sug) {
        var p = document.createElement('p');
        p.className = sug.subir ? 'prog' : 'muted sm';
        p.style.marginTop = '12px';
        p.textContent = sug.texto;
        body.appendChild(p);
      }

      for (var i = 0; i < ex.series; i++) {
        (function (i) {
          var s = sets[i] || { carga: '', reps: '', ok: false };
          var row = document.createElement('div');
          row.className = 'serie';
          row.innerHTML =
            '<span>' + (i + 1) + '</span>' +
            '<input type="number" inputmode="decimal" placeholder="kg">' +
            '<input type="number" inputmode="numeric" placeholder="' + (ex.duracao ? 'seg' : 'reps') + '">' +
            '<button class="ok' + (s.ok ? ' on' : '') + '">✓</button>';
          var iC = row.children[1], iR = row.children[2], bOk = row.children[3];
          iC.value = s.carga === '' ? '' : s.carga;
          iR.value = s.reps === '' ? '' : s.reps;

          function grava(marcando) {
            var arr = log.exercicios[id] || [];
            while (arr.length < ex.series) arr.push({ carga: '', reps: '', ok: false });
            arr[i] = {
              carga: num(iC.value),
              reps: num(iR.value) !== null ? num(iR.value) : (ex.duracao || ex.min),
              ok: marcando !== undefined ? marcando : arr[i].ok
            };
            log.exercicios[id] = arr;
            salvar();
          }

          iC.addEventListener('change', function () { grava(); });
          iR.addEventListener('change', function () { grava(); });

          bOk.addEventListener('click', function () {
            var lig = !bOk.classList.contains('on');
            bOk.classList.toggle('on', lig);
            if (lig && !iR.value) iR.value = ex.duracao || ex.min;
            grava(lig);
            if (lig) {
              iniciarDescanso(ex.descanso, ex.nome + ' · série ' + (i + 1));
              renderTreinoCabecalhos();
            }
          });

          body.appendChild(row);
        })(i);
      }

      var acts = document.createElement('div');
      acts.className = 'exacts';
      var bCad = document.createElement('button');
      bCad.className = 'btn primary';
      bCad.textContent = ex.cadencia === 'isometrico' ? 'Cronômetro' : 'Guia de cadência';
      bCad.addEventListener('click', function (e) { e.stopPropagation(); abrirCadencia(ex); });
      acts.appendChild(bCad);
      body.appendChild(acts);

      el.querySelector('.exhead').addEventListener('click', function () { el.classList.toggle('open'); });
      box.appendChild(el);
    });

    // adicionar exercício direto daqui
    var bAdd = document.createElement('button');
    bAdd.className = 'btn ghost';
    bAdd.textContent = '+ Adicionar exercício a este treino';
    bAdd.addEventListener('click', function () { adicionarNoTreinoDeHoje(); });
    box.appendChild(bAdd);
  }

  /* Adicionar exercício ao treino de hoje.
     Se a ficha for pronta (não editável), copia antes — a cópia vira a ficha ativa. */
  function adicionarNoTreinoDeHoje() {
    if (!trData) return;
    if (!minhaFicha(S.programa)) {
      if (!confirm('As fichas prontas não podem ser alteradas.\n\nCriar uma cópia editável desta ficha e continuar?')) return;
      var novoId = duplicarFicha(S.programa);
      S.programa = novoId;
      salvar();
      trData = null;
      renderTreino();
      toast('Cópia criada. Agora dá para editar.');
    }
    var p = programa();
    var chave = chaveDoTreinoDeHoje(p);
    if (chave === null) { toast('Não achei o treino de hoje nesta ficha.'); return; }
    abrirFormEx(p.id, chave, -1, function () {
      trData = null;
      renderTreino();
    });
  }

  /* onde fica, dentro da ficha, o treino de hoje */
  function chaveDoTreinoDeHoje(p) {
    var k = chaveDe(p, hojeISO());
    return (k === 'descanso' || !blocoPorChave(p, k)) ? chavePadrao(p, hojeISO()) : k;
  }

  /* ───────────── trocar / pular treino ───────────── */

  function abrirPicker() {
    var p = programa(), iso = hojeISO();
    var atualK = chaveDe(p, iso);
    var box = $('#pkLista');
    box.innerHTML = '';

    blocos(p).forEach(function (b) {
      var t = b.treino;
      var n = (t && t.exercicios) ? t.exercicios.length : 0;
      var ehCorrida = t && t.corrida;
      if (!n && !ehCorrida) return;                      // dia vazio não entra na lista
      var el = document.createElement('div');
      el.className = 'item clic' + (b.chave === atualK ? ' sel' : '');
      el.innerHTML = '<div style="flex:1;min-width:0"><b></b><small>' + b.rotulo + ' · ' +
        (ehCorrida ? 'corrida' : n + (n === 1 ? ' exercício' : ' exercícios')) + '</small></div>' +
        (b.chave === atualK ? '<span class="muted">hoje</span>' : '');
      el.querySelector('b').textContent = (t && t.nome) || b.rotulo;
      el.addEventListener('click', function () { escolherTreino(b.chave); });
      box.appendChild(el);
    });

    if (!box.children.length) box.innerHTML = '<p class="empty">Esta ficha ainda não tem treinos montados.</p>';

    $('#pkDica').textContent = p.tipo === 'semanal'
      ? 'Escolha qualquer treino desta ficha para fazer hoje.'
      : 'Escolha qualquer treino da ficha. A rotação segue a partir do que você concluir.';
    $('#pkVoltar').hidden = !trocado(iso);
    $('#ovPick').hidden = false;
  }

  function fecharPicker() { $('#ovPick').hidden = true; }

  function escolherTreino(chave) {
    var iso = hojeISO();
    S.trocas[iso] = chave;
    if (S.logs[iso]) S.logs[iso].chave = chave;
    salvar();
    trData = null;
    fecharPicker();
    toast(chave === 'descanso' ? 'Dia marcado como descanso.' : 'Treino trocado.');
    render();
  }

  $$('[data-trocar]').forEach(function (b) { b.addEventListener('click', abrirPicker); });
  $('#pkFechar').addEventListener('click', fecharPicker);
  $('#ovPick').addEventListener('click', function (e) { if (e.target === $('#ovPick')) fecharPicker(); });
  $('#pkDescanso').addEventListener('click', function () { escolherTreino('descanso'); });
  $('#pkVoltar').addEventListener('click', function () {
    var iso = hojeISO();
    delete S.trocas[iso];
    if (S.logs[iso]) delete S.logs[iso].chave;
    salvar();
    trData = null;
    fecharPicker();
    toast('Voltou ao treino previsto.');
    render();
  });

  /* atualiza só os ✓ e as bordas, sem fechar o que está aberto */
  function renderTreinoCabecalhos() {
    if (!trData) return;
    var log = logDe(trData.iso);
    $$('#trLista .ex').forEach(function (el, idx) {
      var ex = trData.treino.exercicios[idx];
      if (!ex) return;
      var sets = log.exercicios[slug(ex.nome)] || [];
      var feitas = sets.filter(function (s) { return s.ok; }).length;
      el.classList.toggle('done', feitas >= ex.series);
      el.querySelector('.exnum').textContent = feitas >= ex.series ? '✓' : (idx + 1);
    });
  }

  $('#btnIniciar').addEventListener('click', function () { abrirTreino(hojeISO()); });

  $('#btnConcluir').addEventListener('click', function () {
    if (!trData) return;
    var log = logDe(trData.iso);
    log.feito = true;
    salvar();
    toast('Treino concluído.');
    ir('hoje');
  });

  /* ───────────── cadência ───────────── */

  var cad = { ex: null, fases: [], i: 0, t0: 0, reps: 0, raf: 0, rodando: false, prep: false };
  var ctx = null, wake = null;

  function beep(hz, ms) {
    if (!S.som) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hz; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02);
    } catch (e) { /* sem áudio, segue */ }
  }

  function vibra(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* monta as fases na ordem REAL de execução:
     concêntrica → pausa contraído → excêntrica → pausa alongado */
  function montarFases(ex) {
    if (ex.cadencia === 'isometrico') {
      return [{ nome: 'SEGURA', seg: ex.duracao || 30, cls: 'fase-pt', hz: 520 }];
    }
    var n = ex.cadencia.split('-').map(Number); // [exc, pausa_along, conc, pausa_contr]
    var rotuloConc = ex.padrao === 'puxar' ? 'PUXANDO' : (ex.padrao === 'empurrar' ? 'EMPURRANDO' : 'SUBINDO');
    var f = [
      { nome: rotuloConc, seg: n[2], cls: 'fase-con', hz: 880 },
      { nome: 'SEGURA',   seg: n[3], cls: 'fase-pt',  hz: 660 },
      { nome: 'SOLTANDO', seg: n[0], cls: 'fase-exc', hz: 440 },
      { nome: 'ALONGADO', seg: n[1], cls: 'fase-pb',  hz: 550 }
    ];
    return f.filter(function (x) { return x.seg > 0; });
  }

  function abrirCadencia(ex) {
    cad.ex = ex;
    cad.fases = montarFases(ex);
    cad.i = 0; cad.reps = 0; cad.rodando = false; cad.prep = false;
    $('#cadEx').textContent = ex.nome;
    $('#cadAlvo').textContent = ex.duracao ? '1' : (ex.min === ex.max ? ex.min : ex.min + '–' + ex.max);
    $('#cadReps').textContent = '0';
    $('#cadFase').textContent = 'Pronto';
    $('#cadSeg').textContent = '—';
    $('#cadPadrao').textContent = ex.cadencia === 'isometrico'
      ? 'Segure ' + (ex.duracao || 30) + ' s, respirando.'
      : 'Cadência ' + ex.cadencia + ' — ' + cad.fases.map(function (f) { return f.nome.toLowerCase() + ' ' + f.seg + 's'; }).join(' · ');
    $('#cadPlay').textContent = 'Começar';
    $('#cadSom').textContent = 'Som: ' + (S.som ? 'ligado' : 'desligado');
    $('.cad').className = 'cad';
    setArco(0);
    $('#ovCad').hidden = false;
  }

  function setArco(frac) {
    var C = 326.7;
    $('#cadArc').style.strokeDashoffset = String(C - C * Math.max(0, Math.min(1, frac)));
  }

  function fecharCadencia() {
    pararCadencia();
    $('#ovCad').hidden = true;
  }

  function pararCadencia() {
    cad.rodando = false;
    cancelAnimationFrame(cad.raf);
    $('#cadPlay').textContent = 'Começar';
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
  }

  function tocarCadencia() {
    if (cad.rodando) { pararCadencia(); return; }
    cad.rodando = true;
    cad.prep = true;
    cad.i = 0;
    cad.t0 = performance.now();
    $('#cadPlay').textContent = 'Parar';
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
    }
    loop();
  }

  function loop() {
    if (!cad.rodando) return;
    var agora = performance.now();

    if (cad.prep) {
      var restaP = 3 - (agora - cad.t0) / 1000;
      if (restaP <= 0) {
        cad.prep = false;
        cad.t0 = agora;
        entrarFase();
      } else {
        $('.cad').className = 'cad';
        $('#cadFase').textContent = 'Prepare';
        $('#cadSeg').textContent = Math.ceil(restaP);
        setArco(1 - restaP / 3);
      }
      cad.raf = requestAnimationFrame(loop);
      return;
    }

    var f = cad.fases[cad.i];
    var passou = (agora - cad.t0) / 1000;
    var resta = f.seg - passou;

    if (resta <= 0) {
      cad.i++;
      if (cad.i >= cad.fases.length) {
        cad.i = 0;
        cad.reps++;
        $('#cadReps').textContent = cad.reps;
        if (cad.ex.duracao) { // isométrico: uma "rep" encerra
          pararCadencia();
          $('#cadFase').textContent = 'Fim';
          $('#cadSeg').textContent = '✓';
          beep(980, 400); vibra([80, 60, 80]);
          return;
        }
        var teto = cad.ex.max;
        if (teto && cad.reps >= teto) {
          pararCadencia();
          $('#cadFase').textContent = 'Série completa';
          $('#cadSeg').textContent = '✓';
          beep(980, 400); vibra([80, 60, 80]);
          return;
        }
      }
      cad.t0 = agora;
      entrarFase();
      cad.raf = requestAnimationFrame(loop);
      return;
    }

    $('#cadSeg').textContent = Math.ceil(resta);
    setArco(passou / f.seg);
    cad.raf = requestAnimationFrame(loop);
  }

  function entrarFase() {
    var f = cad.fases[cad.i];
    $('.cad').className = 'cad ' + f.cls;
    $('#cadFase').textContent = f.nome;
    $('#cadSeg').textContent = f.seg;
    setArco(0);
    beep(f.hz, 90);
    vibra(35);
  }

  $('#cadPlay').addEventListener('click', tocarCadencia);
  $('#cadFechar').addEventListener('click', fecharCadencia);
  $('#cadSom').addEventListener('click', function () {
    S.som = !S.som; salvar();
    $('#cadSom').textContent = 'Som: ' + (S.som ? 'ligado' : 'desligado');
    if (S.som) beep(880, 90);
  });
  $('#ovCad').addEventListener('click', function (e) { if (e.target === $('#ovCad')) fecharCadencia(); });

  /* ───────────── descanso ───────────── */

  var rest = { fim: 0, raf: 0, total: 0 };

  function iniciarDescanso(seg, rotulo) {
    rest.total = seg;
    rest.fim = performance.now() + seg * 1000;
    $('#restBar').hidden = false;
    $('#restTxt').textContent = rotulo || 'Descanso';
    cancelAnimationFrame(rest.raf);
    tickDescanso();
  }

  function tickDescanso() {
    var resta = (rest.fim - performance.now()) / 1000;
    if (resta <= 0) {
      $('#restBar').hidden = true;
      beep(980, 300); vibra([100, 70, 100]);
      toast('Descanso acabou.');
      return;
    }
    $('#restFill').style.width = (resta / rest.total * 100) + '%';
    $('#restTxt').textContent = Math.ceil(resta) + ' s de descanso';
    rest.raf = requestAnimationFrame(tickDescanso);
  }

  $('#restMais').addEventListener('click', function () { rest.fim += 15000; rest.total += 15; });
  $('#restPular').addEventListener('click', function () {
    cancelAnimationFrame(rest.raf);
    $('#restBar').hidden = true;
  });

  /* ───────────── corrida ───────────── */

  function pace(km, min) {
    if (!km || !min) return '—';
    var p = min / km;
    var m = Math.floor(p), s = Math.round((p - m) * 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + String(s).padStart(2, '0') + ' /km';
  }

  function atualizaPace() {
    $('#paceCalc').textContent = 'Ritmo: ' + pace(num($('#inKm').value), num($('#inMin').value));
  }
  $('#inKm').addEventListener('input', atualizaPace);
  $('#inMin').addEventListener('input', atualizaPace);

  $('#btnSalvarCorrida').addEventListener('click', function () {
    var km = num($('#inKm').value), min = num($('#inMin').value);
    if (!km) { toast('Informe a distância.'); return; }
    S.corridas.push({ data: hojeISO(), km: km, min: min || 0 });
    S.corridas.sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    salvar();
    $('#inKm').value = ''; $('#inMin').value = '';
    atualizaPace();
    toast('Corrida salva.');
    renderCorrida();
  });

  function renderCorrida() {
    var box = $('#listaCorridas');
    if (!S.corridas.length) { box.innerHTML = '<p class="empty">Nenhuma corrida registrada.</p>'; return; }
    box.innerHTML = '';
    S.corridas.forEach(function (c, i) {
      var el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = '<div><b>' + fmt(c.km, 1) + ' km</b><small>' + dataCurta(c.data) +
        (c.min ? ' · ' + c.min + ' min · ' + pace(c.km, c.min) : '') + '</small></div>' +
        '<button class="del" aria-label="Apagar">✕</button>';
      el.querySelector('.del').addEventListener('click', function () {
        S.corridas.splice(i, 1); salvar(); renderCorrida(); renderHoje();
      });
      box.appendChild(el);
    });
  }

  /* ───────────── evolução ───────────── */

  $('#btnSalvarMedida').addEventListener('click', function () {
    var peso = num($('#inPeso').value),
        cint = num($('#inCintura').value),
        omb = num($('#inOmbro').value);
    if (peso === null && cint === null && omb === null) { toast('Preencha pelo menos um campo.'); return; }
    var iso = hojeISO();
    var existente = null;
    for (var i = 0; i < S.medidas.length; i++) if (S.medidas[i].data === iso) existente = S.medidas[i];
    if (existente) {
      if (peso !== null) existente.peso = peso;
      if (cint !== null) existente.cintura = cint;
      if (omb !== null) existente.ombro = omb;
    } else {
      S.medidas.push({ data: iso, peso: peso, cintura: cint, ombro: omb });
    }
    S.medidas.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    salvar();
    $('#inPeso').value = ''; $('#inCintura').value = ''; $('#inOmbro').value = '';
    toast('Medidas salvas.');
    renderEvolucao();
  });

  function renderEvolucao() {
    // gráfico do índice V
    var pts = S.medidas.map(function (m) { return { data: m.data, v: indiceV(m) }; })
                       .filter(function (p) { return p.v; });
    var chart = $('#chart'), msg = $('#chartMsg');
    if (pts.length < 2) {
      chart.innerHTML = '';
      msg.hidden = false;
    } else {
      msg.hidden = true;
      var W = 320, H = 150, pad = 26;
      var vs = pts.map(function (p) { return p.v; });
      var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
      if (max - min < 0.02) { min -= 0.02; max += 0.02; }
      var x = function (i) { return pad + i * (W - pad * 2) / (pts.length - 1); };
      var y = function (v) { return H - pad - (v - min) / (max - min) * (H - pad * 2); };
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
      var area = d + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z';
      var circulos = pts.map(function (p, i) {
        return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="3.5" fill="#C9F24D"/>';
      }).join('');
      chart.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Índice V ao longo do tempo">' +
          '<path d="' + area + '" fill="rgba(201,242,77,.10)"/>' +
          '<path d="' + d + '" fill="none" stroke="#C9F24D" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
          circulos +
          '<text x="' + pad + '" y="' + (H - 7) + '" fill="#7E9A83" font-size="10">' + dataCurta(pts[0].data) + '</text>' +
          '<text x="' + (W - pad) + '" y="' + (H - 7) + '" fill="#7E9A83" font-size="10" text-anchor="end">' + dataCurta(pts[pts.length - 1].data) + '</text>' +
          '<text x="' + pad + '" y="14" fill="#7E9A83" font-size="10">' + fmt(max, 2) + '</text>' +
        '</svg>';
    }

    // histórico
    var box = $('#listaMedidas');
    if (!S.medidas.length) { box.innerHTML = '<p class="empty">Nenhuma medida registrada.</p>'; return; }
    box.innerHTML = '';
    S.medidas.slice().reverse().forEach(function (m) {
      var iv = indiceV(m);
      var partes = [];
      if (m.peso) partes.push(fmt(m.peso, 1) + ' kg');
      if (m.cintura) partes.push('cintura ' + fmt(m.cintura, 1));
      if (m.ombro) partes.push('ombro ' + fmt(m.ombro, 1));
      var el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = '<div><b>' + (iv ? 'Índice V ' + fmt(iv, 2) : dataCurta(m.data)) + '</b><small>' +
        (iv ? dataCurta(m.data) + ' · ' : '') + partes.join(' · ') + '</small></div>' +
        '<button class="del" aria-label="Apagar">✕</button>';
      el.querySelector('.del').addEventListener('click', function () {
        var i = S.medidas.indexOf(m);
        if (i > -1) S.medidas.splice(i, 1);
        salvar(); renderEvolucao();
      });
      box.appendChild(el);
    });
  }

  /* ───────────── editor de fichas ───────────── */

  var DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

  var CADENCIAS = [
    { v: '3-1-1-1', d: 'Puxadas e remadas — pausa de 1 s com o cotovelo junto ao corpo' },
    { v: '3-0-1-1', d: 'Elevação lateral e crucifixo — 1 s segurando no topo' },
    { v: '2-1-1-0', d: 'Multiarticular pesado — descida controlada em 2 s' },
    { v: '3-1-1-0', d: 'Padrão — solta em 3, segura 1 embaixo, sobe em 1' },
    { v: '2-0-1-2', d: 'Face pull, elevação pélvica — 2 s de contração no fim' },
    { v: '3-0-1-0', d: 'Simples — solta em 3, sobe em 1, sem pausas' }
  ];

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function novoId() {
    var id;
    do { id = 'minha-' + Math.random().toString(36).slice(2, 8); } while (todasFichas()[id]);
    return id;
  }

  function duplicarFicha(id) {
    var p = clonar(todasFichas()[id]);
    var novo = novoId();
    p.id = novo;
    p.nome = (p.nome.length > 28 ? p.nome.slice(0, 28) + '…' : p.nome) + ' (minha)';
    p.resumo = 'Minha ficha, copiada de ' + (todasFichas()[id].nome);
    S.fichas[novo] = p;
    salvar();
    return novo;
  }

  function criarFichaVazia() {
    var id = novoId();
    var semana = {};
    ORDEM_SEMANA.forEach(function (d) {
      semana[d] = { id: 'd' + d, nome: '', foco: '', exercicios: [] };
    });
    S.fichas[id] = {
      id: id,
      nome: 'Minha ficha',
      resumo: 'Ficha criada por mim',
      duracao_dias: 45,
      tipo: 'semanal',
      semana: semana
    };
    salvar();
    return id;
  }

  /* lista de blocos (dias ou treinos) de uma ficha */
  function blocos(p) {
    if (p.tipo === 'semanal') {
      return ORDEM_SEMANA.map(function (d) {
        return { chave: String(d), rotulo: DIAS_NOME[d], treino: p.semana[d] };
      });
    }
    return p.sequencia.map(function (k) {
      return { chave: k, rotulo: 'Treino ' + k, treino: p.treinos[k] };
    });
  }

  function trDe(p, chave) {
    return p.tipo === 'semanal' ? p.semana[chave] : p.treinos[chave];
  }

  var edit = { ficha: null, chave: null };

  function abrirFicha(id) {
    edit.ficha = id;
    ir('ficha');
  }

  function renderFicha() {
    var p = S.fichas[edit.ficha];
    if (!p) { ir('mais'); return; }

    $('#fiNome').value = p.nome;
    $('#fiTipo').textContent = p.tipo === 'semanal'
      ? 'Por dia da semana. Toque num dia para montar o treino.'
      : 'Rotativa: os treinos se alternam na ordem abaixo, um por dia.';
    $('#fiAddTreino').hidden = p.tipo !== 'rotativo';

    var box = $('#fiBlocos');
    box.innerHTML = '';
    blocos(p).forEach(function (b) {
      var t = b.treino, n = (t && t.exercicios) ? t.exercicios.length : 0;
      var el = document.createElement('div');
      el.className = 'item clic' + (n ? '' : ' vazio');
      var titulo = (t && t.nome) ? t.nome : (n ? '(sem nome)' : 'Descanso');
      el.innerHTML = '<div><b></b><small>' + b.rotulo + ' · ' +
        (n ? n + (n === 1 ? ' exercício' : ' exercícios') : 'nenhum exercício') + '</small></div><span class="muted">›</span>';
      el.querySelector('b').textContent = titulo;
      el.addEventListener('click', function () { edit.chave = b.chave; ir('dia'); });
      box.appendChild(el);
    });
  }

  $('#fiNome').addEventListener('change', function () {
    var p = S.fichas[edit.ficha];
    if (!p) return;
    p.nome = $('#fiNome').value.trim() || 'Minha ficha';
    salvar();
    renderTopo();
  });

  $('#fiAddTreino').addEventListener('click', function () {
    var p = S.fichas[edit.ficha];
    if (!p || p.tipo !== 'rotativo') return;
    var letras = 'ABCDEFGH'.split('');
    var nova = letras.find(function (l) { return p.sequencia.indexOf(l) < 0; });
    if (!nova) { toast('Limite de 8 treinos.'); return; }
    p.sequencia.push(nova);
    p.treinos[nova] = { id: nova, nome: 'Treino ' + nova, foco: '', exercicios: [] };
    salvar();
    renderFicha();
  });

  $('#fiUsar').addEventListener('click', function () {
    S.programa = edit.ficha;
    salvar();
    trData = null;
    toast('Ficha ativada.');
    ir('hoje');
  });

  $('#fiVoltar').addEventListener('click', function () { ir('mais'); });

  /* ── editor de um treino ── */

  function renderDia() {
    var p = S.fichas[edit.ficha];
    if (!p) { ir('mais'); return; }
    var t = trDe(p, edit.chave);
    if (!t) { ir('ficha'); return; }

    var rotulo = p.tipo === 'semanal' ? DIAS_NOME[Number(edit.chave)] : 'Treino ' + edit.chave;
    $('#diEyebrow').textContent = p.nome + ' · ' + rotulo;
    $('#diNome').value = t.nome || '';

    var box = $('#diLista');
    box.innerHTML = '';
    if (!t.exercicios.length) {
      box.innerHTML = '<p class="empty">Nenhum exercício. Este dia conta como descanso.</p>';
      return;
    }
    t.exercicios.forEach(function (ex, i) {
      var alvo = ex.duracao ? (ex.duracao + ' s') : (ex.min === ex.max ? ex.min + ' reps' : ex.min + '–' + ex.max + ' reps');
      var el = document.createElement('div');
      el.className = 'item';
      el.innerHTML =
        '<div style="flex:1;min-width:0"><b></b><small>' + ex.series + ' × ' + alvo +
        ' · ' + ex.descanso + ' s' +
        '<span class="badge">' + (ex.cadencia === 'isometrico' ? 'ISO' : ex.cadencia) + '</span></small></div>' +
        '<div class="ordem">' +
          '<button class="sobe" aria-label="Subir">↑</button>' +
          '<button class="desce" aria-label="Descer">↓</button>' +
          '<button class="edita" aria-label="Editar">✎</button>' +
        '</div>';
      el.querySelector('b').textContent = ex.nome;
      el.querySelector('.sobe').disabled = i === 0;
      el.querySelector('.desce').disabled = i === t.exercicios.length - 1;
      el.querySelector('.sobe').addEventListener('click', function () {
        t.exercicios.splice(i - 1, 0, t.exercicios.splice(i, 1)[0]); salvar(); renderDia();
      });
      el.querySelector('.desce').addEventListener('click', function () {
        t.exercicios.splice(i + 1, 0, t.exercicios.splice(i, 1)[0]); salvar(); renderDia();
      });
      el.querySelector('.edita').addEventListener('click', function () {
        abrirFormEx(p.id, edit.chave, i, renderDia);
      });
      box.appendChild(el);
    });
  }

  $('#diNome').addEventListener('change', function () {
    var p = S.fichas[edit.ficha];
    if (!p) return;
    var t = trDe(p, edit.chave);
    if (!t) return;
    t.nome = $('#diNome').value.trim();
    salvar();
    trData = null;
  });

  $('#diAdd').addEventListener('click', function () {
    abrirFormEx(edit.ficha, edit.chave, -1, renderDia);
  });

  $('#diVoltar').addEventListener('click', function () { ir('ficha'); });

  /* ── formulário de exercício ── */

  var form = { ficha: null, chave: null, idx: -1, medida: 'reps', padrao: 'puxar', cadencia: '3-1-1-1', depois: null };

  function abrirFormEx(fichaId, chave, idx, depois) {
    var p = S.fichas[fichaId];
    if (!p) { toast('Esta ficha não é editável.'); return; }
    form.ficha = fichaId; form.chave = chave; form.idx = idx; form.depois = depois || function () {};

    var t = trDe(p, chave);
    var ex = idx >= 0 ? t.exercicios[idx] : null;

    $('#exTitulo').textContent = ex ? 'Editar exercício' : 'Novo exercício';
    $('#exNome').value = ex ? ex.nome : '';
    $('#exSeries').value = ex ? ex.series : 3;
    $('#exDesc').value = ex ? ex.descanso : 60;
    form.medida = (ex && ex.duracao) ? 'tempo' : 'reps';
    $('#exMin').value = ex && ex.min != null ? ex.min : 8;
    $('#exMax').value = ex && ex.max != null ? ex.max : 12;
    $('#exDuracao').value = ex && ex.duracao ? ex.duracao : 45;
    form.padrao = ex ? (ex.padrao === 'isometrico' ? 'outro' : ex.padrao) : 'puxar';
    form.cadencia = (ex && ex.cadencia !== 'isometrico') ? ex.cadencia : '3-1-1-1';

    // chips de cadência
    var bc = $('#exCad');
    bc.innerHTML = '';
    CADENCIAS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip cadchip';
      b.textContent = c.v;
      b.dataset.cad = c.v;
      b.addEventListener('click', function () { form.cadencia = c.v; pintaForm(); });
      bc.appendChild(b);
    });

    $('#exApagar').hidden = idx < 0;
    pintaForm();
    $('#ovEx').hidden = false;
    $('#exNome').focus();
  }

  function pintaForm() {
    $$('#exMedida .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.med === form.medida); });
    $$('#exPadrao .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.pad === form.padrao); });
    $$('#exCad .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.cad === form.cadencia); });
    $('#boxReps').hidden = form.medida !== 'reps';
    $('#boxDur').hidden = form.medida !== 'tempo';
    var ehTempo = form.medida === 'tempo';
    $('#exCad').style.display = ehTempo ? 'none' : '';
    $('#exPadrao').style.display = ehTempo ? 'none' : '';
    var c = CADENCIAS.filter(function (x) { return x.v === form.cadencia; })[0];
    $('#exCadDesc').textContent = ehTempo ? 'Isométrico: o app vira cronômetro.' : (c ? c.d : '');
  }

  $$('#exMedida .chip').forEach(function (c) {
    c.addEventListener('click', function () { form.medida = c.dataset.med; pintaForm(); });
  });
  $$('#exPadrao .chip').forEach(function (c) {
    c.addEventListener('click', function () { form.padrao = c.dataset.pad; pintaForm(); });
  });

  function fecharFormEx() { $('#ovEx').hidden = true; }
  $('#exFechar').addEventListener('click', fecharFormEx);
  $('#ovEx').addEventListener('click', function (e) { if (e.target === $('#ovEx')) fecharFormEx(); });

  $('#exSalvar').addEventListener('click', function () {
    var p = S.fichas[form.ficha];
    if (!p) return;
    var t = trDe(p, form.chave);
    if (!t) return;

    var nome = $('#exNome').value.trim();
    if (!nome) { toast('Dê um nome ao exercício.'); return; }

    var series = Math.max(1, Math.min(10, num($('#exSeries').value) || 3));
    var desc = Math.max(10, Math.min(600, num($('#exDesc').value) || 60));

    var ex = { nome: nome, series: series, descanso: desc };

    if (form.medida === 'tempo') {
      ex.duracao = Math.max(5, Math.min(600, num($('#exDuracao').value) || 45));
      ex.cadencia = 'isometrico';
      ex.padrao = 'isometrico';
    } else {
      var mn = Math.max(1, Math.min(100, num($('#exMin').value) || 8));
      var mx = Math.max(mn, Math.min(100, num($('#exMax').value) || mn));
      ex.min = mn; ex.max = mx;
      ex.cadencia = form.cadencia;
      ex.padrao = form.padrao;
    }

    if (form.idx >= 0) t.exercicios[form.idx] = ex;
    else t.exercicios.push(ex);

    if (!t.nome) t.nome = 'Treino';
    salvar();
    trData = null;
    fecharFormEx();
    toast(form.idx >= 0 ? 'Exercício atualizado.' : 'Exercício adicionado.');
    form.depois();
  });

  $('#exApagar').addEventListener('click', function () {
    var p = S.fichas[form.ficha];
    if (!p || form.idx < 0) return;
    if (!confirm('Apagar este exercício?')) return;
    trDe(p, form.chave).exercicios.splice(form.idx, 1);
    salvar();
    trData = null;
    fecharFormEx();
    toast('Exercício apagado.');
    form.depois();
  });

  /* ───────────── mais ───────────── */

  function renderMais() {
    var todas = todasFichas();
    var box = $('#progChips');
    box.innerHTML = '';
    Object.keys(todas).forEach(function (id) {
      var p = todas[id];
      var b = document.createElement('button');
      b.className = 'chip' + (id === S.programa ? ' on' : '');
      b.textContent = p.nome;
      b.addEventListener('click', function () {
        S.programa = id;
        salvar();
        trData = null;
        toast('Ficha alterada.');
        renderMais(); renderTopo();
      });
      box.appendChild(b);
    });
    $('#progResumo').textContent = (programa().resumo || '') + (programa().principio ? ' — ' + programa().principio : '');

    // minhas fichas
    var mf = $('#minhasFichas');
    mf.innerHTML = '';
    var ids = Object.keys(S.fichas);
    if (!ids.length) {
      mf.innerHTML = '<p class="empty">Você ainda não tem fichas próprias.</p>';
    } else {
      ids.forEach(function (id) {
        var p = S.fichas[id];
        var qtd = blocos(p).reduce(function (s, b) { return s + ((b.treino && b.treino.exercicios) ? b.treino.exercicios.length : 0); }, 0);
        var el = document.createElement('div');
        el.className = 'item';
        el.innerHTML = '<div style="flex:1;min-width:0"><b></b><small>' + qtd + ' exercícios' +
          (id === S.programa ? ' · em uso' : '') + '</small></div>' +
          '<div class="ordem"><button class="edita" aria-label="Editar">✎</button>' +
          '<button class="apaga" aria-label="Apagar">✕</button></div>';
        el.querySelector('b').textContent = p.nome;
        el.querySelector('.edita').addEventListener('click', function () { abrirFicha(id); });
        el.querySelector('.apaga').addEventListener('click', function () {
          if (!confirm('Apagar a ficha "' + p.nome + '"? Os treinos já registrados continuam salvos.')) return;
          delete S.fichas[id];
          if (S.programa === id) S.programa = 'ficha-v';
          salvar(); trData = null;
          toast('Ficha apagada.');
          renderMais(); renderTopo();
        });
        mf.appendChild(el);
      });
    }

    $('#cadNotacao').textContent = 'Quatro números: ' + T.cadencia.notacao + '. Padrão da ficha: ' + T.cadencia.padrao + '.';
    var ul = $('#cadRegras');
    ul.innerHTML = '';
    T.cadencia.regras.forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<b>' + r.cadencia + '</b> — ';
      li.appendChild(document.createTextNode(r.tipo + '. ' + r.nota));
      ul.appendChild(li);
    });
    $('#cadResp').textContent = T.cadencia.respiracao;

    $('#verInfo').textContent = 'V-SHAPE · dados v' + S.versao + ' · treinos v' + T.versao +
      ' · início ' + dataCurta(S.inicio);
  }

  $('#btnDuplicar').addEventListener('click', function () {
    var id = duplicarFicha(S.programa);
    S.programa = id;
    salvar();
    trData = null;
    toast('Cópia criada.');
    abrirFicha(id);
  });

  $('#btnNovaFicha').addEventListener('click', function () {
    var id = criarFichaVazia();
    abrirFicha(id);
  });

  $('#btnExportar').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vshape-' + hojeISO() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Backup exportado.');
  });

  $('#inImportar').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var novo = JSON.parse(fr.result);
        if (!novo || typeof novo !== 'object' || !('logs' in novo)) throw new Error('formato');
        S = novo;
        var b = vazio();
        for (var k in b) if (!(k in S)) S[k] = b[k];
        salvar();
        toast('Backup importado.');
        ir('hoje');
      } catch (err) {
        toast('Arquivo inválido.');
      }
    };
    fr.readAsText(f);
    e.target.value = '';
  });

  $('#btnZerar').addEventListener('click', function () {
    if (!confirm('Apagar todos os registros e começar do dia 1?')) return;
    S = vazio();
    salvar();
    trData = null;
    toast('Tudo zerado.');
    ir('hoje');
  });

  /* ───────────── check-in ───────────── */

  $$('#checkinChips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      var iso = hojeISO();
      S.checkins[iso] = (S.checkins[iso] === c.dataset.ci) ? undefined : c.dataset.ci;
      if (!S.checkins[iso]) delete S.checkins[iso];
      salvar();
      renderHoje();
    });
  });

  /* ───────────── início ───────────── */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) renderTopo();
  });

  ir('hoje');
})();
