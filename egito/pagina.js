// Egito, de hoje para trás — monta a página a partir de /egito/dados.json.
// Cada bloco vai em try/catch: uma parte que falha não derruba o resto.
(function () {
  'use strict';
  var E = window.EGITO, U = E.util, h = U.h, s = U.s;
  var D = null;
  var ARGS = new WeakMap(); // argumentos de cada peça (o que não cabe em data-*)

  var ERAS = {
    moderno:   { nome: 'O Egito moderno', quando: 'de 1798 a 2026', texto: 'Do desembarque de Napoleão à república de hoje: o canal, a represa, as guerras e as praças cheias.' },
    islamico:  { nome: 'O Egito islâmico', quando: 'de 641 a 1798', texto: 'Mais de mil anos de califas, sultões e paxás. O Cairo nasce e cresce até virar uma das grandes cidades do seu tempo.' },
    classico:  { nome: 'Gregos, romanos e cristãos', quando: 'de 332 a.C. a 641 d.C.', texto: 'Alexandre funda uma cidade, Roma leva o trigo, e os templos antigos se calam enquanto os mosteiros crescem no deserto.' },
    faraonico: { nome: 'O Egito dos faraós', quando: 'de c. 3100 a 332 a.C.', texto: 'Trinta dinastias em quase três mil anos: a parte mais longa da história escrita do país.' },
    prehist:   { nome: 'Antes dos faraós', quando: 'até c. 3100 a.C.', texto: 'Antes da escrita. O Saara já foi verde, e quem vivia nele desceu para o rio quando a chuva acabou.' },
    profundo:  { nome: 'Tempo profundo', quando: 'milhões de anos atrás', texto: 'Antes das pessoas. Onde hoje é deserto houve mar, baleias e dinossauros.' },
    nilo:      { nome: 'O chão de tudo', quando: 'o rio e a terra', texto: 'O que explica as camadas de cima: um rio que atravessa o deserto e enchia uma vez por ano.' }
  };
  var ENTRE = {
    populacao:   { rot: 'Um fio pelo tempo', titulo: 'Quanta gente coube à beira do rio' },
    descobertas: { rot: 'Como sabemos', titulo: 'Quase tudo o que se sabe foi aprendido nos últimos 200 anos' },
    religioes:   { rot: 'Um fio pelo tempo', titulo: 'Três maiorias em dois mil anos' },
    cleopatra:   { rot: 'Para medir o tempo', titulo: 'Cleópatra viveu mais perto de nós do que das pirâmides', intro: 'O Egito antigo já era antigo para os próprios egípcios. Quando Cleópatra virou rainha, em 51 a.C., a Grande Pirâmide já tinha mais de 2.500 anos.' },
    escritas:    { rot: 'Um fio pelo tempo', titulo: 'A mesma língua, escrita de quatro jeitos' },
    'nilo-numeros': { rot: 'O rio medido', titulo: 'Cinco mil anos medindo a cheia' }
  };

  function txt(v) { return v == null ? '' : String(v); }

  // ---------- peças ----------
  function lugarDePeca(nome, args) {
    var el = h('div', { class: 'peca', 'data-peca': nome });
    if (args) ARGS.set(el, args);
    return el;
  }
  function montaPeca(el) {
    if (el.dataset.feita) return;
    el.dataset.feita = '1';
    var fn = E.pecas[el.dataset.peca];
    if (!fn) { el.classList.add('vazia'); return; }
    try { fn(el, D, U, ARGS.get(el) || {}); }
    catch (e) { try { console.warn('peça', el.dataset.peca, e); } catch (e2) {} el.textContent = ''; }
    if (!el.children.length) el.classList.add('vazia');
  }
  function vigiaPecas(raiz) {
    Array.prototype.forEach.call(raiz.querySelectorAll('.peca:not([data-vigiada])'), function (el) {
      el.dataset.vigiada = '1';
      // os mapas são leves: montam logo, para a página não mudar de altura depois
      if (el.dataset.peca === 'mapa') { montaPeca(el); return; }
      U.aoVer(el, function () { montaPeca(el); }, { margem: '500px 0px 500px 0px' });
    });
  }
  function vigiaRev(raiz) {
    Array.prototype.forEach.call(raiz.querySelectorAll('.rev:not(.vis)'), function (el) {
      U.aoVer(el, function () { el.classList.add('vis'); });
    });
  }

  // ---------- pedaços de uma camada ----------
  function credito(f) {
    if (!f) return null;
    var p = h('span', null, 'Foto: ', U.link(txt(f.autor) || 'Wikimedia Commons', f.pagina));
    if (f.licenca) { p.appendChild(document.createTextNode(' · ')); p.appendChild(U.link(f.licenca, f.licenca_url)); }
    return p;
  }
  function seloCerteza(f) {
    var rot = f.certeza === 'baixa' ? 'de memória, sem fonte conferida' : f.certeza === 'media' ? 'conferido em parte' : null;
    if (!rot && !f.ressalva) return null;
    var cl = 'selo ' + (f.certeza === 'baixa' ? 'memoria' : f.certeza === 'media' ? 'parte' : '');
    if (!f.ressalva) return h('span', { class: cl }, rot);
    var nota = h('p', { class: 'nota', hidden: true }, f.ressalva);
    var b = h('button', { type: 'button', class: cl, 'aria-expanded': 'false', onclick: function () {
      var abre = nota.hidden; nota.hidden = !abre; b.setAttribute('aria-expanded', abre ? 'true' : 'false');
    } }, (rot || 'nota') + ' ›');
    return [b, nota];
  }
  function fato(f) {
    var pe = h('div', { class: 'pe' });
    if (f.fonte) pe.appendChild(h('span', null, 'Fonte: ', U.link(f.fonte, f.url)));
    var selo = seloCerteza(f), nota = null;
    if (Array.isArray(selo)) { pe.appendChild(selo[0]); nota = selo[1]; } else if (selo) pe.appendChild(selo);
    return h('li', { class: 'fato rev' },
      h('div', { class: 'q' }, txt(f.ano_txt) || U.ano(f.ano)),
      h('h4', null, txt(f.titulo)),
      h('p', null, txt(f.texto)),
      pe, nota);
  }
  function listaComMais(itens, faz, primeiro, classe, tag, rotulo) {
    var caixa = h(tag || 'div', { class: classe });
    var corte = itens.length > primeiro + 2 ? primeiro : itens.length;
    itens.slice(0, corte).forEach(function (x) { caixa.appendChild(faz(x)); });
    if (corte >= itens.length) return [caixa];
    var resto = itens.slice(corte);
    var b = h('button', { type: 'button', class: 'mais', onclick: function () {
      resto.forEach(function (x) { caixa.appendChild(faz(x)); });
      b.remove(); vigiaRev(caixa);
    } }, rotulo(resto.length));
    return [caixa, b];
  }
  // "5.398 (número mais citado); 'mais de 5.000' em outras fontes" -> título "5.398" + o resto em letra menor
  function partesDoValor(v) {
    v = txt(v).trim();
    if (v.length <= 26) return [v, ''];
    var m = /^(.{2,34}?)(\s*;\s*|\s+\(|\s*:\s+|,\s+(?=[a-zà-ú(]))(.*)$/.exec(v);
    if (!m) return [v, ''];
    var resto = (m[2].indexOf('(') >= 0 ? '(' : '') + m[3];
    return [m[1].trim(), resto.trim()];
  }
  function numero(n) {
    var pe = h('small', null, txt(n.ano));
    if (n.fonte) { if (n.ano) pe.appendChild(document.createTextNode(' · ')); pe.appendChild(U.link(n.fonte, n.url)); }
    var pv = partesDoValor(n.valor);
    return h('div', { class: 'num' }, h('b', { class: pv[0].length > 30 ? 'longo' : null }, pv[0]), h('span', null, txt(n.rotulo)),
      pv[1] ? h('em', null, pv[1]) : null, pe);
  }
  function pessoa(p) {
    return h('div', { class: 'pessoa' }, h('b', null, txt(p.nome)),
      h('i', null, [txt(p.anos), txt(p.papel)].filter(Boolean).join(' · ')), p.texto ? h('p', null, txt(p.texto)) : null);
  }
  function bloco(titulo, classe) {
    return h('section', { class: 'blk ' + (classe || '') }, h('h3', null, titulo));
  }

  function camada(c, i, total, pulaPrimeiraFoto) {
    var fotos = (c.fotos || []).slice();
    if (pulaPrimeiraFoto && fotos.length > 1) fotos.shift();
    var heroi = fotos.shift();
    var sec = h('section', { class: 'camada', id: c.id, 'data-era': c.era, 'data-inicio': c.inicio, 'data-fim': c.fim, 'aria-labelledby': 't-' + c.id });

    var topo = h('header', { class: 'cam-topo ' + (heroi ? 'com-foto' : 'sem-foto') });
    if (heroi) {
      var pos = { topo: 'center 15%', base: 'center 85%', esquerda: '20% center', direita: '80% center' }[heroi.foco] || 'center';
      topo.appendChild(h('img', { class: 'heroi', src: '/egito/img/' + heroi.arquivo, alt: txt(heroi.legenda), loading: 'lazy', decoding: 'async',
        width: heroi.largura || 1280, height: heroi.altura || 853, style: { 'object-position': pos } }));
    }
    var quando = h('p', { class: 'cam-quando' }, txt(c.periodo_txt));
    if (c.inicio != null && c.fim != null && c.id !== 'nilo') {
      quando.appendChild(h('small', null, c.id === 'hoje' ? 'de agora até ' + U.atras(c.inicio)
        : 'de ' + U.atras(c.fim).replace(' atrás', '') + ' a ' + U.atras(c.inicio)));
    }
    topo.appendChild(h('div', { class: 'miolo cam-tit' },
      h('p', { class: 'cam-num' }, 'Camada ' + (i + 1) + ' de ' + total),
      h('h2', { id: 't-' + c.id }, txt(c.titulo)), quando,
      heroi ? h('p', { class: 'cam-cred' }, txt(heroi.legenda) ? txt(heroi.legenda) + ' ' : '', credito(heroi)) : null));
    sec.appendChild(topo);

    var corpo = h('div', { class: 'miolo cam-corpo' });
    if (c.resumo) corpo.appendChild(h('p', { class: 'cam-resumo rev' }, txt(c.resumo)));
    (c.pecas || []).forEach(function (nome) { corpo.appendChild(lugarDePeca(nome, { camada: c })); });

    var grade = h('div', { class: 'grade' });
    try {
      if (c.fatos && c.fatos.length) {
        var bf = bloco('O que aconteceu', 'esq');
        listaComMais(c.fatos, fato, 6, 'fatos', 'ol', function (n) { return 'Mostrar mais ' + n + (n === 1 ? ' fato' : ' fatos'); })
          .forEach(function (x) { bf.appendChild(x); });
        grade.appendChild(bf);
      }
    } catch (e) {}
    var lado = h('div', { class: 'lado' });
    try {
      if (c.numeros && c.numeros.length) {
        var bn = bloco('Em números');
        listaComMais(c.numeros, numero, 6, 'nums', 'div', function (n) { return 'Mais ' + n + (n === 1 ? ' número' : ' números'); })
          .forEach(function (x) { bn.appendChild(x); });
        lado.appendChild(bn);
      }
    } catch (e) {}
    try {
      if (c.pessoas && c.pessoas.length) {
        var bg = bloco('Gente');
        listaComMais(c.pessoas, pessoa, 4, 'gente', 'div', function (n) { return 'Mais ' + n + (n === 1 ? ' pessoa' : ' pessoas'); })
          .forEach(function (x) { bg.appendChild(x); });
        lado.appendChild(bg);
      }
    } catch (e) {}
    if (lado.children.length) grade.appendChild(lado);
    if (grade.children.length) corpo.appendChild(grade);

    try {
      if (c.vida_comum) {
        var bv = bloco('A vida de quem não era rei');
        bv.appendChild(h('div', { class: 'vida rev' }, h('p', null, txt(c.vida_comum))));
        corpo.appendChild(bv);
      }
    } catch (e) {}
    try {
      if (fotos.length) {
        var bfo = bloco('Para ver');
        var gf = h('div', { class: 'fotos' });
        fotos.forEach(function (f) {
          gf.appendChild(h('figure', { class: 'rev' },
            h('img', { src: '/egito/img/' + f.arquivo, alt: txt(f.legenda), loading: 'lazy', decoding: 'async', width: f.largura || 960, height: f.altura || 720 }),
            h('figcaption', null, txt(f.legenda), h('small', null, credito(f)))));
        });
        bfo.appendChild(gf); corpo.appendChild(bfo);
      }
    } catch (e) {}
    try {
      var comCoord = (c.onde || []).filter(function (o) { return typeof o.lat === 'number' && typeof o.lon === 'number'; });
      if (c.onde && c.onde.length) {
        var bo = bloco('Onde ver isso hoje');
        var lista = h('ol', null, c.onde.map(function (o) {
          return h('li', null, h('b', null, txt(o.lugar)), o.cidade ? h('i', null, ' · ' + txt(o.cidade)) : null, o.o_que ? h('p', null, txt(o.o_que)) : null);
        }));
        var caixa = h('div', { class: 'onde' });
        if (comCoord.length) caixa.appendChild(lugarDePeca('mapa', { pontos: c.onde, numerar: true }));
        caixa.appendChild(lista);
        bo.appendChild(caixa); corpo.appendChild(bo);
      }
    } catch (e) {}
    try {
      if (c.discute && c.discute.length) {
        corpo.appendChild(h('details', { class: 'discute' },
          h('summary', null, 'O que os historiadores discutem (' + c.discute.length + ')'),
          h('ul', null, c.discute.map(function (d) { return h('li', null, txt(d)); }))));
      }
    } catch (e) {}
    sec.appendChild(corpo);
    return sec;
  }

  function eraAbre(era) {
    var e = ERAS[era]; if (!e) return null;
    return h('div', { class: 'era-abre', 'data-era': era, id: 'era-' + era },
      h('div', { class: 'miolo' }, h('p', { class: 'rot rev' }, 'Mais fundo'), h('h2', { class: 'rev' }, e.nome),
        h('p', { class: 'quando rev' }, e.quando), h('p', { class: 'rev' }, e.texto)));
  }
  function entre(x, era) {
    var cfg = ENTRE[x.peca] || {}, serie = x.serie && D.series ? D.series[x.serie] : null;
    return h('section', { class: 'entre', 'data-era': era, id: 'fio-' + x.peca },
      h('div', { class: 'miolo' },
        h('p', { class: 'rot rev' }, cfg.rot || 'Um fio pelo tempo'),
        h('h2', { class: 'rev' }, cfg.titulo || (serie && serie.titulo) || ''),
        h('p', { class: 'intro rev' }, cfg.intro || (serie && serie.resumo) || ''),
        lugarDePeca(x.peca, { serie: serie })));
  }
  function divisa(c) {
    if (c.inicio == null) return null;
    var p = 'M0 18 C 120 4, 240 30, 360 16 S 600 6, 720 20 S 960 30, 1080 14 S 1320 8, 1440 20';
    return h('div', { class: 'divisa', 'data-era': c.era, 'aria-hidden': 'true' },
      s('svg', { viewBox: '0 0 1440 34', preserveAspectRatio: 'none' },
        s('path', { d: p, fill: 'none', stroke: 'currentColor', 'stroke-width': 1, opacity: .5 }),
        s('path', { d: 'M0 26 C 160 14, 300 34, 480 24 S 800 14, 960 26 S 1280 32, 1440 22', fill: 'none', stroke: 'currentColor', 'stroke-width': 1, opacity: .25 })),
      h('span', null, 'antes de ' + (c.inicio <= -11000 ? U.atras(c.inicio).replace(' atrás', '') : U.ano(c.inicio)) + ' ↓'));
  }

  // ---------- capa e índice ----------
  function capa() {
    var c0 = D.camadas[0], f = c0 && c0.fotos && c0.fotos[0];
    if (!f) return false;
    var img = document.querySelector('#capa .capa-foto');
    img.addEventListener('load', function () { img.classList.add('ok'); });
    img.src = '/egito/img/' + f.arquivo; img.alt = txt(f.legenda);
    var cr = document.querySelector('#capa .capa-cred');
    if (cr) { cr.textContent = ''; cr.appendChild(credito(f)); }
    return c0.fotos.length > 1;
  }
  function estratos() {
    var cx = document.getElementById('estratos'); if (!cx) return;
    var vistos = {};
    D.camadas.forEach(function (c) {
      if (vistos[c.era]) { vistos[c.era].n++; return; }
      vistos[c.era] = { n: 1, id: c.id };
    });
    Object.keys(vistos).forEach(function (era) {
      var e = ERAS[era]; if (!e) return;
      var n = vistos[era].n;
      cx.appendChild(h('a', { href: '#era-' + era, 'data-era': era }, h('b', null, e.nome), h('span', null, e.quando),
        h('small', null, n + (n === 1 ? ' camada' : ' camadas'))));
    });
  }
  function indice() {
    var dlg = document.getElementById('indice'), corpo = document.getElementById('ind-corpo'); if (!dlg || !corpo) return;
    var era = null;
    D.camadas.forEach(function (c) {
      if (c.era !== era) { era = c.era; corpo.appendChild(h('div', { class: 'ind-era' }, (ERAS[era] || {}).nome || era)); }
      corpo.appendChild(h('a', { href: '#' + c.id }, h('b', null, txt(c.titulo)), h('span', null, txt(c.periodo_txt))));
    });
    corpo.appendChild(h('div', { class: 'ind-era' }, 'No fim'));
    var ex = h('div', { class: 'ind-extra' });
    [['#nao-sabemos', 'O que ainda não sabemos'], ['#fios', 'Fios que atravessam as camadas'], ['#viagem', 'Mapa para a viagem'],
     ['#metodo', 'Como este estudo foi feito'], ['#fontes', 'Fontes e créditos']].forEach(function (x) {
      ex.appendChild(h('a', { href: x[0] }, h('b', null, x[1]), h('span', null, '')));
    });
    corpo.appendChild(ex);
    corpo.addEventListener('click', function (ev) { if (ev.target.closest('a')) dlg.close(); });
    document.getElementById('rg-ind').addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
    dlg.querySelector('.fecha').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
  }

  // ---------- régua ----------
  function regua() {
    var rg = document.getElementById('regua'), ol = document.getElementById('rg-pontos');
    var elAno = document.getElementById('rg-ano'), elNome = document.getElementById('rg-nome'), elAtras = document.getElementById('rg-atras'), barra = document.getElementById('rg-barra');
    var secs = Array.prototype.slice.call(document.querySelectorAll('.camada'));
    var porId = {}; D.camadas.forEach(function (c) { porId[c.id] = c; });
    var itens = {};
    D.camadas.forEach(function (c) {
      var li = h('li', null, h('a', { href: '#' + c.id, 'aria-label': txt(c.titulo) + ', ' + txt(c.periodo_txt) }, h('i'),
        h('span', null, txt(c.curto || c.titulo) + ' · ' + txt(c.periodo_txt))));
      li.setAttribute('data-era', c.era);
      ol.appendChild(li); itens[c.id] = li;
    });
    var corpo = document.getElementById('conteudo'), atual = null, pedido = false;
    function passo() {
      pedido = false;
      var meio = window.innerHeight * 0.42, ativa = null, i;
      for (i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top <= meio) ativa = secs[i]; else break; }
      var topoCorpo = corpo.getBoundingClientRect().top;
      rg.classList.toggle('on', topoCorpo < window.innerHeight * 0.5);
      var total = corpo.scrollHeight - window.innerHeight;
      barra.style.transform = 'scaleX(' + Math.max(0, Math.min(1, -topoCorpo / (total || 1))).toFixed(4) + ')';
      if (!ativa) return;
      var c = porId[ativa.id]; if (!c) return;
      if (atual !== c.id) {
        if (atual && itens[atual]) itens[atual].classList.remove('atual');
        atual = c.id; itens[c.id].classList.add('atual');
        rg.setAttribute('data-era', c.era); elNome.textContent = txt(c.curto || c.titulo);
        var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', U.cor(ativa, 'fundo') || '#0c1322');
      }
      if (c.id === 'nilo' || c.inicio == null || c.fim == null) { elAno.textContent = 'o rio'; elAtras.textContent = ''; return; }
      var r = ativa.getBoundingClientRect(), p = Math.max(0, Math.min(1, (meio - r.top) / (r.height || 1)));
      var a = c.fim + (c.inicio - c.fim) * p;
      // em períodos longos, anda em passos redondos para o número não tremer
      var vao = Math.abs(c.fim - c.inicio), passoAno = vao > 2e6 ? 1e6 : vao > 2e5 ? 1e4 : vao > 2e4 ? 1000 : vao > 2000 ? 50 : vao > 400 ? 5 : 1;
      a = Math.round(a / passoAno) * passoAno; if (a === 0) a = 1;
      elAno.textContent = U.ano(a); elAtras.textContent = U.atras(a);
    }
    function pede() { if (!pedido) { pedido = true; requestAnimationFrame(passo); } }
    window.addEventListener('scroll', pede, { passive: true }); window.addEventListener('resize', pede);
    passo();
  }

  // ---------- fim ----------
  function regiao(o) {
    var la = o.lat, lo = o.lon;
    if (typeof la !== 'number' || typeof lo !== 'number') return 'Outros';
    if (la < 21.5 || la > 32 || lo < 24.5 || lo > 37) return 'Fora do Egito (museus e vizinhos)';
    if (lo > 33.2 || (lo > 32.2 && la > 27.2 && la < 30.4)) return 'Sinai e Mar Vermelho';
    if (la >= 29.2 && la <= 30.35 && lo >= 30.8 && lo <= 31.7) return 'Cairo, Gizé e Sacará';
    if (la > 30.7 && lo < 30.65) return 'Alexandria e a costa';
    if (la > 30.35) return 'Delta e Canal de Suez';
    if (lo < 30.2 || (la < 24 && lo < 31.2)) return 'Oásis e deserto ocidental';
    if (la >= 26.9) return 'Fayum e Médio Egito';
    if (la >= 25.2) return 'Abidos, Dendera e Luxor';
    return 'Assuã e a Núbia';
  }
  function fim() {
    var f = document.getElementById('fim-corpo'); if (!f) return;
    try {
      var ns = D.series && D.series.descobertas && D.series.descobertas.nao_sabemos;
      if (ns && ns.length) f.appendChild(h('section', { id: 'nao-sabemos' }, h('h2', null, 'O que ainda não sabemos'),
        h('p', { class: 'intro' }, 'Um estudo honesto termina no que falta. Estas perguntas continuam abertas.'),
        h('ul', { class: 'naosei' }, ns.map(function (t) { return h('li', { class: 'rev' }, txt(t)); }))));
    } catch (e) {}
    try {
      if (D.fios && D.fios.length) {
        var vistos = {}, escolha = [];
        D.fios.forEach(function (x) { vistos[x.bloco] = (vistos[x.bloco] || 0) + 1; if (vistos[x.bloco] <= 2) escolha.push(x); });
        f.appendChild(h('section', { id: 'fios' }, h('h2', null, 'Fios que atravessam as camadas'),
          h('p', { class: 'intro' }, 'O que volta, de época em época, com outro nome.'),
          h('div', { class: 'fios' }, escolha.slice(0, 14).map(function (x) { return h('div', { class: 'fio rev' }, h('h3', null, txt(x.titulo)), h('p', null, txt(x.texto))); }))));
      }
    } catch (e) {}
    try {
      var grupos = {}, ordem = ['Cairo, Gizé e Sacará', 'Alexandria e a costa', 'Delta e Canal de Suez', 'Fayum e Médio Egito', 'Abidos, Dendera e Luxor', 'Assuã e a Núbia', 'Sinai e Mar Vermelho', 'Oásis e deserto ocidental', 'Fora do Egito (museus e vizinhos)', 'Outros'];
      var todos = [], chaves = {};
      D.camadas.forEach(function (c) {
        (c.onde || []).forEach(function (o) {
          var k = txt(o.lugar).toLowerCase().replace(/\s+/g, ' ').trim();
          if (chaves[k]) { if (chaves[k].camadas.indexOf(c) < 0) chaves[k].camadas.push(c); return; }
          var item = { o: o, camadas: [c] }; chaves[k] = item; todos.push(item);
          var g = regiao(o); (grupos[g] = grupos[g] || []).push(item);
        });
      });
      if (todos.length) {
        var lista = h('div', { class: 'viagem-lista' });
        ordem.forEach(function (g) {
          if (!grupos[g]) return;
          lista.appendChild(h('h3', null, g + ' (' + grupos[g].length + ')'));
          lista.appendChild(h('ul', null, grupos[g].map(function (it) {
            var cs = h('small', null);
            it.camadas.forEach(function (c, i) { if (i) cs.appendChild(document.createTextNode(' · ')); cs.appendChild(h('a', { href: '#' + c.id }, txt(c.curto || c.titulo))); });
            return h('li', null, h('b', null, txt(it.o.lugar)), it.o.cidade ? ' · ' + txt(it.o.cidade) : '', cs);
          })));
        });
        f.appendChild(h('section', { id: 'viagem' }, h('h2', null, 'Mapa para a viagem'),
          h('p', { class: 'intro' }, 'Todos os lugares citados nas camadas, por região. Em cada um, a época que ele mostra: é um jeito de montar um roteiro que atravessa o tempo.'),
          h('div', { class: 'viagem' }, lugarDePeca('mapa', { pontos: todos.map(function (x) { return x.o; }), grande: true }), lista)));
      }
    } catch (e) {}
    try {
      var nf = 0, nm = 0, nb = 0;
      D.camadas.forEach(function (c) { (c.fatos || []).forEach(function (x) { nf++; if (x.certeza === 'media') nm++; if (x.certeza === 'baixa') nb++; }); });
      f.appendChild(h('section', { id: 'metodo' }, h('h2', null, 'Como este estudo foi feito'),
        h('ul', { class: 'metodo' },
          h('li', null, 'A pesquisa foi feita em novembro de 2026, de hoje para trás, em ' + D.camadas.length + ' camadas. São ' + U.int(nf) + ' fatos, cada um com a fonte ao lado.'),
          h('li', null, 'Cada fato traz o grau de conferência. Sem marca: a fonte confirma o que está escrito. "Conferido em parte" (' + U.int(nm) + '): a fonte confirma o principal, e a nota diz o que ficou de fora. "De memória, sem fonte conferida" (' + U.int(nb) + '): é o que os livros costumam dizer, mas não foi achado numa fonte durante a pesquisa.'),
          h('li', null, 'Datas antigas são aproximadas. Antes de cerca de 664 a.C. as cronologias divergem em décadas, e para o tempo das pirâmides em até um século. Quando há disputa, ela está em "O que os historiadores discutem".'),
          h('li', null, 'Números de população antes de 1882 são estimativas. Nomes aparecem na forma mais comum em português, com a outra entre parênteses quando ajuda.'),
          h('li', null, 'As fotos vêm do Wikimedia Commons, com autor e licença em cada uma.'))));
    } catch (e) {}
    try {
      var sf = h('section', { id: 'fontes' }, h('h2', null, 'Fontes e créditos'));
      if (D.fontes && D.fontes.length) sf.appendChild(h('details', { class: 'cx' }, h('summary', null, 'Fontes consultadas (' + U.int(D.fontes.length) + ')'),
        h('ul', { class: 'lista-fontes' }, D.fontes.map(function (x) { return h('li', null, U.link(txt(x.titulo), x.url)); }))));
      if (D.creditos && D.creditos.length) sf.appendChild(h('details', { class: 'cx' }, h('summary', null, 'Créditos das fotos (' + D.creditos.length + ')'),
        h('ul', { class: 'lista-fontes' }, D.creditos.map(function (x) {
          var li = h('li', null, txt(x.legenda) ? txt(x.legenda) + ' ' : '', credito(x)); return li;
        }))));
      f.appendChild(sf);
    } catch (e) {}
  }

  // ---------- montagem ----------
  // Pular para uma camada distante: as peças e fotos do caminho ainda vão ganhar altura, então o alvo é
  // realinhado algumas vezes, até a página assentar ou a pessoa rolar por conta própria.
  var alvo = null, mexeu = false;
  function irPara(id) {
    var el = document.getElementById(id); if (!el) return false;
    alvo = el; mexeu = false;
    function alinha() { try { el.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
    alinha();
    [120, 350, 800, 1400, 2200].forEach(function (ms) {
      setTimeout(function () {
        if (alvo !== el || mexeu) return;
        var margem = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (Math.abs(el.getBoundingClientRect().top - margem) > 6) alinha();
      }, ms);
    });
    return true;
  }
  function irParaHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (id) irPara(id);
  }
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(function (ev) {
    window.addEventListener(ev, function () { mexeu = true; }, { passive: true });
  });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]'); if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1)); if (!id || id === 'abre') return;
    if (!document.getElementById(id)) return;
    ev.preventDefault();
    try { history.pushState(null, '', '#' + id); } catch (e) {}
    // deixa o clique terminar (o "mousedown" dele marca "mexeu") antes de começar a alinhar
    setTimeout(function () { irPara(id); }, 0);
  });
  function monta() {
    var cx = document.getElementById('camadas');
    cx.textContent = '';
    var pula = false;
    try { pula = capa(); } catch (e) {}
    try { estratos(); } catch (e) {}
    var era = null, total = D.camadas.length;
    D.camadas.forEach(function (c, i) {
      try {
        if (c.era !== era) { era = c.era; if (i > 0) { var ea = eraAbre(era); if (ea) cx.appendChild(ea); } }
        cx.appendChild(camada(c, i, total, i === 0 && pula));
        (D.entre || []).forEach(function (x) { if (x.depois === c.id) { try { cx.appendChild(entre(x, c.era)); } catch (e) {} } });
        var prox = D.camadas[i + 1];
        if (prox && prox.era === c.era) { var dv = divisa(c); if (dv) cx.appendChild(dv); }
      } catch (e) { try { console.warn('camada', c && c.id, e); } catch (e2) {} }
    });
    try { fim(); } catch (e) {}
    try { indice(); } catch (e) {}
    try { regua(); } catch (e) {}
    vigiaRev(document); vigiaPecas(document);
    if (location.hash) irParaHash();
  }
  function carrega() {
    var cx = document.getElementById('camadas');
    fetch('/egito/dados.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) { D = d; E.dados = d; monta(); })
      .catch(function () {
        cx.textContent = '';
        cx.appendChild(h('div', { class: 'miolo', style: { padding: '60px 0' } }, h('div', { class: 'aviso-falha' },
          h('p', null, 'O estudo não carregou.'), h('button', { type: 'button', class: 'mais', onclick: carrega }, 'Tentar de novo'))));
      });
  }
  window.addEventListener('hashchange', irParaHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', carrega); else carrega();
})();
