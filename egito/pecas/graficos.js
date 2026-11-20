// Peças "gráficos": os cinco interlúdios que leem uma série de egito/dados.json (dados.series).
//   populacao     "Quanta gente coube à beira do rio"          série populacao
//   descobertas   "Como sabemos"                                série descobertas (+ o fim dos hieróglifos, da série escritas)
//   escritas      "A mesma língua, escrita de quatro jeitos"    série escritas
//   religioes     "Três maiorias em dois mil anos"              série religioes
//   nilo-numeros  "Cinco mil anos medindo a cheia"              série nilo
// Cada peça recebe args.serie, desenha no tamanho real (U.aoMedir), usa só as variáveis de cor da era e
// injeta o próprio estilo uma vez, com todas as classes começando por pc-<nome>.
// Nenhum número é escrito aqui: tudo é lido da série (ou de um fato de camada) em tempo de execução.
// No topo de cada peça há a tabela "de onde vem cada número".
(function () {
  'use strict';
  var E = window.EGITO; if (!E) return;
  var HOJE = E.HOJE || 2026;

  // ================= utilidades comuns às cinco peças =================
  var postos = {}, conta = 0;
  /** K = fabrica('populacao'); K() -> 'pc-populacao'; K('linha') -> 'pc-populacao-linha' */
  function fabrica(nome) { var p = 'pc-' + nome; return function (x) { return x ? p + '-' + x : p; }; }
  /** estilo da peça, uma vez só. No texto, "&" vale ".pc-<nome>". */
  function poeEstilo(nome, css) {
    if (postos[nome]) return; postos[nome] = 1;
    var st = document.createElement('style');
    st.setAttribute('data-peca', nome);
    st.textContent = css.replace(/&/g, '.pc-' + nome);
    document.head.appendChild(st);
  }
  function unico(p) { conta++; return p + '-' + conta; }
  function limita(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function txt(v) { return v == null ? '' : String(v); }
  /** fundo claro ou escuro? (para as poucas cores fixas, "do mundo") */
  function fundoClaro(el, U) {
    var c = U.cor(el, 'fundo'), m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
  }
  /** nome sem o parêntese: "Judaísmo (Elefantina e Alexandria)" -> "Judaísmo" */
  function semParentese(t) { return txt(t).replace(/\s*\(.*$/, '').trim(); }
  /** o que está entre parênteses, ou '' */
  function parentese(t) { var m = /\(([^)]+)\)/.exec(txt(t)); return m ? m[1] : ''; }
  function certezaTxt(c) { return c === 'baixa' ? 'de memória, sem fonte conferida' : c === 'media' ? 'conferido em parte' : 'conferido'; }
  /** a marca de certeza da página (classes selo / selo parte / selo memoria e nota, de egito.css); a ressalva abre ao tocar */
  function selo(U, f) {
    var rot = f.certeza === 'baixa' ? 'de memória, sem fonte conferida' : f.certeza === 'media' ? 'conferido em parte' : null;
    if (!rot && !f.ressalva) return null;
    var cl = 'selo' + (f.certeza === 'baixa' ? ' memoria' : f.certeza === 'media' ? ' parte' : '');
    if (!f.ressalva) return { marca: U.h('span', { class: cl }, rot), nota: null };
    var nota = U.h('p', { class: 'nota', hidden: true }, f.ressalva);
    var b = U.h('button', { type: 'button', class: cl, 'aria-expanded': 'false', onclick: function () {
      var abre = nota.hidden; nota.hidden = !abre; b.setAttribute('aria-expanded', abre ? 'true' : 'false');
    } }, (rot || 'nota') + ' ›');
    return { marca: b, nota: nota };
  }
  /** primeiro fato de camada cujo título casa com re (de preferência na camada dada) */
  function achaFato(dados, re, camadaId) {
    var cs = (dados && dados.camadas) || [], i, j, fs;
    for (i = 0; i < cs.length; i++) {
      if (camadaId && cs[i].id !== camadaId) continue;
      fs = cs[i].fatos || [];
      for (j = 0; j < fs.length; j++) if (re.test(txt(fs[j].titulo))) return fs[j];
    }
    return null;
  }
  /** rótulo de um ano no eixo: -3000 "3000 a.C."; 1 "ano 1"; 1000 "1000" */
  function anoEixo(a) { return a < 0 ? (-a) + ' a.C.' : a < 1000 ? 'ano ' + Math.max(1, a) : String(a); }
  /** anos redondos entre t0 e t1, de passo em passo (o zero vira o ano 1) */
  function anosRedondos(t0, t1, passo) {
    var o = [], a;
    for (a = Math.ceil(t0 / passo) * passo; a <= t1; a += passo) o.push(a === 0 ? 1 : a);
    return o;
  }
  /** espalha posições em ordem crescente para ficarem a pelo menos d uma da outra, dentro de [a, b] */
  function separa(xs, d, a, b) {
    var o = xs.slice(), i;
    for (i = 1; i < o.length; i++) if (o[i] - o[i - 1] < d) o[i] = o[i - 1] + d;
    if (o.length && o[o.length - 1] > b) {
      o[o.length - 1] = b;
      for (i = o.length - 2; i >= 0; i--) if (o[i + 1] - o[i] < d) o[i] = o[i + 1] - d;
    }
    if (o.length && o[0] < a) { o[0] = a; for (i = 1; i < o.length; i++) if (o[i] - o[i - 1] < d) o[i] = o[i - 1] + d; }
    return o;
  }
  function caixasBatem(a, b, folga) {
    folga = folga || 0;
    return a.x < b.x + b.w + folga && b.x < a.x + a.w + folga && a.y < b.y + b.h + folga && b.y < a.y + a.h + folga;
  }
  /** rótulos do eixo do tempo sem encavalar: escolhe o maior ritmo (todos, um sim um não, um a cada três) que cabe */
  function eixoTempo(U, g, anos, X, y, classe, x0, x1) {
    var s = U.s, ts = anos.map(function (a) {
      var t = s('text', { class: classe, y: y, 'text-anchor': 'middle' }, anoEixo(a));
      g.appendChild(t); return { a: a, t: t, x: X(a), w: 0 };
    });
    ts.forEach(function (o) {
      try { o.w = o.t.getComputedTextLength(); } catch (e) { o.w = o.t.textContent.length * 6.2; }
      o.e = o.x - o.w / 2; o.d = o.x + o.w / 2;
      if (o.e < x0) { o.e = x0; o.d = x0 + o.w; o.t.setAttribute('text-anchor', 'start'); o.x = x0; }
      if (o.d > x1) { o.d = x1; o.e = x1 - o.w; o.t.setAttribute('text-anchor', 'end'); o.x = x1; }
      o.t.setAttribute('x', o.x.toFixed(1));
    });
    var passo, ok, i, ult;
    for (passo = 1; passo <= 4; passo++) {
      ok = true; ult = null;
      for (i = 0; i < ts.length; i += passo) { if (ult && ts[i].e < ult.d + 10) { ok = false; break; } ult = ts[i]; }
      if (ok) break;
    }
    ts.forEach(function (o, i) { if (i % passo) o.t.remove(); });
    return ts.filter(function (o, i) { return !(i % passo); });
  }
  /** tabela de U.tabela que, no celular, vira uma ficha por linha (cada célula leva o nome da coluna) */
  var CSS_TABELA =
    '& .pc-tabela td,& .pc-tabela th{overflow-wrap:anywhere}' +
    '@media (max-width:640px){& .pc-tabela thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    '& .pc-tabela table,& .pc-tabela tbody{display:block;width:100%}' +
    '& .pc-tabela tr{display:block;padding:10px 0;border-bottom:1px solid var(--linha)}' +
    '& .pc-tabela td{display:grid;grid-template-columns:6.4em minmax(0,1fr);gap:10px;padding:2px 0;border:0}' +
    '& .pc-tabela td::before{content:attr(data-rot);font-size:12px;font-weight:600;color:var(--tinta2)}' +
    '& .pc-tabela td:empty{display:none}}';
  function tabela(U, titulo, colunas, linhas) {
    var det = U.tabela(titulo, colunas, linhas), t = det.querySelector('table');
    if (!t) return det;
    t.setAttribute('role', 'table');
    Array.prototype.forEach.call(t.querySelectorAll('thead,tbody'), function (x) { x.setAttribute('role', 'rowgroup'); });
    Array.prototype.forEach.call(t.querySelectorAll('tr'), function (tr) {
      tr.setAttribute('role', 'row');
      Array.prototype.forEach.call(tr.children, function (c, i) {
        c.setAttribute('role', c.tagName === 'TH' ? 'columnheader' : 'cell');
        if (c.tagName === 'TD') c.setAttribute('data-rot', colunas[i] || '');
      });
    });
    return det;
  }
  /** refaz o desenho uma vez quando as fontes da página terminam de chegar (as larguras de texto mudam) */
  function aoChegarFontes(fn) {
    try {
      if (document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready) document.fonts.ready.then(function () { fn(); });
    } catch (e) {}
  }

  // =====================================================================================================
  // 1. POPULAÇÃO — "Quanta gente coube à beira do rio"
  // De onde vem cada número (tudo lido de dados.series.populacao.pontos, em tempo de execução):
  //   linha e pontos ........ pontos[].ano e pontos[].valor (valor_txt no painel e na tabela)
  //   faixa das estimativas .. pontos[].min e pontos[].max (texto: pontos[].faixa)
  //   onde começa a contagem . o ponto cujo ano_txt diz "primeiro censo" (1882); antes dele a linha é tracejada
  //   quem estima ........... pontos[].fonte, .url, .certeza e .ressalva
  //   acontecimentos no eixo:
  //     Peste Antonina ...... ressalva do ponto de 164 da série ("Peste Antonina (165 a 180)", datação não conferida)
  //     Peste Negra ......... fato "A Peste Negra" da camada mamelucos (ano 1347)
  //     primeiro censo ...... o próprio ponto de 1882 da série
  //     Represa Alta ........ fato "A Represa Alta de Assuã" da camada nilo (1960 a 1970; marca no último ano)
  //   "16 vezes em 144 anos" . conta sobre o ponto do primeiro censo e o último ponto da série
  // =====================================================================================================
  var CSS_POP =
    '&-topo{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;margin:0 0 16px}' +
    '&-leg{list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px;margin:0;padding:0;font-size:12.5px;line-height:1.3;color:var(--tinta2)}' +
    '&-leg li{display:inline-flex;align-items:center;gap:7px}&-leg svg{flex:none;display:block}' +
    '&-palco{position:relative}' +
    '&-svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;cursor:crosshair}' +
    '&-svg:focus{outline:none}&-svg:focus-visible{outline:2px solid var(--acento);outline-offset:4px;border-radius:6px}' +
    '&-gl{stroke:var(--linha);stroke-width:1;shape-rendering:crispEdges}' +
    '&-gt{font:500 11px var(--sem);fill:var(--tinta2)}' +
    '&-base{stroke:var(--tinta2);stroke-width:1;opacity:.6;shape-rendering:crispEdges}' +
    '&-et{font:500 11px var(--sem);fill:var(--tinta2);font-variant-numeric:tabular-nums;stroke:var(--fundo);stroke-width:5px;stroke-linejoin:round;paint-order:stroke}' +
    '&-banda{fill:var(--acento);opacity:.17}' +
    '&-est{fill:none;stroke:var(--acento);stroke-width:2;stroke-dasharray:5 4;stroke-linejoin:round}' +
    '&-cen{fill:none;stroke:var(--acento);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}' +
    '&-masc{fill:none;stroke:#fff;stroke-width:16;stroke-linejoin:round;stroke-dasharray:1 1.02;stroke-dashoffset:1;transition:stroke-dashoffset 2.8s cubic-bezier(.45,.05,.3,1)}' +
    '&-vis &-masc{stroke-dashoffset:0}' +
    '&-pe{fill:var(--fundo);stroke:var(--acento);stroke-width:1.6}' +
    '&-pc{fill:var(--acento);stroke:var(--fundo);stroke-width:1.6}' +
    '&-pe,&-pc,&-rot,&-banda,&-queda{opacity:0;transition:opacity .5s ease;transition-delay:var(--d,0s)}' +
    '&-vis &-pe,&-vis &-pc,&-vis &-rot{opacity:1}&-vis &-banda{opacity:.17}&-vis &-queda{opacity:.55}' +
    '&-mudando &-rot{opacity:0;transition:opacity .12s ease}' +
    '&-rv{font:600 15px var(--serifa);fill:var(--tinta)}&-rq{font:500 11px var(--sem);fill:var(--tinta2)}' +
    '&-rv,&-rq{stroke:var(--fundo);stroke-width:4px;stroke-linejoin:round;paint-order:stroke}' +
    '&-fio{stroke:var(--tinta2);stroke-width:1;opacity:.6}' +
    '&-queda{stroke:var(--tinta2);stroke-width:1}' +
    '&-ev circle{fill:var(--s2);stroke:var(--linha);stroke-width:1}&-ev text{font:700 11px var(--sem);fill:var(--tinta);text-anchor:middle}' +
    '&-ev line{stroke:var(--tinta2);stroke-width:1;opacity:.7}' +
    '&-mira{pointer-events:none}&-mira line{stroke:var(--tinta);stroke-width:1;opacity:.5}' +
    '&-mira circle{fill:none;stroke:var(--tinta);stroke-width:1.6}' +
    '&-mira rect{fill:var(--s2);stroke:var(--linha);stroke-width:1}&-mira text{font:600 11.5px var(--sem);fill:var(--tinta);text-anchor:middle}' +
    '&-leitura{margin:10px 0 0;padding:14px 16px 14px;background:var(--s1);border:1px solid var(--linha);border-radius:14px;min-height:148px}' +
    '&-cab{display:flex;align-items:center;gap:8px;margin:-6px -8px 2px}' +
    '&-cab button{flex:none;width:44px;height:44px;border:0;background:none;border-radius:50%;font-size:22px;line-height:1;cursor:pointer;color:var(--tinta)}' +
    '&-cab button:hover{background:var(--s2)}' +
    '&-qd{flex:1;min-width:0;text-align:center;font-size:13px;font-weight:700;letter-spacing:.02em;color:var(--tinta2)}' +
    '&-val{font-family:var(--serifa);font-size:clamp(24px,3.4vw,32px);font-weight:600;line-height:1.1;letter-spacing:-.01em;margin:0}' +
    '&-val small{font-family:var(--sem);font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--tinta2);margin-left:10px;white-space:nowrap}' +
    '&-lin{margin:8px 0 0;font-size:13.5px;line-height:1.45;color:var(--tinta2);max-width:60em}&-lin b{color:var(--tinta);font-weight:600}&-lin a{color:inherit}' +
    '&-pe2{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:10px}' +
    '&-marcos{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px 28px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));font-size:13.5px;line-height:1.4}' +
    '&-marcos li{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start}' +
    '&-marcos i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--s2);border:1px solid var(--linha);font-size:11.5px;font-weight:700}' +
    '&-marcos b{font-weight:600}&-marcos span{color:var(--tinta2)}' +
    '& .pc-nota{margin:16px 0 0}' +
    '&-leitura .nota{background:var(--s2)}' +
    '& .pc-botoes button{white-space:nowrap}@media (max-width:380px){& .pc-botoes button{padding:0 11px;font-size:12.5px}}' +
    CSS_TABELA +
    '@media (prefers-reduced-motion: reduce){&-masc{stroke-dashoffset:0;transition:none}&-pe,&-pc,&-rot{opacity:1;transition:none}&-banda{opacity:.17;transition:none}&-queda{opacity:.55;transition:none}}';

  E.peca('populacao', function (el, dados, U, args) {
    var s = U.s, h = U.h, K = fabrica('populacao');
    var serie = args && args.serie;
    if (!serie || !Array.isArray(serie.pontos)) return;
    var pts = serie.pontos.filter(function (p) { return p && typeof p.ano === 'number' && typeof p.valor === 'number' && p.valor > 0; })
      .slice().sort(function (a, b) { return a.ano - b.ano; });
    var n = pts.length; if (n < 3) return;
    poeEstilo('populacao', CSS_POP);
    el.classList.add(K());

    // ---- o que os dados dizem ----
    var iCenso = -1, m, i;
    pts.forEach(function (p, k) { if (iCenso < 0 && /primeiro censo/i.test(txt(p.ano_txt))) iCenso = k; });
    if (iCenso < 0) {
      m = /Antes de (\d{3,4}) não há contagem/.exec(txt(serie.resumo));
      if (m) pts.forEach(function (p, k) { if (iCenso < 0 && p.ano >= +m[1]) iCenso = k; });
    }
    if (iCenso < 0) iCenso = n; // sem censo nos dados: tudo é estimativa
    var temCenso = iCenso < n, ult = pts[n - 1];
    function vmin(p) { return typeof p.min === 'number' && p.min > 0 ? Math.min(p.min, p.valor) : p.valor; }
    function vmax(p) { return typeof p.max === 'number' && p.max > 0 ? Math.max(p.max, p.valor) : p.valor; }
    function ehEst(k) { return k < iCenso; }
    function valorCurto(k) { return (ehEst(k) ? 'c. ' : '') + U.compacto(pts[k].valor); }
    function quandoCurto(p) { var t = semParentese(p.ano_txt); if (!t || /\sde\s/.test(t)) t = U.ano(p.ano); return t; }

    var maior = Math.max.apply(null, pts.map(function (p) { return p.valor; }));
    var menor = Math.min.apply(null, pts.map(vmin));
    var linMax = maior * 1.1;
    var bruto = maior / 4.2, pot = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10)), fr = bruto / pot;
    var passoLin = (fr >= 5 ? 5 : fr >= 2.5 ? 2.5 : fr >= 2 ? 2 : 1) * pot;
    var logMin = Math.pow(10, Math.floor(Math.log(menor) / Math.LN10 + 1e-9)), logMax = maior * 1.9;
    var ticksLin = [], ticksLog = [], v;
    for (v = passoLin; v <= linMax; v += passoLin) ticksLin.push(v);
    for (v = logMin; v <= logMax * 1.0001; v *= 10) ticksLog.push(v);
    var t0 = pts[0].ano, t1 = Math.max(HOJE, ult.ano);
    // o eixo vertical fala numa unidade só (milhões), escrita uma vez no alto; nas linhas vão só os números
    var div = maior >= 2e6 ? 1e6 : maior >= 2e3 ? 1e3 : 1;
    var unidade = (div === 1e6 ? 'milhões de ' : div === 1e3 ? 'milhares de ' : '') + (txt(serie.unidade) || 'habitantes');
    function numEixo(val) { return U.dec(val / div, 2); }
    var calha = 10 + 6.3 * Math.max.apply(null, ticksLin.concat(ticksLog).map(function (val) { return numEixo(val).length; }));

    // pontos que ganham rótulo direto: o primeiro, o mais alto antes do censo, o de depois da peste, o primeiro censo e o último
    var iPico = 0, iVale = -1;
    for (i = 0; i < Math.min(iCenso, n); i++) if (pts[i].valor > pts[iPico].valor) iPico = i;
    pts.forEach(function (p, k) { if (iVale < 0 && k < iCenso && /depois da Peste/i.test(txt(p.ano_txt))) iVale = k; });
    var comRotulo = [n - 1]; // em ordem de prioridade
    [iCenso, 0, iPico, iVale].forEach(function (k) { if (k >= 0 && k < n && comRotulo.indexOf(k) < 0) comRotulo.push(k); });

    // acontecimentos que explicam as viradas (só os que estão nos dados)
    var eventos = [];
    (function () {
      var mm = null, f;
      pts.some(function (p) { mm = /Peste Antonina \((\d{2,4}) a (\d{2,4})\)/.exec(txt(p.ressalva)); return !!mm; });
      if (mm) eventos.push({ ano: +mm[1], titulo: 'Peste Antonina', quando: mm[1] + ' a ' + mm[2], obs: 'pela datação usual, não conferida na pesquisa; depois dela a população cai' });
      f = achaFato(dados, /Peste Negra/i, 'mamelucos') || achaFato(dados, /Peste Negra/i);
      if (f && typeof f.ano === 'number') eventos.push({ ano: f.ano, titulo: 'Peste Negra', quando: txt(f.ano_txt) || String(f.ano), obs: 'a população cai de novo' });
      if (temCenso) eventos.push({ ano: pts[iCenso].ano, titulo: 'Primeiro censo geral', quando: String(pts[iCenso].ano), obs: 'daqui em diante o número é contado; antes, só estimado' });
      f = achaFato(dados, /Represa Alta de Assuã/i, 'nilo') || achaFato(dados, /Represa Alta de Assuã/i);
      if (f) {
        mm = /(\d{4})\D*$/.exec(txt(f.ano_txt));
        eventos.push({ ano: mm ? +mm[1] : f.ano, titulo: 'Represa Alta de Assuã', quando: txt(f.ano_txt) || String(f.ano), obs: 'segura a cheia do Nilo e dá água o ano todo' });
      }
      eventos = eventos.filter(function (e) { return typeof e.ano === 'number' && e.ano >= t0 && e.ano <= t1; }).sort(function (a, b) { return a.ano - b.ano; });
    })();

    // ---- esqueleto ----
    var modo = 'comum', t = 0, alvoT = 0, quadro = 0, sel = -1, visto = false;
    function sw(d, w) { return s('svg', { width: w || 34, height: 12, viewBox: '0 0 ' + (w || 34) + ' 12', 'aria-hidden': 'true' }, d); }
    var leg = h('ul', { class: K('leg'), 'aria-label': 'Legenda' },
      h('li', null, sw([s('line', { x1: 1, y1: 6, x2: 33, y2: 6, class: K('est') }), s('circle', { cx: 17, cy: 6, r: 3.2, class: K('pe'), style: 'opacity:1' })]), 'estimativa'),
      h('li', null, sw(s('rect', { x: 1, y: 1, width: 24, height: 10, rx: 2, class: K('banda'), style: 'opacity:.3' }), 26), 'faixa entre a menor e a maior estimativa'),
      temCenso ? h('li', null, sw([s('line', { x1: 1, y1: 6, x2: 33, y2: 6, class: K('cen') }), s('circle', { cx: 17, cy: 6, r: 3.4, class: K('pc'), style: 'opacity:1' })]), 'censo ou contagem oficial') : null);
    var botoes = U.botoes([{ id: 'comum', rotulo: 'Escala comum' }, { id: 'log', rotulo: 'Escala de 10 em 10' }], modo, function (id) { mudaModo(id); }, 'Escala do gráfico');
    var palco = h('div', { class: K('palco') });
    var leitura = h('div', { class: K('leitura'), 'aria-live': 'polite' });
    var nota = h('p', { class: 'pc-nota' });
    el.appendChild(h('div', { class: K('topo') }, botoes, leg));
    el.appendChild(palco);
    el.appendChild(leitura);
    if (eventos.length) {
      el.appendChild(h('ol', { class: K('marcos'), 'aria-label': 'Acontecimentos marcados no eixo do tempo' }, eventos.map(function (e, k) {
        return h('li', null, h('i', { 'aria-hidden': 'true' }, String(k + 1)), h('div', null, h('b', null, e.titulo), ' · ' + e.quando, h('br'), h('span', null, e.obs)));
      })));
    }
    el.appendChild(nota);
    function poeNota() {
      nota.textContent = modo === 'log'
        ? 'O que ver: na escala de 10 em 10, cada linha do fundo vale dez vezes a de baixo. Assim aparecem a subida lenta até o Egito romano e as quedas que vêm com as pestes. A faixa clara mostra o quanto os autores divergem antes do primeiro censo.'
        : 'O que ver: na escala comum, quase cinco mil anos cabem numa linha rente ao chão. A subida depois do primeiro censo é uma parede. Troque para a escala de 10 em 10 para ver o que acontece antes dela.';
    }
    poeNota();

    // ---- desenho ----
    var W = 0, Hh = 0, x0, x1, y0, y1, X = [], atraso = [], svg, gLin, gLog, pBanda, pEst, pCen, pMasc, gLinhas, gPts, gRot, gEv, gMira, circs = [], quedas = [], idMasc = unico(K('m'));
    function tiraMascara() { if (pMasc && gLinhas) gLinhas.removeAttribute('mask'); pMasc = null; }
    function xDe(a) { return x0 + (a - t0) / (t1 - t0) * (x1 - x0); }
    function yLin(val) { return y1 - val / linMax * (y1 - y0); }
    function yLog(val) { return y1 - (Math.log(val) - Math.log(logMin)) / (Math.log(logMax) - Math.log(logMin)) * (y1 - y0); }
    function yDe(val) { var a = yLin(val), b = yLog(Math.max(val, logMin)); return a + (b - a) * t; }
    function yNaCurva(xp) { // altura da linha desenhada na posição xp (interpola entre os dois pontos vizinhos, na tela)
      var k; for (k = 1; k < n; k++) if (xp <= X[k]) break;
      k = Math.min(k, n - 1);
      var a = yDe(pts[k - 1].valor), b = yDe(pts[k].valor), f = X[k] === X[k - 1] ? 0 : limita((xp - X[k - 1]) / (X[k] - X[k - 1]), 0, 1);
      return a + (b - a) * f;
    }
    function caminho(a, b, f) {
      var d = '', k; for (k = a; k <= b; k++) d += (k === a ? 'M' : 'L') + X[k].toFixed(1) + ' ' + f(k).toFixed(1);
      return d;
    }
    function pinta() {
      var fimB = Math.min(iCenso, n - 1), k, d;
      d = caminho(0, fimB, function (k) { return yDe(vmax(pts[k])); });
      for (k = fimB; k >= 0; k--) d += 'L' + X[k].toFixed(1) + ' ' + yDe(vmin(pts[k])).toFixed(1);
      pBanda.setAttribute('d', d + 'Z');
      var yv = function (k) { return yDe(pts[k].valor); };
      pEst.setAttribute('d', caminho(0, fimB, yv));
      if (temCenso && iCenso < n - 1) pCen.setAttribute('d', caminho(iCenso, n - 1, yv)); else pCen.setAttribute('d', '');
      if (pMasc) pMasc.setAttribute('d', caminho(0, n - 1, yv));
      circs.forEach(function (c, k) { c.setAttribute('cy', yv(k).toFixed(1)); });
      quedas.forEach(function (q) { q.l.setAttribute('y1', yNaCurva(q.x).toFixed(1)); });
      gLin.style.opacity = (1 - t).toFixed(3); gLog.style.opacity = t.toFixed(3);
      if (sel >= 0) poeMira();
    }
    function grade(g, ticks, yf, base) {
      ticks.forEach(function (val, k) {
        var y = Math.round(yf(val)) + 0.5, naBase = base && k === 0;
        if (!naBase) g.appendChild(s('line', { class: K('gl'), x1: x0, x2: x1, y1: y, y2: y }));
        g.appendChild(s('text', { class: K('gt'), x: x0 - 7, y: y + 4, 'text-anchor': 'end' }, numEixo(val)));
      });
    }
    function desenha(larg) {
      cancelAnimationFrame(quadro); t = alvoT;
      W = larg; Hh = W < 420 ? 318 : W < 760 ? 356 : 446;
      x0 = Math.round(calha); x1 = W - 9; y0 = 48; y1 = Hh - (eventos.length ? 64 : 32);
      X = pts.map(function (p) { return xDe(p.ano); });
      var ini = pts[0], pico = pts[iPico];
      svg = s('svg', { class: K('svg'), width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', tabindex: 0,
        'aria-label': 'Gráfico de linha da população do Egito, de ' + txt(ini.ano_txt) + ' a ' + ult.ano + '. Começa em ' + txt(ini.valor_txt) +
          ', chega a ' + txt(pico.valor_txt) + ' em ' + quandoCurto(pico) + (temCenso ? ', tem ' + txt(pts[iCenso].valor_txt) + ' no primeiro censo, em ' + pts[iCenso].ano + ',' : '') +
          ' e ' + txt(ult.valor_txt) + ' em ' + ult.ano + '. Com o gráfico em foco, as setas para os lados andam de ponto em ponto.' });
      // máscara que "escreve" a linha ao entrar na tela
      pMasc = null;
      if (!U.reduz && !visto) {
        pMasc = s('path', { class: K('masc'), pathLength: 1 });
        svg.appendChild(s('defs', null, s('mask', { id: idMasc, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: Hh }, pMasc)));
      }
      gLin = s('g'); gLog = s('g');
      grade(gLin, ticksLin, yLin, false); grade(gLog, ticksLog, yLog, true);
      svg.appendChild(gLin); svg.appendChild(gLog);
      svg.appendChild(s('text', { class: K('gt'), x: 0, y: y0 - 13 }, unidade));
      svg.appendChild(s('line', { class: K('base'), x1: x0, x2: x1, y1: y1 + 0.5, y2: y1 + 0.5 }));
      // eixo do tempo (as hastes dos acontecimentos ficam por baixo dos rótulos dos anos)
      gEv = s('g'); svg.appendChild(gEv);
      var gE = s('g'); svg.appendChild(gE);
      anosRedondos(t0, t1, 1000).forEach(function (a) { var x = Math.round(xDe(a)) + 0.5; gE.appendChild(s('line', { class: K('base'), x1: x, x2: x, y1: y1, y2: y1 + 5 })); });
      pBanda = s('path', { class: K('banda') }); svg.appendChild(pBanda);
      // linhas finas que descem da curva até cada acontecimento
      quedas = []; var gQ = s('g'); svg.appendChild(gQ);
      eventos.forEach(function (e) { var x = xDe(e.ano), l = s('line', { class: K('queda'), x1: x, x2: x, y1: y1, y2: y1 }); gQ.appendChild(l); quedas.push({ x: x, l: l }); });
      atraso = [];
      pEst = s('path', { class: K('est') }); pCen = s('path', { class: K('cen') });
      gLinhas = s('g', pMasc ? { mask: 'url(#' + idMasc + ')' } : null, pEst, pCen); svg.appendChild(gLinhas);
      // pontos: vazados nas estimativas, cheios nos censos; aparecem quando a linha passa por eles
      gPts = s('g'); circs = []; svg.appendChild(gPts);
      var comp = [0], total = 0;
      for (i = 1; i < n; i++) { total += Math.sqrt(Math.pow(X[i] - X[i - 1], 2) + Math.pow(yDe(pts[i].valor) - yDe(pts[i - 1].valor), 2)); comp.push(total); }
      pts.forEach(function (p, k) {
        atraso[k] = visto ? 0 : 0.2 + 2.35 * (total ? comp[k] / total : 0); // o ponto aparece quando a linha chega nele
        var c = s('circle', { class: ehEst(k) ? K('pe') : K('pc'), cx: X[k].toFixed(1), cy: 0, r: W < 420 ? 3 : 3.6, style: '--d:' + atraso[k].toFixed(2) + 's' });
        circs.push(c); gPts.appendChild(c);
      });
      gRot = s('g'); svg.appendChild(gRot);
      gMira = s('g', { class: K('mira'), style: 'display:none' }); svg.appendChild(gMira);
      palco.textContent = ''; palco.appendChild(svg);
      quedas.forEach(function (q) { var k = 0; while (k < n - 1 && X[k] < q.x) k++; q.l.style.setProperty('--d', (atraso[k] || 0).toFixed(2) + 's'); });
      eixoTempo(U, gE, anosRedondos(t0, t1, 1000), xDe, y1 + 20, K('et'), 0, x1);
      // acontecimentos numerados, embaixo do eixo
      if (eventos.length) {
        var xs = separa(eventos.map(function (e) { return xDe(e.ano); }), 21, x0 + 10, x1 - 10), yc = y1 + 45;
        eventos.forEach(function (e, k) {
          var x = xDe(e.ano);
          gEv.appendChild(s('g', { class: K('ev') },
            s('line', { x1: x, y1: y1 + 1, x2: x, y2: y1 + 25 }), s('line', { x1: x, y1: y1 + 25, x2: xs[k], y2: yc - 10 }),
            s('circle', { cx: xs[k], cy: yc, r: 9.5 }), s('text', { x: xs[k], y: yc + 4 }, String(k + 1)),
            s('title', null, e.titulo + ', ' + e.quando)));
        });
      }
      pinta(); rotula();
      ligaToque();
      if (sel >= 0) poeMira();
    }

    // rótulos diretos: procura, para cada ponto, o lugar livre mais perto dele
    function rotula() {
      gRot.textContent = '';
      var postas = [], amostras = [], k, j, a, estreito = W < 480;
      // por onde passam a linha e a borda de cima da faixa (para o rótulo não cair em cima)
      function amostra(xa, ya, xb, yb) { var dist = Math.sqrt((xb - xa) * (xb - xa) + (yb - ya) * (yb - ya)), np = Math.max(1, Math.ceil(dist / 4)), z; for (z = 0; z <= np; z++) amostras.push([xa + (xb - xa) * z / np, ya + (yb - ya) * z / np]); }
      for (k = 1; k < n; k++) {
        amostra(X[k - 1], yDe(pts[k - 1].valor), X[k], yDe(pts[k].valor));
        if (k <= iCenso) {
          amostra(X[k - 1], yDe(vmax(pts[k - 1])), X[k], yDe(vmax(pts[k])));
          amostra(X[k - 1], yDe(vmin(pts[k - 1])), X[k], yDe(vmin(pts[k])));
        }
      }
      quedas.forEach(function (q) { amostra(q.x, yNaCurva(q.x), q.x, y1); }); // e as linhas que descem até os acontecimentos
      function livre(cx) {
        if (cx.x < x0 + 3 || cx.x + cx.w > x1 + 2 || cx.y < y0 - 6 || cx.y + cx.h > y1 - 3) return false;
        for (j = 0; j < postas.length; j++) if (caixasBatem(cx, postas[j], 5)) return false;
        for (j = 0; j < amostras.length; j++) { a = amostras[j]; if (a[0] > cx.x - 5 && a[0] < cx.x + cx.w + 5 && a[1] > cx.y - 5 && a[1] < cx.y + cx.h + 5) return false; }
        return true;
      }
      function fioLivre(fx, fy, px, py) { // o fio não pode atravessar um rótulo já posto
        var np = Math.max(2, Math.ceil(Math.sqrt((px - fx) * (px - fx) + (py - fy) * (py - fy)) / 3)), z, qx, qy, c;
        for (z = 0; z <= np; z++) {
          qx = fx + (px - fx) * z / np; qy = fy + (py - fy) * z / np;
          for (j = 0; j < postas.length; j++) { c = postas[j]; if (qx > c.x - 3 && qx < c.x + c.w + 3 && qy > c.y - 3 && qy < c.y + c.h + 3) return false; }
        }
        return true;
      }
      function poe(k, linhas) {
        var p = pts[k], px = X[k], py = yDe(p.valor);
        var g = s('g', { class: K('rot'), style: '--d:' + (visto ? 0 : (atraso[k] || 0) + 0.3).toFixed(2) + 's' }), ts = [], larg = 0, alt = 0, yy = 0;
        linhas.forEach(function (l, z) {
          var tx = s('text', { class: z ? K('rq') : K('rv') }, l); if (!z && estreito) tx.style.fontSize = '14px';
          g.appendChild(tx); ts.push(tx);
        });
        gRot.appendChild(g);
        ts.forEach(function (tx, z) { var wv; try { wv = tx.getComputedTextLength(); } catch (e) { wv = tx.textContent.length * 6.5; } larg = Math.max(larg, wv); yy += z ? 13.5 : (estreito ? 14 : 15); tx.setAttribute('y', yy); });
        alt = yy + 3;
        var cands = [], sobe = [9, 20, 32, 44, 58, 72, 88, 104, 122, 140, 160, 180, 200, 225, 250];
        var desl = [0, -(larg / 2 + 7), larg / 2 + 7, -larg * 0.32, larg * 0.32, -(larg / 2 + 28), larg / 2 + 28, -(larg / 2 + 54), larg / 2 + 54];
        cands.push({ x: px - 11 - larg, y: limita(py - alt / 2, y0 - 5, y1 - alt - 4), custo: 3, lado: 1 });
        cands.push({ x: px + 11, y: limita(py - alt / 2, y0 - 5, y1 - alt - 4), custo: 5, lado: -1 });
        sobe.forEach(function (sv) {
          desl.forEach(function (dx, z) {
            cands.push({ x: px - larg / 2 + dx, y: py - sv - alt, custo: sv + Math.abs(dx) * 0.14 + z * 0.4 });
            cands.push({ x: px - larg / 2 + dx, y: py + sv + 2, custo: sv + 7 + Math.abs(dx) * 0.14 + z * 0.4, baixo: true }); // embaixo da curva, quando há vão
          });
        });
        cands.sort(function (c1, c2) { return c1.custo - c2.custo; });
        var achou = null;
        cands.some(function (c) {
          var cx = { x: c.x, y: c.y, w: larg, h: alt };
          if (!livre(cx)) return false;
          if (!c.lado) {
            c.fx = limita(px, c.x + 5, c.x + larg - 5); c.fy = c.baixo ? c.y - 1 : c.y + alt + 1;
            if (!fioLivre(c.fx, c.fy, px, c.baixo ? py + 6 : py - 6)) return false;
          }
          achou = c; postas.push(cx); return true;
        });
        if (!achou) { g.remove(); return false; }
        // o texto encosta do lado do ponto
        var ancora = 'middle', tx0 = achou.x + larg / 2;
        if (achou.x + larg <= px + 8) { ancora = 'end'; tx0 = achou.x + larg; }
        else if (achou.x >= px - 8) { ancora = 'start'; tx0 = achou.x; }
        ts.forEach(function (tx) { tx.setAttribute('x', tx0.toFixed(1)); tx.setAttribute('text-anchor', ancora); tx.setAttribute('y', (achou.y + parseFloat(tx.getAttribute('y'))).toFixed(1)); });
        if (!achou.lado && Math.sqrt(Math.pow(py - achou.fy, 2) + Math.pow(px - achou.fx, 2)) > 11) g.insertBefore(s('line', { class: K('fio'), x1: achou.fx.toFixed(1), y1: achou.fy.toFixed(1), x2: px.toFixed(1), y2: (py + (achou.baixo ? 5.5 : -5.5)).toFixed(1) }), g.firstChild);
        return true;
      }
      comRotulo.forEach(function (k) {
        var p = pts[k], linhas = [valorCurto(k), quandoCurto(p)], par = parentese(p.ano_txt);
        if (par && !/^censo$/i.test(par) && W >= 700) linhas.push(par); // no celular o comentário fica para o painel
        // se não couber inteiro, tenta sem o comentário; depois, só o número (o ano está no eixo e na mira)
        if (!poe(k, linhas) && !(linhas.length > 2 && poe(k, linhas.slice(0, 2)))) poe(k, linhas.slice(0, 1));
      });
    }

    // ---- mira e painel ----
    function poeMira() {
      if (sel < 0 || !gMira) return;
      var p = pts[sel], x = X[sel], y = yDe(p.valor);
      gMira.textContent = ''; gMira.style.display = '';
      var rot = quandoCurto(p) + ' · ' + valorCurto(sel);
      var tx = s('text', { y: 17 }, rot), larg;
      gMira.appendChild(s('line', { x1: x, x2: x, y1: 26, y2: y1 }));
      gMira.appendChild(s('circle', { cx: x, cy: y, r: 6.5 }));
      gMira.appendChild(tx);
      try { larg = tx.getComputedTextLength(); } catch (e) { larg = rot.length * 6.4; }
      var cx = limita(x, larg / 2 + 9, W - larg / 2 - 9);
      tx.setAttribute('x', cx.toFixed(1));
      gMira.insertBefore(s('rect', { x: (cx - larg / 2 - 8).toFixed(1), y: 2.5, width: (larg + 16).toFixed(1), height: 21, rx: 10.5 }), tx);
    }
    function linha(rot, corpo) { return h('p', { class: K('lin') }, h('b', null, rot + ' '), corpo); }
    function painel() {
      leitura.textContent = '';
      var ant = h('button', { type: 'button', 'aria-label': 'Ponto anterior', onclick: function () { escolhe(sel <= 0 ? n - 1 : sel - 1); } }, '‹');
      var prox = h('button', { type: 'button', 'aria-label': 'Ponto seguinte', onclick: function () { escolhe(sel < 0 || sel >= n - 1 ? 0 : sel + 1); } }, '›');
      if (sel < 0) {
        leitura.appendChild(h('div', { class: K('cab') }, ant, h('div', { class: K('qd') }, temCenso ? 'De ' + pts[iCenso].ano + ' a ' + ult.ano : 'A série'), prox));
        if (temCenso) {
          leitura.appendChild(h('p', { class: K('val') }, U.int(Math.round(ult.valor / pts[iCenso].valor)) + ' vezes mais gente em ' + U.int(ult.ano - pts[iCenso].ano) + ' anos'));
          leitura.appendChild(h('p', { class: K('lin') }, 'De ' + txt(pts[iCenso].valor_txt) + ', no primeiro censo, a ' + txt(ult.valor_txt) + ', em ' + txt(ult.ano_txt) + '.'));
        }
        leitura.appendChild(h('p', { class: K('lin') }, 'Toque no gráfico, ou ande com as setas, para ver cada ponto: o ano, o número, a faixa das estimativas e quem estima.'));
        return;
      }
      var p = pts[sel], est = ehEst(sel);
      leitura.appendChild(h('div', { class: K('cab') }, ant, h('div', { class: K('qd') }, txt(p.ano_txt) || U.ano(p.ano)), prox));
      leitura.appendChild(h('p', { class: K('val') }, txt(p.valor_txt) || U.compacto(p.valor), h('small', null, est ? 'ESTIMATIVA' : 'CONTAGEM')));
      if (p.faixa) leitura.appendChild(linha(est ? 'Faixa das estimativas:' : 'Outros números:', txt(p.faixa)));
      if (p.fonte) leitura.appendChild(linha(est ? 'Quem estima:' : 'Fonte:', U.link(txt(p.fonte), p.url)));
      var sl = selo(U, p);
      if (sl) { leitura.appendChild(h('div', { class: K('pe2') }, sl.marca)); if (sl.nota) leitura.appendChild(sl.nota); }
    }
    function escolhe(k) {
      sel = limita(k, 0, n - 1); poeMira(); painel();
    }
    function maisPerto(px, py) {
      var melhor = 0, bd = 1e9, k, d;
      for (k = 0; k < n; k++) { d = Math.abs(X[k] - px); if (d < bd) { bd = d; melhor = k; } }
      // pontos colados na horizontal (os censos, numa tela estreita): desempata pela altura do dedo
      var perto = [], bx = X[melhor];
      for (k = 0; k < n; k++) if (Math.abs(X[k] - bx) <= 12) perto.push(k);
      if (perto.length > 1) { bd = 1e9; perto.forEach(function (k) { d = Math.abs(yDe(pts[k].valor) - py); if (d < bd) { bd = d; melhor = k; } }); }
      return melhor;
    }
    function ligaToque() {
      function pos(ev) { var r = svg.getBoundingClientRect(), f = r.width ? W / r.width : 1; return [(ev.clientX - r.left) * f, (ev.clientY - r.top) * f]; }
      function vai(ev) { var q = pos(ev), k = maisPerto(q[0], q[1]); if (k !== sel) escolhe(k); }
      svg.addEventListener('pointerdown', function (ev) { vai(ev); });
      svg.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse' || ev.buttons || ev.pressure > 0) vai(ev); });
      svg.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k === 'ArrowRight' || k === 'ArrowUp') { escolhe(sel < 0 ? 0 : Math.min(n - 1, sel + 1)); ev.preventDefault(); }
        else if (k === 'ArrowLeft' || k === 'ArrowDown') { escolhe(sel < 0 ? n - 1 : Math.max(0, sel - 1)); ev.preventDefault(); }
        else if (k === 'Home') { escolhe(0); ev.preventDefault(); }
        else if (k === 'End') { escolhe(n - 1); ev.preventDefault(); }
      });
    }

    // ---- troca de escala: os pontos escorregam de uma para a outra ----
    function mudaModo(id) {
      modo = id; alvoT = id === 'log' ? 1 : 0; poeNota();
      cancelAnimationFrame(quadro);
      tiraMascara();
      if (U.reduz || !svg) { t = alvoT; if (svg) { pinta(); rotula(); } return; }
      var de = t, ini = null, dur = 750;
      svg.classList.add(K('mudando'));
      function passo(agora) {
        if (ini == null) ini = agora;
        var f = Math.min(1, (agora - ini) / dur), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        t = de + (alvoT - de) * e; pinta();
        if (f < 1) quadro = requestAnimationFrame(passo);
        else { t = alvoT; pinta(); rotula(); svg.classList.remove(K('mudando')); }
      }
      quadro = requestAnimationFrame(passo);
    }

    painel();
    U.aoMedir(palco, desenha);
    aoChegarFontes(function () { if (W) desenha(W); });
    if (U.reduz) { visto = true; el.classList.add(K('vis')); }
    else U.aoVer(palco, function () { el.classList.add(K('vis')); setTimeout(function () { visto = true; tiraMascara(); }, 3100); });

    // ---- os números, para quem quer o dado ----
    el.appendChild(tabela(U, 'Ver os números (' + n + ' pontos, com fonte e grau de certeza)', ['Quando', 'Habitantes', 'Faixa ou outros números', 'Fonte', 'Conferência'],
      pts.map(function (p, k) {
        return [txt(p.ano_txt) || U.ano(p.ano), (txt(p.valor_txt) || U.compacto(p.valor)) + (ehEst(k) ? ' (estimativa)' : ''), txt(p.faixa), U.link(txt(p.fonte), p.url), certezaTxt(p.certeza)];
      })));
    var fim = h('p', { class: 'pc-fonte' }, 'Fonte do número de ' + ult.ano + ': ', U.link(txt(ult.fonte), ult.url), '. As fontes dos outros pontos estão na tabela.');
    el.appendChild(fim);
  });

  // =====================================================================================================
  // 2. DESCOBERTAS — "Como sabemos"
  // De onde vem cada número (lido em tempo de execução):
  //   cada descoberta ........ dados.series.descobertas.itens[] (ano, ano_txt, tipo, titulo, quem, texto, fonte, url, certeza, ressalva)
  //   o silêncio:
  //     começo (394) ......... dados.series.escritas.itens[], item "Hieróglifos", campo fim (a última inscrição com data)
  //     fim (1822) ........... item da série descobertas cujo título fala em "decifra" (Champollion)
  //     1.428 anos ........... a conta fim − começo
  //   "N de M desde 1822" e "laboratório, só de 2010 para cá" ... contas sobre os anos dos itens
  // Cores: só os três tipos com mais itens (escavação, texto, laboratório) têm cor própria; os tipos de um item só
  // ficam em cinza, com o nome escrito. Oito cores não passam nas checagens de distinção (daltonismo) quando
  // qualquer tipo pode ficar ao lado de qualquer outro; estas três passam em todos os pares, no escuro e no claro.
  // =====================================================================================================
  var CSS_DES =
    '&{--pc-t1:#d95926;--pc-t2:#3987e5;--pc-t3:#199e70}&-claro{--pc-t1:#eb6834;--pc-t2:#2a78d6;--pc-t3:#1baf7a}' +
    '&-filtros{display:flex;flex-wrap:wrap;gap:10px 8px;margin:0 0 20px}' +
    '&-chip{position:relative;display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 14px;border:1px solid var(--linha);border-radius:999px;background:var(--s1);font-size:13.5px;font-weight:600;color:var(--tinta2);cursor:pointer}' +
    '&-chip::after{content:"";position:absolute;left:0;right:0;top:-4px;height:46px}' +
    '&-chip:hover{border-color:var(--tinta2)}' +
    '&-chip[aria-pressed="true"]{background:var(--tinta);border-color:var(--tinta);color:var(--fundo)}' +
    '&-chip i{flex:none;width:10px;height:10px;border-radius:50%;background:var(--pc-c,transparent);border:1.5px solid var(--pc-c,currentColor)}' +
    '&-chip small{font-size:12px;font-weight:500;opacity:.85;font-variant-numeric:tabular-nums}' +
    '[data-c="1"]{--pc-c:var(--pc-t1)}[data-c="2"]{--pc-c:var(--pc-t2)}[data-c="3"]{--pc-c:var(--pc-t3)}' +
    '&-faixa{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
    '&-faixa:focus{outline:none}&-faixa:focus-visible{outline:2px solid var(--acento);outline-offset:4px;border-radius:6px}' +
    '&-eixo{stroke:var(--tinta2);stroke-width:1;opacity:.6;shape-rendering:crispEdges}' +
    '&-vazio{fill:var(--tinta);opacity:.05}&-borda{stroke:var(--tinta2);stroke-width:1;opacity:.5;shape-rendering:crispEdges}' +
    '&-vn{font:600 26px var(--serifa);fill:var(--acento);text-anchor:middle;letter-spacing:-.01em}' +
    '&-vt{font:500 11.5px var(--sem);fill:var(--tinta2);text-anchor:middle}' +
    '&-et{font:500 11px var(--sem);fill:var(--tinta2);font-variant-numeric:tabular-nums}&-et2{font:500 11px var(--sem);fill:var(--tinta2);opacity:.9}' +
    '&-pt{fill:var(--pc-c,var(--fundo));stroke:var(--fundo);stroke-width:1.5;opacity:0;transition:opacity .35s ease;transition-delay:var(--d,0s)}' +
    '&-pt[data-c="0"]{stroke:var(--tinta2);stroke-width:1.4}' +
    '&-vis &-pt{opacity:1}&-vis &-pt&-fora{opacity:.16;transition-delay:0s}' +
    '&-vg{opacity:0;transition:opacity .7s ease .3s}&-vis &-vg{opacity:1}' +
    '&-sel{fill:none;stroke:var(--tinta);stroke-width:1.6;pointer-events:none}' +
    '&-ler{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;min-height:44px;margin:6px 0 0;font-size:13.5px;line-height:1.4;color:var(--tinta2)}' +
    '&-ler b{color:var(--tinta);font-weight:600}' +
    '&-ir{position:relative;min-height:34px;padding:0 13px;border:1px solid var(--linha);border-radius:999px;background:var(--s1);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--tinta)}' +
    '&-ir::after{content:"";position:absolute;left:0;right:0;top:-5px;height:44px}&-ir:hover{border-color:var(--tinta2)}' +
    '&-lista{list-style:none;margin:26px 0 0;padding:0;position:relative;max-width:46em}' +
    '&-lista::before{content:"";position:absolute;left:5px;top:8px;bottom:8px;width:1px;background:var(--linha)}' +
    '&-item{position:relative;padding:0 0 28px 30px;scroll-margin-top:90px}&-item:focus{outline:none}' +
    '&-item::before{content:"";position:absolute;left:0;top:7px;width:11px;height:11px;border-radius:50%;box-sizing:border-box;background:var(--pc-c,var(--fundo));border:2px solid var(--pc-c,var(--tinta2));outline:3px solid var(--fundo)}' +
    '&-alvo{border-radius:10px;outline:2px solid var(--acento);outline-offset:8px}' +
    '&-q{display:flex;flex-wrap:wrap;gap:3px 14px;align-items:center;font-size:13px}' +
    '&-ano{font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums}' +
    '&-tipo{display:inline-flex;align-items:center;gap:6px;color:var(--tinta2);font-weight:600}' +
    '&-tipo i{width:8px;height:8px;border-radius:50%;box-sizing:border-box;background:var(--pc-c,transparent);border:1.5px solid var(--pc-c,var(--tinta2))}' +
    '&-tit{font-size:clamp(20px,2.3vw,24px);margin:4px 0 4px;text-wrap:balance}' +
    '&-quem{margin:0 0 8px;font-size:13.5px;line-height:1.4;color:var(--tinta2)}' +
    '&-txt{margin:0;max-width:40em}' +
    '&-pe{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin-top:9px;font-size:12.5px;color:var(--tinta2)}&-pe a{color:inherit}' +
    '&-sil{position:relative;display:grid;grid-template-columns:62px minmax(0,1fr);gap:0 12px;align-items:center;margin:0 0 30px}' +
    '&-sil svg{display:block;overflow:visible}' +
    '&-sr{stroke:var(--tinta2);stroke-width:1;shape-rendering:crispEdges}&-sf{stroke:var(--tinta2);stroke-width:1;stroke-dasharray:2 4}' +
    '&-st{font:500 11px var(--sem);fill:var(--tinta2);font-variant-numeric:tabular-nums}&-sb{font:700 11.5px var(--sem);fill:var(--tinta)}' +
    '&-sc{fill:var(--fundo);stroke:var(--tinta2);stroke-width:1.5}&-sx{fill:var(--fundo)}' +
    '&-sil b{display:block;font-family:var(--serifa);font-size:clamp(38px,7vw,60px);line-height:.95;font-weight:600;letter-spacing:-.025em;color:var(--acento)}' +
    '&-sil em{display:block;font-family:var(--serifa);font-size:clamp(18px,2.4vw,22px);line-height:1.25;margin-top:8px}' +
    '&-sil p{margin:10px 0 0;font-size:13.5px;line-height:1.45;color:var(--tinta2);max-width:30em}' +
    '&-mais{margin-top:2px;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--linha);background:var(--s1);font-weight:600;font-size:14.5px;cursor:pointer;color:var(--tinta)}' +
    '&-mais:hover{border-color:var(--acento)}' +
    '& .pc-nota{margin:14px 0 0}' +
    '@media (prefers-reduced-motion: reduce){&-pt{opacity:1;transition:none}&-pt&-fora{opacity:.16}&-vg{opacity:1;transition:none}}';

  E.peca('descobertas', function (el, dados, U, args) {
    var s = U.s, h = U.h, K = fabrica('descobertas');
    var serie = args && args.serie;
    if (!serie || !Array.isArray(serie.itens)) return;
    var itens = serie.itens.map(function (x, i) { return { x: x, i: i }; })
      .filter(function (o) { return o.x && typeof o.x.ano === 'number' && o.x.titulo; })
      .sort(function (a, b) { return b.x.ano - a.x.ano || b.i - a.i; }).map(function (o) { return o.x; });
    var n = itens.length; if (n < 2) return;
    poeEstilo('descobertas', CSS_DES);
    el.classList.add(K()); if (fundoClaro(el, U)) el.classList.add(K('claro'));

    // ---- o que os dados dizem ----
    var cron = itens.slice().reverse(); // do mais antigo para o mais novo (para o desenho)
    var t0 = cron[0].ano, t1 = Math.max(HOJE, itens[0].ano);
    var silencio = null;
    (function () {
      var fimH = null, dec = null;
      ((dados && dados.series && dados.series.escritas && dados.series.escritas.itens) || []).forEach(function (x) { if (fimH == null && /^Hieróglifos/i.test(txt(x.nome)) && typeof x.fim === 'number') fimH = x.fim; });
      cron.forEach(function (x) { if (!dec && /decifra/i.test(txt(x.titulo))) dec = x; });
      if (fimH != null && dec && dec.ano > fimH) silencio = { de: fimH, ate: dec.ano, anos: dec.ano - fimH, dec: dec };
    })();
    var cont = {}, tipos = [];
    itens.forEach(function (x) { var t = txt(x.tipo) || 'sem tipo'; if (!cont[t]) { cont[t] = 0; tipos.push(t); } cont[t]++; });
    tipos.sort(function (a, b) { return cont[b] - cont[a]; });
    var grandes = tipos.filter(function (t) { return cont[t] >= 2; }), raros = tipos.filter(function (t) { return cont[t] < 2; });
    if (raros.length === 1) { grandes.push(raros[0]); raros = []; }
    var COR = { 'escavação': 1, 'texto': 2, 'laboratório': 3 }; // a cor é do tipo, não da posição
    function corDe(t) { return COR[txt(t)] || 0; }
    function tipoDe(x) { return txt(x.tipo) || 'sem tipo'; }

    var filtro = 'todas', aberto = false, PRIMEIROS = 8, selPt = -1;
    function passa(x) { return filtro === 'todas' || (filtro === '*raros' ? raros.indexOf(tipoDe(x)) >= 0 : tipoDe(x) === filtro); }
    var ids = itens.map(function () { return unico(K('i')); });

    // ---- filtros ----
    var filtros = h('div', { class: K('filtros'), role: 'group', 'aria-label': 'Filtrar por tipo de prova' });
    function chip(id, rotulo, quantos, cor, dica) {
      var b = h('button', { type: 'button', class: K('chip'), 'aria-pressed': id === filtro ? 'true' : 'false', 'data-c': cor == null ? null : cor, title: dica || null,
        onclick: function () { filtro = id; Array.prototype.forEach.call(filtros.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); refaz(); } },
        cor == null ? null : h('i', { 'aria-hidden': 'true' }), rotulo, h('small', null, String(quantos)));
      filtros.appendChild(b);
    }
    chip('todas', 'todas', n, null);
    grandes.forEach(function (t) { chip(t, t, cont[t], corDe(t)); });
    if (raros.length) chip('*raros', 'outros tipos', raros.length, 0, raros.join(', '));
    el.appendChild(filtros);

    // ---- a régua do silêncio (proporcional) ----
    var palco = h('div'), ler = h('p', { class: K('ler'), 'aria-live': 'polite' });
    el.appendChild(palco); el.appendChild(ler);
    var W = 0, svg, pontos = [], gSel, tNum, contou = false;
    function poeLer() {
      ler.textContent = '';
      if (selPt < 0) { ler.appendChild(document.createTextNode('Cada ponto é uma descoberta. Toque num ponto para ver qual.')); return; }
      var x = cron[selPt];
      ler.appendChild(h('span', null, h('b', null, txt(x.ano_txt) || U.ano(x.ano)), ' · ' + txt(x.titulo) + ' · ' + tipoDe(x)));
      ler.appendChild(h('button', { type: 'button', class: K('ir'), onclick: function () { vaiPara(x); } }, 'ver na lista ↓'));
    }
    function marcaSel() {
      if (!gSel) return;
      gSel.textContent = '';
      if (selPt < 0 || !pontos[selPt]) return;
      gSel.appendChild(s('circle', { class: K('sel'), cx: pontos[selPt].x, cy: pontos[selPt].y, r: pontos[selPt].r + 3.2 }));
    }
    function escolhePt(k) { selPt = limita(k, 0, n - 1); marcaSel(); poeLer(); }
    function desenha(larg) {
      W = larg;
      var r = W < 480 ? 3.3 : 4, passo = 2 * r + 2.2, x0 = r + 3, x1 = W - r - 3;
      function xDe(a) { return x0 + (a - t0) / (t1 - t0) * (x1 - x0); }
      var pilhas = {}, maxp = 0;
      cron.forEach(function (x, k) { var b = Math.round((xDe(x.ano) - x0) / passo); (pilhas[b] = pilhas[b] || []).push(k); maxp = Math.max(maxp, pilhas[b].length); });
      var topo = 12, altP = Math.max(maxp * passo + 10, W < 480 ? 86 : 104), yb = topo + altP, largo = W >= 700, Hh = yb + (largo ? 44 : 28);
      var nAnt = silencio ? cron.filter(function (x) { return x.ano < silencio.de; }).length : 0, nDep = silencio ? cron.filter(function (x) { return x.ano >= silencio.ate; }).length : 0;
      svg = s('svg', { class: K('faixa'), width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', tabindex: 0,
        'aria-label': 'Linha do tempo de ' + U.ano(t0) + ' a ' + t1 + ', em escala, com ' + n + ' descobertas. ' +
          (silencio ? nAnt + ' antes de ' + silencio.de + '; depois, um vazio de ' + U.int(silencio.anos) + ' anos em que ninguém lia hieróglifos; e ' + nDep + ' de ' + silencio.ate + ' para cá. ' : '') +
          'Com a linha em foco, as setas para os lados andam de ponto em ponto.' });
      // o vazio: de 394 a 1822
      if (silencio) {
        var xa = Math.round(xDe(silencio.de)) + 0.5, xb = Math.round(xDe(silencio.ate)) + 0.5, cx = (xa + xb) / 2, cy = topo + altP / 2;
        var gV = s('g', { class: K('vg') });
        gV.appendChild(s('rect', { class: K('vazio'), x: xa, y: topo - 8, width: xb - xa, height: yb - topo + 8 }));
        gV.appendChild(s('line', { class: K('borda'), x1: xa, x2: xa, y1: topo - 8, y2: yb + 5 }));
        gV.appendChild(s('line', { class: K('borda'), x1: xb, x2: xb, y1: topo - 8, y2: yb + 5 }));
        tNum = s('text', { class: K('vn'), x: cx, y: cy + 2 }, U.int(silencio.anos) + ' anos');
        if (W >= 480) tNum.style.fontSize = W >= 900 ? '40px' : '32px';
        gV.appendChild(tNum);
        var frase = 'sem ninguém ler hieróglifos', tL = s('text', { class: K('vt'), x: cx, y: cy + (W >= 900 ? 26 : 21) }, frase);
        if (W >= 700) tL.style.fontSize = '13px';
        gV.appendChild(tL);
        svg.appendChild(gV);
      }
      svg.appendChild(s('line', { class: K('eixo'), x1: 0, x2: W, y1: yb + 0.5, y2: yb + 0.5 }));
      // os pontos, empilhados onde caem juntos
      pontos = [];
      var gP = s('g'); svg.appendChild(gP);
      Object.keys(pilhas).forEach(function (b) {
        pilhas[b].forEach(function (k, andar) {
          var x = cron[k], q = { x: +(x0 + b * passo).toFixed(1), y: +(yb - r - 2.5 - andar * passo).toFixed(1), r: r, k: k };
          q.c = s('circle', { class: K('pt') + (passa(x) ? '' : ' ' + K('fora')), 'data-c': corDe(x.tipo), cx: q.x, cy: q.y, r: r, style: '--d:' + (0.15 + k * 0.05).toFixed(2) + 's' });
          gP.appendChild(q.c); pontos[k] = q;
        });
      });
      gSel = s('g'); svg.appendChild(gSel);
      palco.textContent = ''; palco.appendChild(svg);
      // se a frase do vazio não couber numa linha, vai em duas
      if (silencio) {
        try {
          if (tL.getComputedTextLength() > xb - xa - 14) {
            tL.textContent = ''; tL.appendChild(s('tspan', { x: cx }, 'sem ninguém ler')); tL.appendChild(s('tspan', { x: cx, dy: 14 }, 'hieróglifos'));
            tNum.setAttribute('y', cy - 6); tL.setAttribute('y', cy + 13);
          }
        } catch (e) {}
      }
      // rótulos do eixo: o começo, as duas beiras do vazio e hoje (o que não couber, sai)
      var postos2 = [];
      function rotEixo(a, texto, forte) {
        var x = xDe(a), t = s('text', { class: K('et'), y: yb + 19, 'text-anchor': 'middle' }, texto), w;
        svg.appendChild(t);
        try { w = t.getComputedTextLength(); } catch (e) { w = texto.length * 6.2; }
        var e = limita(x - w / 2, 0, W - w), cxa = { x: e, y: 0, w: w, h: 1 };
        if (postos2.some(function (o) { return caixasBatem(cxa, o, 9); })) { t.remove(); return null; }
        t.setAttribute('x', (e + w / 2).toFixed(1)); postos2.push(cxa);
        svg.insertBefore(s('line', { class: K('eixo'), x1: Math.round(x) + 0.5, x2: Math.round(x) + 0.5, y1: yb, y2: yb + 5 }), gP);
        return { x: e, w: w };
      }
      if (silencio) {
        rotEixo(silencio.de, String(silencio.de)); rotEixo(silencio.ate, String(silencio.ate));
        if (largo) { // no computador cabe dizer o que é cada beira
          svg.appendChild(s('text', { class: K('et2'), x: xDe(silencio.de), y: yb + 34, 'text-anchor': 'middle' }, 'a última inscrição em hieróglifos'));
          svg.appendChild(s('text', { class: K('et2'), x: Math.min(W, xDe(silencio.ate) + 30), y: yb + 34, 'text-anchor': 'end' }, txt(silencio.dec.titulo)));
        }
      }
      rotEixo(t0, U.ano(t0)); rotEixo(t1, 'hoje');
      marcaSel(); ligaToque();
    }
    function ligaToque() {
      function perto(ev) {
        var rc = svg.getBoundingClientRect(), f = rc.width ? W / rc.width : 1, px = (ev.clientX - rc.left) * f, py = (ev.clientY - rc.top) * f, m = -1, bd = 44 * 44;
        pontos.forEach(function (q, k) { if (!q) return; var d = (q.x - px) * (q.x - px) + (q.y - py) * (q.y - py); if (d < bd) { bd = d; m = k; } });
        return m;
      }
      svg.addEventListener('pointerdown', function (ev) { var k = perto(ev); if (k >= 0) escolhePt(k); });
      svg.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'mouse' && !ev.buttons) return; var k = perto(ev); if (k >= 0 && k !== selPt) escolhePt(k); });
      svg.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k === 'ArrowRight' || k === 'ArrowUp') { escolhePt(selPt < 0 ? 0 : selPt + 1); ev.preventDefault(); }
        else if (k === 'ArrowLeft' || k === 'ArrowDown') { escolhePt(selPt < 0 ? n - 1 : selPt - 1); ev.preventDefault(); }
        else if (k === 'Home') { escolhePt(0); ev.preventDefault(); }
        else if (k === 'End') { escolhePt(n - 1); ev.preventDefault(); }
        else if (k === 'Enter' && selPt >= 0) { vaiPara(cron[selPt]); ev.preventDefault(); }
      });
    }
    function contaAnos() { // a conta dos anos sobe de zero até o total, uma vez
      if (contou || !silencio || !tNum) return; contou = true;
      var ini = null, dur = 1100, alvo = silencio.anos;
      function passo(agora) {
        if (ini == null) ini = agora;
        var f = Math.min(1, (agora - ini) / dur), e = 1 - Math.pow(1 - f, 3);
        if (tNum) tNum.textContent = U.int(Math.round(alvo * e)) + ' anos';
        if (f < 1) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }

    // ---- a lista, da mais recente para a mais antiga ----
    var lista = h('ol', { class: K('lista'), 'aria-label': 'Descobertas, da mais recente para a mais antiga' });
    var pe = h('div');
    el.appendChild(lista); el.appendChild(pe);
    function item(x, k) {
      var sl = selo(U, x);
      return h('li', { class: K('item'), id: ids[k], 'data-c': corDe(x.tipo), tabindex: -1 },
        h('div', { class: K('q') }, h('span', { class: K('ano') }, txt(x.ano_txt) || U.ano(x.ano)),
          h('span', { class: K('tipo') }, h('i', { 'aria-hidden': 'true' }), tipoDe(x))),
        h('h3', { class: K('tit') }, txt(x.titulo)),
        x.quem ? h('p', { class: K('quem') }, txt(x.quem)) : null,
        x.texto ? h('p', { class: K('txt') }, txt(x.texto)) : null,
        h('div', { class: K('pe') }, x.fonte ? h('span', null, 'Fonte: ', U.link(txt(x.fonte), x.url)) : null, sl ? sl.marca : null),
        sl ? sl.nota : null);
    }
    function blocoSilencio() { // o trecho vazio, em escala: cada risco é um século
      var esc = 0.16, alt = Math.round(silencio.anos * esc), xs = 5.5, g = s('svg', { width: 62, height: alt + 16, viewBox: '0 -8 62 ' + (alt + 16), 'aria-hidden': 'true' }), a, y, rot = {};
      g.appendChild(s('rect', { class: K('sx'), x: 0, y: -8, width: 12, height: alt + 16 }));
      g.appendChild(s('line', { class: K('sf'), x1: xs, x2: xs, y1: 0, y2: alt }));
      [1500, 1000].forEach(function (v) { if (v < silencio.ate - 120 && v > silencio.de + 120) rot[v] = 1; });
      for (a = Math.floor(silencio.ate / 100) * 100; a > silencio.de; a -= 100) {
        y = Math.round((silencio.ate - a) * esc) + 0.5;
        g.appendChild(s('line', { class: K('sr'), x1: xs - 4, x2: xs + (a % 500 ? 4 : 8), y1: y, y2: y }));
        if (rot[a]) g.appendChild(s('text', { class: K('st'), x: 20, y: y + 4 }, String(a)));
      }
      g.appendChild(s('circle', { class: K('sc'), cx: xs, cy: 0, r: 4 })); g.appendChild(s('circle', { class: K('sc'), cx: xs, cy: alt, r: 4 }));
      g.appendChild(s('text', { class: K('sb'), x: 20, y: 4 }, String(silencio.ate))); g.appendChild(s('text', { class: K('sb'), x: 20, y: alt + 4 }, String(silencio.de)));
      return h('li', { class: K('sil') }, g,
        h('div', null, h('b', null, U.int(silencio.anos) + ' anos'), h('em', null, 'sem ninguém ler hieróglifos'),
          h('p', null, 'De ' + silencio.de + ', ano da última inscrição com data, a ' + silencio.ate + ', quando a escrita foi decifrada. O trecho ao lado está em escala: cada risco é um século sem leitura.')));
    }
    function refaz() {
      var f = itens.filter(passa), corte = (aberto || f.length <= PRIMEIROS + 2) ? f.length : PRIMEIROS, k;
      lista.textContent = '';
      for (k = 0; k < corte; k++) {
        if (silencio && k > 0 && f[k - 1].ano > silencio.de && f[k].ano < silencio.de) lista.appendChild(blocoSilencio());
        lista.appendChild(item(f[k], itens.indexOf(f[k])));
      }
      pe.textContent = '';
      if (corte < f.length) {
        pe.appendChild(h('button', { type: 'button', class: K('mais'), onclick: function () { aberto = true; refaz(); var alvo = document.getElementById(ids[itens.indexOf(f[corte])]); if (alvo) alvo.focus({ preventScroll: true }); } },
          'Mostrar todas as ' + f.length));
      }
      pontos.forEach(function (q) { if (q) q.c.classList.toggle(K('fora'), !passa(cron[q.k])); });
    }
    function vaiPara(x) {
      if (!passa(x)) { filtro = 'todas'; Array.prototype.forEach.call(filtros.children, function (c, i) { c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); }); }
      aberto = true; refaz();
      var alvo = document.getElementById(ids[itens.indexOf(x)]); if (!alvo) return;
      alvo.classList.add(K('alvo')); setTimeout(function () { alvo.classList.remove(K('alvo')); }, 2600);
      try { alvo.scrollIntoView({ block: 'center', behavior: U.reduz ? 'auto' : 'smooth' }); } catch (e) { alvo.scrollIntoView(); }
      alvo.focus({ preventScroll: true });
    }

    poeLer(); refaz();
    U.aoMedir(palco, desenha);
    aoChegarFontes(function () { if (W) desenha(W); });
    if (U.reduz) { contou = true; el.classList.add(K('vis')); }
    else U.aoVer(palco, function () { el.classList.add(K('vis')); contaAnos(); });

    // ---- o que ver ----
    var frases = ['O que ver: cada ponto é uma descoberta, uma leitura ou um exame.'];
    if (silencio) {
      var antes = itens.filter(function (x) { return x.ano < silencio.de; }).length, depois = itens.filter(function (x) { return x.ano >= silencio.ate; }).length;
      frases.push('Há ' + antes + (antes === 1 ? ' ponto' : ' pontos') + ' antes de ' + silencio.de + ', um vazio de ' + U.int(silencio.anos) + ' anos, e ' + depois + ' dos ' + n + ' vêm de ' + silencio.ate + ' para cá.');
    }
    if (cont['laboratório']) {
      var prim = Math.min.apply(null, itens.filter(function (x) { return tipoDe(x) === 'laboratório'; }).map(function (x) { return x.ano; }));
      frases.push('Os de laboratório são todos de ' + prim + ' em diante.');
    }
    el.insertBefore(h('p', { class: 'pc-nota' }, frases.join(' ')), lista);
  });
})();
