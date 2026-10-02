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

  function programa() { return T.programas[S.programa] || T.programas['ficha-v']; }

  function diaDoPlano() {
    return Math.max(1, Math.min(programa().duracao_dias, diasEntre(S.inicio, hojeISO()) + 1));
  }

  /* treino previsto para uma data */
  function treinoDe(iso) {
    var p = programa();
    if (p.tipo === 'semanal') {
      var wd = new Date(iso + 'T00:00:00').getDay();
      return p.semana[wd] || null;
    }
    // rotativo: avança só nos dias já treinados + hoje
    var i = Math.max(0, diasEntre(S.inicio, iso)) % p.sequencia.length;
    return p.treinos[p.sequencia[i]] || null;
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
    if (!tr) {
      $('#hojeTreino').textContent = 'Descanso';
      $('#hojeNota').textContent = '';
      $('#btnIniciar').hidden = true;
    } else {
      $('#hojeTreino').textContent = tr.nome;
      $('#hojeNota').textContent = tr.nota || '';
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
      $('#trNome').textContent = 'Descanso';
      $('#trEyebrow').textContent = '—';
      $('#trNota').textContent = 'Nada marcado para hoje.';
      box.innerHTML = '';
      $('#btnConcluir').hidden = true;
      return;
    }
    var t = trData.treino;
    $('#trEyebrow').textContent = programa().nome;
    $('#trNome').textContent = t.nome;
    $('#trNota').textContent = t.nota || '';
    $('#btnConcluir').hidden = false;

    var log = logDe(iso);
    log.treino = t.id;

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
  }

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

  /* ───────────── mais ───────────── */

  function renderMais() {
    var box = $('#progChips');
    box.innerHTML = '';
    Object.keys(T.programas).forEach(function (id) {
      var p = T.programas[id];
      var b = document.createElement('button');
      b.className = 'chip' + (id === S.programa ? ' on' : '');
      b.textContent = p.nome;
      b.addEventListener('click', function () {
        S.programa = id;
        salvar();
        trData = null;
        toast('Programa alterado.');
        renderMais(); renderTopo();
      });
      box.appendChild(b);
    });
    $('#progResumo').textContent = programa().resumo + (programa().principio ? ' — ' + programa().principio : '');

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
