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
  /** estilo da peça, posto uma vez; no texto, & vale '.pc-nome' */
  function estilo(nome, css) {
    if (postos[nome]) return; postos[nome] = 1;
    var st = document.createElement('style'); st.setAttribute('data-peca', nome);
    st.textContent = css.replace(/&/g, '.pc-' + nome); document.head.appendChild(st);
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
    '&-fiada{fill:var(--pc-pedra);stroke:var(--pc-junta);stroke-width:.8;opacity:0;transform:translateY(-10px);transition:opacity .3s ease,transform .5s cubic-bezier(.2,.7,.2,1)}' +
    '&-corpo{fill:none;stroke:var(--pc-borda);stroke-width:1.3;stroke-linejoin:round}' +
    '&-ponta{fill:color-mix(in srgb,var(--acento) 10%,transparent);stroke:var(--acento);stroke-width:1.4;stroke-dasharray:4 3;stroke-linejoin:round}' +
    '&-cota{stroke:var(--tinta2);stroke-width:1;fill:none}' +
    '&-chamada{stroke:var(--tinta2);stroke-width:.8;stroke-dasharray:2 3;fill:none;opacity:.8}' +
    '&-gente{fill:var(--tinta)}' +
    '&-aro{fill:none;stroke:var(--tinta2);stroke-width:.8}' +
    '&-tarde{opacity:0;transition:opacity .7s ease}' +
    '&-vis &-fiada{opacity:1;transform:none}' +
    '&-vis &-tarde{opacity:1}' +
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
    '&-boneco{fill:var(--tinta2);opacity:0;transition:opacity .25s ease}' +
    '&-boneco&-hoje{fill:var(--acento)}' +
    '&-boneco&-oco{fill:none;stroke:var(--acento);stroke-width:1.1}' +
    '&-gente-vis &-boneco{opacity:1}' +
    '&-chave{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:12.5px;color:var(--tinta2);margin:4px 0 0}' +
    '&-chave span{display:inline-flex;align-items:center;gap:6px}' +
    '&-chave svg{flex:none}' +
    '@media (prefers-reduced-motion:reduce){&-fiada,&-tarde,&-boneco{opacity:1;transform:none;transition:none}}';

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
    var PESSOA = 1.7, falta = hOrig - hHoje;

    estilo('piramide', CSS_PIRAMIDE);
    el.classList.add(C()); if (ehClaro(el, U)) el.classList.add(C('claro'));
    U.aoMedir(el, function (w) { el.classList.toggle(C('largo'), w >= 860); });

    el.appendChild(h('h3', { class: C('tit') }, 'A Grande Pirâmide em números'));
    el.appendChild(h('p', { class: C('sub') }, 'A pirâmide de Quéops vista de frente, em escala' + (nOrig.ano ? ', como ficou pronta por volta de ' + txt(nOrig.ano).replace(/^c\.\s*/, '') : '') + ' e como está hoje.'));

    // ---- desenho de frente ----
    var hostD = h('div', { class: C('d') });
    function desenha(w) {
      hostD.textContent = '';
      var peq = w < 520, mL = peq ? 50 : Math.min(124, Math.round(w * 0.17)), topo = 46, pe = 70;
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
        svg.appendChild(s('path', { class: C('fiada'), d: d, style: 'transition-delay:' + Math.round(i * passo) + 'ms' }));
      }
      var t0 = Math.round(nF * passo + 250);
      function tarde(no, extra) { no.setAttribute('class', (no.getAttribute('class') || '') + ' ' + C('tarde')); no.style.transitionDelay = (t0 + (extra || 0)) + 'ms'; return no; }
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
          h('p', null, h('strong', null, (p && p.aprox ? p.aprox + ' ' : '') + (p ? p.grande : U.int(f[1]) + ' mil')), p ? p.resto.replace(/^[,(]\s*/, '').replace(/\)\s*$/, '') : ''));
        quem.appendChild(fila);
        filas.push({ host: host, cheios: Math.round(f[1] * 1000 / CADA), ocos: Math.round(f[2] * 1000 / CADA), cl: f[4], nome: f[3], v: f[0].valor });
      });
      var chave = h('p', { class: C('chave') },
        h('span', null, boneco(1, C('boneco') + ' ' + C('hoje'), true), U.int(CADA) + ' pessoas'),
        vTeto && vTeto > vArq ? h('span', null, boneco(1, C('boneco') + ' ' + C('oco'), true), 'até ' + U.int(vTeto) + ' mil, o alto da faixa') : null);
      quem.appendChild(chave);
      if (tempo) quem.appendChild(h('p', { class: 'pc-nota', style: { 'margin-top': '14px' } }, tempo.t));
      el.appendChild(quem);
      filas.forEach(function (f) { medir(f.host, U, function (w) { desenhaFila(f, w); }); });
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
      var total = f.cheios + f.ocos, por = [100, 50, 25, 20, 10].filter(function (n) { return w / n >= 11; })[0] || 10;
      var p = Math.min(15, w / por), k = Math.min(1.15, (p - 2.4) / 10), lin = Math.ceil(total / por), ah = 20 * k + 5;
      var svg = s('svg', { width: w, height: Math.ceil(lin * ah), viewBox: '0 0 ' + w + ' ' + Math.ceil(lin * ah), role: 'img', 'aria-label': f.nome + ': ' + txt(f.v) + '.' });
      for (var i = 0; i < total; i++) {
        var g = boneco(k, C('boneco') + (f.cl ? ' ' + f.cl : '') + (i >= f.cheios ? ' ' + C('oco') : ''));
        g.setAttribute('transform', 'translate(' + f1((i % por) * p) + ' ' + f1(Math.floor(i / por) * ah) + ')');
        g.style.transitionDelay = Math.round(i * 9) + 'ms';
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

    U.aoVer(el, function () { el.classList.add(C('vis')); });
    if (quem) U.aoVer(quem, function () { el.classList.add(C('gente-vis')); });
    if (U.reduz) { el.classList.add(C('vis')); el.classList.add(C('gente-vis')); }
  });
})();
