// Egito, de hoje para trás — peças "cenas": piramide, cleopatra, suez, abu-simbel, estacoes, faixa-do-nilo.
// Cada peça lê os números em dados.json na hora de desenhar. No topo de cada uma há uma pequena tabela
// "de onde vem cada número". O que não está nos dados não entra no desenho.
(function () {
  'use strict';
  var E = window.EGITO; if (!E) return;

  // ---------- comuns deste arquivo ----------
  var NUM = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)';
  function txt(v) { return v == null ? '' : String(v); }
  function ptNum(t) { return parseFloat(String(t).replace(/\./g, '').replace(',', '.')); }
  /** número que casa com o molde; no molde, # é o número: pega('146,6 m', '#\\s*m\\b') -> 146.6 */
  function pega(t, molde) { var m = new RegExp(molde.replace(/#/g, NUM), 'i').exec(txt(t)); return m ? ptNum(m[1]) : null; }
  function acha(lista, campo, re) {
    lista = lista || [];
    for (var i = 0; i < lista.length; i++) if (lista[i] && re.test(txt(lista[i][campo]))) return lista[i];
    return null;
  }
  function camadaDe(dados, id) { return acha(dados && dados.camadas, 'id', new RegExp('^' + id + '$')); }
  /** nome de classe com o prefixo da peça: C() -> 'pc-nome', C('x') -> 'pc-nome-x' */
  function prefixo(nome) { var p = 'pc-' + nome; return function (x) { return x ? p + '-' + x : p; }; }
  var postos = {};
  // os botões comuns têm 36 px de altura: uma área invisível completa os 44 px de toque, sem mudar o desenho;
  // nas tabelas, palavra comprida quebra em vez de empurrar a página para o lado
  var TOQUE = '& .pc-botoes button,& .pc-tabela summary{position:relative}' +
    '& .pc-botoes button::after,& .pc-tabela summary::after{content:"";position:absolute;left:0;right:0;top:-5px;bottom:-5px}' +
    '& .pc-tabela td,& .pc-tabela th{overflow-wrap:anywhere}';
  /** estilo da peça, posto uma vez; no texto, & vale '.pc-nome' */
  function estilo(nome, css) {
    if (postos[nome]) return; postos[nome] = 1;
    var st = document.createElement('style'); st.setAttribute('data-peca', nome);
    st.textContent = (css + TOQUE).replace(/&/g, '.pc-' + nome); document.head.appendChild(st);
  }
  function ehClaro(el, U) {
    var c = U.cor(el, 'fundo'), m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
  }
  /** desenha no tamanho real e refaz quando a largura muda ou quando as fontes chegam */
  function medir(host, U, fn) {
    var ult = 0;
    U.aoMedir(host, function (w) { ult = w; fn(w); });
    try {
      if (document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready) {
        document.fonts.ready.then(function () { if (ult && host.isConnected) fn(ult); });
      }
    } catch (e) {}
  }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }
  /** avisa quando o elemento está bem à vista: pelo menos `fracao` dele na tela (ou 70% da altura da janela, se ele for
   *  mais alto que ela). A conta usa as medidas do momento, então continua valendo depois de girar o aparelho ou de mudar
   *  a janela. fracao pode ser uma função (o desenho muda de forma com a largura). Chama fn uma vez só. */
  var PASSOS = []; (function () { for (var i = 0; i <= 20; i++) PASSOS.push(i / 20); })();
  function aoVerBem(host, U, fracao, fn) {
    var feito = false, obs = null;
    obs = U.aoVer(host, function (dentroDaTela, e) {
      if (feito || !dentroDaTela) return;
      if (e && e.boundingClientRect && e.intersectionRect) {
        var a = e.boundingClientRect.height || 1, j = (e.rootBounds && e.rootBounds.height) || window.innerHeight || 700;
        var f = typeof fracao === 'function' ? fracao() : fracao;
        if (e.intersectionRect.height < Math.min(f * a, 0.7 * j) - 1) return;
      }
      feito = true; if (obs) obs.parar();
      fn();
    }, { uma: false, limiar: PASSOS });
    if (feito && obs) obs.parar();
  }
  /** relógio de uma animação de entrada: quando o desenho é refeito (largura, fontes), ela segue de onde estava */
  function relogio() {
    var t0 = 0;
    return { liga: function () { if (!t0) t0 = performance.now(); }, ja: function () { return t0 ? performance.now() - t0 : 0; } };
  }
  /** "cerca de 2,3 milhões" -> { aprox: 'cerca de', grande: '2,3 milhões', resto: '' } */
  function parte(v) {
    var m = new RegExp('^\\s*(cerca de|perto de|mais de|quase)?\\s*(' + NUM.slice(1, -1) + '(?:\\s*(?:milh[õo]es|milhão|mil|bilh[õo]es|bilhão)\\b)?(?:\\s*(?:km|m|t|%)(?![\\wÀ-ÿ]))?)\\s*(.*)$', 'i').exec(txt(v));
    return m ? { aprox: m[1] || '', grande: m[2], resto: (m[3] || '').trim() } : null;
  }
  function fontes(U, lista) {
    var p = U.h('p', { class: 'pc-fonte' }, lista.length > 1 ? 'Fontes: ' : 'Fonte: '), n = 0;
    lista.forEach(function (x) {
      if (!x || !x[0]) return;
      if (n++) p.appendChild(document.createTextNode(' · '));
      p.appendChild(U.link(x[0], x[1]));
    });
    return n ? p : null;
  }

  // =====================================================================================================
  // piramide — "A Grande Pirâmide em números" (camada imperio-antigo)
  // De onde vem cada número (camada.numeros, achado pelo rótulo e lido na hora):
  //   altura original, 146,6 m ............ "Altura original da Grande Pirâmide"
  //   altura hoje, 138,5 m ................ "Altura atual da Grande Pirâmide"
  //   lado da base, 230,3 m (440 côvados) . "Lado da base da Grande Pirâmide"
  //   2,3 milhões de blocos ............... "Blocos da Grande Pirâmide (estimativa)"
  //   6 milhões de t; 2,6 t por bloco ..... "Peso total e peso médio por bloco"
  //   100 mil homens ...................... "Trabalhadores na obra, segundo Heródoto"
  //   cerca de 20 mil; faixa de 20 a 30 mil "Trabalhadores na obra, segundo os arqueólogos"
  //   Quéfren, 143,5 m e 215,25 m de lado . "Pirâmide de Quéfren"
  //   Miquerinos, cerca de 65 m ........... "Pirâmide de Miquerinos" (o lado da base não está nos dados)
  //   tempo de obra ....................... camada.discute ("Tempo de obra da Grande Pirâmide: …")
  //   os 8,1 m que faltam ................. conta: altura original menos altura de hoje
  //   pessoa de 1,7 m ..................... convenção do desenho (pedido da peça); não é dado do estudo
  // As fiadas do desenho são só indicativas: o número de fiadas não está nos dados.
  // =====================================================================================================
  var CSS_PIRAMIDE =
    '&{--pc-pedra:color-mix(in srgb,var(--acento2) 9%,var(--s2));--pc-junta:color-mix(in srgb,var(--tinta2) 30%,var(--s2));--pc-borda:color-mix(in srgb,var(--tinta) 70%,var(--s2))}' +
    '&-tit{font-size:clamp(25px,3.4vw,36px);margin:0 0 8px}' +
    '&-sub{color:var(--tinta2);font-size:15px;max-width:42em;margin:0 0 24px}' +
    '&-g{display:grid;gap:30px 48px;align-items:start}' +
    '&-largo &-g{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}' +
    '& svg{display:block;overflow:visible}' +
    '& svg text{font-family:var(--sem);font-size:11.5px;fill:var(--tinta2)}' +
    '& svg text&-n{font-family:var(--serifa);font-weight:600;fill:var(--tinta);font-variant-numeric:tabular-nums}' +
    '& svg text&-forte{fill:var(--tinta);font-weight:600}' +
    '& svg text&-falta{fill:var(--acento);font-weight:700}' +
    '&-chao{stroke:var(--tinta2);stroke-width:1}' +
    '@keyframes pc-piramide-sobe{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}' +
    '@keyframes pc-piramide-surge{from{opacity:0}to{opacity:1}}' +
    '&-fiada{fill:var(--pc-pedra);stroke:var(--pc-junta);stroke-width:.8;opacity:0}' +
    '&-corpo{fill:none;stroke:var(--pc-borda);stroke-width:1.3;stroke-linejoin:round}' +
    '&-ponta{fill:color-mix(in srgb,var(--acento) 10%,transparent);stroke:var(--acento);stroke-width:1.4;stroke-dasharray:4 3;stroke-linejoin:round}' +
    '&-cota{stroke:var(--tinta2);stroke-width:1;fill:none}' +
    '&-chamada{stroke:var(--tinta2);stroke-width:.8;stroke-dasharray:2 3;fill:none;opacity:.8}' +
    '&-gente{fill:var(--tinta)}' +
    '&-aro{fill:none;stroke:var(--tinta2);stroke-width:.8}' +
    '&-tarde{opacity:0}' +
    '&-vis &-fiada{animation:pc-piramide-sobe .5s cubic-bezier(.2,.7,.2,1) both}' +
    '&-vis &-tarde{animation:pc-piramide-surge .7s ease both}' +
    '&-ficha{margin:0;display:grid;gap:0}' +
    '&-ficha div{padding:12px 0 13px;border-top:1px solid var(--linha)}' +
    '&-ficha div:last-child{border-bottom:1px solid var(--linha)}' +
    '&-ficha dt{font-size:12.5px;color:var(--tinta2);margin:0 0 2px}' +
    '&-ficha dd{margin:0;font-size:13.5px;color:var(--tinta2);line-height:1.35}' +
    '&-ficha dd b{font-family:var(--serifa);font-size:clamp(24px,2.6vw,30px);font-weight:600;color:var(--tinta);letter-spacing:-.01em;margin-right:6px;white-space:nowrap}' +
    '&-tres{margin:22px 0 0}' +
    '&-tres p{font-size:12.5px;color:var(--tinta2);margin:0 0 8px}' +
    '&-tri{fill:var(--pc-pedra);stroke:var(--pc-borda);stroke-width:1;stroke-linejoin:round}' +
    '&-quem{margin:clamp(34px,6vh,54px) 0 0;padding-top:22px;border-top:1px solid var(--linha)}' +
    '&-quem h4{font-size:clamp(21px,2.5vw,26px);margin:0 0 4px}' +
    '&-quem>p{font-size:14px;color:var(--tinta2);margin:0 0 18px;max-width:44em}' +
    '&-fila{margin:0 0 18px}' +
    '&-fila p{margin:0 0 6px;font-size:13.5px;color:var(--tinta2);line-height:1.4}' +
    '&-fila p b{color:var(--tinta);font-size:15px}' +
    '&-fila p strong{font-family:var(--serifa);font-size:22px;font-weight:600;color:var(--tinta);margin-right:5px}' +
    '&-boneco{fill:var(--tinta2);opacity:0}' +
    '&-boneco&-hoje{fill:var(--acento)}' +
    '&-boneco&-oco{fill:none;stroke:var(--acento);stroke-width:1.1}' +
    '&-gente-vis &-boneco{animation:pc-piramide-surge .25s ease both}' +
    '&-chave{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:12.5px;color:var(--tinta2);margin:4px 0 0}' +
    '&-chave span{display:inline-flex;align-items:center;gap:6px}' +
    '&-chave svg{flex:none}' +
    '@media (prefers-reduced-motion:reduce),print{&-fiada,&-tarde,&-boneco{opacity:1!important;animation:none!important}}';

  E.peca('piramide', function (el, dados, U, args) {
    var h = U.h, s = U.s, c = args && args.camada; if (!c) return;
    var N = c.numeros || [], C = prefixo('piramide');
    var nOrig = acha(N, 'rotulo', /altura original da grande pir/i), nHoje = acha(N, 'rotulo', /altura atual da grande pir/i),
      nLado = acha(N, 'rotulo', /lado da base/i);
    var hOrig = nOrig && pega(nOrig.valor, '#\\s*m\\b'), hHoje = nHoje && pega(nHoje.valor, '#\\s*m\\b'), lado = nLado && pega(nLado.valor, '#\\s*m\\b');
    if (!(hOrig > 0 && hHoje > 0 && lado > 0) || hHoje >= hOrig) return; // sem as três medidas não há desenho
    var covados = pega(nLado.valor, '#\\s*c[ôo]vados');
    var nBlocos = acha(N, 'rotulo', /blocos da grande pir/i), nPeso = acha(N, 'rotulo', /peso total/i);
    var nHer = acha(N, 'rotulo', /trabalhadores.*her[óo]doto/i), nArq = acha(N, 'rotulo', /trabalhadores.*arque[óo]logos/i);
    var nQf = acha(N, 'rotulo', /pir[âa]mide de qu[ée]fren/i), nMq = acha(N, 'rotulo', /pir[âa]mide de miquerinos/i);
    var fato = acha(c.fatos, 'titulo', /grande pir[âa]mide em n[úu]meros/i);
    var PESSOA = 1.7, falta = hOrig - hHoje, rel = relogio(), relG = relogio();

    estilo('piramide', CSS_PIRAMIDE);
    el.classList.add(C());
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 860); });

    el.appendChild(h('h3', { class: C('tit') }, 'A Grande Pirâmide em números'));
    el.appendChild(h('p', { class: C('sub') }, 'A pirâmide de Quéops vista de frente, em escala' + (nOrig.ano ? ', como ficou pronta por volta de ' + txt(nOrig.ano).replace(/^c\.\s*/, '') : '') + ' e como está hoje.'));

    // ---- desenho de frente ----
    var hostD = h('div', { class: C('d') });
    function desenha(w) {
      hostD.textContent = '';
      var peq = w < 520, mL = peq ? 50 : Math.min(124, Math.round(w * 0.17)), topo = 46, pe = 80, ja = rel.ja();
      var esc = (w - 2 * mL) / lado; if (hOrig * esc > 440) esc = 440 / hOrig;
      var meia = lado * esc / 2, cx = w / 2, gy = Math.round(topo + hOrig * esc), H = gy + pe;
      function y(z) { return gy - z * esc; }
      function xe(z) { return cx - meia * (1 - z / hOrig); }
      function xd(z) { return cx + meia * (1 - z / hOrig); }
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Desenho de frente da Grande Pirâmide, em escala. Altura original: ' + U.dec(hOrig) + ' metros. Altura hoje: ' + U.dec(hHoje) +
          ' metros; a ponta que falta, de ' + U.dec(falta) + ' metros, aparece tracejada. Lado da base: ' + U.dec(lado) + ' metros. Ao pé, uma pessoa de ' + U.dec(PESSOA) + ' metro na mesma escala.' });
      hostD.appendChild(svg);
      // fiadas (só até a altura de hoje)
      var nF = Math.max(14, Math.round(hHoje * esc / (peq ? 6.4 : 8))), dz = hHoje / nF, passo = Math.min(55, 1700 / nF), i, k;
      for (i = 0; i < nF; i++) {
        var z0 = i * dz, z1 = (i + 1) * dz, y0 = y(z0), y1 = y(z1), bw = (y0 - y1) * 2.2, d;
        d = 'M' + f1(xe(z0)) + ' ' + f1(y0) + 'H' + f1(xd(z0)) + 'L' + f1(xd(z1)) + ' ' + f1(y1) + 'H' + f1(xe(z1)) + 'Z';
        var lim = Math.ceil(meia / bw) + 1;
        for (k = -lim; k <= lim; k++) {
          var x = cx + (k + (i % 2 ? 0.5 : 0)) * bw;
          if (x > xe(z1) + 1.5 && x < xd(z1) - 1.5) d += 'M' + f1(x) + ' ' + f1(y0) + 'V' + f1(y1);
        }
        svg.appendChild(s('path', { class: C('fiada'), d: d, style: 'animation-delay:' + Math.round(i * passo - ja) + 'ms' }));
      }
      var t0 = Math.round(nF * passo + 250);
      function tarde(no, extra) { no.setAttribute('class', (no.getAttribute('class') || '') + ' ' + C('tarde')); no.style.animationDelay = Math.round(t0 + (extra || 0) - ja) + 'ms'; return no; }
      svg.appendChild(s('line', { class: C('chao'), x1: 2, x2: w - 2, y1: gy + 0.5, y2: gy + 0.5 }));
      // contorno de hoje e ponta perdida
      var yT = y(hHoje), yA = y(hOrig), xTe = xe(hHoje), xTd = xd(hHoje);
      svg.appendChild(tarde(s('path', { class: C('corpo'), d: 'M' + f1(xe(0)) + ' ' + gy + 'L' + f1(xTe) + ' ' + f1(yT) + 'H' + f1(xTd) + 'L' + f1(xd(0)) + ' ' + gy })));
      svg.appendChild(tarde(s('path', { class: C('ponta'), d: 'M' + f1(xTe) + ' ' + f1(yT) + 'L' + f1(cx) + ' ' + f1(yA) + 'L' + f1(xTd) + ' ' + f1(yT) }), 350));
      // cotas
      function risco(x, yy) { return 'M' + f1(x - 3.5) + ' ' + f1(yy + 3.5) + 'L' + f1(x + 3.5) + ' ' + f1(yy - 3.5); }
      var xcE = peq ? 9 : Math.round(mL * 0.3), xcD = w - xcE, yB = gy + 25;
      var g1 = tarde(s('g', null,
        s('path', { class: C('chamada'), d: 'M' + f1(cx - 4) + ' ' + f1(yA) + 'H' + (xcE - 5) }),
        s('path', { class: C('cota'), d: 'M' + xcE + ' ' + gy + 'V' + f1(yA) + risco(xcE, gy) + risco(xcE, yA) }),
        s('text', { class: C('n'), x: xcE + 10, y: f1(yA + (peq ? 24 : 30)), style: 'font-size:' + (peq ? 21 : 27) + 'px' }, U.dec(hOrig) + ' m'),
        s('text', { x: xcE + 10, y: f1(yA + (peq ? 40 : 48)) }, 'altura original'),
        nOrig.ano ? s('text', { x: xcE + 10, y: f1(yA + (peq ? 54 : 63)) }, txt(nOrig.ano)) : null), 600);
      var g2 = tarde(s('g', null,
        s('path', { class: C('chamada'), d: 'M' + f1(xTd + 4) + ' ' + f1(yT) + 'H' + (xcD + 5) }),
        s('path', { class: C('cota'), d: 'M' + xcD + ' ' + gy + 'V' + f1(yT) + risco(xcD, gy) + risco(xcD, yT) }),
        s('text', { class: C('n'), x: xcD - 10, y: f1(yT + (peq ? 24 : 30)), 'text-anchor': 'end', style: 'font-size:' + (peq ? 21 : 27) + 'px' }, U.dec(hHoje) + ' m'),
        s('text', { x: xcD - 10, y: f1(yT + (peq ? 40 : 48)), 'text-anchor': 'end' }, 'altura hoje')), 900);
      var g3 = tarde(s('g', null,
        s('text', { class: C('falta'), x: cx, y: f1(yA - 11), 'text-anchor': 'middle', style: 'font-size:12.5px' }, 'faltam ' + U.dec(falta) + ' m')), 1200);
      var g4 = tarde(s('g', null,
        s('path', { class: C('chamada'), d: 'M' + f1(xe(0)) + ' ' + (gy + 5) + 'V' + (yB + 5) + 'M' + f1(xd(0)) + ' ' + (gy + 5) + 'V' + (yB + 5) }),
        s('path', { class: C('cota'), d: 'M' + f1(xe(0)) + ' ' + yB + 'H' + f1(xd(0)) + risco(xe(0), yB) + risco(xd(0), yB) }),
        s('text', { class: C('n'), x: cx, y: yB + 27, 'text-anchor': 'middle', style: 'font-size:' + (peq ? 21 : 27) + 'px' }, U.dec(lado) + ' m'),
        s('text', { x: cx, y: yB + 44, 'text-anchor': 'middle' }, 'lado da base' + (covados ? ' · ' + U.int(covados) + ' côvados' : ''))), 1400);
      // pessoa na mesma escala
      var hp = Math.max(1.6, PESSOA * esc), xP = xd(0) + (peq ? 10 : 15), lp = Math.max(1.1, hp * 0.3);
      var g5 = tarde(s('g', null,
        s('rect', { class: C('gente'), x: f1(xP - lp / 2), y: f1(gy - hp), width: f1(lp), height: f1(hp) }),
        s('circle', { class: C('aro'), cx: f1(xP), cy: f1(gy - hp / 2), r: Math.max(5, hp * 0.9) }),
        s('path', { class: C('cota'), d: 'M' + f1(xP) + ' ' + f1(gy - hp / 2 - Math.max(5, hp * 0.9) - 2) + 'V' + f1(gy - 26) }),
        s('text', { class: C('forte'), x: f1(xP + 3), y: gy - 43, 'text-anchor': 'middle' }, 'pessoa'),
        s('text', { x: f1(xP + 3), y: gy - 30, 'text-anchor': 'middle' }, 'de ' + U.dec(PESSOA) + ' m')), 1700);
      [g1, g2, g3, g4, g5].forEach(function (g) { svg.appendChild(g); });
    }

    // ---- ficha de números ----
    var ficha = h('dl', { class: C('ficha') });
    function linha(rot, v, depois) {
      var p = parte(v); if (!p) return;
      ficha.appendChild(h('div', null, h('dt', null, rot), h('dd', null, p.aprox ? p.aprox + ' ' : '', h('b', null, p.grande), depois == null ? p.resto : depois)));
    }
    if (nBlocos) linha('Blocos de pedra (estimativa)', nBlocos.valor, 'de blocos');
    if (nPeso) {
      var ps = txt(nPeso.valor).split(';');
      linha('Peso total', ps[0]);
      if (ps[1]) linha('Peso médio de um bloco (o peso total dividido pelo número de blocos)', ps[1]);
    }

    // ---- as três de Gizé ----
    var tres = null, hostT = h('div');
    var hQf = nQf && pega(nQf.valor, '#\\s*m de altura'), lQf = nQf && pega(nQf.valor, '#\\s*m de lado'), hMq = nMq && pega(nMq.valor, '#\\s*m\\b');
    if (hQf > 0 && lQf > 0 && hMq > 0) {
      tres = h('div', { class: C('tres') }, h('p', null, 'As três pirâmides de Gizé, com as alturas na mesma escala'), hostT);
    }
    function desenhaTres(w) {
      hostT.textContent = '';
      var lMq = hMq * lado / hOrig; // sem o lado nos dados: mesma inclinação da Grande Pirâmide
      var lista = [['Quéops', hOrig, lado, U.dec(hOrig) + ' m'], ['Quéfren', hQf, lQf, U.dec(hQf, 2) + ' m'], ['Miquerinos', hMq, lMq, 'cerca de ' + U.dec(hMq) + ' m']];
      var vao = 20, borda = 22, soma = lado + lQf + lMq, esc = Math.min((w - 2 * vao - 2 * borda) / soma, 150 / hOrig);
      var gy = Math.round(hOrig * esc + 8), H = gy + 40, x = (w - soma * esc - 2 * vao) / 2;
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Silhuetas das três pirâmides de Gizé lado a lado: ' + lista.map(function (p) { return p[0] + ', ' + p[3]; }).join('; ') + '.' });
      svg.appendChild(s('line', { class: C('chao'), x1: 2, x2: w - 2, y1: gy + 0.5, y2: gy + 0.5 }));
      lista.forEach(function (p) {
        var b = p[2] * esc, a = p[1] * esc, m = x + b / 2;
        svg.appendChild(s('path', { class: C('tri'), d: 'M' + f1(x) + ' ' + gy + 'L' + f1(m) + ' ' + f1(gy - a) + 'L' + f1(x + b) + ' ' + gy + 'Z' }));
        svg.appendChild(s('text', { class: C('forte'), x: f1(m), y: gy + 17, 'text-anchor': 'middle', style: 'font-size:12px' }, p[0]));
        svg.appendChild(s('text', { x: f1(m), y: gy + 32, 'text-anchor': 'middle' }, p[3]));
        x += b + vao;
      });
      hostT.appendChild(svg);
    }

    el.appendChild(h('div', { class: C('g') }, hostD, h('div', { class: C('lado') }, ficha.children.length ? ficha : null, tres)));
    medir(hostD, U, desenha);
    if (tres) medir(hostT, U, desenhaTres);

    // ---- quem construiu ----
    var vHer = nHer && pega(nHer.valor, '#\\s*mil\\b'), vArq = nArq && pega(nArq.valor, '#\\s*mil\\b');
    var fx = nArq && new RegExp('faixa de ' + NUM + ' a ' + NUM + '\\s*mil', 'i').exec(txt(nArq.valor)), vTeto = fx ? ptNum(fx[2]) : null;
    var quem = null, filas = [];
    if (vHer > 0 && vArq > 0) {
      var CADA = 1000;
      var tempo = acha((c.discute || []).map(function (t) { return { t: t }; }), 't', /^tempo de obra/i);
      quem = h('div', { class: C('quem') }, h('h4', null, 'Quem construiu'),
        h('p', null, 'Dois números para a mesma obra. Cada figura vale ' + U.int(CADA) + ' pessoas.'));
      [[nHer, vHer, 0, 'Segundo Heródoto', ''], [nArq, vArq, vTeto && vTeto > vArq ? vTeto - vArq : 0, 'Segundo os arqueólogos de hoje', C('hoje')]].forEach(function (f) {
        var p = parte(f[0].valor), host = h('div');
        var fila = h('div', { class: C('fila') },
          h('p', null, h('b', null, f[3]), f[0].ano ? ' · ' + txt(f[0].ano) : ''), host,
          h('p', null, h('strong', null, (p && p.aprox ? p.aprox + ' ' : '') + (p ? p.grande : U.int(f[1]) + ' mil')), p ? frase(p.resto) : ''));
        quem.appendChild(fila);
        filas.push({ host: host, cheios: Math.round(f[1] * 1000 / CADA), ocos: Math.round(f[2] * 1000 / CADA), cl: f[4], nome: f[3], v: f[0].valor });
      });
      var chave = h('p', { class: C('chave') },
        h('span', null, boneco(1, C('boneco') + ' ' + C('hoje'), true), U.int(CADA) + ' pessoas'),
        vTeto && vTeto > vArq ? h('span', null, boneco(1, C('boneco') + ' ' + C('oco'), true), 'até ' + U.int(vTeto) + ' mil, o alto da faixa') : null);
      quem.appendChild(chave);
      var fq = acha(c.fatos, 'titulo', /quantos constru[íi]ram/i), lehner = fq && /(Lehner sugere[^.]*\.)/.exec(txt(fq.texto));
      if (lehner || tempo) quem.appendChild(h('p', { class: 'pc-nota', style: { 'margin-top': '14px' } }, [lehner ? lehner[1].replace(/^Lehner sugere/, 'O arqueólogo Mark Lehner sugere') : '', tempo ? tempo.t : ''].filter(Boolean).join(' ')));
      el.appendChild(quem);
      filas.forEach(function (f) { medir(f.host, U, function (w) { desenhaFila(f, w); }); });
    }
    function frase(r) { // "(faixa de…)" vira frase própria; "homens, em turnos…" segue o número
      var m = /^\((.*)\)\s*$/.exec(r); if (!m) return r;
      return m[1].charAt(0).toUpperCase() + m[1].slice(1) + '.';
    }
    function boneco(k, cl, solto) {
      var g = s('g', { class: cl }, s('circle', { cx: 5 * k, cy: 3.6 * k, r: 2.7 * k }),
        s('path', { d: 'M' + f1(1.3 * k) + ' ' + f1(20 * k) + 'V' + f1(11 * k) + 'a' + f1(3.7 * k) + ' ' + f1(3.7 * k) + ' 0 0 1 ' + f1(7.4 * k) + ' 0V' + f1(20 * k) + 'Z' }));
      if (!solto) return g;
      g.style.opacity = 1;
      return s('svg', { width: 10 * k, height: 20 * k, viewBox: '0 0 ' + 10 * k + ' ' + 20 * k, 'aria-hidden': 'true' }, g);
    }
    function desenhaFila(f, w) {
      f.host.textContent = '';
      var total = f.cheios + f.ocos, por = [100, 50, 25, 20, 10].filter(function (n) { return w / n >= 11; })[0] || 10, ja = relG.ja();
      var p = Math.min(15, w / por), k = Math.min(1.15, (p - 2.4) / 10), lin = Math.ceil(total / por), ah = 20 * k + 5;
      var svg = s('svg', { width: w, height: Math.ceil(lin * ah), viewBox: '0 0 ' + w + ' ' + Math.ceil(lin * ah), role: 'img', 'aria-label': f.nome + ': ' + txt(f.v) + '.' });
      for (var i = 0; i < total; i++) {
        var g = boneco(k, C('boneco') + (f.cl ? ' ' + f.cl : '') + (i >= f.cheios ? ' ' + C('oco') : ''));
        g.setAttribute('transform', 'translate(' + f1((i % por) * p) + ' ' + f1(Math.floor(i / por) * ah) + ')');
        g.style.animationDelay = Math.round(i * 9 - ja) + 'ms';
        svg.appendChild(g);
      }
      f.host.appendChild(svg);
    }

    // ---- leitura, números e fontes ----
    el.appendChild(h('p', { class: 'pc-nota', style: { 'margin-top': '22px' } },
      'O que ver aqui: a diferença entre as duas alturas é a ponta que se perdeu, junto com o revestimento. O risco dentro do círculo, ao pé, é uma pessoa na mesma escala. As fileiras de blocos são só indicativas.'));
    var linhasT = [nOrig, nHoje, nLado, nBlocos, nPeso, nHer, nArq, nQf, nMq].filter(Boolean).map(function (n) { return [txt(n.rotulo), txt(n.valor), txt(n.fonte)]; });
    linhasT.push(['Ponta que falta (conta: altura original menos altura de hoje)', U.dec(falta) + ' m', '']);
    if (tres) linhasT.push(['Base de Miquerinos no desenho', 'o lado não está nos dados; a silhueta usa a mesma inclinação da Grande Pirâmide', '']);
    el.appendChild(U.tabela('Ver os números', ['Medida', 'Valor', 'Fonte'], linhasT));
    var fo = fontes(U, [fato ? [txt(fato.fonte), fato.url] : (nOrig ? [txt(nOrig.fonte), nOrig.url] : null), nHer ? [txt(nHer.fonte), nHer.url] : null]);
    if (fo) el.appendChild(fo);

    aoVerBem(hostD, U, 0.8, function () { rel.liga(); el.classList.add(C('vis')); });
    if (quem) U.aoVer(quem, function () { relG.liga(); el.classList.add(C('gente-vis')); });
  });

  // =====================================================================================================
  // cleopatra — "Cleópatra viveu mais perto de nós do que das pirâmides" (interlúdio, depois de ptolemaico)
  // De onde vem cada número:
  //   a Grande Pirâmide, c. 2560 a.C. .. camada imperio-antigo, fato "A Grande Pirâmide em números"
  //                                      (campo ano; se o texto do ano trouxer uma faixa, vale o meio dela)
  //   Cleópatra VII .................... camada ptolemaico. Vale, nesta ordem: o nascimento, se os dados o trouxerem
  //                                      (fato "Nasce Cleópatra…" ou pessoa com anos "69 a 30 a.C."); senão o começo do
  //                                      reinado (pessoa "Cleópatra VII", anos "rainha de 51 a 30 a.C."); senão a morte
  //                                      (fato "Morte de Cleópatra VII"). Hoje os dados só trazem 51 e 30 a.C.
  //   hoje, 2026 ....................... dados.hoje
  //   Tutancâmon, c. 1323 a.C. ......... camada imperio-novo, fato "Tutancâmon e o túmulo KV62"
  //   Alexandre, 332 a.C. .............. camada ptolemaico, fato "Alexandre no Egito e o oráculo de Siwa"
  //   conquista árabe, 641 ............. camada islamico-inicial, fato "Alexandria se rende por tratado"
  //   Napoleão, 1798 ................... camada napoleao, fato "Napoleão desembarca no Egito"
  //   os dois vãos e a diferença ....... conta com os anos acima; não existe ano zero (depois de 1 a.C. vem 1 d.C.)
  // =====================================================================================================
  var CSS_CLEOPATRA =
    '@keyframes pc-cleopatra-surge{from{opacity:0}to{opacity:1}}' +
    '@keyframes pc-cleopatra-cx{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '@keyframes pc-cleopatra-cy{from{transform:scaleY(0)}to{transform:scaleY(1)}}' +
    '&{--pc-longe:color-mix(in srgb,var(--tinta2) 62%,var(--fundo))}' +
    '& svg{display:block;overflow:visible}' +
    '& svg text{font-family:var(--sem);font-size:12px;fill:var(--tinta2)}' +
    '& svg text&-ano{font-family:var(--serifa);font-weight:600;font-size:21px;fill:var(--tinta);font-variant-numeric:tabular-nums}' +
    '& svg &-nome{font-family:var(--sem);font-weight:400;font-size:13px;fill:var(--tinta)}' +
    '& svg text&-big{font-family:var(--serifa);font-weight:600;font-size:34px;fill:var(--tinta);font-variant-numeric:tabular-nums;letter-spacing:-.01em}' +
    '& svg&-peq text&-big{font-size:28px}' +
    '& svg text&-big&-perto{fill:var(--acento)}' +
    '& svg &-un{font-family:var(--sem);font-weight:500;font-size:13px;fill:var(--tinta2);letter-spacing:0}' +
    '& svg &-m1{font-weight:600;fill:var(--tinta)}' +
    '&-a{fill:var(--pc-longe)}' +
    '&-b{fill:var(--acento)}' +
    '&-sx{transform-box:fill-box;transform-origin:0 50%;transform:scaleX(0)}' +
    '&-sy{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(0)}' +
    '&-vis &-sx{animation:pc-cleopatra-cx 1.1s cubic-bezier(.45,0,.2,1) both}' +
    '&-vis &-sy{animation:pc-cleopatra-cy 1.1s cubic-bezier(.45,0,.2,1) both}' +
    '&-t{opacity:0}' +
    '&-vis &-t{animation:pc-cleopatra-surge .6s ease both}' +
    '&-fio{stroke:var(--tinta2);stroke-width:1;opacity:.5}' +
    '&-tique{stroke:var(--tinta2);stroke-width:1.2}' +
    '&-meio{stroke:var(--tinta2);stroke-width:1;stroke-dasharray:3 4}' +
    '&-pir{fill:var(--tinta)}' +
    '&-cleo{fill:var(--acento);stroke:var(--fundo);stroke-width:2.5}' +
    '&-hoje{fill:var(--fundo);stroke:var(--tinta);stroke-width:2}' +
    '&-conta{display:grid;gap:16px 34px;margin:26px 0 0}' +
    '&-largo &-conta{grid-template-columns:repeat(3,minmax(0,1fr));align-items:start}' +
    '&-conta div{border-top:3px solid var(--linha);padding-top:10px}' +
    '&-conta div&-ca{border-top-color:var(--pc-longe)}' +
    '&-conta div&-cb{border-top-color:var(--acento)}' +
    '&-conta span{display:block;font-size:13px;color:var(--tinta2)}' +
    '&-conta b{display:block;font-family:var(--serifa);font-size:clamp(24px,2.8vw,30px);font-weight:600;line-height:1.15;margin:3px 0 4px;font-variant-numeric:tabular-nums}' +
    '&-conta i{display:block;font-style:normal;font-size:13px;color:var(--tinta2);font-variant-numeric:tabular-nums;line-height:1.4}' +
    '&-nota{margin-top:22px}' +
    '@media (prefers-reduced-motion:reduce),print{&-t{opacity:1!important;animation:none!important}&-sx,&-sy{transform:none!important;animation:none!important}}';

  /** ano -> posição numa régua contínua (não existe ano zero: 1 a.C. fica em 0) */
  function eixo(a) { return a < 0 ? a + 1 : a; }
  function dataPir(f) {
    if (!f) return null;
    var t = txt(f.ano_txt), m = /(\d{3,4})\s*a\s*(\d{3,4})\s*a\.C\./.exec(t);
    if (m) return { ano: -Math.round((+m[1] + +m[2]) / 2), c: true }; // faixa: vale o meio
    return typeof f.ano === 'number' ? { ano: f.ano, c: /^\s*c\./.test(t) } : null;
  }
  function dataCleo(c) {
    var p = acha(c.pessoas, 'nome', /cle[óo]patra/i), anos = p ? txt(p.anos) : '', m;
    var f = (c.fatos || []).filter(function (x) { return /nasc/i.test(txt(x.titulo)) && /cle[óo]patra/i.test(txt(x.titulo)) && typeof x.ano === 'number'; })[0];
    if (f) return { ano: f.ano, tipo: 'nasc', fato: f };
    if ((m = /nasc\w*\s+(?:em\s+)?(?:c\.\s*)?(\d{1,4})\s*a\.C\./i.exec(anos))) return { ano: -m[1], tipo: 'nasc' };
    if ((m = /^\s*(?:c\.\s*)?(\d{1,4})\s*(?:a|–|-)\s*(\d{1,4})\s*a\.C\./.exec(anos))) return { ano: -m[1], tipo: 'nasc' };
    if ((m = /(?:rainha|rein\w*)\s+de\s+(?:c\.\s*)?(\d{1,4})\s+a\s+(\d{1,4})\s*a\.C\./i.exec(anos))) {
      return { ano: -m[1], tipo: 'trono', fato: acha(c.fatos, 'texto', new RegExp('reinava desde ' + m[1] + ' a\\.C\\.', 'i')) };
    }
    f = acha(c.fatos, 'titulo', /morte de cle[óo]patra/i);
    return f && typeof f.ano === 'number' ? { ano: f.ano, tipo: 'morte', fato: f } : null;
  }

  E.peca('cleopatra', function (el, dados, U) {
    var h = U.h, s = U.s, C = prefixo('cleopatra');
    var cAnt = camadaDe(dados, 'imperio-antigo'), cPt = camadaDe(dados, 'ptolemaico'); if (!cAnt || !cPt) return;
    var HOJE = (dados && +dados.hoje) || U.HOJE;
    var fPir = acha(cAnt.fatos, 'titulo', /grande pir[âa]mide em n[úu]meros/i) || acha(cAnt.fatos, 'titulo', /grande pir[âa]mide/i);
    var pir = dataPir(fPir), cleo = dataCleo(cPt);
    if (!pir || !cleo || !(pir.ano < cleo.ano && cleo.ano < 0 && HOJE > 0)) return;
    var total = eixo(HOJE) - eixo(pir.ano), vA = eixo(cleo.ano) - eixo(pir.ano), vB = eixo(HOJE) - eixo(cleo.ano);
    if (!(vA > vB)) return; // se os dados mudarem e a frase deixar de valer, a peça não aparece
    function anoTxt(a, c) { return (c ? 'c. ' : '') + U.ano(a); }
    var CL = { nasc: ['nasce Cleópatra VII', ['nasce', 'Cleópatra VII'], 'o nascimento de Cleópatra VII', 'ao nascimento de Cleópatra VII'],
      trono: ['Cleópatra VII vira rainha', ['Cleópatra VII', 'vira rainha'], 'o ano em que Cleópatra VII virou rainha', 'ao ano em que Cleópatra VII virou rainha'],
      morte: ['morre Cleópatra VII', ['morre', 'Cleópatra VII'], 'a morte de Cleópatra VII', 'à morte de Cleópatra VII'] }[cleo.tipo];
    var men = [];
    [['imperio-novo', /tutanc[âa]mon/i, 'Tutancâmon', 'Tutancâmon'], ['ptolemaico', /alexandre no egito/i, 'Alexandre', 'Alexandre toma o Egito'],
      ['islamico-inicial', /alexandria se rende|babil[ôo]nia se rende/i, 'conquista árabe', 'conquista árabe'],
      ['napoleao', /napole[ãa]o desembarca/i, 'Napoleão', 'Napoleão desembarca']].forEach(function (x) {
      var cm = camadaDe(dados, x[0]), f = cm && acha(cm.fatos, 'titulo', x[1]);
      if (f && typeof f.ano === 'number' && f.ano > pir.ano && f.ano < HOJE && Math.abs(eixo(f.ano) - eixo(cleo.ano)) > total * 0.03) {
        men.push({ ano: f.ano, quando: anoTxt(f.ano, /^\s*c\./.test(txt(f.ano_txt))), curto: x[2], longo: x[3], fato: f });
      }
    });
    men.sort(function (a, b) { return a.ano - b.ano; });

    estilo('cleopatra', CSS_CLEOPATRA);
    el.classList.add(C());
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 600); });
    var rel = relogio(), host = h('div');
    var rotulo = 'Régua do tempo de ' + anoTxt(pir.ano, pir.c) + ' a ' + HOJE + '. Da Grande Pirâmide ' + CL[3] + ', em ' + U.ano(cleo.ano) + ': ' + U.int(vA) +
      ' anos. Daí até hoje: ' + U.int(vB) + ' anos.' + (men.length ? ' Outras marcas: ' + men.map(function (m) { return m.longo + ', ' + m.quando; }).join('; ') + '.' : '');

    function compr(t, chute) { var n = 0; try { n = t.getComputedTextLength(); } catch (e) {} return n || chute || txt(t.textContent).length * 6.6; }
    function desenha(w) {
      host.textContent = '';
      var ja = rel.ja(), svg = s('svg', { role: 'img', 'aria-label': rotulo }), H;
      host.appendChild(svg);
      function t(no, d) { no.setAttribute('class', ((no.getAttribute('class') || '') + ' ' + C('t')).trim()); no.style.animationDelay = Math.round(d - ja) + 'ms'; return no; }
      function seg(a, cl, d) { var r = s('rect', a); r.setAttribute('class', cl); r.style.animationDelay = Math.round(d - ja) + 'ms'; return r; }
      function big(x, y, n, anc, perto) {
        return s('text', { class: C('big') + (perto ? ' ' + C('perto') : ''), x: f1(x), y: f1(y), 'text-anchor': anc }, U.int(n), anc === 'middle' ? s('tspan', { class: C('un'), dx: 7 }, 'anos') : null);
      }
      if (w >= 600) {
        // ---- régua deitada ----
        var pad = 30, x0 = pad, x1 = w - pad, yAx = 142, curto = w < 900, T = { pir: 0, a: 400, cleo: 1500, na: 1750, b: 2300, hoje: 3300, nb: 3500, men: 4050, meio: 4750 };
        var X = function (a) { return x0 + (eixo(a) - eixo(pir.ano)) / total * (x1 - x0); }, xC = X(cleo.ano), xM = (x0 + x1) / 2;
        svg.appendChild(seg({ x: f1(x0), y: yAx - 2.5, width: f1(xC - x0), height: 5, rx: 2.5 }, C('a') + ' ' + C('sx'), T.a));
        svg.appendChild(seg({ x: f1(xC), y: yAx - 2.5, width: f1(x1 - xC), height: 5, rx: 2.5 }, C('b') + ' ' + C('sx'), T.b));
        svg.appendChild(t(s('g', null,
          s('line', { class: C('fio'), x1: x0, x2: x0, y1: 60, y2: yAx - 18 }),
          s('path', { class: C('pir'), d: 'M' + (x0 - 10) + ' ' + (yAx + 2.5) + 'L' + x0 + ' ' + (yAx - 13) + 'L' + (x0 + 10) + ' ' + (yAx + 2.5) + 'Z' }),
          s('text', { class: C('ano'), x: x0 - 10, y: 30 }, anoTxt(pir.ano, pir.c)),
          s('text', { class: C('nome'), x: x0 - 10, y: 50 }, 'a Grande Pirâmide fica pronta')), T.pir));
        svg.appendChild(t(s('g', null,
          s('line', { class: C('fio'), x1: f1(xC), x2: f1(xC), y1: 60, y2: yAx - 11 }),
          s('circle', { class: C('cleo'), cx: f1(xC), cy: yAx, r: 7 }),
          s('text', { class: C('ano'), x: f1(xC), y: 30, 'text-anchor': 'middle' }, U.ano(cleo.ano)),
          s('text', { class: C('nome'), x: f1(xC), y: 50, 'text-anchor': 'middle' }, CL[0])), T.cleo));
        svg.appendChild(t(s('g', null,
          s('line', { class: C('fio'), x1: x1, x2: x1, y1: 60, y2: yAx - 10 }),
          s('circle', { class: C('hoje'), cx: x1, cy: yAx, r: 5.5 }),
          s('text', { class: C('ano'), x: x1 + 10, y: 30, 'text-anchor': 'end' }, String(HOJE)),
          s('text', { class: C('nome'), x: x1 + 10, y: 50, 'text-anchor': 'end' }, 'hoje')), T.hoje));
        svg.appendChild(t(big((x0 + xC) / 2, yAx - 26, vA, 'middle', false), T.na));
        svg.appendChild(t(big((xC + x1) / 2, yAx - 26, vB, 'middle', true), T.nb));
        var ant = -1e9;
        men.forEach(function (m, i) {
          var x = X(m.ano), t1 = s('text', { class: C('m1'), y: yAx + 32 }, m.quando), t2 = s('text', { y: yAx + 47 }, curto ? m.curto : m.longo);
          var g = s('g', null, s('line', { class: C('tique'), x1: f1(x), x2: f1(x), y1: yAx + 6, y2: yAx + 15 }), t1, t2);
          svg.appendChild(g);
          var lg = Math.max(compr(t1), compr(t2));
          if (x - lg / 2 < ant + 12 && !curto) { t2.textContent = m.curto; lg = Math.max(compr(t1), compr(t2)); }
          var anc = 'middle', xt = x, xe = x - lg / 2, xd = x + lg / 2;
          if (xd > w - 2 || (x < xM && xd > xM - 10)) { anc = 'end'; xt = x + 4; xe = xt - lg; xd = xt; }
          else if (xe < 2 || (x >= xM && xe < xM + 10)) { anc = 'start'; xt = x - 4; xe = xt; xd = xt + lg; }
          [t1, t2].forEach(function (tx) { tx.setAttribute('x', f1(xt)); tx.setAttribute('text-anchor', anc); });
          ant = xd; t(g, T.men + i * 130);
        });
        var tm = s('text', { x: f1(xM), y: yAx + 86, 'text-anchor': 'middle' }, 'meio do caminho entre a pirâmide e hoje');
        svg.appendChild(t(s('g', null, s('line', { class: C('meio'), x1: f1(xM), x2: f1(xM), y1: yAx - 16, y2: yAx + 70 }), tm), T.meio));
        H = yAx + 96;
      } else {
        // ---- régua em pé: hoje em cima, a pirâmide embaixo (como a página, de hoje para trás) ----
        var larg = Math.min(w, 400), dx = Math.round((w - larg) / 2), est = larg < 340, xa = dx + (est ? 98 : 124), y0 = 34, alt = est ? 520 : 560, y1 = y0 + alt, xr = xa + 20, cabe = dx + larg - xr - 2;
        var TV = { hoje: 0, b: 400, cleo: 1400, nb: 1600, a: 2150, pir: 3300, na: 3500, men: 4050, meio: 4750 };
        var Y = function (a) { return y0 + (eixo(HOJE) - eixo(a)) / total * alt; }, yC = Y(cleo.ano), yM = (y0 + y1) / 2;
        if (est) svg.setAttribute('class', C('peq'));
        svg.appendChild(seg({ x: xa - 2.5, y: y0, width: 5, height: f1(yC - y0), rx: 2.5 }, C('b') + ' ' + C('sy'), TV.b));
        svg.appendChild(seg({ x: xa - 2.5, y: f1(yC), width: 5, height: f1(y1 - yC), rx: 2.5 }, C('a') + ' ' + C('sy'), TV.a));
        svg.appendChild(t(s('g', null, s('circle', { class: C('hoje'), cx: xa, cy: y0, r: 5.5 }),
          s('text', { class: C('ano'), x: xr, y: y0 + 7 }, String(HOJE), s('tspan', { class: C('nome'), dx: 8 }, 'hoje'))), TV.hoje));
        var marco = function (y, ano, nome, partes, forma, d) {
          var tn = s('text', { class: C('nome'), x: xr, y: f1(y - 6) }, nome), ta = s('text', { class: C('ano'), x: xr, y: f1(y - 25) }, ano), g = s('g', null, forma, ta, tn);
          svg.appendChild(g);
          if (compr(tn) > cabe) { // não coube numa linha: duas
            tn.textContent = partes[1]; ta.setAttribute('y', f1(y - 41));
            g.insertBefore(s('text', { class: C('nome'), x: xr, y: f1(y - 22) }, partes[0]), tn);
          }
          t(g, d);
        };
        marco(yC, U.ano(cleo.ano), CL[0], CL[1], s('circle', { class: C('cleo'), cx: xa, cy: f1(yC), r: 7 }), TV.cleo);
        marco(y1, anoTxt(pir.ano, pir.c), 'a Grande Pirâmide fica pronta', ['a Grande Pirâmide', 'fica pronta'],
          s('path', { class: C('pir'), d: 'M' + (xa - 10) + ' ' + (y1 + 3) + 'L' + xa + ' ' + (y1 - 13) + 'L' + (xa + 10) + ' ' + (y1 + 3) + 'Z' }), TV.pir);
        var bloco = function (ym, n, l1, l2, perto, d) {
          svg.appendChild(t(s('g', null, big(xa - 20, ym, n, 'end', perto),
            s('text', { class: C('un'), x: xa - 20, y: f1(ym + 19), 'text-anchor': 'end' }, 'anos'),
            s('text', { x: xa - 20, y: f1(ym + 40), 'text-anchor': 'end' }, l1), s('text', { x: xa - 20, y: f1(ym + 55), 'text-anchor': 'end' }, l2)), d));
        };
        bloco((y0 + yC) / 2 - 12, vB, 'de Cleópatra', 'até hoje', true, TV.nb);
        bloco((yC + y1) / 2 - 12, vA, 'da pirâmide', 'a Cleópatra', false, TV.na);
        men.slice().reverse().forEach(function (m, i) {
          var y = Y(m.ano), tx = s('text', { x: xr, y: f1(y + 4) }, s('tspan', { class: C('m1') }, m.quando), ' · ' + m.longo);
          var g = s('g', null, s('line', { class: C('tique'), x1: xa + 6, x2: xa + 14, y1: f1(y), y2: f1(y) }), tx);
          svg.appendChild(g);
          if (compr(tx) > cabe) tx.lastChild.textContent = ' · ' + m.curto;
          t(g, TV.men + i * 130);
        });
        svg.appendChild(t(s('g', null, s('line', { class: C('meio'), x1: xa - 14, x2: xa + 14, y1: f1(yM), y2: f1(yM) }),
          s('text', { x: xa - 20, y: f1(yM - 3), 'text-anchor': 'end' }, 'meio do'), s('text', { x: xa - 20, y: f1(yM + 11), 'text-anchor': 'end' }, 'caminho')), TV.meio));
        H = y1 + 22;
      }
      svg.setAttribute('width', w); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + H);
    }

    el.appendChild(host);
    var conta = h('div', { class: C('conta') + ' ' + C('t'), style: 'animation-delay:5200ms' },
      h('div', { class: C('ca') }, h('span', null, 'Da pirâmide a Cleópatra'), h('b', null, U.int(vA) + ' anos'), h('i', null, U.int(-pir.ano).replace('.', '') + ' − ' + (-cleo.ano) + ' = ' + U.int(vA))),
      h('div', { class: C('cb') }, h('span', null, 'De Cleópatra a hoje'), h('b', null, U.int(vB) + ' anos'), h('i', null, (-cleo.ano) + ' + ' + HOJE + ' − 1 = ' + U.int(vB) + ' (não existe ano zero)')),
      h('div', null, h('span', null, 'Diferença'), h('b', null, U.int(vA - vB) + ' anos'), h('i', null, 'Cleópatra fica mais perto de hoje do que da pirâmide.')));
    el.appendChild(conta);
    el.appendChild(h('p', { class: 'pc-nota ' + C('nota') }, 'O que ver aqui: a marca de Cleópatra cai do lado de cá do meio do caminho. ' +
      (cleo.tipo === 'nasc' ? '' : 'A conta usa ' + CL[2] + ', ' + U.ano(cleo.ano) + ', a data mais antiga da vida dela neste estudo. ') +
      (pir.c ? 'A data da pirâmide é aproximada, mas a ordem só mudaria se ela fosse ' + U.int(vA - vB) + ' anos mais nova.' : '')));
    var linhasT = [['A Grande Pirâmide fica pronta', anoTxt(pir.ano, pir.c), fPir ? txt(fPir.fonte) : ''],
      [CL[0].charAt(0).toUpperCase() + CL[0].slice(1), U.ano(cleo.ano), cleo.fato ? txt(cleo.fato.fonte) : ''], ['Hoje', String(HOJE), '']];
    men.forEach(function (m) { linhasT.push([m.longo.charAt(0).toUpperCase() + m.longo.slice(1), m.quando, txt(m.fato.fonte)]); });
    linhasT.push(['Da pirâmide a Cleópatra', U.int(vA) + ' anos', 'conta']);
    linhasT.push(['De Cleópatra a hoje', U.int(vB) + ' anos', 'conta (não existe ano zero)']);
    el.appendChild(U.tabela('Ver os números', ['Marco', 'Ano', 'Fonte'], linhasT));
    var fo = fontes(U, [fPir ? [txt(fPir.fonte), fPir.url] : null, cleo.fato ? [txt(cleo.fato.fonte), cleo.fato.url] : null]);
    if (fo) el.appendChild(fo);

    medir(host, U, desenha);
    // deitada, começa com a régua quase toda à vista; em pé, assim que o alto (hoje) aparece
    aoVerBem(host, U, function () { return host.getBoundingClientRect().height > 400 ? 0 : 0.7; }, function () { rel.liga(); el.classList.add(C('vis')); });
  });

  // =====================================================================================================
  // faixa-do-nilo — "Um país em fila" (camada hoje)
  // De onde vem cada número (camada.numeros, pelo rótulo):
  //   cerca de 95% ...................... "População que vive junto ao Nilo e no delta" (2025, Wikipedia)
  //   109,5 milhões ..................... "População dentro do país (relógio da CAPMAS)"
  //   121 habitantes por km² ............ "População urbana e densidade média"
  //   25 mil pessoas por ponto .......... convenção do desenho: a população dividida pelo número de pontos
  // O desenho é esquemático: 95 de cada 100 pontos seguem o Nilo e o delta de EGITO.geo (mais densos no Cairo e
  // no delta); os outros ficam no canal e nos oásis de EGITO.geo. Não é um mapa de população medido.
  // Os pontos saem de um sorteio com semente fixa: o desenho é sempre o mesmo.
  // =====================================================================================================
  var CSS_FAIXA =
    '&-tit{font-size:clamp(25px,3.4vw,36px);margin:0 0 22px}' +
    '&-g{display:grid;gap:20px 52px;grid-template-areas:"cab" "mapa" "apoio"}' +
    '&-largo &-g{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);grid-template-areas:"cab mapa" "apoio mapa";grid-template-rows:auto auto}' +
    '&-cab{grid-area:cab;align-self:end}' +
    '&-mapa{grid-area:mapa;align-self:center}' +
    '&-nota{margin-top:22px}' +
    '&-num{font-family:var(--serifa);font-weight:600;font-size:clamp(76px,11vw,132px);line-height:.92;color:var(--acento);letter-spacing:-.03em;margin:0;font-variant-numeric:tabular-nums}' +
    '&-num small{display:block;font-family:var(--sem);font-size:14px;font-weight:500;line-height:1.3;color:var(--tinta2);letter-spacing:0;margin:0 0 6px}' +
    '&-frase{font-family:var(--serifa);font-size:clamp(20px,2.4vw,27px);line-height:1.28;margin:12px 0 20px;max-width:16em}' +
    '&-apoio{grid-area:apoio;align-self:start;font-size:14px;color:var(--tinta2);margin:0;max-width:34em;min-height:5.2em}' +
    '&-mapa{position:relative;--pc-rot:var(--tinta2);--pc-halo:var(--fundo)}' +
    '&-claro &-mapa{background:#0c1322;border-radius:14px;--pc-rot:#aab4c6;--pc-halo:#0c1322}' +
    '&-mapa canvas{display:block}' +
    '&-mapa svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}' +
    '&-mapa text{font-family:var(--sem);font-size:11px;fill:var(--pc-rot);paint-order:stroke;stroke:var(--pc-halo);stroke-width:3px;stroke-linejoin:round}' +
    '&-mapa text&-mar{font-family:var(--serifa);font-style:italic;font-size:12px;letter-spacing:.06em;opacity:.8}';

  function sorteio(a) { // mulberry32
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function dentro(pol, x, y) {
    var c = false;
    for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      var xi = pol[i][0], yi = pol[i][1], xj = pol[j][0], yj = pol[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /** pontos de luz: [x0, y0, x1, y1, atraso] em unidades de EGITO.geo; começam espalhados e terminam junto ao rio */
  function luzes(G, nRio, nFora) {
    var R = sorteio(2026), CXG = 0.895;
    function g() { var u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * R()); }
    function naLinha(pts, f) {
      var L = [], tot = 0, i, d;
      for (i = 1; i < pts.length; i++) { d = Math.hypot((pts[i][0] - pts[i - 1][0]) * CXG, pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
      var alvo = f * tot;
      for (i = 0; i < L.length; i++) {
        if (alvo <= L[i] || i === L.length - 1) { var q = Math.max(0, Math.min(1, alvo / L[i])); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q]; }
        alvo -= L[i];
      }
      return pts[0];
    }
    function emTerra(faz) { for (var k = 0; k < 30; k++) { var p = faz(); if (dentro(G.TERRA, p[0], p[1])) return p; } return null; }
    function nuvem(c, sx, sy) { return function () { return [c[0] + g() * sx, c[1] + g() * sy]; }; }
    function fita(pts, s, f0, f1) { return function () { var p = naLinha(pts, f0 + R() * (f1 - f0)); return [p[0] + g() * s / CXG, p[1] + g() * s]; }; }
    function noDelta() { for (var k = 0; k < 60; k++) { var x = 29.9 + R() * 2.4, y = 30.18 + R() * 1.42; if (dentro(G.DELTA, x, y)) return [x, y]; } return [31.1, 30.6]; }
    var cid = {}; G.CIDADES.forEach(function (c) { cid[c[0]] = [c[1], c[2]]; });
    var cairo = cid.Cairo || [31.24, 30.04], alex = cid.Alexandria || [29.92, 31.2];
    // onde ficam os pontos do rio (somam 1): Cairo, miolo do delta, os dois braços, Alexandria, vale largo (norte) e vale estreito (sul)
    var partes = [[0.18, nuvem(cairo, 0.13, 0.12)], [0.31, noDelta], [0.06, fita(G.ROSETA, 0.05, 0, 1)], [0.06, fita(G.DAMIETA, 0.05, 0, 1)],
      [0.03, nuvem([alex[0] + 0.06, alex[1] - 0.07], 0.15, 0.05)], [0.20, fita(G.NILO, 0.055, 0.52, 1)], [0.16, fita(G.NILO, 0.03, 0, 0.52)]];
    var alvos = [], i, k, p;
    partes.forEach(function (pt) { var n = Math.round(pt[0] * nRio); for (k = 0; k < n && alvos.length < nRio; k++) { p = emTerra(pt[1]); if (p) alvos.push(p); } });
    while (alvos.length < nRio) { p = emTerra(noDelta); if (p) alvos.push(p); }
    var nCanal = Math.round(nFora * 0.6), porOasis = Math.max(1, Math.floor((nFora - nCanal) / G.OASIS.length));
    for (k = 0; k < nCanal; k++) { p = emTerra(fita(G.CANAL, 0.03, 0, 1)); if (p) alvos.push(p); }
    G.OASIS.forEach(function (o) { for (k = 0; k < porOasis && alvos.length < nRio + nFora; k++) { p = emTerra(nuvem([o[1], o[2]], 0.07, 0.06)); if (p) alvos.push(p); } });
    var ini = [];
    while (ini.length < alvos.length) { p = [24.7 + R() * 12.2, 22 + R() * 9.7]; if (dentro(G.TERRA, p[0], p[1])) ini.push(p); }
    // casa os pontos por latitude: cada um anda quase de lado até o rio
    ini.sort(function (a, b) { return b[1] - a[1]; }); alvos.sort(function (a, b) { return b[1] - a[1]; });
    var out = new Float32Array(alvos.length * 5);
    for (i = 0; i < alvos.length; i++) { out[i * 5] = G.X(ini[i][0]); out[i * 5 + 1] = G.Y(ini[i][1]); out[i * 5 + 2] = G.X(alvos[i][0]); out[i * 5 + 3] = G.Y(alvos[i][1]); out[i * 5 + 4] = R(); }
    return out;
  }

  E.peca('faixa-do-nilo', function (el, dados, U, args) {
    var h = U.h, s = U.s, c = args && args.camada, G = E.geo; if (!c || !G) return;
    var N = c.numeros || [], C = prefixo('faixa-do-nilo');
    var nPct = acha(N, 'rotulo', /junto ao nilo e no delta/i), pct = nPct && pega(nPct.valor, '#\\s*%');
    if (!(pct > 50 && pct < 100)) return;
    var nPop = acha(N, 'rotulo', /popula[çc][ãa]o dentro do pa[íi]s/i), pop = nPop ? ptNum(txt(nPop.valor).replace(/[^\d.,]/g, '')) : 0;
    var nDens = acha(N, 'rotulo', /densidade/i), dens = nDens && pega(nDens.valor, '#\\s*habitantes por km');
    var CADA = 25000, total = pop > 1e7 ? Math.round(pop / CADA) : 4000, nRio = Math.round(total * pct / 100), P = luzes(G, nRio, total - nRio), nP = P.length / 5;
    var escuro = !ehClaro(el, U), pp = parte(nPct.valor);

    estilo('faixa-do-nilo', CSS_FAIXA);
    el.classList.add(C()); if (!escuro) el.classList.add(C('claro'));
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 820); });

    // começa espalhado por igual; ao entrar na tela, os pontos se juntam (com movimento reduzido, já começa no fim)
    var estado = U.reduz ? 'real' : 'igual', prog = U.reduz ? 1 : 0, alvo = prog, raf = 0, mexeu = false, naTela = false, tUlt = 0, k = 1, ctx = null, cores = null;
    var apoio = h('p', { class: C('apoio'), 'aria-live': 'polite' });
    var TEXTO = {
      igual: (pop > 1e7 ? 'Cada ponto vale cerca de ' + U.int(CADA / 1000) + ' mil pessoas. ' : '') + 'Se a população se espalhasse por igual, os pontos cobririam o mapa inteiro' +
        (dens ? ': seriam ' + U.int(dens) + ' pessoas por km².' : '.'),
      real: (pop > 1e7 ? 'Cada ponto vale cerca de ' + U.int(CADA / 1000) + ' mil pessoas. ' : '') + 'De cada 100 pontos, ' + U.int(pct) +
        ' ficam numa faixa junto ao Nilo e no delta. O resto do mapa é deserto: os poucos pontos de fora marcam o canal de Suez e os oásis.'
    };
    var bt = U.botoes([{ id: 'real', rotulo: 'onde vivem' }, { id: 'igual', rotulo: 'se fosse por igual' }], estado, function (id) { vai(id, true); }, 'O que o mapa mostra');
    function marca(id) { Array.prototype.forEach.call(bt.children, function (b, i) { b.setAttribute('aria-pressed', (i === 0) === (id === 'real') ? 'true' : 'false'); }); }
    function vai(id, daPessoa) {
      estado = id; alvo = id === 'real' ? 1 : 0; marca(id); apoio.textContent = TEXTO[id];
      if (daPessoa) mexeu = true;
      if (U.reduz) { prog = alvo; pinta(); return; }
      anda();
    }
    function anda() { if (!raf && naTela && prog !== alvo) { tUlt = 0; raf = requestAnimationFrame(passo); } }
    function passo(ts) {
      raf = 0;
      var dt = tUlt ? Math.min(60, ts - tUlt) : 16; tUlt = ts;
      var v = dt / 2800; prog = prog < alvo ? Math.min(alvo, prog + v) : Math.max(alvo, prog - v);
      pinta();
      if (prog !== alvo && naTela) raf = requestAnimationFrame(passo);
    }
    function rgba(hex, a) { var m = /^#([0-9a-f]{6})$/i.exec(hex), n = m ? parseInt(m[1], 16) : 0xf2c14e; return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    function pinta() {
      if (!ctx) return;
      var W = G.W * k + 12, H = G.H * k + 12, i, t = G.TERRA, ESP = 0.55, tam = Math.max(1.05, 1.3 * Math.sqrt(k)) * (1.4 - 0.4 * prog);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      for (i = 0; i < t.length; i++) ctx[i ? 'lineTo' : 'moveTo'](6 + G.X(t[i][0]) * k, 6 + G.Y(t[i][1]) * k);
      ctx.closePath(); ctx.fillStyle = cores.terra; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = cores.costa; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = cores.luz;
      for (i = 0; i < nP; i++) {
        var q = Math.max(0, Math.min(1, prog * (1 + ESP) - P[i * 5 + 4] * ESP)), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        ctx.fillRect(6 + (P[i * 5] + (P[i * 5 + 2] - P[i * 5]) * e) * k - tam / 2, 6 + (P[i * 5 + 1] + (P[i * 5 + 3] - P[i * 5 + 1]) * e) * k - tam / 2, tam, tam);
      }
    }

    var mapa = h('div', { class: C('mapa'), role: 'img', 'aria-label': 'Mapa do Egito à noite, em desenho: milhares de pontos de luz se juntam numa faixa ao longo do Nilo e no delta, e o deserto fica vazio. ' +
      txt(nPct.valor) + ' da população vive junto ao rio e no delta.' });
    function desenha(w) {
      k = (w - 12) / G.W;
      var H = Math.round(G.H * k + 12), dpr = Math.min(2, window.devicePixelRatio || 1);
      mapa.textContent = '';
      var cv = h('canvas', { width: Math.round(w * dpr), height: Math.round(H * dpr), 'aria-hidden': 'true', style: { width: w + 'px', height: H + 'px' } });
      ctx = cv.getContext && cv.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cores = { terra: escuro ? (U.cor(el, 's1') || '#141d31') : '#141d31', costa: escuro ? (U.cor(el, 'linha') || '#2a3653') : '#2a3653', luz: rgba(escuro ? U.cor(el, 'acento') : '#f2c14e', Math.max(0.5, Math.min(0.74, 0.36 + 0.3 * k))) };
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, 'aria-hidden': 'true' });
      function X(lon) { return 6 + G.X(lon) * k; } function Y(lat) { return 6 + G.Y(lat) * k; }
      svg.appendChild(s('text', { class: C('mar'), x: f1(X(27.3)), y: f1(Y(31.78)), 'text-anchor': 'middle' }, 'Mediterrâneo'));
      svg.appendChild(s('text', { class: C('mar'), x: f1(X(35.25)), y: f1(Y(26.2)), 'text-anchor': 'middle', transform: 'rotate(58 ' + f1(X(35.25)) + ' ' + f1(Y(26.2)) + ')' }, 'Mar Vermelho'));
      svg.appendChild(s('text', { class: C('mar'), x: f1(X(27.6)), y: f1(Y(25.6)), 'text-anchor': 'middle' }, 'deserto'));
      G.CIDADES.forEach(function (cd) {
        if (!/^(Cairo|Alexandria|Luxor|Assuã)$/.test(cd[0])) return;
        var esq = cd[3] === 'e', dx = cd[0] === 'Cairo' ? 16 : 9;
        svg.appendChild(s('text', { x: f1(X(cd[1]) + (esq ? -dx : dx)), y: f1(Y(cd[2]) + 4), 'text-anchor': esq ? 'end' : 'start' }, cd[0]));
      });
      svg.appendChild(s('text', { x: f1(X(30.05)), y: f1(Y(30.42)), 'text-anchor': 'end' }, 'delta'));
      mapa.appendChild(cv); mapa.appendChild(svg);
      pinta();
    }

    el.appendChild(h('h3', { class: C('tit') }, 'Um país em fila'));
    el.appendChild(h('div', { class: C('g') },
      h('div', { class: C('cab') },
        h('p', { class: C('num') }, pp && pp.aprox ? h('small', null, pp.aprox) : null, U.int(pct) + '%'),
        h('p', { class: C('frase') }, 'da população do Egito vive junto ao Nilo e no delta.'),
        bt),
      mapa, apoio));
    apoio.textContent = TEXTO[estado];
    el.appendChild(h('p', { class: 'pc-nota ' + C('nota') }, 'O que ver aqui: as luzes desenham o rio sem que ele precise ser traçado. É um desenho feito a partir do número, não uma foto de satélite nem um mapa de censo.'));
    var linhasT = [nPct, nPop, nDens].filter(Boolean).map(function (n) { return [txt(n.rotulo), txt(n.valor), txt(n.ano), txt(n.fonte)]; });
    linhasT.push(['Pontos no desenho', U.int(nP) + ' (' + U.int(nRio) + ' junto ao rio e no delta)', '', 'conta: população dividida por ' + U.int(CADA)]);
    el.appendChild(U.tabela('Ver os números', ['O quê', 'Valor', 'Quando', 'Fonte'], linhasT));
    var fo = fontes(U, [[txt(nPct.fonte) + (nPct.ano ? ', ' + txt(nPct.ano) : ''), nPct.url], nPop ? [txt(nPop.fonte), nPop.url] : null]);
    if (fo) el.appendChild(fo);

    medir(mapa, U, desenha);
    U.aoVer(mapa, function (dentroDaTela) { // o movimento só anda com o mapa na tela
      naTela = dentroDaTela;
      if (!naTela) { if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
      anda();
    }, { uma: false });
    // na primeira vez em que o mapa aparece quase inteiro, os pontos se juntam (a não ser que a pessoa já tenha escolhido)
    if (!U.reduz) aoVerBem(mapa, U, 0.45, function () { setTimeout(function () { if (!mexeu) vai('real'); }, 800); });
  });

  // =====================================================================================================
  // estacoes — "O ano do Nilo" (camada nilo)
  // De onde vem cada coisa:
  //   as três estações, o que eram e os meses . camada nilo, fato "Três estações: akhet, peret e shemu" (lido do texto).
  //                                             Se o fato tiver certeza baixa, a peça diz "segundo os manuais"; se a
  //                                             ressalva disser que os meses não foram confirmados, a peça avisa
  //   4 meses de 30 dias, 5 dias extras, 365 .. o mesmo fato
  //   a cheia sobe no verão e baixa no outono . camada nilo, fato "A cheia anual"
  //   1964 e 1970 ............................. dados.series.nilo, ponto "A cheia anual deixa de chegar ao Egito"
  //                                             (na falta dele, o texto do ano do fato "A Represa Alta de Assuã")
  // A curva da água e o corte do vale são esquemáticos, sem escala: a altura da cheia não está nos dados.
  // =====================================================================================================
  var CSS_ESTACOES =
    '&{--pc-agua:#3a86bb;--pc-areia:#e3d5ae;--pc-areia2:#b9a377;--pc-chao:#b89766;--pc-lodo:#4d351f;--pc-casa:#d2ba91;--pc-verde:#3c8a4c;--pc-ouro:#c2952b}' +
    '&-escuro{--pc-agua:#5aa6d8;--pc-areia:#8f7c59;--pc-areia2:#b9a377;--pc-chao:#6d593b;--pc-lodo:#2a1c10;--pc-casa:#b59b72;--pc-verde:#63b06f;--pc-ouro:#dcb14a}' +
    '&-tit{font-size:clamp(25px,3.4vw,36px);margin:0 0 8px}' +
    '&-sub{color:var(--tinta2);font-size:15px;max-width:42em;margin:0 0 20px}' +
    '&-ctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin:0 0 18px}' +
    '&-tocar{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--linha);background:var(--s1);font-size:13.5px;font-weight:600;cursor:pointer;color:var(--tinta)}' +
    '&-tocar:hover{border-color:var(--acento)}' +
    '&-estreito &-ctl .pc-botoes button{padding:0 9px;font-size:13px}' +
    '&-g{display:grid;gap:14px 44px;align-items:center;justify-items:center}' +
    '&-largo &-g{grid-template-columns:auto minmax(0,1fr);justify-items:stretch}' +
    '&-anel{width:100%;max-width:400px}' +
    '&-lado{justify-self:stretch;min-width:0}' +
    '&-largo &-anel{width:380px}' +
    '& svg{display:block;overflow:visible}' +
    '& svg text{font-family:var(--sem);font-size:11px;fill:var(--tinta2)}' +
    '& svg text&-est{font-size:11.5px;font-weight:700;fill:var(--tinta);letter-spacing:.1em}' +
    '& svg &-min{font-weight:500;letter-spacing:.02em}' +
    '& svg text&-nome{font-family:var(--serifa);font-weight:600;font-size:21px;fill:var(--tinta)}' +
    '& svg text&-forte{fill:var(--tinta);font-weight:600}' +
    '& svg text&-it{font-family:var(--serifa);font-style:italic;font-size:12px}' +
    '&-arco{stroke:var(--fundo);stroke-width:2;transition:opacity .5s ease}' +
    '&-anel svg{cursor:pointer}' +
    '&-arco0{fill:color-mix(in srgb,var(--pc-agua) 34%,var(--s1))}' +
    '&-arco1{fill:color-mix(in srgb,var(--pc-verde) 30%,var(--s1))}' +
    '&-arco2{fill:color-mix(in srgb,var(--pc-ouro) 38%,var(--s1))}' +
    '&-arco3{fill:var(--s2)}' +
    '&-trilho{fill:none;stroke:var(--linha);stroke-width:1}' +
    '&-tique{stroke:var(--tinta2);stroke-width:1}' +
    '&-onda{fill:var(--pc-agua);opacity:.42}' +
    '&-miolo{fill:var(--fundo);stroke:var(--linha);stroke-width:1}' +
    '&-pont line{stroke:var(--tinta);stroke-width:1.6;stroke-linecap:round}' +
    '&-pont circle{fill:var(--acento);stroke:var(--fundo);stroke-width:2}' +
    '&-rocha{fill:var(--pc-areia)}' +
    '&-perfil{fill:none;stroke:color-mix(in srgb,var(--tinta) 45%,var(--pc-areia2));stroke-width:1.1;stroke-linejoin:round;stroke-linecap:round}' +
    '&-vale{fill:var(--pc-chao)}' +
    '&-agua{fill:var(--pc-agua);opacity:.82}' +
    '&-tona{stroke:color-mix(in srgb,var(--pc-agua) 55%,#fff);stroke-width:1.2}' +
    '&-lodo{fill:none;stroke:var(--pc-lodo);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}' +
    '&-casa{fill:var(--pc-casa);stroke:color-mix(in srgb,var(--tinta) 55%,var(--pc-casa));stroke-width:.9}' +
    '&-palma{fill:none;stroke:color-mix(in srgb,var(--pc-verde) 70%,var(--tinta));stroke-width:1.3;stroke-linecap:round}' +
    '&-roca{fill:none;stroke-width:1.3;stroke-linecap:round}' +
    '&-canal{fill:var(--pc-agua)}' +
    '&-fio{stroke:var(--tinta2);stroke-width:.9}' +
    '&-leg{font-size:14.5px;line-height:1.5;margin:12px 0 0;min-height:6em;max-width:40em}' +
    '&-leg b{font-family:var(--serifa);font-size:18px;font-weight:600}' +
    '&-chave{font-size:12.5px;color:var(--tinta2);margin:8px 0 0}' +
    '&-so{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '&-nota{margin-top:20px}';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIA1 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  // curva esquemática da água num ano contado do começo da inundação (0 a 1): sobe depressa, fica alta por semanas, baixa no outono
  var CHEIA = [[0, 0.25], [0.07, 0.7], [0.14, 1], [0.21, 0.96], [0.29, 0.5], [0.36, 0.3], [0.5, 0.2], [0.66, 0.13], [0.85, 0.05], [0.93, 0.08], [1, 0.25]];
  function nivelCheia(u) {
    for (var i = 1; i < CHEIA.length; i++) if (u <= CHEIA[i][0]) {
      var a = CHEIA[i - 1], c = CHEIA[i], q = (u - a[0]) / (c[0] - a[0]); q = (1 - Math.cos(q * Math.PI)) / 2;
      return a[1] + (c[1] - a[1]) * q;
    }
    return CHEIA[0][1];
  }
  var nEstacoes = 0;

  E.peca('estacoes', function (el, dados, U, args) {
    var h = U.h, s = U.s, c = args && args.camada; if (!c) return;
    var C = prefixo('estacoes'), uid = 'pc-estacoes-' + (++nEstacoes);
    var fEst = acha(c.fatos, 'titulo', /tr[êe]s esta[çc][õo]es/i); if (!fEst) return;
    var tx = txt(fEst.texto), incerto = fEst.certeza === 'baixa', ress = txt(fEst.ressalva);
    var mesesSoltos = !incerto && /n[ãa]o confirmad[^.]*meses/i.test(ress), deriva = /(Como o calend[áa]rio atrasava[^.]*\.)/.exec(ress);
    var EST = [['Akhet', 'inundação'], ['Peret', 'crescimento'], ['Shemu', 'colheita']].map(function (e) {
      var m = new RegExp(e[0] + ' era ([^.]*?),\\s*(?:mais ou menos\\s+)?de ([a-zç]+) a ([a-zç]+)\\.', 'i').exec(tx);
      return { nome: e[0], curto: e[1], desc: m ? m[1] : 'a ' + e[1], de: m ? m[2].toLowerCase() : '', ate: m ? m[3].toLowerCase() : '' };
    });
    if (tx.toLowerCase().indexOf('akhet') < 0 || tx.toLowerCase().indexOf('shemu') < 0) return;
    var PAL = { quatro: 4, cinco: 5, tres: 3, 'três': 3 };
    var mm = /(\w+) meses de (\d+) dias/i.exec(tx), me = /(\w+) dias extras/i.exec(tx), ma = /ano de (\d+)/i.exec(tx);
    var porEst = mm ? (PAL[mm[1].toLowerCase()] || +mm[1] || 4) * (+mm[2]) : 120, extras = me ? (PAL[me[1].toLowerCase()] || +me[1] || 0) : 0, ANO = ma ? +ma[1] : porEst * 3 + extras;
    if (!(porEst * 3 + extras === ANO)) { porEst = ANO / 3; extras = 0; }
    var iIni = MESES.indexOf(EST[0].de), dia0 = iIni >= 0 ? DIA1[iIni] + 14 : 195; // a estação começa no meio do mês que divide com a anterior
    var fCheia = acha(c.fatos, 'titulo', /^a cheia anual/i), fRep = acha(c.fatos, 'titulo', /represa alta de assu[ãa]/i);
    var pFim = dados && dados.series && dados.series.nilo ? acha(dados.series.nilo.pontos, 'rotulo', /cheia anual deixa de chegar/i) : null;
    var quandoFim = pFim && pFim.ano ? 'O lago da represa começou a encher em ' + pFim.ano + (pFim.ano_fim ? ', e a obra ficou pronta em ' + pFim.ano_fim : '') + '.'
      : (fRep && fRep.ano_txt ? 'A Represa Alta de Assuã foi construída de ' + txt(fRep.ano_txt) + '.' : '');
    var escuro = !ehClaro(el, U);
    var COR = escuro ? { verde: [99, 176, 111], ouro: [220, 177, 74] } : { verde: [60, 138, 76], ouro: [194, 149, 43] };

    estilo('estacoes', CSS_ESTACOES);
    el.classList.add(C()); if (escuro) el.classList.add(C('escuro'));
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 820); el.classList.toggle(C('estreito'), w < 340); });

    // ---- estado ----
    var u = U.reduz ? 0.16 : 0, b = 0, bAlvo = 0, tocando = !U.reduz, naTela = false, raf = 0, tUlt = 0, alvoU = null, VOLTA = 22000, estAtual = -1, modoTxt = -1;
    var R = {}; // peças do desenho que mudam (refeitas quando a largura muda)
    var MEIO = [0.16, 0.5, 0.8]; // onde o ponteiro para em cada estação: cheia no alto, plantas crescendo, colheita
    function estacaoDe(v) { var d = v * ANO; return d < porEst ? 0 : d < porEst * 2 ? 1 : 2; }
    function mesDe(v) { var d = (dia0 + v * 365) % 365, i = 11; while (DIA1[i] > d) i--; return i; }
    function aguaEm(v, bb) { return (0.20 + 0.36 * nivelCheia(v)) * (1 - bb) + 0.27 * bb; } // nível no corte (0 = fundo do rio, 1 = alto do deserto)
    function roca(v, depois) {
      if (depois) { var q = (v * 2) % 1; return q < 0.55 ? [q / 0.55, 0] : q < 0.72 ? [1, (q - 0.55) / 0.17] : q < 0.82 ? [1, 1] : q < 0.92 ? [1 - (q - 0.82) / 0.1, 1] : [0, 1]; }
      return v < 0.34 ? [0, 0] : v < 0.62 ? [(v - 0.34) / 0.28, 0] : v < 0.72 ? [1, (v - 0.62) / 0.1] : v < 0.8 ? [1, 1] : v < 0.88 ? [1 - (v - 0.8) / 0.08, 1] : [0, 1];
    }
    function lodoEm(v) { return v < 0.2 ? 0 : v < 0.33 ? (v - 0.2) / 0.13 : v < 0.66 ? 1 : v < 0.9 ? 1 - (v - 0.66) / 0.24 * 0.8 : 0.2 * (1 - (v - 0.9) / 0.1); }

    var leg = h('p', { class: C('leg') }), fala = h('p', { class: C('so'), 'aria-live': 'polite' });
    function textoDe(i, depois) {
      if (depois) return ['Sem cheia', 'A água fica guardada atrás da represa e é solta aos poucos. O rio quase não muda de nível, a água chega aos campos por canal o ano todo e se colhe mais de uma vez por ano. O lodo fica no lago.'];
      var e = EST[i];
      return [e.nome + ', ' + e.desc, ['A água sobe no verão, cobre os campos por semanas e baixa no outono.',
        'A água baixa e deixa o lodo. Semeia-se na terra úmida e as plantas crescem.',
        'Colhe-se na estação seca, com o rio baixo.'][i] + (e.de ? ' Mais ou menos de ' + e.de + ' a ' + e.ate + '.' : '')];
    }
    function legenda(falar) {
      var i = estacaoDe(u), dep = bAlvo > 0.5, chave = dep ? 9 : i;
      if (chave === modoTxt && !falar) return;
      modoTxt = chave;
      var t = textoDe(i, dep);
      leg.textContent = ''; leg.appendChild(h('b', null, t[0] + '. ')); leg.appendChild(document.createTextNode(t[1]));
      if (falar) fala.textContent = t[0] + '. ' + t[1];
    }

    // ---- desenho: o anel do ano ----
    var hostA = h('div', { class: C('anel') }), hostC = h('div', { class: C('corte') });
    function pt(p) { return f1(p[0]) + ' ' + f1(p[1]); }
    function desenhaAnel(w) {
      hostA.textContent = '';
      var S = Math.min(w, 400), cx = S / 2, cy = S / 2, RR = S / 2 - 2, peq = S < 340;
      var rMes = RR - 10, rTic = RR - 22, rE = RR - 28, rI = rE - (peq ? 30 : 36), rAg = rI - 7, rB = peq ? 50 : 62;
      function pol(r, g) { var a = (g - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
      function setor(r0, r1, g0, g1) {
        var gr = g1 - g0 > 180 ? 1 : 0;
        return 'M' + pt(pol(r1, g0)) + 'A' + r1 + ' ' + r1 + ' 0 ' + gr + ' 1 ' + pt(pol(r1, g1)) + 'L' + pt(pol(r0, g1)) + 'A' + r0 + ' ' + r0 + ' 0 ' + gr + ' 0 ' + pt(pol(r0, g0)) + 'Z';
      }
      var svg = s('svg', { width: S, height: S, viewBox: '0 0 ' + S + ' ' + S, role: 'img',
        'aria-label': 'Calendário em círculo do ano egípcio antigo' + (incerto ? ', segundo os manuais' : '') + ': ' + EST.map(function (e) { return e.nome + ', ' + e.desc + (e.de ? ', mais ou menos de ' + e.de + ' a ' + e.ate : ''); }).join('; ') +
          '. Uma faixa azul mostra o rio mais alto na inundação. Depois da represa, a faixa fica quase igual o ano inteiro.' });
      var defs = s('defs'); svg.appendChild(defs);
      svg.appendChild(s('circle', { class: C('trilho'), cx: cx, cy: cy, r: rTic }));
      MES3.forEach(function (m, i) {
        var g0 = ((DIA1[i] - dia0 + 365) % 365) / 365 * 360, gm = g0 + 15, p = pol(rMes, gm);
        svg.appendChild(s('line', { class: C('tique'), x1: f1(pol(rTic, g0)[0]), y1: f1(pol(rTic, g0)[1]), x2: f1(pol(rTic + 5, g0)[0]), y2: f1(pol(rTic + 5, g0)[1]) }));
        svg.appendChild(s('text', { x: f1(p[0]), y: f1(p[1] + 3.8), 'text-anchor': 'middle' }, m));
      });
      R.arcos = [];
      EST.forEach(function (e, i) {
        var g0 = i * porEst / ANO * 360, g1 = (i + 1) * porEst / ANO * 360, gm = (g0 + g1) / 2, baixo = gm > 100 && gm < 260, rt = (rE + rI) / 2 + (baixo ? 4.2 : -4.2);
        var a = s('path', { class: C('arco') + ' ' + C('arco' + i), d: setor(rI, rE, g0, g1) });
        svg.appendChild(a); R.arcos.push(a);
        var pa = pol(rt, baixo ? g1 - 3 : g0 + 3), pb = pol(rt, baixo ? g0 + 3 : g1 - 3);
        defs.appendChild(s('path', { id: uid + '-a' + i, d: 'M' + pt(pa) + 'A' + f1(rt) + ' ' + f1(rt) + ' 0 0 ' + (baixo ? 0 : 1) + ' ' + pt(pb) }));
        var tp = s('textPath', { href: '#' + uid + '-a' + i, startOffset: '50%' }, e.nome.toUpperCase(), s('tspan', { class: C('min') }, peq ? '' : ' · ' + e.curto));
        svg.appendChild(s('text', { class: C('est'), 'text-anchor': 'middle', style: 'pointer-events:none' }, tp));
      });
      if (extras) {
        svg.appendChild(s('path', { class: C('arco') + ' ' + C('arco3'), d: setor(rI, rE, 3 * porEst / ANO * 360, 360) }, s('title', null, extras + ' dias extras fecham o ano')));
        var pe = pol(rI - 3, 360 - extras / ANO * 180);
        svg.appendChild(s('line', { class: C('tique'), x1: f1(pe[0]), y1: f1(pe[1]), x2: f1(pe[0]), y2: f1(pe[1] + 5) }));
        svg.appendChild(s('text', { x: f1(pe[0]), y: f1(pe[1] + 16), 'text-anchor': 'middle' }, '+' + extras + ' dias'));
      }
      R.onda = s('path', { class: C('onda'), 'fill-rule': 'evenodd' }); svg.appendChild(R.onda);
      R.ondaGeo = { cx: cx, cy: cy, r0: rB + 3, r1: rAg, pol: pol };
      svg.appendChild(s('circle', { class: C('miolo'), cx: cx, cy: cy, r: rB }));
      R.t1 = s('text', { class: C('nome'), x: cx, y: cy - 5, 'text-anchor': 'middle', style: peq ? 'font-size:19px' : '' });
      R.t2 = s('text', { class: C('forte'), x: cx, y: cy + 12, 'text-anchor': 'middle' });
      R.t3 = s('text', { x: cx, y: cy + 27, 'text-anchor': 'middle' });
      svg.appendChild(R.t1); svg.appendChild(R.t2); svg.appendChild(R.t3);
      R.pont = s('g', { class: C('pont') }, s('line', { x1: cx, y1: f1(cy - rB - 3), x2: cx, y2: f1(cy - rTic + 3) }), s('circle', { cx: cx, cy: f1(cy - rTic), r: 5 }));
      R.cx = cx; R.cy = cy;
      svg.appendChild(R.pont);
      svg.addEventListener('click', function (ev) { // tocar no anel leva o ponteiro para aquele momento do ano
        var q = svg.getBoundingClientRect(), dx = ev.clientX - (q.left + q.width / 2), dy = ev.clientY - (q.top + q.height / 2), d = Math.sqrt(dx * dx + dy * dy);
        if (d < rB || d > RR + 6) return;
        vaiPara((Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1);
      });
      hostA.appendChild(svg);
      onda(); estAtual = -1; pinta();
    }
    function onda() { // faixa da água em volta do miolo: mais larga onde o rio está alto
      var g = R.ondaGeo; if (!g || !R.onda) return;
      var d = '', i, v, r, p;
      for (i = 0; i <= 120; i++) { v = i / 120; r = g.r0 + 4 + (g.r1 - g.r0 - 4) * (nivelCheia(v % 1) * (1 - b) + 0.26 * b); p = g.pol(r, v * 360); d += (i ? 'L' : 'M') + pt(p); }
      d += 'Z';
      for (i = 120; i >= 0; i--) { p = g.pol(g.r0, i * 3); d += (i === 120 ? 'M' : 'L') + pt(p); }
      R.onda.setAttribute('d', d + 'Z');
    }

    // ---- desenho: o corte do vale ----
    var PERFIL = [[0, 0.96], [0.07, 0.94], [0.11, 0.62], [0.13, 0.5], [0.2, 0.47], [0.24, 0.47], [0.255, 0.6], [0.32, 0.6], [0.335, 0.47], [0.4, 0.46], [0.435, 0.5], [0.455, 0.3], [0.47, 0.12],
      [0.53, 0.12], [0.545, 0.3], [0.565, 0.5], [0.6, 0.46], [0.72, 0.47], [0.86, 0.47], [0.88, 0.5], [0.9, 0.62], [0.94, 0.94], [1, 0.96]];
    function desenhaCorte(w) {
      hostC.textContent = '';
      var H = Math.round(Math.max(176, Math.min(250, w * 0.4))), yT = 24, yB = H - 26;
      function X(f) { return f * w; } function Y(l) { return yB - l * (yB - yT); }
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Corte do vale do Nilo, sem escala: o deserto alto dos dois lados, os campos na planície e o rio no meio. Antes da represa, a água sobe na inundação, cobre os campos, baixa e deixa o lodo. Depois da represa, fica quase no mesmo nível o ano inteiro.' });
      var linha = PERFIL.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('');
      svg.appendChild(s('defs', null, s('clipPath', { id: uid + '-ar' }, s('path', { d: linha + 'V-40H0Z' }))));
      svg.appendChild(s('path', { class: C('rocha'), d: linha + 'V' + H + 'H0Z' }));
      svg.appendChild(s('path', { class: C('vale'), d: PERFIL.filter(function (p) { return p[0] >= 0.11 && p[0] <= 0.9; }).map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('') +
        'L' + f1(X(0.86)) + ' ' + H + 'H' + f1(X(0.15)) + 'Z' }));
      R.agua = s('g', null, s('rect', { class: C('agua'), x: 0, y: 0, width: w, height: H + 60 }), s('line', { class: C('tona'), x1: 0, x2: w, y1: 0.6, y2: 0.6 }));
      svg.appendChild(s('g', { 'clip-path': 'url(#' + uid + '-ar)' }, R.agua));
      svg.appendChild(s('path', { class: C('perfil'), d: linha }));
      // lodo sobre os campos (os dois lados do rio)
      function trecho(a, z) { return PERFIL.filter(function (p) { return p[0] >= a && p[0] <= z; }).map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join(''); }
      R.lodo = s('path', { class: C('lodo'), d: trecho(0.13, 0.24) + trecho(0.335, 0.435) + trecho(0.565, 0.88) }); svg.appendChild(R.lodo);
      // canais de irrigação (só depois da represa)
      R.canais = s('g', null, [0.37, 0.66, 0.8].map(function (f) { return s('rect', { class: C('canal'), x: f1(X(f) - 4), y: f1(Y(0.47) - 1), width: 8, height: 5, rx: 1 }); })); svg.appendChild(R.canais);
      // plantas nos campos
      var d = '', passo = w < 520 ? 7 : 9, alt = w < 520 ? 10 : 13;
      [[0.145, 0.235], [0.345, 0.425], [0.585, 0.87]].forEach(function (cp) {
        for (var x = X(cp[0]); x <= X(cp[1]); x += passo) d += 'M' + f1(x) + ' 0v' + (-alt) + 'M' + f1(x) + ' ' + f1(-alt * 0.42) + 'l-2.7 ' + f1(-alt * 0.36) + 'M' + f1(x) + ' ' + f1(-alt * 0.42) + 'l2.7 ' + f1(-alt * 0.36);
      });
      R.roca = s('path', { class: C('roca'), d: d }); R.rocaY = Y(0.465);
      svg.appendChild(R.roca);
      // aldeia em terreno alto
      var ya = Y(0.6), xa = X(0.268), ca = w < 520 ? 0.8 : 1.1;
      function palma(x, y, a) { // tronco e cinco folhas caídas
        var k = a / 20, d = 'M' + f1(x) + ' ' + f1(y) + 'q' + f1(1.5 * k) + ' ' + f1(-a / 2) + ' 0 ' + f1(-a), topo = 'M' + f1(x) + ' ' + f1(y - a);
        [[-9, 5, -5, -3], [9, 5, 5, -3], [-8, -2, -4, -5], [8, -2, 4, -5], [0, -7, 1, -4]].forEach(function (f) { d += topo + 'q' + f1(f[2] * k) + ' ' + f1(f[3] * k) + ' ' + f1(f[0] * k) + ' ' + f1(f[1] * k); });
        return s('path', { class: C('palma'), d: d });
      }
      svg.appendChild(s('g', null,
        palma(xa + 46 * ca, ya, 21 * ca), palma(xa - 6 * ca, ya, 15 * ca),
        s('rect', { class: C('casa'), x: f1(xa), y: f1(ya - 11 * ca), width: f1(13 * ca), height: f1(11 * ca) }),
        s('rect', { class: C('casa'), x: f1(xa + 13 * ca), y: f1(ya - 15 * ca), width: f1(12 * ca), height: f1(15 * ca) }),
        s('rect', { class: C('casa'), x: f1(xa + 26 * ca), y: f1(ya - 9 * ca), width: f1(12 * ca), height: f1(9 * ca) })));
      // rótulos
      svg.appendChild(s('text', { class: C('it'), x: 3, y: f1(Y(0.96) - 7) }, 'deserto'));
      svg.appendChild(s('text', { class: C('it'), x: w - 3, y: f1(Y(0.96) - 7), 'text-anchor': 'end' }, 'deserto'));
      svg.appendChild(s('text', { x: f1(xa + 19 * ca), y: f1(ya - 26 * ca), 'text-anchor': 'middle' }, 'aldeia'));
      svg.appendChild(s('text', { x: f1(X(0.725)), y: f1(Y(0.47) - (w < 520 ? 22 : 27)), 'text-anchor': 'middle' }, 'campos'));
      svg.appendChild(s('text', { class: C('forte'), x: f1(X(0.5)), y: H - 7, 'text-anchor': 'middle' }, 'Nilo'));
      R.rLodo = s('g', null, s('line', { class: C('fio'), x1: f1(X(0.79)), x2: f1(X(0.79)), y1: f1(Y(0.47) + 4), y2: f1(Y(0.47) + 14) }), s('text', { class: C('forte'), x: f1(X(0.79)), y: f1(Y(0.47) + 26), 'text-anchor': 'middle' }, 'lodo'));
      R.rCanal = s('g', null, s('line', { class: C('fio'), x1: f1(X(0.66)), x2: f1(X(0.66)), y1: f1(Y(0.47) + 6), y2: f1(Y(0.47) + 14) }), s('text', { class: C('forte'), x: f1(X(0.66)), y: f1(Y(0.47) + 26), 'text-anchor': 'middle' }, 'canal'));
      svg.appendChild(R.rLodo); svg.appendChild(R.rCanal);
      R.Y = Y;
      hostC.appendChild(svg);
      pinta();
    }

    // ---- o que muda a cada quadro ----
    function pinta() {
      var dep = b > 0.5, i = estacaoDe(u), pl = roca(u, dep), lo = lodoEm(u) * (1 - b);
      if (R.pont) R.pont.setAttribute('transform', 'rotate(' + f1(u * 360) + ' ' + R.cx + ' ' + R.cy + ')');
      if (R.agua && R.Y) R.agua.setAttribute('transform', 'translate(0 ' + f1(R.Y(aguaEm(u, b))) + ')');
      if (R.lodo) { R.lodo.style.opacity = f1(lo); R.rLodo.style.opacity = lo > 0.6 ? 1 : 0; }
      if (R.canais) { R.canais.style.opacity = f1(b); R.rCanal.style.opacity = b > 0.6 ? 1 : 0; }
      if (R.roca) {
        var k = Math.max(0.001, pl[0]), cor = COR.verde.map(function (v, j) { return Math.round(v + (COR.ouro[j] - v) * pl[1]); });
        R.roca.setAttribute('transform', 'translate(0 ' + f1(R.rocaY) + ') scale(1 ' + k.toFixed(3) + ')');
        R.roca.style.stroke = 'rgb(' + cor.join(',') + ')'; R.roca.style.opacity = pl[0] < 0.02 ? 0 : 1;
      }
      var chave = dep ? 10 + mesDe(u) : i * 20 + mesDe(u);
      if (R.t1 && chave !== estAtual) {
        estAtual = chave;
        var mes = MESES[mesDe(u)];
        R.t1.textContent = dep ? 'Sem cheia' : EST[i].nome; R.t2.textContent = dep ? 'o ano todo' : EST[i].curto; R.t3.textContent = '≈ ' + mes;
        if (R.arcos) R.arcos.forEach(function (a, j) { a.style.opacity = dep ? 0.4 : (j === i ? 1 : 0.62); });
        if (btEst) Array.prototype.forEach.call(btEst.children, function (bb, j) { bb.setAttribute('aria-pressed', !dep && j === i ? 'true' : 'false'); });
      }
      legenda(false);
    }
    function passo(ts) {
      raf = 0;
      var dt = tUlt ? Math.min(80, ts - tUlt) : 16; tUlt = ts;
      if (alvoU != null) {
        var d = ((alvoU - u + 1.5) % 1) - 0.5;
        if (Math.abs(d) < 0.003) { u = alvoU; alvoU = null; } else u = (u + d * Math.min(1, dt / 170) + 1) % 1;
      } else if (tocando) u = (u + dt / VOLTA) % 1;
      if (b !== bAlvo) { var v = dt / 900; b = b < bAlvo ? Math.min(bAlvo, b + v) : Math.max(bAlvo, b - v); onda(); }
      pinta();
      if (naTela && (tocando || alvoU != null || b !== bAlvo)) raf = requestAnimationFrame(passo);
    }
    function anda() { if (!raf && naTela && (tocando || alvoU != null || b !== bAlvo)) { tUlt = 0; raf = requestAnimationFrame(passo); } }
    function tocar(sim) { tocando = sim; btTocar.textContent = sim ? 'Pausar' : 'Continuar'; btTocar.setAttribute('aria-pressed', sim ? 'false' : 'true'); if (sim) anda(); }
    function vaiPara(v) { // para o laço e leva o ponteiro até um momento do ano (0 a 1)
      tocar(false);
      if (U.reduz) { u = v; alvoU = null; pinta(); } else { alvoU = v; anda(); }
      var t = textoDe(estacaoDe(v), bAlvo > 0.5); fala.textContent = t[0] + '. ' + t[1];
    }
    function represa(depois) {
      bAlvo = depois ? 1 : 0;
      if (U.reduz) { b = bAlvo; onda(); estAtual = -1; pinta(); } else anda();
      legenda(true);
    }

    // ---- montagem ----
    var btRep = U.botoes([{ id: 'antes', rotulo: 'antes da represa' }, { id: 'depois', rotulo: 'depois da represa' }], 'antes', function (id) { represa(id === 'depois'); }, 'Antes ou depois da represa');
    var btEst = U.botoes(EST.map(function (e, i) { return { id: String(i), rotulo: e.nome }; }), U.reduz ? '0' : '', function (id) { vaiPara(MEIO[+id]); }, 'Estação do ano');
    var btTocar = h('button', { type: 'button', class: C('tocar'), 'aria-pressed': 'false', onclick: function () { tocar(!tocando); } }, 'Pausar');
    if (U.reduz) { btTocar.textContent = 'Continuar'; btTocar.setAttribute('aria-pressed', 'true'); }
    el.appendChild(h('h3', { class: C('tit') }, 'O ano do Nilo'));
    el.appendChild(h('p', { class: C('sub') }, 'O calendário dos antigos egípcios seguia o rio: três estações' + (mm ? ' de ' + mm[1].toLowerCase() + ' meses' : '') + '.' +
      (incerto ? ' Os nomes e os meses vêm dos manuais.' : '') + (quandoFim ? ' ' + quandoFim : '')));
    el.appendChild(h('div', { class: C('ctl') }, btRep, btEst, btTocar));
    el.appendChild(h('div', { class: C('g') }, hostA, h('div', { class: C('lado') }, hostC, leg,
      h('p', { class: C('chave') }, 'No anel, a faixa azul mostra o nível do rio ao longo do ano; toque nele para ir a outro mês. No corte, a mesma água vista de lado.'))));
    el.appendChild(fala);
    el.appendChild(h('p', { class: 'pc-nota ' + C('nota') }, 'O que ver aqui: a cheia fazia duas coisas de uma vez, regava e adubava os campos. ' +
      (incerto ? 'Os nomes das estações e os meses são os dos manuais: esta pesquisa não os conferiu em fonte, e os meses de hoje são aproximados. '
        : mesesSoltos ? 'A pesquisa confirmou os nomes e a duração das estações; os meses de hoje são aproximados e não foram conferidos em fonte. ' : '') +
      (deriva ? deriva[1] + ' ' : '') + 'A curva da água e o corte são esquemáticos, sem escala.'));
    var linhasT = EST.map(function (e) { return [e.nome, e.desc, e.de ? 'mais ou menos de ' + e.de + ' a ' + e.ate : '']; });
    if (mm) linhasT.push(['Cada estação', mm[1].toLowerCase() + ' meses de ' + mm[2] + ' dias' + (extras ? '; ' + extras + ' dias extras fecham o ano de ' + ANO : ''), '']);
    if (fCheia) linhasT.push(['A cheia', txt(fCheia.ano_txt), '']);
    if (pFim) linhasT.push(['Fim da cheia', txt(pFim.ano_txt), txt(pFim.texto).split('. ')[0] + '.']);
    el.appendChild(U.tabela('Ver os dados', ['Estação', 'O que era', 'Meses de hoje'], linhasT));
    var fo = fontes(U, [!incerto && fEst.fonte ? [txt(fEst.fonte).replace(/\s*\([^)]*\)\s*$/, ''), fEst.url] : null, // a fonte do calendário, sem o parêntese de bastidor
      fCheia ? [txt(fCheia.fonte), fCheia.url] : null, pFim ? [txt(pFim.fonte), pFim.url] : null]);
    if (fo) el.appendChild(fo);

    medir(hostA, U, desenhaAnel);
    medir(hostC, U, desenhaCorte);
    legenda(false);
    U.aoVer(el, function (dentroDaTela) {
      naTela = dentroDaTela;
      if (!naTela) { if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
      anda();
    }, { uma: false, margem: '0px 0px -8% 0px' });
  });

  // =====================================================================================================
  // suez — "O canal" (camada mohamed-ali; a receita de hoje vem da camada hoje)
  // De onde vem cada número:
  //   10 anos de obra, 1859 a 1869 ......... fato "Dez anos de obra, corveia e mortos" (texto do ano)
  //   aberto em 17 de novembro de 1869 ..... fato "Inauguração do Canal de Suez"; "Convidados na inauguração do canal"
  //   433 mi de francos; previsão de 200 mi;
  //   11.627.000 libras (conta de Lesseps) . número "Custo do Canal de Suez"
  //   mortos: 120 mil (Nasser, 1956) ou
  //   "números muito menores" (companhia) .. número "Mortos na obra do canal" (as duas versões, com quem diz cada uma)
  //   concessão de 99 anos (1854) .......... número "Duração da concessão do canal"
  //   receita: US$ 9,4 bi (2022/23), cerca de
  //   US$ 4 bi (2024), US$ 4,67 bi (2025/26)  camada hoje: "Recorde de receita do canal", "Receita do canal no pior ano
  //                                          da crise", "Receita do Canal de Suez no ano fiscal"
  // Ficaram de fora por não estarem nos dados: o comprimento do canal e o número de trabalhadores (este só aparece
  // numa ressalva, como lembrança de memória). O mapa usa EGITO.geo (costa, canal, Nilo): serve para situar, não para medir.
  // =====================================================================================================
  var CSS_SUEZ =
    '@keyframes pc-suez-cresce{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '&{--pc-agua:#5aa6d8;--pc-verde:#6fae78}' +
    '&-claro{--pc-agua:#2f79b3;--pc-verde:#4d8f58}' +
    '&-tit{font-size:clamp(25px,3.4vw,36px);margin:0 0 8px}' +
    '&-sub{color:var(--tinta2);font-size:15px;max-width:42em;margin:0 0 22px}' +
    '&-g{display:grid;gap:26px 48px;align-items:start}' +
    '&-largo &-g{grid-template-columns:minmax(0,430px) minmax(0,1fr)}' +
    '&-medio &-g{grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:26px 36px}' +
    '&-mapa{border-radius:14px;overflow:hidden;border:1px solid var(--linha);max-width:460px}' +
    '&-mapa svg{display:block}' +
    '&-mar{fill:color-mix(in srgb,var(--pc-agua) 32%,var(--fundo))}' +
    '&-terra{fill:var(--s2);stroke:color-mix(in srgb,var(--tinta2) 38%,var(--s2));stroke-width:1;stroke-linejoin:round}' +
    '&-delta{fill:color-mix(in srgb,var(--pc-verde) 22%,var(--s2))}' +
    '&-rio{fill:none;stroke:var(--pc-agua);stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;opacity:.75}' +
    '&-canal{fill:none;stroke:var(--pc-agua);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    '&-lago{fill:var(--pc-agua)}' +
    '&-navio{fill:var(--acento);stroke:var(--fundo);stroke-width:1.2;stroke-linejoin:round}' +
    '&-cid{fill:var(--tinta);stroke:var(--s2);stroke-width:1.5}' +
    '&-mapa text{font-family:var(--sem);font-size:11.5px;fill:var(--tinta);paint-order:stroke;stroke:var(--s2);stroke-width:3px;stroke-linejoin:round}' +
    '&-mapa text&-agua{font-family:var(--serifa);font-style:italic;font-size:12.5px;fill:var(--tinta2);stroke:none;letter-spacing:.05em}' +
    '&-mapa text&-reg{font-size:11px;fill:var(--tinta2);letter-spacing:.14em;text-transform:uppercase;stroke:none}' +
    '&-pe{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin:10px 0 0;max-width:460px}' +
    '&-pe span{font-size:12.5px;color:var(--tinta2);flex:1 1 180px}' +
    '&-tocar{min-height:44px;padding:0 15px;border-radius:999px;border:1px solid var(--linha);background:var(--s1);font-size:13px;font-weight:600;cursor:pointer;color:var(--tinta)}' +
    '&-tocar:hover{border-color:var(--acento)}' +
    '&-ficha{margin:0}' +
    '&-ficha>div{padding:14px 0 15px;border-top:1px solid var(--linha)}' +
    '&-ficha>div:last-child{border-bottom:1px solid var(--linha)}' +
    '&-ficha dt{font-size:12.5px;color:var(--tinta2);margin:0 0 3px}' +
    '&-ficha dd{margin:0;font-size:14px;color:var(--tinta2);line-height:1.45}' +
    '&-ficha dd b{font-family:var(--serifa);font-size:clamp(24px,2.6vw,30px);font-weight:600;color:var(--tinta);letter-spacing:-.01em;margin-right:8px;white-space:nowrap;line-height:1.15}' +
    '&-duas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 22px;margin-top:4px}' +
    '&-duas div b{display:block;margin:0 0 2px;white-space:normal;font-size:clamp(22px,2.4vw,27px)}' +
    '&-mini{display:grid;gap:5px;margin:8px 0 0;max-width:420px}' +
    '&-mini div{display:flex;align-items:center;gap:8px;font-size:12.5px}' +
    '&-mini i{display:block;height:8px;border-radius:2px;background:var(--tinta2);opacity:.55;flex:none}' +
    '&-mini i&-gasto{background:var(--tinta);opacity:.9}' +
    '&-hoje{margin:clamp(34px,6vh,54px) 0 0;padding-top:22px;border-top:1px solid var(--linha);max-width:820px}' +
    '&-hoje h4{font-size:clamp(21px,2.5vw,26px);margin:0 0 4px}' +
    '&-hoje>p{font-size:14px;color:var(--tinta2);margin:0 0 18px;max-width:44em}' +
    '&-linha{margin:0 0 14px}' +
    '&-linha p{margin:0 0 5px;font-size:13.5px;color:var(--tinta2)}' +
    '&-linha p b{color:var(--tinta);font-weight:600}' +
    '&-trilho{display:flex;align-items:center;gap:10px}' +
    '&-barra{height:18px;border-radius:3px;background:color-mix(in srgb,var(--tinta2) 62%,var(--fundo));flex:none;transform-origin:0 50%}' +
    '&-barra&-agora{background:var(--acento)}' +
    '&-trilho span{font-family:var(--serifa);font-size:19px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '&-vis &-barra{animation:pc-suez-cresce .9s cubic-bezier(.2,.7,.2,1) both}' +
    '&-nota{margin-top:20px}' +
    '@media (prefers-reduced-motion:reduce){&-barra{animation:none!important}}';

  E.peca('suez', function (el, dados, U, args) {
    var h = U.h, s = U.s, c = args && args.camada, G = E.geo; if (!c) return;
    var N = c.numeros || [], C = prefixo('suez'), cH = camadaDe(dados, 'hoje'), NH = (cH && cH.numeros) || [];
    var fObra = acha(c.fatos, 'titulo', /anos de obra/i), fInaug = acha(c.fatos, 'titulo', /inaugura[çc][ãa]o do canal/i);
    var mo = fObra && /(\d{4})\s*a\s*(\d{4})/.exec(txt(fObra.ano_txt)), anos = mo ? mo[2] - mo[1] : 0;
    var nCusto = acha(N, 'rotulo', /custo do canal/i), nMortos = acha(N, 'rotulo', /mortos na obra/i), nConc = acha(N, 'rotulo', /concess[ãa]o do canal/i), nConv = acha(N, 'rotulo', /convidados/i);
    var gasto = nCusto && pega(nCusto.valor, '#\\s*milh[õo]es de francos'), previsto = nCusto && pega(nCusto.valor, 'previs[ãa]o[^;]*?#\\s*milh[õo]es'), libras = nCusto && pega(nCusto.valor, '#\\s*libras');
    var quemGasto = nCusto && /milh[õo]es de francos\s*\(([^)]+)\)/i.exec(txt(nCusto.valor));
    if (!(anos > 0) && !(gasto > 0)) return; // sem o tempo de obra nem o custo, a peça não aparece
    var temMapa = !!(G && G.CANAL && G.CANAL.length > 2 && G.TERRA);

    estilo('suez', CSS_SUEZ);
    el.classList.add(C()); if (ehClaro(el, U)) el.classList.add(C('claro'));
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 820); el.classList.toggle(C('medio'), w >= 640 && w < 820); });
    el.appendChild(h('h3', { class: C('tit') }, 'O canal'));
    el.appendChild(h('p', { class: C('sub') }, 'Um corte no istmo de Suez liga o Mediterrâneo ao Mar Vermelho' + (mo ? ' desde ' + mo[2] : '') + '. Os navios deixaram de contornar a África.'));

    // ---- mapa do istmo ----
    var hostM = h('div', { class: C('mapa') }), nav = null, caminho = null, compr = 0, tocando = !U.reduz, naTela = false, raf = 0, tUlt = 0, pos = U.reduz ? 0.6 : 0, VOLTA = 17000;
    function poe() {
      if (!nav || !caminho || !compr) return;
      var a = caminho.getPointAtLength(pos * compr), b2 = caminho.getPointAtLength(Math.min(compr, pos * compr + 2)), ang = Math.atan2(b2.y - a.y, b2.x - a.x) * 180 / Math.PI;
      if (pos > 0.995) ang = +nav.getAttribute('data-a') || ang; else nav.setAttribute('data-a', f1(ang));
      nav.setAttribute('transform', 'translate(' + f1(a.x) + ' ' + f1(a.y) + ') rotate(' + f1(ang) + ')');
      nav.style.opacity = f1(Math.min(1, pos / 0.05, (1 - pos) / 0.05));
    }
    function passo(ts) {
      raf = 0;
      var dt = tUlt ? Math.min(80, ts - tUlt) : 16; tUlt = ts;
      pos = (pos + dt / VOLTA) % 1; poe();
      if (naTela && tocando) raf = requestAnimationFrame(passo);
    }
    function anda() { if (!raf && naTela && tocando) { tUlt = 0; raf = requestAnimationFrame(passo); } }
    function desenhaMapa(w) {
      hostM.textContent = '';
      var LON0 = 31.0, LON1 = 33.35, LAT0 = 31.75, LAT1 = 29.5, gx0 = G.X(LON0), gy0 = G.Y(LAT0), z = w / (G.X(LON1) - gx0), H = Math.round((G.Y(LAT1) - gy0) * z);
      function X(lon) { return (G.X(lon) - gx0) * z; } function Y(lat) { return (G.Y(lat) - gy0) * z; }
      function cam(pts, fecha) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('') + (fecha ? 'Z' : ''); }
      var P = G.CANAL, svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Mapa do istmo de Suez: o Mediterrâneo em cima, o Mar Vermelho embaixo e o canal entre os dois, de Porto Saíde a Suez, passando por Ismaília e pelos Lagos Amargos. À esquerda, o delta do Nilo e o Cairo. Um navio desce o canal.' });
      svg.appendChild(s('rect', { class: C('mar'), width: w, height: H }));
      svg.appendChild(s('path', { class: C('terra'), d: cam(G.TERRA, true) }));
      if (G.DELTA) svg.appendChild(s('path', { class: C('delta'), d: cam(G.DELTA, true) }));
      [G.NILO, G.DAMIETA, G.ROSETA].forEach(function (r) { if (r) svg.appendChild(s('path', { class: C('rio'), d: cam(r) })); });
      var iI = Math.floor(P.length / 2), iL = Math.min(P.length - 2, iI + 1); // pelo meio do canal: Ismaília (lago Timsah) e os Lagos Amargos
      svg.appendChild(s('ellipse', { class: C('lago'), cx: f1(X(P[iL][0]) + 1.2 * z), cy: f1(Y(P[iL][1])), rx: f1(2.2 * z), ry: f1(4.6 * z), transform: 'rotate(-24 ' + f1(X(P[iL][0])) + ' ' + f1(Y(P[iL][1])) + ')' }));
      svg.appendChild(s('circle', { class: C('lago'), cx: f1(X(P[iI][0])), cy: f1(Y(P[iI][1])), r: f1(1.3 * z) }));
      caminho = s('path', { class: C('canal'), d: cam(P) }); svg.appendChild(caminho);
      function rot(x, y, t, anc, cl) { return s('text', { class: cl ? C(cl) : null, x: f1(x), y: f1(y), 'text-anchor': anc || 'start' }, t); }
      svg.appendChild(rot(X(32.82), Y(31.5), 'Mediterrâneo', 'middle', 'agua'));
      svg.appendChild(rot(X(P[P.length - 1][0]) - 0.6 * z, H - 9, 'Mar Vermelho', 'middle', 'agua'));
      svg.appendChild(rot(X(33.0), Y(30.5), 'Sinai', 'middle', 'reg'));
      svg.appendChild(rot(X(31.52), Y(30.98), 'delta do Nilo', 'middle', 'reg'));
      var cid = [[P[0], 'Porto Saíde', 9, -6, 'start'], [P[iI], 'Ismaília', -10, 4, 'end'], [P[P.length - 1], 'Suez', -10, 4, 'end']];
      var cairo = (G.CIDADES || []).filter(function (x) { return x[0] === 'Cairo'; })[0];
      if (cairo) cid.push([[cairo[1], cairo[2]], 'Cairo', 9, 4, 'start']);
      cid.forEach(function (k) {
        svg.appendChild(s('circle', { class: C('cid'), cx: f1(X(k[0][0])), cy: f1(Y(k[0][1])), r: 3.4 }));
        svg.appendChild(rot(X(k[0][0]) + k[2], Y(k[0][1]) + k[3], k[1], k[4]));
      });
      svg.appendChild(rot(X(P[iL][0]) + 4.6 * z, Y(P[iL][1]) + 4, 'Lagos Amargos', 'start'));
      nav = s('path', { class: C('navio'), d: 'M9 0L4.5 -3.6H-7.5V3.6H4.5Z' }); svg.appendChild(nav);
      hostM.appendChild(svg);
      try { compr = caminho.getTotalLength(); } catch (e) { compr = 0; }
      poe();
    }

    // ---- números da obra ----
    var ficha = h('dl', { class: C('ficha') }), extrasT = [];
    if (anos > 0) ficha.appendChild(h('div', null, h('dt', null, 'Tempo de obra'), h('dd', null, h('b', null, anos + ' anos'), 'de ' + mo[1] + ' a ' + mo[2] + '.' +
      (fInaug && fInaug.ano_txt ? ' O canal abriu em ' + txt(fInaug.ano_txt) + (nConv ? ', numa festa com ' + txt(nConv.valor) + ' convidados' : '') + '.' : ''))));
    if (gasto > 0) {
      var dd = h('dd', null, h('b', null, U.int(gasto) + ' milhões'), 'de francos' + (quemGasto ? ' (fonte: ' + quemGasto[1] + ')' : '') + '.' +
        (previsto > 0 ? ' A previsão era de ' + U.int(previsto) + ' milhões' + (gasto > 2 * previsto ? ': custou mais que o dobro.' : '.') : '') +
        (libras > 0 ? ' Na conta de Lesseps, que dirigiu a obra, foram ' + U.int(libras) + ' libras.' : ''));
      if (previsto > 0) dd.appendChild(h('div', { class: C('mini'), 'aria-hidden': 'true' },
        h('div', null, h('i', { style: { width: (previsto / gasto * 62).toFixed(1) + '%' } }), 'previsto'),
        h('div', null, h('i', { class: C('gasto'), style: { width: '62%' } }), 'gasto')));
      ficha.appendChild(h('div', null, h('dt', null, 'Custo'), dd));
    }
    if (nMortos) {
      var vs = txt(nMortos.valor).split(';').map(function (x) { return x.trim(); }).filter(Boolean), duas = h('div', { class: C('duas') });
      vs.slice(0, 2).forEach(function (v) {
        var m = /^(.*?)\s*,?\s*segundo\s+(.*)$/i.exec(v);
        if (m) duas.appendChild(h('div', null, h('b', null, m[1]), 'segundo ' + m[2]));
      });
      if (duas.children.length) ficha.appendChild(h('div', null, h('dt', null, 'Mortos na obra: não há número certo'), h('dd', null, duas)));
    }
    [[/comprimento[^;]*canal|canal[^;]*comprimento|extens[ãa]o do canal/i, 'Comprimento'], [/trabalhadores[^;]*canal|gente na obra do canal/i, 'Gente na obra']].forEach(function (x) {
      var n = acha(N, 'rotulo', x[0]), q = n && !/amplia/i.test(txt(n.rotulo)) && parte(n.valor); // hoje os dados não trazem nenhum dos dois
      if (q) { ficha.appendChild(h('div', null, h('dt', null, x[1]), h('dd', null, q.aprox ? q.aprox + ' ' : '', h('b', null, q.grande), q.resto))); extrasT.push(n); }
    });
    if (nConc) { var pc = parte(nConc.valor); if (pc) ficha.appendChild(h('div', null, h('dt', null, 'Concessão'), h('dd', null, h('b', null, pc.grande + (pc.resto ? ' ' + pc.resto : '')), 'era o prazo da concessão dada em ' + txt(nConc.ano) + ' para cavar e explorar o canal.'))); }

    var pe = null, btNav = null;
    if (temMapa) {
      btNav = h('button', { type: 'button', class: C('tocar'), 'aria-pressed': tocando ? 'false' : 'true', onclick: function () {
        tocando = !tocando; btNav.textContent = tocando ? 'Parar o navio' : 'Mover o navio'; btNav.setAttribute('aria-pressed', tocando ? 'false' : 'true'); anda();
      } }, tocando ? 'Parar o navio' : 'Mover o navio');
      pe = h('div', { class: C('pe') }, h('span', null, 'Desenho para situar, não para medir.'), btNav);
    }
    el.appendChild(h('div', { class: C('g') }, temMapa ? h('div', null, hostM, pe) : null, ficha));

    // ---- a receita de hoje ----
    var nRec = acha(NH, 'rotulo', /recorde de receita/i), nPior = acha(NH, 'rotulo', /pior ano/i), nUlt = acha(NH, 'rotulo', /receita do canal de suez no ano fiscal/i), barras = [];
    function bi(t) { return pega(t, 'US\\$\\s*#\\s*bilh'); }
    if (nRec && bi(nRec.valor)) { var mf = /ano fiscal\s+(\d{4}\/\d{2})/i.exec(txt(nRec.valor)); barras.push({ v: bi(nRec.valor), quando: mf ? 'ano fiscal ' + mf[1] : txt(nRec.ano), o: 'recorde', t: 'US$ ' + U.dec(bi(nRec.valor), 2) + ' bilhões', n: nRec }); }
    if (nPior && bi(nPior.valor)) barras.push({ v: bi(nPior.valor), quando: txt(nPior.ano), o: 'o pior ano da crise do Mar Vermelho', t: (/^cerca de/i.test(txt(nPior.valor)) ? 'cerca de ' : '') + 'US$ ' + U.dec(bi(nPior.valor), 2) + ' bilhões', n: nPior });
    if (nUlt && bi(nUlt.valor)) { var ex = /\(([^)]+)\)/.exec(txt(nUlt.valor)); barras.push({ v: bi(nUlt.valor), quando: 'ano fiscal ' + txt(nUlt.ano), o: 'o último ano fechado' + (ex ? ', ' + ex[1] : ''), t: 'US$ ' + U.dec(bi(nUlt.valor), 2) + ' bilhões', n: nUlt, agora: true }); }
    var hoje = null;
    if (barras.length >= 2) {
      var max = Math.max.apply(null, barras.map(function (x) { return x.v; })), civil = nRec && /US\$\s*([\d.,]+)\s*bilh[õo]es no ano civil de (\d{4})/i.exec(txt(nRec.valor));
      hoje = h('div', { class: C('hoje') }, h('h4', null, 'Quanto o canal rende hoje'),
        h('p', null, 'Receita em um ano, em dólares. O ano fiscal do Egito vai de julho a junho.' + (civil ? ' No ano civil de ' + civil[2] + ', a receita foi de US$ ' + civil[1] + ' bilhões.' : '')));
      barras.forEach(function (x, i) {
        hoje.appendChild(h('div', { class: C('linha') }, h('p', null, h('b', null, x.quando), ' · ' + x.o),
          h('div', { class: C('trilho') }, h('div', { class: C('barra') + (x.agora ? ' ' + C('agora') : ''), style: { width: 'calc(var(--pc-max, 60%) * ' + (x.v / max).toFixed(4) + ')', 'animation-delay': (i * 180) + 'ms' } }), h('span', null, x.t))));
      });
      el.appendChild(hoje);
      U.aoMedir(hoje, function (w) { hoje.style.setProperty('--pc-max', Math.max(90, Math.min(w * 0.62, w - 178)) + 'px'); }); // a barra maior deixa lugar para o valor ao lado
      U.aoVer(hoje, function () { el.classList.add(C('vis')); });
    }

    // ---- leitura, números e fontes ----
    el.appendChild(h('p', { class: 'pc-nota ' + C('nota') }, 'O que ver aqui: o canal não é o Nilo. Ele corta o deserto a leste do delta, de mar a mar.' +
      (barras.length >= 2 ? ' E o que ele rende depende do que acontece no Mar Vermelho.' : '')));
    var linhasT = [];
    if (anos > 0) linhasT.push(['Obra', txt(fObra.ano_txt), txt(fObra.fonte)]);
    [nCusto, nMortos, nConc, nConv].concat(extrasT).forEach(function (n) { if (n) linhasT.push([txt(n.rotulo), txt(n.valor), txt(n.fonte)]); });
    barras.forEach(function (x) { linhasT.push([txt(x.n.rotulo) + ' (' + txt(x.n.ano) + ')', txt(x.n.valor), txt(x.n.fonte)]); });
    el.appendChild(U.tabela('Ver os números', ['O quê', 'Valor', 'Fonte'], linhasT));
    var fo = fontes(U, [fObra ? [txt(fObra.fonte), fObra.url] : null, nUlt ? [txt(nUlt.fonte), nUlt.url] : (nRec ? [txt(nRec.fonte), nRec.url] : null)]);
    if (fo) el.appendChild(fo);

    if (temMapa) {
      medir(hostM, U, desenhaMapa);
      U.aoVer(hostM, function (dentroDaTela) {
        naTela = dentroDaTela;
        if (!naTela) { if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
        anda();
      }, { uma: false });
    }
  });

  // =====================================================================================================
  // abu-simbel — "Mudar um templo de lugar" (camada republica)
  // De onde vem cada número:
  //   1.035 blocos de 7 a 30 toneladas .. número "Abu Simbel: blocos cortados"
  //   65 m mais alto, cerca de 200 m para trás  o mesmo número (e o fato "Abu Simbel muda de lugar", de certeza alta;
  //                                       se o fato passar a ter certeza baixa, as medidas deixam de ser escritas)
  //   1964 a 1968 ....................... campo ano do mesmo número
  //   1960, campanha da Unesco .......... texto do fato "Abu Simbel muda de lugar"
  //   cerca de US$ 40 milhões ........... número "Abu Simbel: custo da mudança"
  //   22 monumentos; cerca de 50 países . número "Campanha da Núbia"
  // As duas distâncias estão na mesma escala. O tamanho do templo, o perfil da encosta e os níveis da água são
  // só indicativos (não estão nos dados). Os blocos do desenho são poucos: cada um vale por dezenas dos de verdade.
  // =====================================================================================================
  var CSS_ABU =
    '&{--pc-rocha:#6a583f;--pc-risco:#b89b6a;--pc-pedra:#e4c791;--pc-junta:#5a4830;--pc-oco:#33291d;--pc-agua:#5aa6d8}' +
    '&-claro{--pc-rocha:#dcc594;--pc-risco:#a8905f;--pc-pedra:#f6e8c4;--pc-junta:#8a7447;--pc-oco:#9a8257;--pc-agua:#3a86bb}' +
    '&-tit{font-size:clamp(25px,3.4vw,36px);margin:0 0 8px}' +
    '&-sub{color:var(--tinta2);font-size:15px;max-width:42em;margin:0 0 20px}' +
    '&-ctl{margin:0 0 16px}' +
    '&-g{display:grid;gap:22px 48px;align-items:start}' +
    '&-largo &-g{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}' +
    '& svg{display:block;overflow:visible}' +
    '& svg text{font-family:var(--sem);font-size:11.5px;fill:var(--tinta2)}' +
    '& svg text&-forte{fill:var(--tinta);font-weight:600}' +
    '& svg &-n{font-family:var(--serifa);font-weight:600;font-size:17px;fill:var(--tinta)}' +
    '& svg text&-it{font-family:var(--serifa);font-style:italic;font-size:12.5px}' +
    '&-rocha{fill:var(--pc-rocha)}' +
    '&-perfil{fill:none;stroke:var(--pc-risco);stroke-width:1.2;stroke-linejoin:round}' +
    '&-veio{fill:none;stroke:var(--pc-risco);stroke-width:1;opacity:.2}' +
    '&-oco{fill:var(--pc-oco)}' +
    '&-nivel{stroke:var(--pc-agua);stroke-width:1.2;stroke-dasharray:5 4}' +
    '&-fundoagua{fill:var(--pc-agua);opacity:.8}' +
    '&-tona{stroke:color-mix(in srgb,var(--pc-agua) 55%,#fff);stroke-width:1.2}' +
    '&-agua{transform:translateY(var(--pc-y0));transition:transform 2.4s cubic-bezier(.4,0,.2,1)}' +
    '&-e2 &-agua{transform:translateY(var(--pc-y2))}' +
    '&-pedra{fill:var(--pc-pedra);stroke:var(--pc-junta);stroke-width:.9;stroke-linejoin:round}' +
    '&-sala{fill:var(--pc-oco)}' +
    '&-inteiro &-pedra{stroke:none}' +
    '&-inteiro &-pedra&-col{stroke:var(--pc-junta)}' +
    // antes: o templo inteiro, sem emendas; no corte, os blocos tomam o lugar dele e só então saem
    '&-inteiro{opacity:0;transition:opacity .35s ease}' +
    '&-e0 &-inteiro{opacity:1;transition-delay:1.45s}' +
    '&-blocos{opacity:1;transition:opacity .35s ease}' +
    '&-e0 &-blocos{opacity:0;transition-delay:1.6s}' +
    // cada bloco são dois grupos, um anda de lado (bx) e o outro na altura (by), com ritmos diferentes:
    // na ida o bloco sobe primeiro e recua depois; na volta, anda de lado primeiro e desce depois
    '&-bx,&-by{transition:transform 1.4s}' +
    '&-bx{transition-timing-function:cubic-bezier(.12,.6,.4,1)}' +
    '&-by{transition-timing-function:cubic-bezier(.6,0,.88,.4)}' +
    '&-e1 &-bx,&-e2 &-bx{transform:translateX(var(--pc-dx));transition-timing-function:cubic-bezier(.6,0,.88,.4)}' +
    '&-e1 &-by,&-e2 &-by{transform:translateY(var(--pc-dy));transition-timing-function:cubic-bezier(.12,.6,.4,1)}' +
    '&-e1 &-bx,&-e1 &-by{transition-delay:var(--pc-d)}' +
    '&-jato &-bx,&-jato &-by,&-jato &-agua,&-jato &-inteiro,&-jato &-blocos,&-jato [class*="pc-abu-simbel-so"]{transition:none!important}' +
    '&-novo{fill:none;stroke:var(--tinta2);stroke-width:1;stroke-dasharray:3 3}' +
    '&-guia{fill:none;stroke:var(--acento);stroke-width:1.3;stroke-dasharray:5 4}' +
    '&-seta{fill:var(--acento)}' +
    '&-cota{fill:none;stroke:var(--tinta);stroke-width:1}' +
    '&-chamada{fill:none;stroke:var(--tinta2);stroke-width:.9;stroke-dasharray:2 3}' +
    '&-fio{stroke:var(--tinta2);stroke-width:.9}' +
    '&-so0,&-so1,&-so2,&-so01,&-so12{opacity:0;transition:opacity .6s ease}' +
    '&-e0 &-so0,&-e1 &-so1,&-e2 &-so2,&-e0 &-so01,&-e1 &-so01,&-e1 &-so12,&-e2 &-so12{opacity:1}' +
    '&-e2 &-so2{transition-delay:1.5s}' +
    '&-leg{font-size:14.5px;line-height:1.5;margin:12px 0 0;min-height:4.6em;max-width:40em}' +
    '&-leg b{font-family:var(--serifa);font-size:18px;font-weight:600}' +
    '&-ficha{margin:0}' +
    '&-ficha>div{padding:13px 0 14px;border-top:1px solid var(--linha)}' +
    '&-ficha>div:last-child{border-bottom:1px solid var(--linha)}' +
    '&-ficha dt{font-size:12.5px;color:var(--tinta2);margin:0 0 3px}' +
    '&-ficha dd{margin:0;font-size:14px;color:var(--tinta2);line-height:1.45}' +
    '&-ficha dd b{font-family:var(--serifa);font-size:clamp(23px,2.5vw,29px);font-weight:600;color:var(--tinta);letter-spacing:-.01em;margin-right:7px;white-space:nowrap;line-height:1.15}' +
    '&-nota{margin-top:20px}' +
    '@media (prefers-reduced-motion:reduce){&-bx,&-by,&-agua,&-so0,&-so1,&-so2,&-so01,&-so12,&-inteiro,&-blocos{transition:none!important}}';
  var nAbu = 0;

  E.peca('abu-simbel', function (el, dados, U, args) {
    var h = U.h, s = U.s, c = args && args.camada; if (!c) return;
    var N = c.numeros || [], C = prefixo('abu-simbel'), uid = 'pc-abu-simbel-' + (++nAbu);
    var nBl = acha(N, 'rotulo', /abu simbel: blocos/i), fato = acha(c.fatos, 'titulo', /abu simbel muda/i) || acha(c.fatos, 'titulo', /abu simbel/i);
    var base = nBl ? txt(nBl.valor) : (fato ? txt(fato.texto) : ''), blocos = pega(base, '#\\s*blocos'); if (!blocos) return;
    var sobe = pega(base, '#\\s*m mais alto'), recua = pega(base, '#\\s*m para tr[áa]s'), recuaAprox = /cerca de\s+[\d.,]+\s*m para tr/i.test(base);
    var medidas = sobe > 0 && recua > 0 && !(fato && fato.certeza === 'baixa'); // só escreve as medidas se a camada as confirma
    var mp = /de\s+(\d+)\s+a\s+(\d+)\s+toneladas/i.exec(base), ma = /(\d{4})\s*a\s*(\d{4})/.exec(nBl && nBl.ano ? txt(nBl.ano) : (fato ? txt(fato.ano_txt) : ''));
    var nCusto = acha(N, 'rotulo', /abu simbel: custo/i), nCamp = acha(N, 'rotulo', /campanha da n[úu]bia/i), mu = fato && /Unesco[^.]*?em (\d{4})/i.exec(txt(fato.texto));
    var dZ = sobe > 0 ? sobe : 65, dX = recua > 0 ? recua : 200, A = 33, P = 62; // A e P: altura e fundo do templo no desenho, só indicativos

    estilo('abu-simbel', CSS_ABU);
    el.classList.add(C()); if (ehClaro(el, U)) el.classList.add(C('claro'));
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 860); });

    var estado = U.reduz ? 2 : 0, relogios = [], leg = h('p', { class: C('leg'), 'aria-live': 'polite' });
    var TXT = [
      [ma ? 'Até ' + ma[1] : 'Antes', 'Os templos de Abu Simbel, cortados na rocha no tempo de Ramsés II, ficam à beira do Nilo. O lago da nova represa vai cobrir o lugar.'],
      [ma ? ma[1] + ' a ' + ma[2] : 'O corte', 'Os dois templos são serrados em ' + U.int(blocos) + ' blocos' + (mp ? ' de ' + mp[1] + ' a ' + mp[2] + ' toneladas' : '') + ' e levados para o alto da encosta.'],
      [ma ? 'Desde ' + ma[2] : 'Depois', (medidas ? 'Os templos estão remontados ' + U.int(sobe) + ' m mais alto e ' + (recuaAprox ? 'cerca de ' : '') + U.int(recua) + ' m para trás.' : 'Os templos estão remontados no alto da encosta.') + ' A água do lago cobriu o lugar antigo.']
    ];
    var bt = U.botoes([{ id: '0', rotulo: 'antes' }, { id: '1', rotulo: 'o corte' }, { id: '2', rotulo: 'depois' }], String(estado), function (id) { para(); escolhe(+id); }, 'Momento da mudança');
    function para() { relogios.forEach(clearTimeout); relogios = []; }
    function escolhe(n) {
      if (n === 1 && estado === 2 && !U.reduz) { // de "depois" para "o corte": volta ao começo de uma vez e mostra a mudança de novo
        el.classList.add(C('jato'));
        [0, 1, 2].forEach(function (i) { el.classList.toggle(C('e' + i), i === 0); });
        host.getBoundingClientRect(); // o estado de "antes" vale já, sem transição
        el.classList.remove(C('jato'));
      }
      poe(n);
    }
    function poe(n) {
      estado = n;
      [0, 1, 2].forEach(function (i) { el.classList.toggle(C('e' + i), i === n); });
      Array.prototype.forEach.call(bt.children, function (b, i) { b.setAttribute('aria-pressed', i === n ? 'true' : 'false'); });
      leg.textContent = ''; leg.appendChild(h('b', null, TXT[n][0] + '. ')); leg.appendChild(document.createTextNode(TXT[n][1]));
    }

    var host = h('div');
    function desenha(w) {
      host.textContent = '';
      var XMIN = -48, XMAX = dX + P + 22, ZMAX = dZ + A + 14, k = w / (XMAX - XMIN), topo = 30;
      function X(x) { return (x - XMIN) * k; } function Y(z) { return topo + (ZMAX - z) * k; }
      var yH = Y(-15), H = Math.round(yH + (medidas ? 34 : 8)), zRio = -4, zLago = dZ - 6;
      var T = [[XMIN, -17], [-38, -14], [-30, -6], [-22, 0], [0, 0], [0, A], [5, A + 8], [20, A + 19], [46, dZ - 5], [80, dZ - 1], [dX - 60, dZ], [dX, dZ],
        [dX, dZ + A], [dX + 9, dZ + A + 8], [dX + 34, dZ + A + 12], [dX + P - 2, dZ + A + 7], [dX + P + 12, dZ + 22], [XMAX, dZ + 12]];
      var linha = T.map(function (p, i) { return (i ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('');
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        style: '--pc-dx:' + f1(dX * k) + 'px;--pc-dy:' + f1(-dZ * k) + 'px;--pc-y0:' + f1(Y(zRio)) + 'px;--pc-y2:' + f1(Y(zLago)) + 'px',
        'aria-label': 'Corte de lado do vale em Abu Simbel, em três momentos. Antes: o templo cavado na rocha, à beira do Nilo. O corte: o templo é serrado em ' + U.int(blocos) +
          ' blocos. Depois: o templo remontado ' + (medidas ? U.int(sobe) + ' metros mais alto e ' + (recuaAprox ? 'cerca de ' : '') + U.int(recua) + ' metros para trás' : 'no alto da encosta') + ', e a água do lago cobre o lugar antigo.' });
      svg.appendChild(s('defs', null, s('clipPath', { id: uid + '-ar' }, s('path', { d: linha + 'V-60H0Z' })), s('clipPath', { id: uid + '-ro' }, s('path', { d: linha + 'V' + H + 'H0Z' }))));
      svg.appendChild(s('path', { class: C('rocha'), d: linha + 'V' + H + 'H0Z' }));
      var veios = '', z;
      for (z = -9; z < ZMAX; z += 21) veios += 'M0 ' + f1(Y(z)) + 'H' + w;
      svg.appendChild(s('path', { class: C('veio'), d: veios, 'clip-path': 'url(#' + uid + '-ro)' }));
      // o vazio que fica na rocha, e a água que entra nele no fim
      var oco = { x: f1(X(0)), y: f1(Y(A)), width: f1(P * k), height: f1(A * k) };
      svg.appendChild(s('rect', { class: C('oco'), x: oco.x, y: oco.y, width: oco.width, height: oco.height }));
      svg.appendChild(s('g', { class: C('so2') }, s('rect', { class: C('fundoagua'), x: oco.x, y: oco.y, width: oco.width, height: oco.height })));
      svg.appendChild(s('g', { 'clip-path': 'url(#' + uid + '-ar)' },
        s('g', { class: C('agua') }, s('rect', { class: C('fundoagua'), x: 0, y: 0, width: w, height: H + 80 }), s('line', { class: C('tona'), x1: 0, x2: w, y1: 0.6, y2: 0.6 }))));
      svg.appendChild(s('path', { class: C('perfil'), d: linha }));
      svg.appendChild(s('rect', { class: C('novo') + ' ' + C('so12'), x: oco.x, y: oco.y, width: oco.width, height: oco.height }));
      // até onde a água vai subir (antes) e o lugar novo (durante)
      svg.appendChild(s('g', { class: C('so01') }, s('line', { class: C('nivel'), x1: 0, x2: f1(X(42)), y1: f1(Y(zLago)), y2: f1(Y(zLago)) }),
        s('text', { class: C('it'), x: 3, y: f1(Y(zLago) - 6) }, 'futuro lago')));
      svg.appendChild(s('rect', { class: C('novo') + ' ' + C('so1'), x: f1(X(dX)), y: f1(Y(dZ + A)), width: f1(P * k), height: f1(A * k) }));
      var g0 = [X(-4), Y(25)], g1 = [X(dX - 5), Y(dZ + 26)], gc = [X(dX * 0.36), Y(dZ + A + 46)];
      svg.appendChild(s('g', { class: C('so1') }, s('path', { class: C('guia'), d: 'M' + f1(g0[0]) + ' ' + f1(g0[1]) + 'Q' + f1(gc[0]) + ' ' + f1(gc[1]) + ' ' + f1(g1[0]) + ' ' + f1(g1[1]) }),
        s('path', { class: C('seta'), d: 'M2 0L-8 -4.4V4.4Z', transform: 'translate(' + f1(g1[0]) + ' ' + f1(g1[1]) + ') rotate(' + f1(Math.atan2(g1[1] - gc[1], g1[0] - gc[0]) * 180 / Math.PI) + ')' })));
      // o templo: o colosso sentado na frente (cabeça, tronco, pernas e trono) e o corpo cavado na rocha, com as salas por dentro.
      // Antes, aparece inteiro; no corte, em blocos que saem da frente para o fundo.
      var COLOSSO = [[[0, 14.9], [-5.3, 14.9], [-5.9, 15.1], [-5.4, 16], [-5.9, 16.7], [-5.3, 17.7], [-5.6, 18.1], [-4.6, 21.3], [-2.4, 21.7], [-1.8, 18.3], [-0.9, 17.3], [0, 15.6]],
        [[0, 9.8], [-5, 9.8], [-5.2, 14.5], [-5.3, 14.9], [0, 14.9]],
        [[0, 0], [-10.5, 0], [-10.5, 1.4], [-8.8, 1.4], [-8.8, 8.4], [-9.2, 8.8], [-9.2, 9.8], [0, 9.8]]];
      var SALAS = [[0, 0], [0, 9], [4, 9], [4, 20], [30, 20], [30, 15], [44, 15], [44, 11], [54, 11], [54, 2.5], [44, 2.5], [44, 1.2], [30, 1.2], [30, 0]];
      function dPoli(pts) { return pts.map(function (p, q) { return (q ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('') + 'Z'; }
      var dSalas = dPoli(SALAS), defs = svg.querySelector('defs'), n = 0, nc = 6, nr = 3, i, j;
      var gI = s('g', { class: C('inteiro') }, s('rect', { class: C('pedra'), x: oco.x, y: oco.y, width: oco.width, height: oco.height }), s('path', { class: C('sala'), d: dSalas }));
      COLOSSO.forEach(function (pp) { gI.appendChild(s('path', { class: C('pedra') + ' ' + C('col'), d: dPoli(pp) })); });
      var gB = s('g', { class: C('blocos') });
      function bloco() { var g = s('g', { class: C('bx'), style: '--pc-d:' + (700 + n * 150) + 'ms' }, s('g', { class: C('by') }, Array.prototype.slice.call(arguments))); n++; return g; }
      COLOSSO.forEach(function (pp) { gB.appendChild(bloco(s('path', { class: C('pedra'), d: dPoli(pp) }))); });
      for (i = 0; i < nc; i++) for (j = nr - 1; j >= 0; j--) {
        var r = { x: f1(X(i * P / nc)), y: f1(Y((j + 1) * A / nr)), width: f1(P / nc * k), height: f1(A / nr * k) }, idc = uid + '-b' + i + j;
        defs.appendChild(s('clipPath', { id: idc }, s('rect', r)));
        gB.appendChild(bloco(s('rect', { class: C('pedra'), x: r.x, y: r.y, width: r.width, height: r.height }), s('path', { class: C('sala'), d: dSalas, 'clip-path': 'url(#' + idc + ')' })));
      }
      svg.appendChild(gB); svg.appendChild(gI);
      // cotas (só no fim, e só se a camada confirma as medidas)
      if (medidas) {
        var xV = X(dX + 14), risco = function (x, y) { return 'M' + f1(x - 3.5) + ' ' + f1(y + 3.5) + 'L' + f1(x + 3.5) + ' ' + f1(y - 3.5); };
        svg.appendChild(s('g', { class: C('so2') },
          s('path', { class: C('chamada'), d: 'M' + f1(X(0)) + ' ' + f1(Y(0) + 3) + 'V' + f1(yH + 5) + 'M' + f1(X(dX)) + ' ' + f1(Y(dZ) + 3) + 'V' + f1(yH + 5) + 'M' + f1(X(P) + 3) + ' ' + f1(Y(0)) + 'H' + f1(xV + 5) }),
          s('path', { class: C('cota'), d: 'M' + f1(X(0)) + ' ' + f1(yH) + 'H' + f1(X(dX)) + risco(X(0), yH) + risco(X(dX), yH) + 'M' + f1(xV) + ' ' + f1(Y(0)) + 'V' + f1(Y(dZ)) + risco(xV, Y(0)) + risco(xV, Y(dZ)) }),
          s('text', { x: f1(X(dX / 2)), y: f1(yH + 22), 'text-anchor': 'middle' }, s('tspan', { class: C('n') }, (recuaAprox ? 'cerca de ' : '') + U.int(recua) + ' m'), ' para trás'),
          s('text', { class: C('n'), x: f1(xV + 9), y: f1(Y(dZ / 2) + 2) }, U.int(sobe) + ' m'),
          s('text', { x: f1(xV + 9), y: f1(Y(dZ / 2) + 17) }, 'mais alto')));
      }
      // rótulos de cada momento
      svg.appendChild(s('text', { class: C('it') + ' ' + C('so01'), x: 3, y: f1(Y(zRio) - 6) }, 'Nilo'));
      svg.appendChild(s('text', { class: C('it') + ' ' + C('so2'), x: 3, y: f1(Y(zLago) - 7) }, 'lago Nasser'));
      svg.appendChild(s('text', { class: C('forte') + ' ' + C('so0'), x: f1(X(P) + 9), y: f1(Y(A / 2) + 4) }, 'o templo, cavado na rocha'));
      svg.appendChild(s('text', { class: C('so1'), x: f1(X(dX + P / 2)), y: f1(Y(dZ + A + 19)), 'text-anchor': 'middle' }, 'lugar novo'));
      svg.appendChild(s('text', { class: C('forte') + ' ' + C('so2'), x: f1(X(dX + P / 2)), y: f1(Y(dZ + A + 19)), 'text-anchor': 'middle' }, 'o templo hoje'));
      svg.appendChild(s('g', { class: C('so2') }, s('text', { class: C('forte'), x: f1(X(-3)), y: f1(Y(A / 2) - 2), 'text-anchor': 'end' }, 'lugar'),
        s('text', { class: C('forte'), x: f1(X(-3)), y: f1(Y(A / 2) + 12), 'text-anchor': 'end' }, 'antigo')));
      host.appendChild(svg);
    }

    // ---- montagem ----
    el.appendChild(h('h3', { class: C('tit') }, 'Mudar um templo de lugar'));
    el.appendChild(h('p', { class: C('sub') }, 'Abu Simbel visto de lado, em três momentos' + (mu ? '. A Unesco lançou a campanha em ' + mu[1] : '') + (ma ? '; a mudança foi feita de ' + ma[1] + ' a ' + ma[2] : '') + '.'));
    el.appendChild(h('div', { class: C('ctl') }, bt));
    var ficha = h('dl', { class: C('ficha') });
    ficha.appendChild(h('div', null, h('dt', null, 'Blocos cortados'), h('dd', null, h('b', null, U.int(blocos)), mp ? 'de ' + mp[1] + ' a ' + mp[2] + ' toneladas cada um' : '')));
    if (medidas) ficha.appendChild(h('div', null, h('dt', null, 'Para onde foi'), h('dd', null, h('b', null, U.int(sobe) + ' m'), 'mais alto e ' + (recuaAprox ? 'cerca de ' : '') + U.int(recua) + ' m para trás')));
    if (nCusto) { var pcu = /^(cerca de\s+)?(US\$\s*[\d.,]+\s*(?:milh[õo]es|bilh[õo]es)?)\s*(.*)$/i.exec(txt(nCusto.valor)); if (pcu) ficha.appendChild(h('div', null, h('dt', null, 'Custo'), h('dd', null, pcu[1] || '', h('b', null, pcu[2]), pcu[3].replace(/^\((.*)\)$/, '$1')))); }
    if (nCamp) { var pp = /(cerca de\s+|mais de\s+)?(\d+)\s+pa[íi]ses/i.exec(txt(nCamp.valor)), pm = /(\d+)\s+monumentos[^;]*/i.exec(txt(nCamp.valor));
      if (pp) ficha.appendChild(h('div', null, h('dt', null, 'Campanha da Núbia' + (nCamp.ano ? ', ' + txt(nCamp.ano) : '')), h('dd', null, pp[1] || '', h('b', null, pp[2] + ' países'), 'ajudaram a pagar' + (pm ? '; a campanha cuidou de ' + pm[0] : '') + '.'))); }
    el.appendChild(h('div', { class: C('g') }, h('div', null, host, leg), ficha));
    el.appendChild(h('p', { class: 'pc-nota ' + C('nota') }, 'O que ver aqui: o templo não foi arrastado, foi desmontado e montado de novo acima da linha da água. ' +
      (medidas ? 'As duas distâncias estão na mesma escala; ' : '') + 'o tamanho do templo e o perfil da encosta são só indicativos, e cada bloco do desenho vale por dezenas dos de verdade.'));
    var linhasT = [nBl, nCusto, nCamp].filter(Boolean).map(function (n) { return [txt(n.rotulo), txt(n.valor), txt(n.ano), txt(n.fonte)]; });
    el.appendChild(U.tabela('Ver os números', ['O quê', 'Valor', 'Quando', 'Fonte'], linhasT));
    var fo = fontes(U, [fato ? [txt(fato.fonte), fato.url] : (nBl ? [txt(nBl.fonte), nBl.url] : null)]);
    if (fo) el.appendChild(fo);

    poe(estado);
    medir(host, U, desenha);
    if (!U.reduz) U.aoVer(host, function () {
      if (estado !== 0) return;
      relogios.push(setTimeout(function () { poe(1); }, 1500));
      relogios.push(setTimeout(function () { poe(2); }, 1500 + 600 + 21 * 150 + 1700));
    }, { margem: '0px 0px -25% 0px' });
  });
})();
