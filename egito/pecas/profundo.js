// Peças do tempo profundo e da pré-história do estudo "Egito, de hoje para trás".
//   saara ......... "Quando o Saara era verde": mapa com régua de tempo (camada saara-verde)
//   baleias ....... "Baleias no deserto": o mar de Tétis sobre o norte do Egito, régua de comprimento e coluna do tempo (antes-dos-humanos)
//   pedra-de-mar .. "A pirâmide é feita de mar": pirâmide, bloco e fóssil, com zoom (antes-dos-humanos ou imperio-antigo)
// Cada peça lê os números em dados.json na hora de desenhar; a tabela "de onde vem cada número" fica no começo de cada uma.
// O que não está nos dados e mesmo assim aparece é desenho de situação, e a própria peça avisa: a linha da costa, o avanço
// do verde, a posição dos lagos e dos pontos de gente e de gado, a pessoa que serve de escala.
// Todas usam EGITO.geo (publicado por mapa.js) e só as variáveis de cor da era; as cores "do mundo" (água, areia, verde,
// pedra) são misturadas com essas variáveis para funcionar em era clara e em era escura.
(function () {
  'use strict';
  var E = window.EGITO; if (!E) return;
  var UID = 0;
  var s = E.util && E.util.s; // fábrica de elementos SVG (cada peça confirma com U.s ao começar)

  // ---------- comum ----------
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }
  function lim(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function suave(t) { t = lim(t, 0, 1); return t * t * (3 - 2 * t); }
  function txt(v) { return v == null ? '' : String(v); }
  function maiuscula(t) { t = txt(t); return t.charAt(0).toUpperCase() + t.slice(1); }
  /** primeiro item da lista cujo campo casa com a expressão */
  function acha(lista, re, campo) {
    lista = lista || [];
    for (var i = 0; i < lista.length; i++) if (lista[i] && re.test(txt(lista[i][campo || 'titulo']))) return lista[i];
    return null;
  }
  /** o grau de conferência de um fato, nas palavras da página ('' quando a fonte confirma tudo) */
  function seloDe(f) { return f && f.certeza === 'baixa' ? 'de memória, sem fonte conferida' : f && f.certeza === 'media' ? 'conferido em parte' : ''; }
  function enumera(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
  function camadaDe(dados, id) { return acha(dados && dados.camadas, new RegExp('^' + id + '$'), 'id'); }
  /** a camada da peça: a que a página passou, se for a certa; senão, a que tem esse id nos dados */
  function camadaCerta(dados, args, id) { var c = args && args.camada; return c && c.id === id ? c : camadaDe(dados, id); }
  /** números de um texto em português: "41,3 a 37,2" -> [41.3, 37.2]; "14.800" -> [14800] */
  function numeros(t) {
    return (txt(t).match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(/\./g, '').replace(',', '.')); });
  }
  /** "de cerca de 50 a 40 milhões de anos atrás" -> { de: 50, a: 40, cerca: true }; sem texto que sirva, usa o campo ano */
  function milhoes(f) {
    if (!f) return null;
    var t = txt(f.ano_txt), m = /(\d+(?:,\d+)?)(?:\s*(?:a|e)\s*(\d+(?:,\d+)?))?\s*milh/.exec(t), a, b;
    if (m) { a = parseFloat(m[1].replace(',', '.')); b = m[2] ? parseFloat(m[2].replace(',', '.')) : a; }
    else if (typeof f.ano === 'number' && f.ano <= -1e6) { a = b = -f.ano / 1e6; }
    else return null;
    return { de: Math.max(a, b), a: Math.min(a, b), cerca: /cerca de|\bc\./.test(t) || !m };
  }
  function poeEstilo(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);
  }
  /** curva que passa pelos pontos (Catmull-Rom -> Bézier). fecha: contorno fechado */
  function curva(p, fecha) {
    var n = p.length, d = 'M' + f1(p[0][0]) + ' ' + f1(p[0][1]), i, a, b, c, e;
    for (i = 0; i < (fecha ? n : n - 1); i++) {
      a = p[fecha ? (i - 1 + n) % n : Math.max(i - 1, 0)]; b = p[i % n]; c = p[(i + 1) % n]; e = p[fecha ? (i + 2) % n : Math.min(i + 2, n - 1)];
      d += 'C' + f1(b[0] + (c[0] - a[0]) / 6) + ' ' + f1(b[1] + (c[1] - a[1]) / 6) + ' ' + f1(c[0] - (e[0] - b[0]) / 6) + ' ' + f1(c[1] - (e[1] - b[1]) / 6) + ' ' + f1(c[0]) + ' ' + f1(c[1]);
    }
    return d + (fecha ? 'Z' : '');
  }
  /** perfil: tabela [[u, valor], ...] -> função contínua (Hermite) */
  function perfil(t) {
    return function (u) {
      var i = 0, n = t.length;
      if (u <= t[0][0]) return t[0][1];
      if (u >= t[n - 1][0]) return t[n - 1][1];
      while (t[i + 1][0] < u) i++;
      var a = t[i], b = t[i + 1], h = b[0] - a[0], x = (u - a[0]) / h;
      var pa = t[Math.max(i - 1, 0)], pb = t[Math.min(i + 2, n - 1)];
      var ma = (b[1] - pa[1]) / (b[0] - pa[0]) * h, mb = (pb[1] - a[1]) / (pb[0] - a[0]) * h;
      var x2 = x * x, x3 = x2 * x;
      return (2 * x3 - 3 * x2 + 1) * a[1] + (x3 - 2 * x2 + x) * ma + (-2 * x3 + 3 * x2) * b[1] + (x3 - x2) * mb;
    };
  }
  /** cabeçalho comum das peças: linha de cima, título e chamada */
  function topo(U, pre, rot, titulo, intro) {
    return U.h('header', { class: pre + '-topo' },
      rot ? U.h('p', { class: pre + '-rot' }, rot) : null,
      U.h('h3', { class: pre + '-tit' }, titulo),
      intro ? U.h('p', { class: pre + '-intro' }, intro) : null);
  }
  function cssTopo(p) {
    return '.' + p + '-rot{font:700 12px var(--sem);letter-spacing:.2em;text-transform:uppercase;color:var(--tinta2);margin:0 0 10px}' +
      '.' + p + '-tit{font-size:clamp(26px,3.6vw,38px);letter-spacing:-.015em;margin:0;text-wrap:balance}' +
      '.' + p + '-intro{max-width:36em;margin:12px 0 0;color:var(--tinta2);font-size:clamp(16px,1.8vw,18px);line-height:1.5}' +
      '.' + p + '-topo{margin:0 0 22px}' +
      '.' + p + '-sub{font:700 12px var(--sem);letter-spacing:.16em;text-transform:uppercase;color:var(--tinta2);margin:0 0 12px}' +
      '.' + p + ' svg{display:block;max-width:100%}' +
      '.' + p + ' .pc-nota{margin:14px 0 0}' +
      '.' + p + '-rolo{overflow-x:auto}' +
      '.' + p + '-rolo small{display:block;font-size:12px;line-height:1.4;color:var(--tinta2);margin-top:2px}';
  }
  /** a tabela de U.tabela, com proteção: se um dia não couber na tela, rola dentro da própria caixa, e não a página */
  function tabelaSegura(U, pre, titulo, colunas, linhas) {
    var t = U.tabela(titulo, colunas, linhas), tb = t.querySelector('table');
    if (tb) t.appendChild(U.h('div', { class: pre + '-rolo' }, tb));
    return t;
  }

  // ---------- bichos: silhuetas simples, de lado, olhando para a direita ----------
  var Bi = {};
  function cssBichos(p) {
    return '.' + p + '-bicho{fill:var(--tinta)}' +
      '.' + p + '-bm{fill:none;stroke:var(--tinta);stroke-linecap:round;stroke-linejoin:round}' +
      '.' + p + '-bv{fill:var(--fundo)}' +
      '.' + p + '-bvl{fill:none;stroke:var(--fundo);stroke-linecap:round}';
  }

  /** baleia de lado, com L px de comprimento. tipo: 'basilo' (corpo de enguia) ou 'doru' (menor, mais cheio).
      O focinho fica em x = L, a ponta da cauda em x = 0, o meio do corpo em y = 0. g.perna = onde fica a perna traseira. */
  Bi.baleia = function (pre, L, tipo) {
    var B = tipo === 'basilo';
    var cima = perfil(B
      ? [[0, .003], [.02, .010], [.06, .019], [.10, .023], [.14, .026], [.22, .034], [.32, .038], [.45, .036], [.60, .030], [.75, .021], [.88, .012], [.955, .006]]
      : [[0, .006], [.03, .020], [.08, .034], [.14, .052], [.20, .068], [.30, .086], [.40, .090], [.55, .074], [.70, .048], [.82, .026], [.90, .013]]);
    var baixo = perfil(B
      ? [[0, .003], [.02, .009], [.06, .016], [.10, .022], [.14, .028], [.22, .040], [.32, .046], [.45, .042], [.60, .033], [.75, .022], [.88, .012], [.955, .006]]
      : [[0, .006], [.03, .016], [.08, .030], [.14, .050], [.20, .072], [.30, .096], [.40, .100], [.55, .080], [.70, .050], [.82, .026], [.90, .013]]);
    var fim = B ? .955 : .90, amp = B ? .013 : .010;
    function esp(u) { // espinha: leve ondulação, mais forte para a cauda
      var e = suave((u - .08) / .5);
      return [L * (1 - u), L * amp * e * Math.sin(Math.PI * 2 * (u * (B ? 1.25 : .8)) + (B ? 2.2 : 2.6))];
    }
    function normal(u) { var a = esp(Math.max(0, u - .01)), b = esp(Math.min(1, u + .01)), dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [dy / m, -dx / m]; }
    var n = B ? 34 : 22, A = [], Z = [], i, u, p, nn;
    for (i = 0; i <= n; i++) {
      u = fim * i / n; p = esp(u); nn = normal(u);
      A.push([p[0] + nn[0] * L * cima(u), p[1] + nn[1] * L * cima(u)]);
      Z.push([p[0] - nn[0] * L * baixo(u), p[1] - nn[1] * L * baixo(u)]);
    }
    var g = s('g', { class: pre + '-bicho' });
    g.appendChild(s('path', { d: curva(A.concat(Z.reverse()), true) }));
    // cauda: uma lâmina deitada, vista de lado
    var c0 = esp(fim), c1 = esp(1), t = L * (B ? .0105 : .020), e0 = L * (B ? .006 : .013);
    g.appendChild(s('path', { d: 'M' + f1(c0[0] + L * .02) + ' ' + f1(c0[1] - e0) +
      'C' + f1(mix(c0[0], c1[0], .4)) + ' ' + f1(c0[1] - t * 1.9) + ' ' + f1(mix(c0[0], c1[0], .8)) + ' ' + f1(c1[1] - t * 1.7) + ' ' + f1(c1[0]) + ' ' + f1(c1[1] - t * .5) +
      'C' + f1(mix(c0[0], c1[0], .7)) + ' ' + f1(c1[1] + t * .6) + ' ' + f1(mix(c0[0], c1[0], .35)) + ' ' + f1(c0[1] + t * 1.3) + ' ' + f1(c0[0] + L * .02) + ' ' + f1(c0[1] + e0) + 'Z' }));
    // nadadeira da frente
    var un = B ? .185 : .27, pn = esp(un), cn = L * (B ? .052 : .115), yb = pn[1] + L * baixo(un) * .55;
    g.appendChild(s('path', { d: 'M' + f1(pn[0] + cn * .32) + ' ' + f1(yb) +
      'C' + f1(pn[0] + cn * .12) + ' ' + f1(yb + cn * .55) + ' ' + f1(pn[0] - cn * .45) + ' ' + f1(yb + cn * .98) + ' ' + f1(pn[0] - cn * .78) + ' ' + f1(yb + cn * .92) +
      'C' + f1(pn[0] - cn * .86) + ' ' + f1(yb + cn * .6) + ' ' + f1(pn[0] - cn * .5) + ' ' + f1(yb + cn * .2) + ' ' + f1(pn[0] - cn * .3) + ' ' + f1(yb - cn * .05) + 'Z' }));
    // perna traseira: mínima
    var up = B ? .70 : .66, pp = esp(up), cp = L * (B ? .020 : .034), yp = pp[1] + L * baixo(up) * .8, lw = Math.max(1.5, L * (B ? .0052 : .011));
    g.appendChild(s('path', { class: pre + '-bm', d: 'M' + f1(pp[0]) + ' ' + f1(yp) + 'L' + f1(pp[0] - cp * .5) + ' ' + f1(yp + cp * .85) + 'L' + f1(pp[0] - cp * .95) + ' ' + f1(yp + cp * .95), 'stroke-width': f1(lw) }));
    g.perna = [pp[0] - cp * .4, yp + cp * .5];
    // olho e boca (vazados)
    var po = esp(B ? .068 : .12), pb = esp(0), pm = esp(B ? .062 : .105);
    g.appendChild(s('circle', { class: pre + '-bv', cx: f1(po[0]), cy: f1(po[1] - L * (B ? .006 : .012)), r: f1(Math.max(.9, L * (B ? .0026 : .006))) }));
    g.appendChild(s('path', { class: pre + '-bvl', d: 'M' + f1(pb[0] - L * .004) + ' ' + f1(pb[1] + L * .001) + 'L' + f1(pm[0]) + ' ' + f1(pm[1] + L * (B ? .007 : .014)), 'stroke-width': f1(Math.max(.8, L * .0022)) }));
    return g;
  };

  /** pessoa em pé, com H px de altura; pés em y = 0, centro em x = 0 */
  Bi.pessoa = function (pre, H) {
    var g = s('g', { class: pre + '-bicho' });
    g.appendChild(s('circle', { cx: 0, cy: f1(-H * .922), r: f1(H * .078) }));
    g.appendChild(s('rect', { x: f1(-H * .105), y: f1(-H * .82), width: f1(H * .21), height: f1(H * .38), rx: f1(H * .05) }));
    [-1, 1].forEach(function (k) {
      g.appendChild(s('path', { class: pre + '-bm', d: 'M' + f1(k * H * .055) + ' ' + f1(-H * .5) + 'L' + f1(k * H * .062) + ' ' + f1(-H * .04), 'stroke-width': f1(H * .082) }));
      g.appendChild(s('path', { class: pre + '-bm', d: 'M' + f1(k * H * .152) + ' ' + f1(-H * .78) + 'L' + f1(k * H * .172) + ' ' + f1(-H * .475), 'stroke-width': f1(H * .058) }));
    });
    return g;
  };
  /** espinossauro: caixa de 110 x 56, chão em y = 54 */
  Bi.espino = function (pre, k) {
    var g = s('g', { class: pre + '-bicho', transform: 'scale(' + k + ')' });
    g.appendChild(s('path', { d: 'M2 30C16 28.5 30 26 40 23C42 9 52 2.5 60 2.5C68 2.5 74 10 77 22C81 20.5 85 16.5 89 15.5L106 18L108.5 19.6L107 21.4L93 23C89 23.5 88 26 86 28.5C83 33 80 37 75 39.5C66 43 54 42.5 45 39C32 35.5 15 33 2 31.2Z' }));
    g.appendChild(s('path', { class: pre + '-bm', d: 'M51 38L55 46L53 51L58 53.5', 'stroke-width': 4.4 }));
    g.appendChild(s('path', { class: pre + '-bm', d: 'M45 38L47.5 45.5L45 51L50 53.5', 'stroke-width': 4 }));
    g.appendChild(s('path', { class: pre + '-bm', d: 'M75 36L79 41L82.5 41.5', 'stroke-width': 2.2 }));
    g.appendChild(s('circle', { class: pre + '-bv', cx: 93.5, cy: 18.4, r: .9 }));
    return g;
  };
  /** saurópode (Paralititan): caixa de 130 x 64, chão em y = 62 */
  Bi.sauro = function (pre, k) {
    var g = s('g', { class: pre + '-bicho', transform: 'scale(' + k + ')' });
    g.appendChild(s('path', { d: 'M2 41C20 35 36 28 48 23.5C56 20 66 19.5 76 23C86 21.5 100 13.5 112 6C115 4 121 3.5 124 6C125 8 122 10.2 118 10.2C108 14.5 99 25 91 32C89 38 85 43 78 45C70 48 56 48 48 43.5C36 37.5 20 41 2 42.6Z' }));
    [[80, 40, 81, 59, 6.5], [72, 42, 71, 59, 6], [55, 40, 57, 59, 6.5], [48, 39, 46, 59, 6]].forEach(function (p) {
      g.appendChild(s('path', { class: pre + '-bm', d: 'M' + p[0] + ' ' + p[1] + 'L' + p[2] + ' ' + p[3], 'stroke-width': p[4] }));
    });
    return g;
  };
  /** macaco (Aegyptopithecus): caixa de 64 x 44, galho em y = 40 */
  Bi.macaco = function (pre, k) {
    var g = s('g', { class: pre + '-bicho', transform: 'scale(' + k + ')' });
    g.appendChild(s('path', { d: 'M16 22C16 13 30 10 42 13C48 14.5 49 22 44 25C36 28 22 29 16 22Z' }));
    g.appendChild(s('circle', { cx: 50, cy: 12.5, r: 5.6 }));
    g.appendChild(s('ellipse', { cx: 55.2, cy: 14.4, rx: 3.1, ry: 2.3 }));
    g.appendChild(s('circle', { cx: 46.8, cy: 9, r: 1.8 }));
    [['M43 22L46 31L44.5 39', 3.2], ['M39 23L37.5 31L39.5 39', 3], ['M20 23L16 31L20 39', 3.2], ['M24 24L25.5 31L24 39', 3]].forEach(function (p) {
      g.appendChild(s('path', { class: pre + '-bm', d: p[0], 'stroke-width': p[1] }));
    });
    g.appendChild(s('path', { class: pre + '-bm', d: 'M16.5 20C8 18 3 12 6 5C7.5 1.5 12 2 12.5 5.5', 'stroke-width': 2.4 }));
    g.appendChild(s('circle', { class: pre + '-bv', cx: 52, cy: 11.6, r: .8 }));
    return g;
  };
  /** numulito: disco com a espiral. r = raio, centro em (0, 0) */
  Bi.disco = function (pre, r) {
    var g = s('g', { class: pre + '-bicho' }), d = '', i, a, rr;
    g.appendChild(s('circle', { cx: 0, cy: 0, r: f1(r) }));
    for (i = 0; i <= 60; i++) { a = i / 60 * Math.PI * 2 * 2.6; rr = r * (.12 + .74 * i / 60); d += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr); }
    g.appendChild(s('path', { class: pre + '-bvl', d: d, 'stroke-width': f1(Math.max(.8, r * .11)) }));
    return g;
  };

  // ---------- baleia vista de cima, que segue um laço ----------
  /** laço fechado: devolve { T: comprimento, em(d): [x, y] na distância d ao longo do laço } */
  function laco(cx, cy, rx, ry, giro, torto) {
    var N = 160, P = [], C = [0], i, a, x, y, c = Math.cos(giro), sn = Math.sin(giro);
    for (i = 0; i <= N; i++) {
      a = i / N * Math.PI * 2;
      x = rx * Math.cos(a) + torto * rx * Math.cos(2 * a + .6); y = ry * Math.sin(a) + torto * ry * Math.sin(3 * a);
      P.push([cx + x * c - y * sn, cy + x * sn + y * c]);
      if (i) C.push(C[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    }
    var T = C[N];
    return { T: T, em: function (d) {
      d = ((d % T) + T) % T;
      var lo = 0, hi = N, m; while (hi - lo > 1) { m = (lo + hi) >> 1; if (C[m] <= d) lo = m; else hi = m; }
      var f = (d - C[lo]) / ((C[hi] - C[lo]) || 1);
      return [mix(P[lo][0], P[hi][0], f), mix(P[lo][1], P[hi][1], f)];
    } };
  }
  /** devolve a função que desenha (o atributo d) uma baleia de comprimento L e meia largura w, com a cabeça na distância d0 do laço */
  function nadador(L, w, basilo) {
    var per = perfil(basilo
      ? [[0, .10], [.025, .26], [.06, .44], [.095, .50], [.125, .46], [.18, .82], [.26, 1], [.42, .95], [.60, .72], [.80, .42], [.92, .22], [1, .13]]
      : [[0, .12], [.05, .36], [.11, .60], [.16, .58], [.30, 1], [.46, .95], [.70, .56], [.90, .24], [1, .15]]);
    var n = basilo ? 26 : 14, uN = basilo ? .165 : .25, uP = basilo ? .72 : .68, cN = w * (basilo ? 1.4 : 1.55), cP = w * (basilo ? .9 : .7), env = w * (basilo ? 1.7 : 1.9);
    return function (lc, d0, sent) {
      function pt(u) {
        var p = lc.em(d0 - sent * u * L), q = lc.em(d0 - sent * (u * L - 1.5)), tx = q[0] - p[0], ty = q[1] - p[1], m = Math.hypot(tx, ty) || 1;
        return [p[0], p[1], tx / m, ty / m];
      }
      function P(q, a, b) { return [q[0] + q[2] * a - q[3] * b, q[1] + q[3] * a + q[2] * b]; } // a: para a frente; b: para o lado
      var A = [], Z = [], i, u, p, hw, d, k;
      for (i = 0; i <= n; i++) { u = i / n; p = pt(u); hw = w * per(u); A.push(P(p, 0, hw)); Z.push(P(p, 0, -hw)); }
      d = curva(A.concat(Z.reverse()), true);
      // nadadeiras da frente (remos) e pernas de trás (mínimas), dos dois lados
      var qn = pt(uN), hn = w * per(uN) * .85, qp = pt(uP), hp = w * per(uP) * .9, qc = pt(1);
      for (k = -1; k <= 1; k += 2) {
        d += curva([P(qn, cN * .34, k * hn), P(qn, cN * .16, k * (hn + cN * .55)), P(qn, -cN * .42, k * (hn + cN * .98)), P(qn, -cN * .72, k * (hn + cN * .62)), P(qn, -cN * .36, k * hn)], true);
        p = [P(qp, cP * .3, k * hp), P(qp, -cP * .8, k * (hp + cP)), P(qp, -cP * .3, k * hp)];
        d += 'M' + f1(p[0][0]) + ' ' + f1(p[0][1]) + 'L' + f1(p[1][0]) + ' ' + f1(p[1][1]) + 'L' + f1(p[2][0]) + ' ' + f1(p[2][1]) + 'Z';
      }
      // cauda: dois lobos arredondados, com o entalhe no meio
      hw = w * per(1);
      d += curva([P(qc, env * .34, hw), P(qc, -env * .06, env * .56), P(qc, -env * .5, env), P(qc, -env * .56, env * .52), P(qc, -env * .3, 0),
        P(qc, -env * .56, -env * .52), P(qc, -env * .5, -env), P(qc, -env * .06, -env * .56), P(qc, env * .34, -hw)], true);
      return d;
    };
  }

  // =====================================================================================================
  // BALEIAS: "Baleias no deserto" (camada antes-dos-humanos)
  // De onde vem cada número (tudo lido de dados.json na hora de desenhar):
  //   40 a 37 milhões de anos ........ fato "As baleias com pernas de Wadi al-Hitan" (ano_txt)
  //   Basilosaurus, mais de 15 m ..... número "Comprimento do Basilosaurus isis adulto"
  //   Dorudon, cerca de 5 m .......... ressalva do mesmo fato ("vem de memória"): entra com esse aviso
  //   pino de Wadi al-Hitan .......... onde "Wadi al-Hitan (Vale das Baleias)" (lat, lon)
  //   coluna do tempo ................ ano_txt dos fatos "O mar de Tétis cobria o Egito", "Spinosaurus…", "Paralititan…", "Mansourasaurus…",
  //                                    "A pedra das pirâmides é fundo de mar", "As baleias com pernas…" e "Aegyptopithecus…";
  //                                    a régua vai até o começo da camada (inicio); "gente" usa o começo da camada paleolitico
  //   A pessoa da régua de comprimento é só referência visual (não há medida de pessoa nos dados).
  //   A linha da costa é um desenho de situação: os dados dizem só que o mar cobria o norte e que o Fayum era uma baía rasa.
  // =====================================================================================================
  var COSTA = [[23.6, 28.5], [24.6, 28.6], [25.8, 28.78], [27.1, 28.62], [28.3, 28.86], [29.3, 28.62], [30.15, 28.44], [30.95, 28.6], [31.7, 29.05],
    [32.4, 29.48], [33.3, 29.76], [34.4, 30.28], [35.6, 30.52], [36.9, 30.95], [37.9, 31.3]];
  function cssBaleias() {
    var p = 'pc-baleias';
    return '.pc-baleias{--pcb-mar:color-mix(in srgb,#2f93b5 62%,var(--s1));--pcb-mar2:color-mix(in srgb,#14506b 72%,var(--s1));--pcb-terra:color-mix(in srgb,#c79a5a 26%,var(--s1))}' +
      cssTopo(p) + cssBichos(p) +
      '.pc-baleias-g{display:grid;gap:36px 52px}' +
      '.pc-baleias-largo .pc-baleias-g{grid-template-columns:var(--pcb-a) minmax(0,1fr);align-items:start}' +
      '.pc-baleias-cena{margin:0}' +
      '.pc-baleias-leg{font-size:12.5px;color:var(--tinta2);margin:10px 0 0;line-height:1.5;max-width:44em}' +
      '.pc-baleias-bloco{margin:0 0 36px}.pc-baleias-bloco:last-child{margin-bottom:0}' +
      '.pc-baleias-terra{fill:var(--pcb-terra)}' +
      '.pc-baleias-m0{stop-color:var(--pcb-mar2)}.pc-baleias-m1{stop-color:var(--pcb-mar)}' +
      '.pc-baleias-borda{fill:none;stroke:var(--linha);stroke-width:1}' +
      '.pc-baleias-praia{fill:none;stroke:var(--tinta);stroke-width:7;opacity:.1;stroke-linejoin:round}' +
      '.pc-baleias-costa{fill:none;stroke:var(--tinta);stroke-width:1.5;opacity:.9;stroke-linejoin:round}' +
      '.pc-baleias-hoje{fill:none;stroke:var(--tinta);stroke-width:1;stroke-dasharray:4 3;opacity:.62;stroke-linejoin:round}' +
      '.pc-baleias-hoje.pc-baleias-fino{stroke-dasharray:1.5 3.5;opacity:.5}' +
      '.pc-baleias-onda{fill:none;stroke:var(--tinta);stroke-width:1;opacity:.13;stroke-linecap:round}' +
      '.pc-baleias-nada{fill:var(--tinta);opacity:.95;stroke:var(--tinta);stroke-width:.6;stroke-linejoin:round}' +
      '.pc-baleias-nat{font:italic 400 15px var(--serifa);fill:var(--tinta);letter-spacing:.08em;opacity:.85}' +
      '.pc-baleias-lug{font:500 11.5px var(--sem);fill:var(--tinta2)}' +
      '.pc-baleias-lugf{font:700 12.5px var(--sem);fill:var(--tinta)}' +
      '.pc-baleias-pt{fill:var(--tinta);opacity:.7}' +
      '.pc-baleias-pino{fill:var(--acento);stroke:var(--fundo);stroke-width:1.6}' +
      '.pc-baleias-anel{fill:none;stroke:var(--acento);stroke-width:1.4;transform-box:fill-box;transform-origin:center;opacity:0}' +
      '.pc-baleias-vivo .pc-baleias-anel{animation:pc-baleias-pulso 3.2s ease-out infinite}' +
      '@keyframes pc-baleias-pulso{0%{transform:scale(.45);opacity:.9}70%{transform:scale(1);opacity:0}100%{transform:scale(1);opacity:0}}' +
      '.pc-baleias-fio{stroke:var(--tinta2);stroke-width:1;opacity:.75;fill:none}' +
      // régua de comprimento
      '.pc-baleias-eixo{stroke:var(--tinta2);stroke-width:1;fill:none}' +
      '.pc-baleias-guia{stroke:var(--tinta2);stroke-width:1;stroke-dasharray:1.5 4;opacity:.45;fill:none}' +
      '.pc-baleias-nome{font:italic 400 16px var(--serifa);fill:var(--tinta)}' +
      '.pc-baleias-med{font:600 17px var(--serifa);fill:var(--tinta)}' +
      '.pc-baleias-rt{font:500 11.5px var(--sem);fill:var(--tinta2);paint-order:stroke;stroke:var(--fundo);stroke-width:4px;stroke-linejoin:round}' +
      '.pc-baleias-dest{fill:none;stroke:var(--acento);stroke-width:1.4}' +
      '.pc-baleias-destt{font:600 12px var(--sem);fill:var(--acento);paint-order:stroke;stroke:var(--fundo);stroke-width:4px;stroke-linejoin:round}' +
      '.pc-baleias-ast{font-size:12px;color:var(--tinta2);margin:8px 0 0;max-width:44em}' +
      // coluna do tempo
      '.pc-baleias-col{position:relative}' +
      '.pc-baleias-col>svg{position:absolute;left:0;top:0}' +
      '.pc-baleias-banda{fill:var(--pcb-mar);opacity:.34}' +
      '.pc-baleias-marca{fill:var(--tinta)}.pc-baleias-marca.pc-baleias-forte{fill:var(--acento)}' +
      '.pc-baleias-liga{fill:none;stroke:var(--tinta2);stroke-width:1;opacity:.6}.pc-baleias-liga.pc-baleias-forte{stroke:var(--acento);opacity:.9}' +
      '.pc-baleias-it{position:absolute;display:flex;gap:10px;align-items:center;min-height:34px}' +
      '.pc-baleias-it svg{flex:none}' +
      '.pc-baleias-it b{display:block;font:600 14px/1.25 var(--sem);color:var(--tinta)}' +
      '.pc-baleias-it b i{font-weight:400;font-style:normal;color:var(--tinta2)}' +
      '.pc-baleias-it span{display:block;font:500 12px/1.3 var(--sem);color:var(--tinta2);margin-top:1px}' +
      '.pc-baleias-forte .pc-baleias-bicho{fill:var(--acento)}.pc-baleias-forte .pc-baleias-bm{stroke:var(--acento)}' +
      '.pc-baleias-tet{position:absolute;font:italic 400 15px/1.2 var(--serifa);color:var(--tinta);letter-spacing:.06em;opacity:.9}' +
      '.pc-baleias-tet small{display:block;font:500 12px/1.3 var(--sem);font-style:normal;letter-spacing:0;color:var(--tinta2);margin-top:3px}' +
      '@media (prefers-reduced-motion: reduce){.pc-baleias-vivo .pc-baleias-anel{animation:none;opacity:.5}}';
  }

  E.peca('baleias', function (el, dados, U, args) {
    s = U.s; var h = U.h, G = E.geo, P = 'pc-baleias';
    var c = camadaCerta(dados, args, 'antes-dos-humanos');
    if (!c || !G || !c.fatos) return;
    var fBal = acha(c.fatos, /baleias com pernas/i) || acha(c.fatos, /Hitan/i);
    var lugar = acha(c.onde, /Hitan/i, 'lugar');
    if (!fBal || !lugar || typeof lugar.lat !== 'number' || typeof lugar.lon !== 'number') return;
    var nBas = acha(c.numeros, /Basilosaurus/i, 'rotulo'), mBas = nBas ? numeros(nBas.valor)[0] : null;
    var mDor = (/Dorudon \(cerca de (\d+(?:,\d+)?) m\)/.exec(txt(fBal.ressalva)) || [])[1];
    mDor = mDor ? parseFloat(mDor.replace(',', '.')) : null;
    var dorMemoria = mDor != null && /Dorudon[^.]*mem[óo]ria/i.test(txt(fBal.ressalva));

    // quem entra na coluna do tempo: [expressão do título do fato, nome, complemento, desenho]
    var maxMa = typeof c.inicio === 'number' && c.inicio <= -1e6 ? -c.inicio / 1e6 : 100;
    var itens = [], pal = camadaDe(dados, 'paleolitico');
    function quando(m) {
      var ce = m.cerca ? 'c. ' : '';
      if (m.de === m.a) return ce + U.dec(m.de) + (m.de >= 2 ? ' milhões de anos atrás' : ' milhão de anos atrás');
      return ce + U.dec(m.de) + ' a ' + U.dec(m.a) + ' milhões de anos atrás';
    }
    [[/^Spinosaurus/i, 'Spinosaurus', /Bahariya/, ', em Bahariya', 'espino'], [/^Paralititan/i, 'Paralititan', /Bahariya/, ', em Bahariya', 'sauro'],
     [/^Mansourasaurus/i, 'Mansourasaurus', /Dakhla/, ', em Dakhla', 'sauro'],
     [/pedra das pir[âa]mides/i, 'Numulitos', /fundo de mar/, ', no fundo do mar', 'disco'], [/baleias com pernas/i, 'Baleias com pernas', null, '', 'baleia'],
     [/^Aegyptopithecus/i, 'Aegyptopithecus', /macaco do Fayum/, ', macaco do Fayum', 'macaco']].forEach(function (d) {
      var f = acha(c.fatos, d[0]), m = milhoes(f);
      if (!m || m.de > maxMa) return;
      itens.push({ m: m, nome: d[1], comp: d[2] && d[2].test(txt(f.titulo) + ' ' + txt(f.texto)) ? d[3] : '', bicho: d[4], q: quando(m), f: f, dest: d[4] === 'baleia' });
    });
    if (pal && typeof pal.inicio === 'number' && pal.inicio < 0) {
      itens.push({ m: { de: -pal.inicio / 1e6, a: 0 }, nome: 'Gente', comp: '', bicho: 'pessoa', q: 'só de c. ' + U.dec(-pal.inicio / 1e6) + (-pal.inicio >= 2e6 ? ' milhões' : ' milhão') + ' de anos para cá' });
    }
    itens.sort(function (a, b) { return (a.m.de + a.m.a) - (b.m.de + b.m.a); });
    var fTet = acha(c.fatos, /T[ée]tis cobria/i), mTet = milhoes(fTet);
    // o que a pesquisa não conferiu por inteiro e aparece na coluna do tempo: a peça avisa embaixo dela
    var emParte = [], deMemoria = [];
    function anota(f, nome) { if (f && f.certeza === 'baixa') deMemoria.push(nome); else if (f && f.certeza === 'media') emParte.push(nome); }
    if (mTet) anota(fTet, 'mar de Tétis');
    itens.forEach(function (it) { anota(it.f, it.nome); });

    poeEstilo('pc-baleias-css', cssBaleias());
    el.classList.add(P);
    var cenaBox = h('figure', { class: P + '-cena' });
    var colA = h('div', { class: P + '-a' }, cenaBox,
      h('p', { class: P + '-leg' }, 'Linha cheia: a costa daquele tempo, num desenho de situação (não é um mapa geológico). Tracejado: o Egito de hoje, com o Nilo, que ainda não existia. A baleia comprida é o Basilosaurus; as menores, Dorudon. Estão desenhadas muito maiores do que seriam no mapa.'));
    var reguaBox = h('div'), colBox = h('div', { class: P + '-col' });
    var colB = h('div', { class: P + '-b' });
    if (mBas) {
      colB.appendChild(h('section', { class: P + '-bloco' }, h('h4', { class: P + '-sub' }, 'Na mesma escala'), reguaBox,
        h('p', { class: P + '-ast' }, (dorMemoria ? '* O tamanho do Dorudon vem de memória na pesquisa, sem fonte conferida. ' : '') + 'A pessoa está aí só para comparar.')));
    }
    if (itens.length > 1) {
      colB.appendChild(h('section', { class: P + '-bloco' }, h('h4', { class: P + '-sub' }, 'Quem viveu aqui, e quando'),
        h('p', { class: P + '-leg', style: { margin: '-4px 0 14px' } }, 'A régua desce no tempo, em milhões de anos: quanto mais embaixo, mais antigo.'), colBox,
        emParte.length || deMemoria.length ? h('p', { class: P + '-ast' }, (emParte.length ? 'Conferido só em parte na pesquisa: ' + enumera(emParte) + '. ' : '') +
          (deMemoria.length ? 'De memória, sem fonte conferida: ' + enumera(deMemoria) + '.' : '')) : null));
    }
    el.appendChild(topo(U, P, maiuscula(fBal.ano_txt), 'Baleias no deserto',
      'Onde hoje é o deserto do Fayum havia uma baía rasa do mar de Tétis. Nela nadavam baleias que ainda tinham pernas.'));
    el.appendChild(h('div', { class: P + '-g' }, colA, colB));
    colA.appendChild(h('p', { class: 'pc-nota' }, 'O que ver aqui: a costa ficava muito ao sul da de hoje, e o lugar do pino era fundo de mar. Os esqueletos dessas baleias estão hoje no chão do deserto, em ' + txt(lugar.lugar).replace(/\s*\(.*$/, '') + '.'));

    // ----- a cena -----
    var bichos = [], vivo = false, raf = 0, antes = 0, relogio = 0;
    function pinta() { for (var i = 0; i < bichos.length; i++) { var b = bichos[i]; b.el.setAttribute('d', b.faz(b.lc, b.d0 + b.vel * relogio, b.vel < 0 ? -1 : 1)); } }
    function quadro(ts) { // nado lento: 30 quadros por segundo bastam
      if (!vivo) return;
      if (!antes || ts - antes >= 30) { if (antes) relogio += Math.min(80, ts - antes) / 1000; antes = ts; pinta(); }
      raf = requestAnimationFrame(quadro);
    }
    function fazCena(w) {
      var k = w / G.W, TOPO = 76, H = Math.round((G.H + TOPO) * k), id = 'pcb' + (++UID);
      function X(lon) { return G.X(lon) * k; } function Y(lat) { return (G.Y(lat) + TOPO) * k; }
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Desenho de situação: o mar de Tétis cobre o norte do Egito e a costa daquele tempo passa ao sul do Fayum. Baleias nadam onde hoje é deserto; um pino marca Wadi al-Hitan. O contorno do Egito de hoje aparece em tracejado.' });
      var costa = COSTA.map(function (p) { return [X(p[0]), Y(p[1])]; }), dCosta = curva(costa);
      svg.appendChild(s('defs', null,
        s('clipPath', { id: id + 'q' }, s('rect', { x: .5, y: .5, width: w - 1, height: H - 1, rx: 14 })),
        s('linearGradient', { id: id + 'm', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: f1(Y(28.5)) }, s('stop', { offset: 0, class: P + '-m0' }), s('stop', { offset: 1, class: P + '-m1' }))));
      var g = s('g', { 'clip-path': 'url(#' + id + 'q)' });
      g.appendChild(s('rect', { class: P + '-terra', x: 0, y: 0, width: w, height: H }));
      g.appendChild(s('path', { d: dCosta + 'L' + (w + 30) + ' -30L-30 -30Z', fill: 'url(#' + id + 'm)' }));
      [[.2, .1], [.52, .07], [.82, .2], [.1, .27], [.44, .3], [.7, .33], [.9, .05], [.3, .19], [.62, .2]].forEach(function (o) {
        var x = o[0] * w, y = o[1] * H, a = 7 * Math.max(.9, k);
        g.appendChild(s('path', { class: P + '-onda', d: 'M' + f1(x - a) + ' ' + f1(y) + 'q' + f1(a / 2) + ' ' + f1(-a * .45) + ' ' + f1(a) + ' 0t' + f1(a) + ' 0' }));
      });
      g.appendChild(s('path', { class: P + '-praia', d: dCosta }));
      g.appendChild(s('path', { class: P + '-costa', d: dCosta }));
      var hoje = s('g', { transform: 'translate(0 ' + f1(TOPO * k) + ') scale(' + (Math.round(k * 1000) / 1000) + ')' });
      hoje.appendChild(s('path', { class: P + '-hoje', d: G.caminho(G.TERRA, true), 'vector-effect': 'non-scaling-stroke' }));
      [G.NILO, G.ROSETA, G.DAMIETA].forEach(function (r) { hoje.appendChild(s('path', { class: P + '-hoje ' + P + '-fino', d: G.caminho(r), 'vector-effect': 'non-scaling-stroke' })); });
      g.appendChild(hoje);
      // baleias
      var kb = lim(k, .92, 1.3), nad = s('g', { 'aria-hidden': 'true' });
      bichos = [
        { lc: laco(198 * k, 92 * k, 100 * k, 40 * k, -.05, .05), faz: nadador(132 * kb, 5.2 * kb, true), d0: 250 * k, vel: 12 * k },
        { lc: laco(66 * k, 156 * k, 36 * k, 21 * k, .12, .05), faz: nadador(44 * kb, 4.2 * kb, false), d0: 30 * k, vel: -8.5 * k },
        { lc: laco(362 * k, 48 * k, 38 * k, 19 * k, -.1, .05), faz: nadador(44 * kb, 4.2 * kb, false), d0: 120 * k, vel: 7.5 * k }
      ];
      bichos.forEach(function (b) { b.el = s('path', { class: P + '-nada' }); nad.appendChild(b.el); });
      g.appendChild(nad);
      // rótulos
      g.appendChild(s('text', { class: P + '-nat', x: f1(Math.max(14, 18 * k)), y: f1(Math.max(26, 30 * k)) }, 'mar de Tétis'));
      g.appendChild(s('text', { class: P + '-nat', x: f1(X(28.4)), y: f1(Y(25.3)), 'text-anchor': 'middle' }, 'terra firme'));
      g.appendChild(s('text', { class: P + '-lug', x: f1(X(25.25)), y: f1(Y(28.62) + 17) }, 'costa aproximada'));
      g.appendChild(s('text', { class: P + '-lug', x: f1(X(25.25)), y: f1(Y(22.25)) }, 'tracejado: o Egito de hoje'));
      var cx = X(31.24), cy = Y(30.04);
      g.appendChild(s('circle', { class: P + '-pt', cx: f1(cx), cy: f1(cy), r: 2 }));
      g.appendChild(s('text', { class: P + '-lug', x: f1(cx + 6), y: f1(cy + 4) }, 'Cairo, hoje'));
      if (k >= 1.05) g.appendChild(s('text', { class: P + '-lug', x: f1(X(31.62) - 7), y: f1(Y(26.5) + 4), 'text-anchor': 'end' }, 'Nilo, hoje')); // no celular não cabe: a legenda explica
      svg.appendChild(g);
      svg.appendChild(s('rect', { class: P + '-borda', x: .5, y: .5, width: w - 1, height: H - 1, rx: 14 }));
      // pino
      var px = X(lugar.lon), py = Y(lugar.lat), yc = 0, i;
      for (i = 0; i < COSTA.length - 1; i++) if (lugar.lon >= COSTA[i][0] && lugar.lon <= COSTA[i + 1][0]) yc = Y(mix(COSTA[i][1], COSTA[i + 1][1], (lugar.lon - COSTA[i][0]) / (COSTA[i + 1][0] - COSTA[i][0])));
      yc = Math.max(yc, py + 14);
      svg.appendChild(s('path', { class: P + '-fio', d: 'M' + f1(px) + ' ' + f1(py + 7) + 'V' + f1(yc + 22) }));
      svg.appendChild(s('circle', { class: P + '-anel', cx: f1(px), cy: f1(py), r: 15 }));
      svg.appendChild(s('circle', { class: P + '-pino', cx: f1(px), cy: f1(py), r: 5 }));
      var nome = txt(lugar.lugar).replace(/\s*\(.*$/, ''), entre = (/\(([^)]+)\)/.exec(txt(lugar.lugar)) || [])[1];
      svg.appendChild(s('text', { class: P + '-lugf', x: f1(px + 10), y: f1(yc + 35), 'text-anchor': 'end' }, nome));
      if (entre) svg.appendChild(s('text', { class: P + '-lug', x: f1(px + 10), y: f1(yc + 49), 'text-anchor': 'end' }, entre + ', hoje'));
      cenaBox.textContent = ''; cenaBox.appendChild(svg);
      pinta();
    }

    // ----- régua de comprimento -----
    function fazRegua(w) {
      var esc = (w - 6) / mBas, x0 = 3, yB = 46, yD = 152, yE = 178, H = 204;
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Régua de comprimento, na mesma escala: Basilosaurus isis, ' + txt(nBas.valor) + (mDor ? '; Dorudon, cerca de ' + U.dec(mDor) + ' m' : '') + '; e uma pessoa, para comparar.' });
      var i, x, passo = mBas > 12 ? 5 : mBas > 5 ? 2 : 1;
      for (i = passo; i <= mBas; i += passo) svg.appendChild(s('path', { class: P + '-guia', d: 'M' + f1(x0 + i * esc) + ' 24V' + yE }));
      svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + x0 + ' ' + yE + 'H' + f1(x0 + mBas * esc) }));
      for (i = 0; i <= mBas; i += passo) {
        x = x0 + i * esc;
        svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + f1(x) + ' ' + yE + 'v5' }));
        svg.appendChild(s('text', { class: P + '-rt', x: f1(x), y: yE + 19, 'text-anchor': i === 0 ? 'start' : i + passo > mBas ? 'end' : 'middle' }, i === 0 ? '0' : U.dec(i) + ' m'));
      }
      // Basilosaurus
      svg.appendChild(s('text', { x: x0, y: 17 }, s('tspan', { class: P + '-nome' }, 'Basilosaurus isis'), s('tspan', { class: P + '-med', dx: 10 }, txt(nBas.valor))));
      var bas = Bi.baleia(P, mBas * esc, 'basilo');
      svg.appendChild(s('g', { transform: 'translate(' + x0 + ' ' + yB + ')' }, bas));
      var qx = x0 + bas.perna[0], qy = yB + bas.perna[1];
      svg.appendChild(s('circle', { class: P + '-dest', cx: f1(qx), cy: f1(qy), r: 9 }));
      svg.appendChild(s('path', { class: P + '-dest', d: 'M' + f1(qx) + ' ' + f1(qy + 9) + 'V' + f1(yB + 39) }));
      svg.appendChild(s('text', { class: P + '-destt', x: f1(qx - 9), y: yB + 53 }, 'pernas traseiras, com pés e dedos'));
      // Dorudon e a pessoa
      var xp = x0 + 1.3 * esc;
      if (mDor) {
        svg.appendChild(s('text', { x: x0, y: yD - 28 }, s('tspan', { class: P + '-nome' }, 'Dorudon'), s('tspan', { class: P + '-med', dx: 10 }, 'cerca de ' + U.dec(mDor) + ' m' + (dorMemoria ? '*' : ''))));
        svg.appendChild(s('g', { transform: 'translate(' + x0 + ' ' + yD + ')' }, Bi.baleia(P, mDor * esc, 'doru')));
        xp = x0 + (mDor + 1.5) * esc;
      }
      svg.appendChild(s('g', { transform: 'translate(' + f1(xp) + ' ' + yE + ')' }, Bi.pessoa(P, 1.7 * esc))); // altura de desenho, só para comparar
      svg.appendChild(s('text', { class: P + '-rt', x: f1(xp + .55 * esc + 4), y: yE - 14 }, 'uma pessoa'));
      reguaBox.textContent = ''; reguaBox.appendChild(svg);
    }

    // ----- coluna do tempo -----
    var larguraCol = 0;
    function fazTempo(w, ppm) {
      larguraCol = w; ppm = ppm || 4.1; // px por milhão de anos; cresce se o nome do mar não couber
      var xE = 40, xT = 74, y0 = 10, yFim = y0 + maxMa * ppm, i;
      function yT(t) { return y0 + t * ppm; }
      colBox.textContent = '';
      // rótulos (HTML, para o texto quebrar sozinho)
      var caixas = itens.map(function (it) {
        var ic = s('svg', { width: 52, height: 30, viewBox: '0 0 52 30', 'aria-hidden': 'true' }), gi;
        if (it.bicho === 'espino') gi = s('g', { transform: 'translate(1 3)' }, Bi.espino(P, .45));
        else if (it.bicho === 'sauro') gi = s('g', { transform: 'translate(0 3)' }, Bi.sauro(P, .39));
        else if (it.bicho === 'macaco') gi = s('g', { transform: 'translate(8 1)' }, Bi.macaco(P, .64));
        else if (it.bicho === 'disco') gi = s('g', { transform: 'translate(26 15)' }, Bi.disco(P, 10.5));
        else if (it.bicho === 'baleia') gi = s('g', { transform: 'translate(1 14)' }, Bi.baleia(P, 50, 'basilo'));
        else gi = s('g', { transform: 'translate(26 29)' }, Bi.pessoa(P, 27));
        ic.appendChild(gi);
        var cx = h('div', { class: P + '-it' + (it.dest ? ' ' + P + '-forte' : ''), style: { left: xT + 'px', width: (w - xT) + 'px' } }, ic,
          h('div', null, h('b', null, it.nome, it.comp ? h('i', null, it.comp) : null), h('span', null, it.q)));
        colBox.appendChild(cx); return cx;
      });
      var alt = caixas.map(function (cx) { return cx.offsetHeight || 36; });
      var top = itens.map(function (it, j) { return yT((it.m.de + it.m.a) / 2) - alt[j] / 2; }), vez, sobra;
      var yMar = mTet ? yT(Math.min(mTet.a, maxMa)) : -1e9;
      for (vez = 0; vez < 60; vez++) {
        for (i = 0; i < top.length - 1; i++) { sobra = top[i] + alt[i] + 8 - top[i + 1]; if (sobra > 0) { top[i] -= sobra / 2; top[i + 1] += sobra / 2; } }
        for (i = 0; i < top.length; i++) { // quem viveu depois do mar fica acima da borda; quem viveu nele, abaixo
          if ((itens[i].m.de + itens[i].m.a) / 2 < (mTet ? mTet.a : -1)) top[i] = Math.min(top[i], yMar - 7 - alt[i]); else if (mTet) top[i] = Math.max(top[i], yMar + 7);
        }
        if (top[0] < 0) top[0] = 0;
      }
      var H = Math.ceil(Math.max(yFim + 16, top[top.length - 1] + alt[alt.length - 1] + 12));
      caixas.forEach(function (cx, j) { cx.style.top = f1(top[j]) + 'px'; });
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Coluna do tempo, de hoje até ' + U.dec(maxMa) + ' milhões de anos atrás: ' + itens.map(function (it) { return it.nome + ', ' + it.q; }).join('; ') + '.' });
      // o mar de Tétis: faixa com a borda de cima ondulada
      if (mTet) {
        var ya = yMar, yb = H, d = 'M0 ' + f1(ya), x, nOndas = Math.max(4, Math.round(w / 22)), lo = w / nOndas;
        for (x = 0; x < nOndas; x++) d += 'q' + f1(lo / 4) + ' -4 ' + f1(lo / 2) + ' 0t' + f1(lo / 2) + ' 0';
        svg.appendChild(s('path', { class: P + '-banda', d: d + 'V' + f1(yb - 12) + 'q0 12 -12 12H12q-12 0 -12 -12Z' }));
        // o nome do mar vai no maior vão entre os rótulos, dentro da faixa
        var melhor = null, a, b;
        var tet = colBox.appendChild(h('div', { class: P + '-tet', style: { left: xT + 'px', width: (w - xT) + 'px' } }, 'mar de Tétis sobre o Egito', h('small', null, 'de ' + quando(mTet))));
        var hTet = tet.offsetHeight || 40;
        for (i = 0; i <= top.length; i++) {
          a = i === 0 ? ya + 6 : Math.max(ya + 6, top[i - 1] + alt[i - 1]); b = i === top.length ? yb : Math.min(yb, top[i]);
          if (b - a > hTet + 16 && (!melhor || b - a > melhor[1] - melhor[0])) melhor = [a, b];
        }
        if (!melhor && ppm < 8) return fazTempo(w, ppm + .8);
        if (melhor) tet.style.top = f1((melhor[0] + melhor[1] - hTet) / 2) + 'px'; else tet.remove();
      }
      svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + xE + ' ' + y0 + 'V' + f1(yFim) }));
      for (i = 0; i <= maxMa; i += 20) {
        svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + (xE - 5) + ' ' + f1(yT(i)) + 'h5' }));
        svg.appendChild(s('text', { class: P + '-rt', x: xE - 9, y: f1(yT(i) + 4), 'text-anchor': 'end' }, i === 0 ? 'hoje' : String(i)));
      }
      itens.forEach(function (it, j) {
        var ym = yT((it.m.de + it.m.a) / 2), yc = top[j] + alt[j] / 2, cl = it.dest ? ' ' + P + '-forte' : '';
        svg.appendChild(s('path', { class: P + '-liga' + cl, d: 'M' + (xE + 6) + ' ' + f1(ym) + 'C' + (xE + 20) + ' ' + f1(ym) + ' ' + (xE + 14) + ' ' + f1(yc) + ' ' + (xT - 6) + ' ' + f1(yc) }));
        if (it.m.de - it.m.a < 1.2) svg.appendChild(s('circle', { class: P + '-marca' + cl, cx: xE, cy: f1(Math.max(y0 + 2, ym)), r: 4.5 }));
        else svg.appendChild(s('rect', { class: P + '-marca' + cl, x: xE - 4, y: f1(yT(it.m.a) + .5), width: 8, height: f1((it.m.de - it.m.a) * ppm - 1), rx: 3 }));
      });
      colBox.insertBefore(svg, colBox.firstChild);
      colBox.style.height = H + 'px';
    }

    // ----- tabela e fonte -----
    // duas colunas só: a fonte vai embaixo do nome, para a tabela caber num celular estreito sem partir palavra
    var linhas = [];
    function comFonte(nome, f) { return f && f.fonte ? [nome, h('small', null, 'Fonte: ', U.link(txt(f.fonte), f.url))] : nome; }
    function dataCom(f) { var selo = seloDe(f); return txt(f.ano_txt) + (selo ? ' (' + selo + ')' : ''); }
    if (nBas) linhas.push([comFonte(txt(nBas.rotulo), nBas), txt(nBas.valor)]);
    if (mDor) linhas.push([dorMemoria ? ['Comprimento do Dorudon', h('small', null, 'de memória, sem fonte conferida')] : 'Comprimento do Dorudon', 'cerca de ' + U.dec(mDor) + ' m']);
    if (mTet) linhas.push([comFonte(txt(fTet.titulo), fTet), dataCom(fTet)]);
    itens.slice().reverse().forEach(function (it) { if (it.f) linhas.push([comFonte(txt(it.f.titulo), it.f), dataCom(it.f)]); });
    if (pal && typeof pal.inicio === 'number' && pal.inicio < 0) linhas.push(['Gente no Egito (camada ' + txt(pal.titulo) + ')', txt(pal.periodo_txt)]);
    el.appendChild(tabelaSegura(U, P, 'Ver os números', ['O quê', 'Medida ou data'], linhas));
    if (fBal.fonte) el.appendChild(U.fonte(txt(fBal.fonte), fBal.url));

    U.aoMedir(el, function (larg) {
      var largo = larg >= 860, a = largo ? Math.min(560, Math.round((larg - 52) * .5)) : Math.min(larg, 560), b = Math.min(largo ? larg - 52 - a : larg, 600);
      el.classList.toggle(P + '-largo', largo); el.style.setProperty('--pcb-a', a + 'px');
      fazCena(a);
      if (mBas) fazRegua(b);
      if (itens.length > 1) fazTempo(b);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (larguraCol && el.isConnected && itens.length > 1) fazTempo(larguraCol); });
    U.aoVer(cenaBox, function (v) {
      el.classList.toggle(P + '-vivo', !!v);
      vivo = !!v && !U.reduz; cancelAnimationFrame(raf);
      if (vivo) { antes = 0; raf = requestAnimationFrame(quadro); }
    }, { uma: false, margem: '0px' });
  });

  // =====================================================================================================
  // SAARA: "Quando o Saara era verde" (camada saara-verde)
  // De onde vem cada número (tudo lido de dados.json na hora de desenhar):
  //   começo da régua (c. 9000 a.C.) ... inicio da camada; é quando o fato "As chuvas chegam ao deserto egípcio" começa (ano_txt)
  //   fim da régua (c. 3500 a.C.) ...... ano do fato "Fim do Período Úmido Africano"
  //   período úmido no Saara inteiro ... número "Duração do Período Úmido Africano" (valor), citado na nota de leitura
  //   marcas e títulos na régua ........ ano, ano_txt e titulo de cada fato da camada que cai dentro da régua
  //   começo do recuo da chuva ......... fim da camada (c. 5000 a.C.); o resumo diz só "depois as chuvas recuaram"
  //   lugares com rótulo ............... onde da camada (lat, lon), sem os museus
  //   frase da tese .................... fato "A tese: a seca empurrou gente para o Nilo" (ano_txt e autores)
  //   quando o gado se espalha ......... entre o ano do fato "Jebel Uweinat: rebanhos pintados na fronteira" e o do fato
  //                                      "Ovelhas e cabras chegam do Oriente Próximo"; antes disso só há gado perto de
  //                                      Nabta Playa, porque a ressalva do fato das chuvas diz que o gado tão cedo é
  //                                      discutido e restrito ao sul (a peça repete esse aviso na nota de leitura)
  //   O avanço e o recuo do verde, os lagos (fora Nabta Playa) e os pontos de gente e de gado são um esquema: os dados
  //   dão as datas do começo e do fim e dizem que a seca chegou antes ao norte. Os oásis vêm de EGITO.geo (mapa.js).
  // =====================================================================================================
  function cssSaara() {
    var p = 'pc-saara';
    return '.pc-saara{--pcs-areia:color-mix(in srgb,#e3c489 62%,var(--s2));--pcs-verde:color-mix(in srgb,#5a9a3c 66%,var(--s2));--pcs-agua:color-mix(in srgb,#74c0ea 82%,var(--s2));' +
      '--pcs-mato:color-mix(in srgb,#27521f 70%,var(--s2));--pcs-duna:color-mix(in srgb,#9a6f2e 55%,var(--s2))}' +
      cssTopo(p) +
      '.pc-saara-g{display:grid;gap:20px 52px;grid-template-areas:"topo" "mapa" "painel"}' +
      '.pc-saara-largo .pc-saara-g{grid-template-columns:var(--pcs-a) minmax(0,1fr);grid-template-areas:"mapa topo" "mapa painel";grid-template-rows:auto 1fr;align-items:start}' +
      '.pc-saara .pc-saara-topo{grid-area:topo;margin:0}.pc-saara-a{grid-area:mapa}.pc-saara-b{grid-area:painel}' +
      '.pc-saara-largo .pc-saara-topo{padding-top:8px}.pc-saara-largo .pc-saara-b{padding-top:10px}' +
      '.pc-saara-mapa{margin:0}' +
      '.pc-saara-terra{fill:var(--pcs-areia)}' +
      '.pc-saara-pts{fill:var(--pcs-duna);opacity:.5}' +
      '.pc-saara-v0{stop-color:var(--pcs-verde);stop-opacity:0}.pc-saara-v1{stop-color:var(--pcs-verde);stop-opacity:1}' +
      '.pc-saara-vale{fill:none;stroke:var(--pcs-verde);stroke-linecap:round;stroke-linejoin:round}' +
      '.pc-saara-delta,.pc-saara-cv{fill:var(--pcs-verde)}' +
      '.pc-saara-rio{fill:none;stroke:var(--pcs-agua);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
      '.pc-saara-lago{fill:var(--pcs-agua);stroke:var(--pcs-mato);stroke-width:.6;transform-box:fill-box;transform-origin:center}' +
      '.pc-saara-arv{fill:none;stroke:var(--pcs-mato);stroke-width:1.3;stroke-linecap:round}' +
      '.pc-saara-copa{fill:var(--pcs-mato);stroke:none}' +
      '.pc-saara-duna{fill:none;stroke:var(--pcs-duna);stroke-width:1.1;stroke-linecap:round}' +
      '.pc-saara-oasis{fill:var(--pcs-verde);stroke:var(--pcs-mato);stroke-width:1}' +
      '.pc-saara-costa{fill:none;stroke:var(--linha);stroke-width:1}' +
      '.pc-saara-mar{font:italic 400 12px var(--serifa);fill:var(--tinta2);letter-spacing:.08em}' +
      '.pc-saara-lug{font:600 11.5px var(--sem);fill:var(--tinta);paint-order:stroke;stroke:var(--fundo);stroke-width:3px;stroke-opacity:.75;stroke-linejoin:round}' +
      '.pc-saara-lug.pc-saara-leve{font-weight:500;font-size:11px;fill:var(--tinta);opacity:.85}' +
      '.pc-saara-lug.pc-saara-lrio{font:italic 400 12.5px var(--serifa);letter-spacing:.06em}' +
      '.pc-saara-marco{fill:none;stroke:var(--tinta);stroke-width:1.4;paint-order:stroke}' +
      '.pc-saara-marco.pc-saara-sel{stroke:var(--acento);stroke-width:2.4}' +
      '.pc-saara-gente{fill:var(--tinta);stroke:var(--fundo);stroke-width:.9}' +
      '.pc-saara-gado{fill:var(--tinta);stroke:var(--fundo);stroke-width:.8;opacity:.9}' +
      // painel
      '.pc-saara-ano{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;justify-content:space-between}' +
      '.pc-saara-g>*{min-width:0}' +
      '.pc-saara-ano b{display:block;font:600 clamp(30px,5vw,44px)/1 var(--serifa);letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.pc-saara-st{font:500 13px/1.3 var(--sem);color:var(--tinta2);margin:8px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.pc-saara-bts{display:flex;gap:6px;flex:none}' +
      '.pc-saara-bt{min-width:44px;min-height:44px;padding:0 14px;border:1px solid var(--linha);border-radius:999px;background:var(--s1);color:var(--tinta);font:600 13.5px var(--sem);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}' +
      '.pc-saara-bt:hover{border-color:var(--acento)}' +
      '.pc-saara-bt svg{width:14px;height:14px;fill:currentColor}' +
      '.pc-saara-bt.pc-saara-so{padding:0}' +
      '.pc-saara-bt[disabled]{opacity:.4;cursor:default;border-color:var(--linha)}' +
      '.pc-saara-regua{position:relative;margin:10px 0 0}' +
      '.pc-saara-range{position:absolute;left:0;top:10px;width:100%;height:44px;margin:0;padding:0;background:none;-webkit-appearance:none;appearance:none;cursor:pointer;touch-action:pan-y}' +
      '.pc-saara-range::-webkit-slider-runnable-track{height:44px;background:none;border:0}' +
      '.pc-saara-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:9px;border-radius:50%;background:var(--acento);border:3px solid var(--fundo);box-shadow:0 0 0 1px var(--acento)}' +
      '.pc-saara-range::-moz-range-track{height:44px;background:none;border:0}' +
      '.pc-saara-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--acento);border:3px solid var(--fundo);box-shadow:0 0 0 1px var(--acento)}' +
      '.pc-saara-range:focus{outline:none}' +
      '.pc-saara-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 1px var(--acento),0 0 0 5px color-mix(in srgb,var(--acento) 45%,transparent)}' +
      '.pc-saara-range:focus-visible::-moz-range-thumb{box-shadow:0 0 0 1px var(--acento),0 0 0 5px color-mix(in srgb,var(--acento) 45%,transparent)}' +
      '.pc-saara-eixo{stroke:var(--tinta2);stroke-width:1;fill:none}' +
      '.pc-saara-rt{font:500 11.5px var(--sem);fill:var(--tinta2);font-variant-numeric:tabular-nums}' +
      '.pc-saara-fm{fill:var(--tinta2);opacity:.55}.pc-saara-fm.pc-saara-foi{fill:var(--tinta);opacity:1}.pc-saara-fm.pc-saara-sel{fill:var(--acento);opacity:1}' +
      '.pc-saara-faixa{stroke:var(--linha);stroke-width:1}' +
      '.pc-saara-fato{margin:14px 0 0;min-height:5.2em;border-left:2px solid var(--acento);padding:1px 0 1px 14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between}' +
      '.pc-saara-fato>div{min-width:0}' +
      '.pc-saara-fato p{margin:0 0 8px}.pc-saara-fato p:last-child{margin:0}' +
      '.pc-saara-fato i{display:block;font:700 12.5px/1.3 var(--sem);font-style:normal;color:var(--tinta2);font-variant-numeric:tabular-nums}' +
      '.pc-saara-fato b{display:block;font:600 clamp(17px,2vw,20px)/1.22 var(--serifa);margin-top:2px;text-wrap:balance}' +
      '.pc-saara-fato small{display:block;font:500 12px/1.3 var(--sem);color:var(--tinta2);margin-top:3px}' +
      '.pc-saara-leg{display:flex;flex-wrap:wrap;gap:6px 16px;margin:12px 0 0;padding:0;list-style:none;font:500 12.5px/1.3 var(--sem);color:var(--tinta2)}' +
      '.pc-saara-leg li{display:inline-flex;align-items:center;gap:6px}' +
      '.pc-saara-leg svg{flex:none}' +
      '.pc-saara-fim{position:relative;margin:22px 0 0;max-width:34em}' +
      '.pc-saara-perg{position:absolute;left:0;top:0;margin:0;font:italic 400 clamp(17px,2vw,20px)/1.3 var(--serifa);color:var(--tinta2);transition:opacity .5s ease}' +
      '.pc-saara-tese{opacity:0;transition:opacity .7s ease}' +
      '.pc-saara-vis .pc-saara-tese{opacity:1}.pc-saara-vis .pc-saara-perg{opacity:0}' +
      '.pc-saara-tese b{display:block;font:600 clamp(19px,2.3vw,24px)/1.25 var(--serifa);text-wrap:balance}' +
      '.pc-saara-tese span{display:block;font-size:13.5px;color:var(--tinta2);margin-top:8px;line-height:1.5}' +
      '@media (prefers-reduced-motion: reduce){.pc-saara-tese,.pc-saara-perg{transition:none}}';
  }
  function semente(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dentroDe(pol, x, y) {
    var d = false, i, j;
    for (i = 0, j = pol.length - 1; i < pol.length; j = i++) if ((pol[i][1] > y) !== (pol[j][1] > y) && x < (pol[j][0] - pol[i][0]) * (y - pol[i][1]) / (pol[j][1] - pol[i][1]) + pol[i][0]) d = !d;
    return d;
  }

  E.peca('saara', function (el, dados, U, args) {
    s = U.s; var h = U.h, G = E.geo, P = 'pc-saara';
    var c = camadaCerta(dados, args, 'saara-verde');
    if (!c || !G || !c.fatos || typeof c.inicio !== 'number') return;
    var fFim = acha(c.fatos, /Fim do Per[íi]odo [ÚU]mido/i), fTese = acha(c.fatos, /\btese\b/i), fChuva = acha(c.fatos, /chuvas chegam/i);
    var T0 = c.inicio, T1 = fFim && typeof fFim.ano === 'number' ? fFim.ano : c.fim;
    if (!(T1 > T0) || T0 < -20000) return;
    var PASSO = 50;
    var tCh = fChuva && fChuva.ano > T0 && fChuva.ano < T1 ? fChuva.ano : T0;          // a chuva acabou de chegar
    var tRe = typeof c.fim === 'number' && c.fim > tCh && c.fim < T1 ? c.fim : mix(tCh, T1, .65); // a chuva começa a recuar
    // fatos datados dentro da régua, do mais velho para o mais novo, juntando os do mesmo ano
    function gatilho(f) { var m = /c\.\s*([\d.]+)\s*a\s*[\d.]+\s*a\.C\./.exec(txt(f.ano_txt)), a = m ? -parseInt(m[1].replace(/\./g, ''), 10) : f.ano; return lim(Math.min(f.ano, a), T0, T1); }
    var grupos = [];
    c.fatos.filter(function (f) { return typeof f.ano === 'number' && f.ano >= T0 && f.ano <= T1; })
      .map(function (f, i) { return { f: f, t: gatilho(f), i: i }; })
      .sort(function (a, b) { return a.t - b.t || b.i - a.i; })
      .forEach(function (x) { var u = grupos[grupos.length - 1]; if (u && u.t === x.t) u.fs.push(x.f); else grupos.push({ t: x.t, fs: [x.f] }); });
    if (!grupos.length) return;
    var nUmido = acha(c.numeros, /Dura[çc][ãa]o do Per[íi]odo [ÚU]mido/i, 'rotulo');
    // quando o gado se espalha pelo deserto (sem esses fatos, o gado acompanha a gente desde o começo)
    var fReb = acha(c.fatos, /rebanhos/i), fOv = acha(c.fatos, /ovelhas e cabras/i);
    var tG0 = fReb && typeof fReb.ano === 'number' ? fReb.ano : null, tG1 = fOv && typeof fOv.ano === 'number' ? fOv.ano : null;
    if (tG0 == null) tG0 = tG1; if (tG1 == null) tG1 = tG0;
    if (tG0 == null || tG0 < T0 || tG1 > T1) tG0 = tG1 = T0;
    if (tG0 > tG1) { var tGx = tG0; tG0 = tG1; tG1 = tGx; }
    var gadoDiscutido = !!fChuva && /gado[^.]*(discutid|controvers)/i.test(txt(fChuva.ressalva));

    // ----- o modelo do desenho: até onde vai o verde em cada ano -----
    var FAIXA = 1.25, FMAX = 31.6, FMIN = 21.55 - FAIXA - .25, POT = 1.7;
    function frente(t) {
      if (t < tCh) return mix(FMIN, FMAX, suave((t - T0) / (tCh - T0)));
      if (t <= tRe) return FMAX;
      return FMAX - (FMAX - FMIN) * Math.pow(lim((t - tRe) / (T1 - tRe), 0, 1), POT);
    }
    function verde(lat, F) { return suave((F - lat) / (2 * FAIXA) + .5); }
    function quandoPassa(lat, limiar, sobe) { // ano em que o verde de uma latitude cruza o limiar (na chegada ou no recuo)
      var a = sobe ? T0 : tRe, b = sobe ? tCh : T1, t;
      for (t = a; t <= b; t += 10) if (sobe ? verde(lat, frente(t)) >= limiar : verde(lat, frente(t)) <= limiar) return t;
      return b;
    }

    // ----- geografia do esquema (graus) -----
    var RIO = G.LAGO.slice().reverse().concat(G.NILO); // do sul para o norte
    var GRAU = G.Y(0) - G.Y(1); // unidades do mapa por grau de latitude
    function lonDoRio(lat) {
      for (var i = 0; i < RIO.length - 1; i++) { var a = RIO[i], b = RIO[i + 1]; if ((lat - a[1]) * (lat - b[1]) <= 0 && a[1] !== b[1]) return mix(a[0], b[0], (lat - a[1]) / (b[1] - a[1])); }
      return lat < RIO[0][1] ? RIO[0][0] : RIO[RIO.length - 1][0];
    }
    var lugares = (c.onde || []).filter(function (o) {
      return typeof o.lat === 'number' && typeof o.lon === 'number' && !/museu/i.test(txt(o.lugar)) && o.lat > 21.7 && o.lat < 31.9 && o.lon > 24.6 && o.lon < 36.8;
    }).map(function (o) {
      var t = txt(o.lugar) + ' ' + txt(o.cidade);
      if (/Nabta/i.test(t)) return { o: o, rot: 'Nabta Playa', re: /Nabta/i, lado: -1 };
      if (/Gilf|Wadi Sura/i.test(t)) return { o: o, rot: 'Gilf Kebir', re: /Gilf|Nadadores|Bestas|Wadi Sura/i, lado: 1 };
      if (/Qarun|Fayum/i.test(t)) return { o: o, rot: 'Fayum', re: /Fayum/i, lado: -1 };
      return { o: o, rot: txt(o.lugar).replace(/\s*\(.*$/, ''), re: new RegExp(txt(o.lugar).replace(/\s*\(.*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), lado: o.lon < lonDoRio(o.lat) ? -1 : 1 };
    });
    function lugarDoFato(f) {
      var i, t1 = txt(f.titulo), t2 = txt(f.texto).split('. ')[0];
      for (i = 0; i < lugares.length; i++) if (lugares[i].re.test(t1)) return lugares[i];
      for (i = 0; i < lugares.length; i++) if (lugares[i].re.test(t2)) return lugares[i];
      return null;
    }
    var R = semente(7031), nabta = acha(c.onde, /Nabta/i, 'lugar');
    var LAGOS = [[26.55, 23.0, 1], [27.9, 22.45, .8], [28.9, 24.25, .9], [26.6, 25.7, .8], [29.5, 23.2, .7], [27.5, 27.25, .7], [26.2, 28.2, .6], [30.2, 26.5, .6], [33.7, 24.7, .5], [33.2, 27.3, .45]];
    if (nabta && typeof nabta.lat === 'number') LAGOS.push([nabta.lon - .05, nabta.lat + .12, .9]);
    function sorteia(n, peso) { // pontos em terra, longe do rio e do Sinai; peso(lon, lat) = chance de ficar
      var r = [], lon, lat, v = 0;
      while (r.length < n && v++ < 6000) {
        lon = 24.9 + R() * 10.6; lat = 21.8 + R() * 9.6;
        if (!dentroDe(G.TERRA, lon, lat) || !dentroDe(G.TERRA, lon - .35, lat) || !dentroDe(G.TERRA, lon + .45, lat) || !dentroDe(G.TERRA, lon, lat + .3) || !dentroDe(G.TERRA, lon, lat - .3) ||
          (lon > 32.4 && lat > 28.3) || Math.abs(lon - lonDoRio(lat)) < .55 || R() > peso(lon, lat)) continue;
        r.push([lon, lat]);
      }
      return r;
    }
    function pesoSul(lon, lat) { return (lon > lonDoRio(lat) ? .35 : 1) * mix(1, .4, (lat - 21.8) / 9.6); }
    var ARVORES = sorteia(40, pesoSul), TUFOS = sorteia(70, pesoSul), DUNAS = sorteia(34, function (lon, lat) { return lon > lonDoRio(lat) ? .3 : 1; });
    // grupos de gente com gado: casa no deserto, destino no rio, num oásis ou para o sul
    var GRUPOS = [], casas = sorteia(24, function (lon, lat) { return (lon > lonDoRio(lat) ? .28 : 1) * mix(1, .5, (lat - 21.8) / 9.6); }), cheios = {};
    LAGOS.slice(0, 6).concat(LAGOS.slice(-1)).forEach(function (l, i) { if (casas[i]) casas[i] = [l[0] + (R() - .5) * .9, l[1] + (R() - .3) * .7]; });
    casas.forEach(function (cs, i) {
      var lon = cs[0], lat = cs[1], g = { casa: cs, fase: R() * 6.28, gado: 1 + (R() < .35 ? 1 : 0), sul: false }, d, k, o, melhor = null;
      if (lat < 23.9 && lon < 29.2 && R() < .6) { g.dest = [lon + (R() - .3) * 1.2, 21.72]; g.sul = true; } // some na fronteira do sul
      else {
        for (k = 0; k < G.OASIS.length; k++) { o = G.OASIS[k]; d = Math.hypot((o[1] - lon) * .9, o[2] - lat); if (d < 2.3 && (cheios[k] || 0) < 2 && (!melhor || d < melhor[0])) melhor = [d, k]; }
        if (melhor && lon < lonDoRio(lat) && R() < .4) { o = G.OASIS[melhor[1]]; cheios[melhor[1]] = (cheios[melhor[1]] || 0) + 1; g.dest = [o[1] + (cheios[melhor[1]] === 1 ? -.3 : -.36), o[2] + (cheios[melhor[1]] === 1 ? .2 : -.16)]; }
        else { d = lim(lat + (R() * 2 - .5), 22.4, 30.05); g.rio = d; }
      }
      g.entra = quandoPassa(lat, .6, true) + R() * 420;
      // o gado: desde a chegada só perto de Nabta Playa; nos outros grupos, mais tarde (sem sorteio novo, para não mexer no resto)
      g.tGado = nabta && typeof nabta.lat === 'number' && Math.hypot((lon - nabta.lon) * .9, lat - nabta.lat) < 2.2 ? T0 : mix(tG0, tG1, g.fase / 6.2832);
      g.sai = quandoPassa(lat, .42, false) + R() * 160;
      g.dura = 280 + R() * 200;
      if (g.sai + g.dura > T1) g.sai = Math.max(tRe, T1 - g.dura);
      GRUPOS.push(g);
    });
    // quem sempre esteve no vale e nos oásis
    var FIXOS = [], LATS_FIXAS = [22.9, 24.6, 25.9, 27.2, 28.5, 29.7];
    LATS_FIXAS.forEach(function (lat, i) { FIXOS.push({ p: [lonDoRio(lat) + (i % 2 ? -.2 : .2), lat], desde: T0 - 1 }); });
    // quem vai para o rio: espalha ao longo do vale, alternando as margens, sem cair em cima de quem já estava lá
    var ultima = 0, nDelta = 0;
    GRUPOS.filter(function (g) { return g.rio != null; }).sort(function (a, b) { return a.rio - b.rio; }).forEach(function (g, i) {
      var lat = Math.max(g.rio, ultima + .3), v = 0;
      while (v++ < 8 && LATS_FIXAS.some(function (f) { return Math.abs(f - lat) < .2; })) lat += .14;
      ultima = g.rio = lat;
      if (lat <= 30.05) g.dest = [lonDoRio(lat) + (i % 2 ? .2 : -.2), lat];
      else { // passou do Cairo: vai para o delta, ao longo de um dos braços
        var ramo = nDelta % 2 ? G.DAMIETA : G.ROSETA, f = Math.min(.92, .22 + Math.floor(nDelta / 2) * .26), k = Math.min(ramo.length - 2, Math.floor(f * (ramo.length - 1))), u = f * (ramo.length - 1) - k;
        g.dest = [mix(ramo[k][0], ramo[k + 1][0], u) + (nDelta % 2 ? .16 : -.16), mix(ramo[k][1], ramo[k + 1][1], u)]; nDelta++;
      }
    });
    FIXOS.push({ p: [31.2, 30.62], desde: T0 - 1 });
    G.OASIS.forEach(function (o, i) { if (i % 2 === 0 || i === 3) FIXOS.push({ p: [o[1] + .05, o[2] - .2], desde: quandoPassa(o[2], .6, true) + 150 + i * 60 }); });

    // ----- montagem -----
    poeEstilo('pc-saara-css', cssSaara());
    el.classList.add(P);
    var t = U.reduz ? T1 : T0, tocando = false, mexeu = false, rafA = 0, antesA = 0, visto = false;
    function rotAno(a) { return (a > -11000 ? 'c. ' : '') + U.ano(a); } // U.ano já escreve "há N mil anos" para datas mais velhas
    var mapaBox = h('figure', { class: P + '-mapa' });
    var anoB = h('b'), anoS = h('p', { class: P + '-st' });
    var btToca = h('button', { type: 'button', class: P + '-bt' }), btAnt, btProx;
    var fatoTxt = h('div'), fatoBox = h('div', { class: P + '-fato' }, fatoTxt);
    var reguaBox = h('div', { class: P + '-regua' });
    var range = h('input', { type: 'range', class: P + '-range', min: T0, max: T1, step: PASSO, value: t, 'aria-label': 'Ano (arraste para andar no tempo)' });
    var tese = null, perg = null, fimBox = null;
    if (fTese) {
      var autores = /(?:Em (\d{4}),\s*)?(Kuper e Kr[öo]pelin)/.exec(txt(fTese.texto));
      tese = h('div', { class: P + '-tese' },
        h('b', null, 'Uma hipótese forte: a seca empurrou os pastores para o vale do Nilo.'),
        h('span', null, (autores ? 'É a tese de ' + autores[2] + (autores[1] ? ' (' + autores[1] + ')' : '') + ', não um fato fechado. ' : 'É uma tese, não um fato fechado. ') +
          'O grosso do abandono do deserto fica ' + txt(fTese.ano_txt) + ', pouco antes das culturas que deram no Egito dos faraós.'));
      perg = h('p', { class: P + '-perg' }, 'Quando a chuva for embora, para onde vai essa gente?');
      fimBox = h('div', { class: P + '-fim' }, perg, tese);
    }
    function icone(d) { return s('svg', { viewBox: '0 0 14 14', 'aria-hidden': 'true' }, s('path', { d: d })); }
    var IC_TOCA = 'M3 1.5v11l9-5.5z', IC_PARA = 'M2.5 1.5h3.2v11H2.5zM8.3 1.5h3.2v11H8.3z';
    btAnt = h('button', { type: 'button', class: P + '-bt ' + P + '-so', 'aria-label': 'Fato anterior', title: 'Fato anterior' }, icone('M9.5 1.5L4 7l5.5 5.5 1.2-1.2L6.4 7l4.3-4.3z'));
    btProx = h('button', { type: 'button', class: P + '-bt ' + P + '-so', 'aria-label': 'Próximo fato', title: 'Próximo fato' }, icone('M4.5 1.5L10 7l-5.5 5.5-1.2-1.2L7.6 7 3.3 2.7z'));
    fatoBox.appendChild(h('div', { class: P + '-bts' }, btAnt, btProx));
    var leg = h('ul', { class: P + '-leg', 'aria-label': 'Legenda' });
    function chave(desenho, texto) { leg.appendChild(h('li', null, desenho, texto)); }
    chave(s('svg', { width: 22, height: 12 }, s('rect', { class: P + '-cv', width: 22, height: 12, rx: 3 }), s('path', { class: P + '-arv', d: 'M7 9v-3M4.5 5.6h5M15 9.5v-3M12.5 6.1h5' })), 'savana, com chuva de verão');
    chave(s('svg', { width: 22, height: 12 }, s('rect', { class: P + '-terra', width: 22, height: 12, rx: 3 }), s('path', { class: P + '-duna', d: 'M4 8q3.5 -4 7 0M12 6.5q3 -3.4 6 0' })), 'deserto');
    chave(s('svg', { width: 16, height: 12 }, s('ellipse', { class: P + '-lago', cx: 8, cy: 6, rx: 7, ry: 3.6 })), 'lago de chuva');
    chave(s('svg', { width: 12, height: 12 }, s('circle', { class: P + '-gente', cx: 6, cy: 6, r: 3.4 })), 'gente');
    chave(s('svg', { width: 12, height: 12 }, s('path', { class: P + '-gado', d: 'M6 2.2L9.8 6 6 9.8 2.2 6z' })), 'gado');
    chave(s('svg', { width: 12, height: 12 }, s('circle', { class: P + '-oasis', cx: 6, cy: 6, r: 3.6 })), 'oásis');

    var intro = 'A chuva de verão chegou ao deserto egípcio, ficou por milênios e foi embora. Arraste a régua, ou deixe rodar.';
    var painel = h('div', { class: P + '-painel' },
      h('div', { class: P + '-ano' }, anoB, btToca), anoS,
      reguaBox, fatoBox);
    var cab = topo(U, P, 'De ' + U.int(Math.round(U.anosAtras(T0) / 1000)) + ' mil a ' + U.int(Math.round(U.anosAtras(T1) / 100) * 100) + ' anos atrás', 'Quando o Saara era verde', intro);
    var colA = h('div', { class: P + '-a' }, mapaBox, leg), colB = h('div', { class: P + '-b' });
    var grade = h('div', { class: P + '-g' }, cab, colA, colB);
    el.appendChild(grade);
    var nota = h('p', { class: 'pc-nota' }, 'O que ver aqui: o verde some do norte para o sul, e os pontos, antes espalhados, acabam junto ao rio. ' +
      (nUmido ? 'No Saara inteiro, o período úmido foi ' + txt(nUmido.valor) + '; a régua mostra só o trecho em que a chuva alcançou o Egito. ' : '') +
      'O avanço do verde, os lagos e os pontos são um esquema, não medidas: a pesquisa dá as datas do começo e do fim e diz que a seca chegou antes ao norte.' +
      (gadoDiscutido ? ' O gado mais antigo, no sul, ainda é discutido.' : ''));

    // ----- o mapa -----
    var M = null; // peças móveis do mapa
    function fazMapa(w) {
      var k = w / G.W, MY = 16, H = Math.round(G.H * k + MY + 4), id = 'pcs' + (++UID), i;
      function X(lon) { return G.X(lon) * k; } function Y(lat) { return G.Y(lat) * k + MY; }
      function cam(pts, fecha) { return pts.map(function (p, j) { return (j ? 'L' : 'M') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('') + (fecha ? 'Z' : ''); }
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Mapa do Egito ao longo do tempo. Quando a chuva chega, o deserto a oeste do Nilo vira savana, com lagos e gente, e mais tarde gado. Quando a chuva recua para o sul, o verde vira areia e os pontos de gente e de gado vão para o vale do Nilo, para os oásis e para o sul.' });
      var faixaPx = 2 * FAIXA * GRAU * k; // altura, em px, da passagem do verde para a areia
      svg.appendChild(s('defs', null,
        s('clipPath', { id: id + 't' }, s('path', { d: cam(G.TERRA, true) })),
        s('linearGradient', { id: id + 'v', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: f1(faixaPx) }, s('stop', { offset: 0, class: P + '-v0' }), s('stop', { offset: 1, class: P + '-v1' })),
        s('pattern', { id: id + 'p', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, s('circle', { class: P + '-pts', cx: 2, cy: 2.5, r: .7 }), s('circle', { class: P + '-pts', cx: 6.5, cy: 7, r: .7 }))));
      svg.appendChild(s('text', { class: P + '-mar', x: f1(X(27.4)), y: f1(Y(31.75) + 1), 'text-anchor': 'middle' }, 'Mediterrâneo'));
      svg.appendChild(s('text', { class: P + '-mar', x: f1(X(35.25)), y: f1(Y(26.2)), 'text-anchor': 'middle', transform: 'rotate(58 ' + f1(X(35.25)) + ' ' + f1(Y(26.2)) + ')' }, 'Mar Vermelho'));
      var terra = s('g', { 'clip-path': 'url(#' + id + 't)' });
      terra.appendChild(s('rect', { class: P + '-terra', x: 0, y: 0, width: w, height: H }));
      terra.appendChild(s('rect', { x: 0, y: 0, width: w, height: H, fill: 'url(#' + id + 'p)' }));
      var dunas = s('g'), cortina = s('rect', { x: -10, y: 0, width: w + 20, height: H * 2 + faixaPx, fill: 'url(#' + id + 'v)' }), mato = s('g'), lagos = s('g');
      // marcas em faixas de latitude: cada faixa muda de opacidade de uma vez
      var NF = 12, fx = { duna: [], mato: [] };
      for (i = 0; i < NF; i++) { fx.duna.push(dunas.appendChild(s('g'))); fx.mato.push(mato.appendChild(s('g'))); }
      function faixaDe(lat) { return lim(Math.floor((lat - 21.6) / (10.2 / NF)), 0, NF - 1); }
      DUNAS.forEach(function (p) { var x = X(p[0]), y = Y(p[1]), a = 5 * Math.max(.9, k); fx.duna[faixaDe(p[1])].appendChild(s('path', { class: P + '-duna', d: 'M' + f1(x - a) + ' ' + f1(y) + 'q' + f1(a) + ' ' + f1(-a * .9) + ' ' + f1(a * 2) + ' 0' })); });
      TUFOS.forEach(function (p) { var x = X(p[0]), y = Y(p[1]); fx.mato[faixaDe(p[1])].appendChild(s('path', { class: P + '-arv', d: 'M' + f1(x - 2.2) + ' ' + f1(y - 2.6) + 'l1.2 2.6M' + f1(x) + ' ' + f1(y - 3.4) + 'v3.4M' + f1(x + 2.2) + ' ' + f1(y - 2.6) + 'l-1.2 2.6' })); });
      ARVORES.forEach(function (p) {
        var x = X(p[0]), y = Y(p[1]), e = Math.max(.9, k), gg = fx.mato[faixaDe(p[1])];
        gg.appendChild(s('path', { class: P + '-arv', d: 'M' + f1(x) + ' ' + f1(y) + 'v' + f1(-4.2 * e) }));
        gg.appendChild(s('ellipse', { class: P + '-copa', cx: f1(x), cy: f1(y - 4.6 * e), rx: f1(4.2 * e), ry: f1(1.7 * e) }));
      });
      var elLagos = LAGOS.map(function (l) { return lagos.appendChild(s('ellipse', { class: P + '-lago', cx: f1(X(l[0])), cy: f1(Y(l[1])), rx: f1(8.5 * l[2] * Math.max(.85, k)), ry: f1(3.8 * l[2] * Math.max(.85, k)) })); });
      terra.appendChild(dunas); terra.appendChild(cortina); terra.appendChild(mato); terra.appendChild(lagos);
      // o vale e o delta, sempre verdes; o rio e o lago do Fayum
      terra.appendChild(s('path', { class: P + '-delta', d: cam(G.DELTA, true) }));
      terra.appendChild(s('path', { class: P + '-vale', d: cam(RIO), 'stroke-width': f1(Math.max(6, 8 * k)) }));
      svg.appendChild(terra);
      svg.appendChild(s('path', { class: P + '-costa', d: cam(G.TERRA, true) }));
      [RIO, G.ROSETA, G.DAMIETA].forEach(function (r) { svg.appendChild(s('path', { class: P + '-rio', d: cam(r) })); });
      svg.appendChild(s('ellipse', { class: P + '-lago', cx: f1(X(30.62)), cy: f1(Y(29.47)), rx: f1(8 * k), ry: f1(2.6 * k) }));
      G.OASIS.forEach(function (o) {
        svg.appendChild(s('circle', { class: P + '-oasis', cx: f1(X(o[1])), cy: f1(Y(o[2])), r: f1(Math.max(3, 3.4 * k)) }));
        if (k >= 1.12) svg.appendChild(s('text', { class: P + '-lug ' + P + '-leve', x: f1(X(o[1]) + 7), y: f1(Y(o[2]) + 4) }, o[0]));
      });
      svg.appendChild(s('text', { class: P + '-lug ' + P + '-lrio', x: f1(X(31.9)), y: f1(Y(27.5)) }, 'Nilo'));
      // gente e gado
      var rp = Math.max(2.5, 2.7 * k), rg = Math.max(2.3, 2.5 * k), pontos = s('g', { 'aria-hidden': 'true' });
      function gente() { return s('circle', { class: P + '-gente', r: f1(rp) }); }
      function gado() { return s('path', { class: P + '-gado', d: 'M0 ' + f1(-rg) + 'L' + f1(rg) + ' 0L0 ' + f1(rg) + 'L' + f1(-rg) + ' 0Z' }); }
      var fixos = FIXOS.map(function (q, j) {
        var e = pontos.appendChild(gente()); e.setAttribute('transform', 'translate(' + f1(X(q.p[0])) + ' ' + f1(Y(q.p[1])) + ')');
        var b = null; if (j % 2 === 0) { b = pontos.appendChild(gado()); b.setAttribute('transform', 'translate(' + f1(X(q.p[0]) + rp * 2.3) + ' ' + f1(Y(q.p[1]) + rp * .9) + ')'); }
        return { q: q, e: e, b: b };
      });
      var grupos2 = GRUPOS.map(function (g) {
        var a = [X(g.casa[0]), Y(g.casa[1])], b = [X(g.dest[0]), Y(g.dest[1])], dx = b[0] - a[0], dy = b[1] - a[1], lado = (g.fase > 3.14 ? 1 : -1) * .16;
        var els = [pontos.appendChild(gente())], j; for (j = 0; j < g.gado; j++) els.push(pontos.appendChild(gado()));
        return { g: g, a: a, b: b, c: [(a[0] + b[0]) / 2 - dy * lado, (a[1] + b[1]) / 2 + dx * lado], els: els };
      });
      svg.appendChild(pontos);
      // lugares com rótulo
      var marcos = lugares.map(function (L) {
        var x = X(L.o.lon), y = Y(L.o.lat), m = s('circle', { class: P + '-marco', cx: f1(x), cy: f1(y), r: 5.5 });
        svg.appendChild(m);
        svg.appendChild(s('text', { class: P + '-lug', x: f1(x + L.lado * 10), y: f1(y + 4), 'text-anchor': L.lado < 0 ? 'end' : 'start' }, L.rot));
        return { L: L, m: m };
      });
      mapaBox.textContent = ''; mapaBox.appendChild(svg);
      M = { Y: Y, k: k, H: H, cortina: cortina, fx: fx, NF: NF, lagos: elLagos, fixos: fixos, grupos: grupos2, marcos: marcos, rp: rp, antes: {} };
    }

    // ----- a régua -----
    var Rg = null;
    function fazRegua(w) {
      var POL = 13, x0 = POL, x1 = w - POL, H = 76, yF = 26, i, a;
      function xT(tt) { return x0 + (tt - T0) / (T1 - T0) * (x1 - x0); }
      var id = 'pcr' + (++UID), svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, 'aria-hidden': 'true' });
      var paradas = [], lat, soma, n;
      for (i = 0; i <= 22; i++) {
        a = mix(T0, T1, i / 22); soma = 0; n = 0;
        for (lat = 22.2; lat <= 31.2; lat += .5) { soma += verde(lat, frente(a)); n++; }
        paradas.push(s('stop', { offset: f1(i / 22 * 100) + '%', style: 'stop-color:color-mix(in srgb,var(--pcs-verde) ' + Math.round(soma / n * 100) + '%,var(--pcs-areia))' }));
      }
      svg.appendChild(s('defs', null, s('linearGradient', { id: id, x1: 0, y1: 0, x2: 1, y2: 0 }, paradas)));
      svg.appendChild(s('rect', { class: P + '-faixa', x: x0, y: yF, width: x1 - x0, height: 12, rx: 6, fill: 'url(#' + id + ')' }));
      // fatos datados: uma marca por data
      var marcas = grupos.map(function (g) { return svg.appendChild(s('circle', { class: P + '-fm', cx: f1(xT(g.t)), cy: yF - 9, r: 3 })); });
      // milênios
      for (a = Math.ceil(T0 / 1000) * 1000; a <= T1; a += 1000) {
        svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + f1(xT(a)) + ' ' + (yF + 16) + 'v5' }));
        if (xT(a) > x1 - 62 && a !== T1) continue; // perto do fim, fica só o rótulo do fim
        if (a === T1) continue;
        svg.appendChild(s('text', { class: P + '-rt', x: f1(xT(a) - (a === T0 ? POL - 1 : 0)), y: yF + 36, 'text-anchor': a === T0 ? 'start' : 'middle' }, U.ano(a).replace(' a.C.', '')));
      }
      svg.appendChild(s('path', { class: P + '-eixo', d: 'M' + f1(x1) + ' ' + (yF + 16) + 'v5' }));
      svg.appendChild(s('text', { class: P + '-rt', x: f1(x1 + POL - 1), y: yF + 36, 'text-anchor': 'end' }, U.ano(T1)));
      reguaBox.textContent = ''; reguaBox.appendChild(svg); reguaBox.appendChild(range);
      Rg = { marcas: marcas };
    }

    // ----- o estado de cada ano -----
    var grupoAtual = -1;
    function mostra(inteiro) {
      var F = frente(t), i, j, v, e, ta = Math.round(t / PASSO) * PASSO;
      // textos
      var ga = 0; for (i = 0; i < grupos.length; i++) if (grupos[i].t <= t + 1) ga = i;
      anoB.textContent = rotAno(ta);
      anoS.textContent = (t < tCh ? 'a chuva chega' : t <= tRe ? (t < tG0 ? 'savana e lagos de chuva' : 'savana, lagos e gado') : t < T1 ? 'a chuva recua para o sul' : 'o Saara volta a ser deserto') + ' · há ' + U.int(Math.round(U.anosAtras(ta) / 100) * 100) + ' anos';
      if (String(range.value) !== String(ta)) range.value = ta;
      range.setAttribute('aria-valuetext', anoB.textContent + ': ' + anoS.textContent.split(' · ')[0]);
      if (ga !== grupoAtual || inteiro) {
        grupoAtual = ga; fatoTxt.textContent = '';
        grupos[ga].fs.forEach(function (f) {
          var selo = seloDe(f);
          fatoTxt.appendChild(h('p', null, h('i', null, txt(f.ano_txt) || U.ano(f.ano)), h('b', null, txt(f.titulo)), selo ? h('small', null, selo) : null));
        });
      }
      btAnt.disabled = t <= T0; btProx.disabled = ga === grupos.length - 1 && t >= T1;
      if (fimBox) {
        v = t >= (typeof fTese.ano === 'number' ? fTese.ano : T1);
        if (fimBox.classList.contains(P + '-vis') !== v || inteiro) { fimBox.classList.toggle(P + '-vis', v); tese.setAttribute('aria-hidden', v ? 'false' : 'true'); perg.setAttribute('aria-hidden', v ? 'true' : 'false'); }
      }
      if (Rg) Rg.marcas.forEach(function (m, k2) { m.setAttribute('class', P + '-fm' + (k2 === ga ? ' ' + P + '-sel' : k2 < ga ? ' ' + P + '-foi' : '')); m.setAttribute('r', k2 === ga ? 4.5 : 3); });
      if (!M) return;
      // o verde
      M.cortina.setAttribute('transform', 'translate(0 ' + f1(M.Y(F + FAIXA)) + ')');
      for (i = 0; i < M.NF; i++) {
        v = Math.round(verde(21.6 + (i + .5) * 10.2 / M.NF, F) * 20) / 20;
        if (M.antes['f' + i] !== v) { M.antes['f' + i] = v; M.fx.mato[i].setAttribute('opacity', v); M.fx.duna[i].setAttribute('opacity', 1 - v); }
      }
      for (i = 0; i < M.lagos.length; i++) {
        v = Math.round(verde(LAGOS[i][1], F - .5) * 20) / 20;
        if (M.antes['l' + i] !== v) { M.antes['l' + i] = v; M.lagos[i].style.opacity = v; M.lagos[i].style.transform = 'scale(' + (.4 + v * .6).toFixed(2) + ')'; }
      }
      // gente e gado
      for (i = 0; i < M.fixos.length; i++) {
        e = M.fixos[i]; v = t >= e.q.desde ? 1 : 0; if (e.v !== v) { e.v = v; e.e.style.opacity = v; }
        if (e.b) { v = t >= Math.max(e.q.desde, tG1) ? 1 : 0; if (e.vb !== v) { e.vb = v; e.b.style.opacity = v; } }
      }
      for (i = 0; i < M.grupos.length; i++) {
        e = M.grupos[i]; var g = e.g, u = suave((t - g.sai) / g.dura), x, y, op, w1 = Math.sin(t / 170 + g.fase), w2 = Math.cos(t / 230 + g.fase * 1.7);
        if (u <= 0) { x = e.a[0] + w1 * 3.4 * M.k; y = e.a[1] + w2 * 2.6 * M.k; }
        else { x = (1 - u) * (1 - u) * e.a[0] + 2 * u * (1 - u) * e.c[0] + u * u * e.b[0]; y = (1 - u) * (1 - u) * e.a[1] + 2 * u * (1 - u) * e.c[1] + u * u * e.b[1]; x += (1 - u) * w1 * 3.4 * M.k; y += (1 - u) * w2 * 2.6 * M.k; }
        op = lim((t - g.entra) / 160, 0, 1) * (g.sul ? 1 - suave((u - .45) / .45) : 1);
        var opG = op * lim((t - g.tGado) / 160, 0, 1);
        for (j = 0; j < e.els.length; j++) {
          e.els[j].setAttribute('transform', 'translate(' + f1(x + (j ? (j === 1 ? M.rp * 2.3 : -M.rp * 1.6) : 0)) + ' ' + f1(y + (j ? (j === 1 ? M.rp * .9 : M.rp * 2) : 0)) + ')');
          e.els[j].style.opacity = (j ? opG : op).toFixed(2);
        }
      }
      // lugar do fato da vez
      var lf = null; grupos[ga].fs.forEach(function (f) { lf = lf || lugarDoFato(f); });
      M.marcos.forEach(function (m) { m.m.setAttribute('class', P + '-marco' + (m.L === lf ? ' ' + P + '-sel' : '')); });
    }

    // ----- andar no tempo -----
    function rotuloToca() {
      btToca.textContent = ''; btToca.appendChild(icone(tocando ? IC_PARA : IC_TOCA));
      btToca.appendChild(document.createTextNode(tocando ? 'Pausar' : t >= T1 ? 'De novo' : 'Rodar'));
      btToca.setAttribute('aria-label', tocando ? 'Pausar a animação' : t >= T1 ? 'Rodar a animação de novo' : 'Rodar a animação');
      fatoTxt.setAttribute('aria-live', tocando ? 'off' : 'polite');
    }
    function para() { tocando = false; cancelAnimationFrame(rafA); rotuloToca(); }
    function vel(tt) { return tt < tCh ? (tCh - T0) / 1.8 : tt < tRe ? (tRe - tCh) / 7.5 : (T1 - tRe) / 8.5; } // anos por segundo
    function quadro(ts) {
      if (!tocando) return;
      if (antesA) t = Math.min(T1, t + vel(t) * Math.min(100, ts - antesA) / 1000);
      antesA = ts; mostra();
      if (t >= T1) { para(); return; }
      rafA = requestAnimationFrame(quadro);
    }
    function toca() { if (t >= T1) t = T0; tocando = true; antesA = 0; rotuloToca(); rafA = requestAnimationFrame(quadro); }
    btToca.addEventListener('click', function () { mexeu = true; if (tocando) para(); else toca(); });
    function salta(dir) {
      mexeu = true; para();
      var i, alvo = null;
      if (dir > 0) { for (i = 0; i < grupos.length; i++) if (grupos[i].t > t + 1) { alvo = grupos[i].t; break; } if (alvo == null) alvo = T1; }
      else { for (i = grupos.length - 1; i >= 0; i--) if (grupos[i].t < t - 1) { alvo = grupos[i].t; break; } if (alvo == null) alvo = T0; }
      t = alvo; mostra(); rotuloToca();
    }
    btAnt.addEventListener('click', function () { salta(-1); });
    btProx.addEventListener('click', function () { salta(1); });
    range.addEventListener('input', function () { mexeu = true; if (tocando) para(); t = lim(parseFloat(range.value), T0, T1); mostra(); rotuloToca(); });
    range.addEventListener('pointerdown', function () { mexeu = true; if (tocando) para(); });

    colB.appendChild(painel); if (fimBox) colB.appendChild(fimBox);
    el.appendChild(nota);
    el.appendChild(tabelaSegura(U, P, 'Ver os fatos da régua', ['Quando', 'O quê', 'Conferência'], grupos.reduce(function (r, g) {
      return r.concat(g.fs.map(function (f) { return [txt(f.ano_txt), txt(f.titulo), seloDe(f) || 'conferido']; }));
    }, [])));
    var fonteDe = fFim && fFim.fonte ? fFim : fTese;
    if (fonteDe && fonteDe.fonte) el.appendChild(U.fonte(txt(fonteDe.fonte), fonteDe.url));

    U.aoMedir(el, function (larg) {
      var largo = larg >= 860, a = largo ? Math.min(560, Math.round((larg - 48) * .5)) : Math.min(larg, 560), b = largo ? larg - 48 - a : larg;
      el.classList.toggle(P + '-largo', largo); el.style.setProperty('--pcs-a', a + 'px');
      fazMapa(a); fazRegua(Math.min(b, 720)); mostra(true); rotuloToca();
    });
    U.aoVer(mapaBox, function (v) {
      if (v && !visto && !U.reduz && !mexeu) { visto = true; toca(); }
      else if (!v && tocando) { para(); if (!mexeu) visto = false; } // saiu da tela no meio: recomeça de onde parou quando voltar
    }, { uma: false, margem: '0px 0px -25% 0px' });
  });

  // =====================================================================================================
  // PEDRA-DE-MAR: "A pirâmide é feita de mar" (camada antes-dos-humanos; serve também na imperio-antigo)
  // args.solto = true desliga o modo em que o palco fica preso na tela enquanto a página rola (ver "rolagem", mais abaixo).
  // De onde vem cada número (tudo lido de dados.json na hora de desenhar; a peça procura as duas camadas pelo id):
  //   idade do calcário ............... número "Idade do calcário de Gizé (Formação Mokattam)", da camada antes-dos-humanos:
  //                                     as fontes divergem, então a peça mostra a faixa inteira (do menor ao maior valor)
  //   fim dos numulitos ............... texto do fato "A pedra das pirâmides é fundo de mar" ("há cerca de 33,9 milhões de anos")
  //   cerca de 2,3 milhões de blocos .. número "Blocos da Grande Pirâmide (estimativa)", da camada imperio-antigo
  //   c. 2560 a.C. .................... ano do fato "A Grande Pirâmide em números" (imperio-antigo)
  //   proporção da silhueta ........... números "Altura original da Grande Pirâmide" e "Lado da base da Grande Pirâmide"
  //   "cerca de N mil vezes mais velha" é conta feita aqui: o meio da faixa de idade da pedra dividido pela idade da obra.
  //   O bloco e o fóssil não têm medida nos dados: são desenhos, sem escala.
  // =====================================================================================================
  function cssPedra() {
    var p = 'pc-pedra-de-mar';
    return '.pc-pedra-de-mar{--pcp-pedra:color-mix(in srgb,#c9ad78 88%,var(--s2));--pcp-sombra:color-mix(in srgb,#a3854f 88%,var(--s2));--pcp-claro:color-mix(in srgb,#f1e5c4 92%,var(--s2));--pcp-traco:#57452a;--pcp-k:1}' +
      cssTopo(p) +
      '.pc-pedra-de-mar-gruda{display:grid;gap:14px 44px;align-items:center}' +
      '.pc-pedra-de-mar-largo .pc-pedra-de-mar-gruda{grid-template-columns:var(--pcp-a) minmax(0,1fr)}' +
      '.pc-pedra-de-mar-palco{margin:0;grid-row:span 2}' +
      '.pc-pedra-de-mar:not(.pc-pedra-de-mar-largo) .pc-pedra-de-mar-palco{grid-row:auto;order:2}' +
      '.pc-pedra-de-mar:not(.pc-pedra-de-mar-largo) .pc-pedra-de-mar-bts{order:1}.pc-pedra-de-mar:not(.pc-pedra-de-mar-largo) .pc-pedra-de-mar-leg{order:3}' +
      '.pc-pedra-de-mar-largo .pc-pedra-de-mar-bts{align-self:end}.pc-pedra-de-mar-largo .pc-pedra-de-mar-leg{align-self:start}' +
      '.pc-pedra-de-mar-bts .pc-botoes button{min-height:44px;padding:0 16px}' +
      '.pc-pedra-de-mar-fundo{fill:var(--s1)}' +
      '.pc-pedra-de-mar-borda{fill:none;stroke:var(--linha);stroke-width:1}' +
      '.pc-pedra-de-mar-chao{fill:var(--pcp-pedra);opacity:.16}' +
      '.pc-pedra-de-mar-pedra{fill:var(--pcp-pedra)}' +
      '.pc-pedra-de-mar-sombra{fill:var(--pcp-sombra)}' +
      '.pc-pedra-de-mar-viz{fill:color-mix(in srgb,var(--pcp-sombra) 45%,var(--pcp-pedra))}' +
      '.pc-pedra-de-mar-claro{fill:var(--pcp-claro)}' +
      '.pc-pedra-de-mar-l{fill:none;stroke:var(--pcp-traco);stroke-width:calc(var(--pcp-k) * 1px);stroke-linecap:round;stroke-linejoin:round}' +
      '.pc-pedra-de-mar-l.pc-pedra-de-mar-lf{opacity:.3}.pc-pedra-de-mar-l.pc-pedra-de-mar-lm{opacity:.55}.pc-pedra-de-mar-l.pc-pedra-de-mar-lg{stroke-width:calc(var(--pcp-k) * 1.8px)}' +
      '.pc-pedra-de-mar-disco{fill:var(--pcp-claro);stroke:var(--pcp-traco);stroke-opacity:.5;stroke-width:calc(var(--pcp-k) * .8px)}' +
      '.pc-pedra-de-mar-alvo{fill:none;stroke:var(--acento);stroke-width:calc(var(--pcp-k) * 2px);stroke-linejoin:round}' +
      '.pc-pedra-de-mar-halo{fill:none;stroke:var(--s1);stroke-width:calc(var(--pcp-k) * 5px);stroke-linejoin:round;opacity:.9}' +
      '.pc-pedra-de-mar-rt{font:600 11.5px var(--sem);fill:var(--tinta)}' +
      '.pc-pedra-de-mar-fio{fill:none;stroke:var(--tinta2);stroke-width:1}' +
      '.pc-pedra-de-mar-rt.pc-pedra-de-mar-esc{fill:#3b2e17;paint-order:stroke;stroke:var(--pcp-claro);stroke-width:3.5px;stroke-linejoin:round}' +
      '.pc-pedra-de-mar-fio.pc-pedra-de-mar-esc{stroke:#3b2e17;opacity:.8}' +
      '.pc-pedra-de-mar-leg{margin:0;padding:0;list-style:none;display:grid;gap:14px}' +
      '.pc-pedra-de-mar-leg li{border-left:2px solid var(--linha);padding:2px 0 2px 16px;opacity:.5;transition:opacity .35s ease,border-color .35s ease}' +
      '.pc-pedra-de-mar-leg li.pc-pedra-de-mar-at{opacity:1;border-color:var(--acento)}' +
      '.pc-pedra-de-mar-leg b{display:block;font:600 clamp(19px,2.2vw,23px)/1.2 var(--serifa)}' +
      '.pc-pedra-de-mar-leg i{font:700 12px var(--sem);font-style:normal;letter-spacing:.12em;color:var(--tinta2);display:block;margin-bottom:3px}' +
      '.pc-pedra-de-mar-leg p{margin:6px 0 0;font-size:15.5px;line-height:1.5;color:var(--tinta);max-width:32em}' +
      '.pc-pedra-de-mar-uma .pc-pedra-de-mar-leg{display:block;min-height:var(--pcp-leg,0)}' +
      '.pc-pedra-de-mar-uma .pc-pedra-de-mar-leg li{display:none}.pc-pedra-de-mar-uma .pc-pedra-de-mar-leg li.pc-pedra-de-mar-at{display:block}' +
      '.pc-pedra-de-mar-trilho{position:relative}' +
      '@media (prefers-reduced-motion: reduce){.pc-pedra-de-mar-leg li{transition:none}}';
  }

  E.peca('pedra-de-mar', function (el, dados, U, args) {
    s = U.s; var h = U.h, P = 'pc-pedra-de-mar';
    var cm = camadaCerta(dados, args, 'antes-dos-humanos'), cp = camadaCerta(dados, args, 'imperio-antigo');
    if (!cm) return;
    var fPedra = acha(cm.fatos, /pedra das pir[âa]mides/i) || acha(cm.fatos, /numulit/i, 'texto');
    var nIdade = acha(cm.numeros, /calc[áa]rio de Giz[ée]/i, 'rotulo');
    var idades = numeros(nIdade ? nIdade.valor : fPedra ? fPedra.ano_txt : '').filter(function (n) { return n > 1 && n < 500; });
    if (!fPedra || idades.length < 2) return;
    var idMin = Math.min.apply(null, idades), idMax = Math.max.apply(null, idades);
    var some = (/h[áa] cerca de (\d+(?:,\d+)?) milh[õo]es de anos/.exec(txt(fPedra.texto)) || [])[1];
    var nBlocos = cp && acha(cp.numeros, /^Blocos da Grande Pir/i, 'rotulo'), fPir = cp && acha(cp.fatos, /Grande Pir[âa]mide em n[úu]meros/i);
    var nAlt = cp && acha(cp.numeros, /^Altura original da Grande Pir/i, 'rotulo'), nLado = cp && acha(cp.numeros, /^Lado da base da Grande Pir/i, 'rotulo');
    var alt = nAlt ? numeros(nAlt.valor)[0] : 0, lado = nLado ? numeros(nLado.valor)[0] : 0;
    var razao = alt > 50 && lado > 50 ? alt / lado : .64; // sem os números, a silhueta fica só como desenho
    var anoPir = fPir && typeof fPir.ano === 'number' ? fPir.ano : null;

    poeEstilo('pc-pedra-de-mar-css', cssPedra());
    el.classList.add(P);
    var faixaTxt = 'entre ' + U.dec(idMin) + ' e ' + U.dec(idMax) + ' milhões de anos';
    var quadros = [
      { rot: 'pirâmide', tit: 'A obra', txt: 'A Grande Pirâmide de Gizé' + (anoPir ? ', de c. ' + U.ano(anoPir) + ',' : '') + (nBlocos ? ' tem ' + txt(nBlocos.valor) + ' de blocos. ' : ' é feita de blocos. ') + 'A pedra é o calcário do próprio planalto.' },
      { rot: 'bloco', tit: 'A pedra', txt: 'De perto, o bloco está cheio de discos em forma de moeda. É fundo de mar endurecido, e muito mais velho que a obra: tem ' + faixaTxt + ', conforme a fonte.' },
      { rot: 'fóssil', tit: 'O fóssil', txt: 'Cada disco é um numulito: a carapaça de um ser marinho de uma célula só, que vivia no mar de Tétis. Por dentro, uma espiral de pequenas câmaras.' + (some ? ' Os numulitos somem do registro fóssil há cerca de ' + some + ' milhões de anos.' : '') }
    ];
    var z = 0, alvoZ = 0, rafZ = 0, preso = false, manual = false, topoPx = 20, Pc = null;
    var palcoBox = h('figure', { class: P + '-palco' });
    var leg = h('ol', { class: P + '-leg' }, quadros.map(function (q, i) {
      return h('li', null, h('i', null, (i + 1) + ' de 3'), h('b', null, q.tit), h('p', null, q.txt));
    }));
    var bts = U.botoes(quadros.map(function (q, i) { return { id: i, rotulo: q.rot }; }), 0, function (i) { manual = true; irPara(i); }, 'Aproximação');
    var gruda = h('div', { class: P + '-gruda' }, palcoBox, h('div', { class: P + '-bts' }, bts), leg);
    var trilho = h('div', { class: P + '-trilho' }, gruda);
    var introP = h('p', { class: P + '-intro' });
    var cab = h('header', { class: P + '-topo' }, h('p', { class: P + '-rot' }, 'De ' + U.dec(idMax) + ' a ' + U.dec(idMin) + ' milhões de anos atrás'), h('h3', { class: P + '-tit' }, 'A pirâmide é feita de mar'), introP);
    el.appendChild(cab); el.appendChild(trilho);
    var obra = anoPir ? Math.round(U.anosAtras(anoPir) / 100) * 100 : 0;
    el.appendChild(h('p', { class: 'pc-nota' }, 'O que ver aqui: três aproximações da mesma pedra, sem escala. ' +
      (obra ? 'A obra tem cerca de ' + U.int(obra) + ' anos; a pedra é cerca de ' + U.int(Math.round((idMin + idMax) / 2 * 1e6 / obra / 1000)) + ' mil vezes mais velha. ' : '') +
      'Em Gizé, dá para procurar esses discos nos blocos, de perto.'));
    var linhas = [];
    if (nIdade) linhas.push([txt(nIdade.rotulo), txt(nIdade.valor), U.link(txt(nIdade.fonte), nIdade.url)]);
    if (some) linhas.push(['Fim dos numulitos no registro fóssil', 'há cerca de ' + some + ' milhões de anos', U.link(txt(fPedra.fonte), fPedra.url)]);
    [nBlocos, nAlt, nLado].forEach(function (n) { if (n) linhas.push([txt(n.rotulo), txt(n.valor), U.link(txt(n.fonte), n.url)]); });
    el.appendChild(tabelaSegura(U, P, 'Ver os números', ['O quê', 'Valor', 'Fonte'], linhas));
    if (fPedra.fonte) el.appendChild(U.fonte(txt(fPedra.fonte), fPedra.url));

    // ----- o palco: três camadas, uma dentro da outra -----
    function fazPalco(w) {
      var H = Math.round(w * .76), C = [w / 2, H / 2], id = 'pcp' + (++UID), R = semente(41), e = w / 350, i;
      var svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img',
        'aria-label': 'Três aproximações: a silhueta da Grande Pirâmide; um bloco de calcário cheio de discos; e um desses discos visto por dentro, um numulito, com a espiral dividida em câmaras.' });
      svg.appendChild(s('defs', null, s('clipPath', { id: id + 'q' }, s('rect', { x: .5, y: .5, width: w - 1, height: H - 1, rx: 14 }))));
      var cena = s('g', { 'clip-path': 'url(#' + id + 'q)' });
      cena.appendChild(s('rect', { class: P + '-fundo', x: 0, y: 0, width: w, height: H }));

      // B: o bloco (desenhado em volta de 0,0)
      var wB = w * .7, hB = H * .56, junta = 5 * e;
      // A: a pirâmide
      var yG = H * .84, bw = w * .74, ph = bw * razao; if (ph > H * .66) { ph = H * .66; bw = ph / razao; }
      var ax = w * .5, apice = [ax, yG - ph], bl = [ax - bw / 2, yG], br = [ax + bw / 2, yG], quina = [ax + bw * .2, yG];
      var mw = Math.max(13, 15 * e), mh = mw * hB / wB, FA = [ax - bw * .13, yG - ph * .3];
      var A = s('g');
      A.appendChild(s('rect', { class: P + '-chao', x: -w, y: f1(yG), width: w * 3, height: H }));
      A.appendChild(s('path', { class: P + '-pedra', d: 'M' + f1(bl[0]) + ' ' + f1(bl[1]) + 'L' + f1(apice[0]) + ' ' + f1(apice[1]) + 'L' + f1(br[0]) + ' ' + f1(br[1]) + 'Z' }));
      A.appendChild(s('path', { class: P + '-sombra', d: 'M' + f1(quina[0]) + ' ' + f1(quina[1]) + 'L' + f1(apice[0]) + ' ' + f1(apice[1]) + 'L' + f1(br[0]) + ' ' + f1(br[1]) + 'Z' }));
      var fiadas = '', f, n = 15;
      for (i = 1; i < n; i++) { f = i / n; fiadas += 'M' + f1(mix(bl[0], apice[0], f)) + ' ' + f1(yG - ph * f) + 'H' + f1(mix(br[0], apice[0], f)); }
      A.appendChild(s('path', { class: P + '-l ' + P + '-lf', d: fiadas }));
      A.appendChild(s('path', { class: P + '-l ' + P + '-lm', d: 'M' + f1(-w) + ' ' + f1(yG) + 'H' + f1(w * 2) }));
      A.appendChild(s('rect', { class: P + '-halo', x: f1(FA[0] - mw / 2), y: f1(FA[1] - mh / 2), width: f1(mw), height: f1(mh), rx: f1(mw * .08) }));
      A.appendChild(s('rect', { class: P + '-alvo', x: f1(FA[0] - mw / 2), y: f1(FA[1] - mh / 2), width: f1(mw), height: f1(mh), rx: f1(mw * .08) }));

      var B = s('g');
      function bloco(x, y, ww, hh, cl) { // contorno um pouco torto, de pedra cortada à mão
        var p = [], k2, nn, t2;
        nn = Math.max(2, Math.round(ww / (34 * e))); for (k2 = 0; k2 <= nn; k2++) { t2 = k2 / nn; p.push([x + lim(ww * t2, 7 * e, ww - 7 * e), y + (R() - .5) * 2.4 * e]); }
        nn = Math.max(2, Math.round(hh / (34 * e))); for (k2 = 0; k2 <= nn; k2++) { t2 = k2 / nn; p.push([x + ww + (R() - .5) * 2.4 * e, y + lim(hh * t2, 7 * e, hh - 7 * e)]); }
        nn = Math.max(2, Math.round(ww / (34 * e))); for (k2 = 0; k2 <= nn; k2++) { t2 = k2 / nn; p.push([x + ww - lim(ww * t2, 7 * e, ww - 7 * e), y + hh + (R() - .5) * 2.4 * e]); }
        nn = Math.max(2, Math.round(hh / (34 * e))); for (k2 = 0; k2 <= nn; k2++) { t2 = k2 / nn; p.push([x + (R() - .5) * 2.4 * e, y + hh - lim(hh * t2, 7 * e, hh - 7 * e)]); }
        return s('path', { class: P + '-' + cl, d: curva(p, true) });
      }
      // a parede em volta: fiadas com as juntas desencontradas
      var x0 = -wB / 2, y0 = -hB / 2;
      [[x0 - wB * .62 - junta, y0 - hB - junta, wB * 1.02, hB], [x0 + wB * .4, y0 - hB - junta, wB * 1.25, hB],
       [x0 - wB - junta, y0, wB, hB], [x0 + wB + junta, y0, wB, hB],
       [x0 - wB * .75 - junta, y0 + hB + junta, wB * 1.03, hB], [x0 + wB * .28, y0 + hB + junta, wB * 1.3, hB]].forEach(function (q) { B.appendChild(bloco(q[0], q[1], q[2], q[3], 'viz')); });
      B.appendChild(bloco(x0, y0, wB, hB, 'pedra'));
      // veios e discos
      var veios = '';
      for (i = 0; i < 3; i++) { var yv = y0 + hB * (.22 + i * .28) + (R() - .5) * 8 * e; veios += 'M' + f1(x0 + 10 * e) + ' ' + f1(yv) + 'q' + f1(wB * .25) + ' ' + f1((R() - .5) * 10 * e) + ' ' + f1(wB * .5 - 10 * e) + ' ' + f1((R() - .5) * 6 * e) + 't' + f1(wB * .5 - 10 * e) + ' ' + f1((R() - .5) * 6 * e); }
      B.appendChild(s('path', { class: P + '-l ' + P + '-lf', d: veios }));
      var FB = [wB * .14, -hB * .04], rB = 9 * e, postos = [[FB[0], FB[1], rB * 2.4]], v = 0, dx, dy, rr, ok, de, x, y;
      function espiralzinha(cx2, cy2, r2, voltas) { var d2 = '', j, a2, q2; for (j = 0; j <= 40; j++) { a2 = j / 40 * Math.PI * 2 * voltas + 1; q2 = r2 * (.14 + .72 * j / 40); d2 += (j ? 'L' : 'M') + f1(cx2 + Math.cos(a2) * q2) + ' ' + f1(cy2 + Math.sin(a2) * q2); } return d2; }
      var nDiscos = 0;
      while (nDiscos < 64 && v++ < 3000) {
        x = (R() - .5) * (w + 40); y = (R() - .5) * (H + 40); rr = (3.4 + R() * R() * 6) * e; de = Math.abs(x) < wB / 2 && Math.abs(y) < hB / 2;
        // nada em cima das juntas
        dx = Math.abs(Math.abs(x) - wB / 2 - junta / 2); dy = Math.abs(Math.abs(y) - hB / 2 - junta / 2);
        if (dx < rr + junta || dy < rr + junta) continue;
        if (!de && Math.abs(y) < hB / 2 === false && Math.abs(x - (y < 0 ? x0 + wB * .4 - junta / 2 : x0 + wB * .28 - junta / 2)) < rr + junta) continue;
        ok = postos.every(function (q) { return Math.hypot(q[0] - x, q[1] - y) > q[2] + rr + 2.5 * e; });
        if (!ok) continue;
        postos.push([x, y, rr]); nDiscos++;
        if (R() < .58) {
          B.appendChild(s('circle', { class: P + '-disco', cx: f1(x), cy: f1(y), r: f1(rr), opacity: de ? 1 : .7 }));
          if (rr > 5.5 * e) B.appendChild(s('path', { class: P + '-l ' + P + '-lf', d: espiralzinha(x, y, rr, 1.6) }));
        } else B.appendChild(s('ellipse', { class: P + '-disco', cx: f1(x), cy: f1(y), rx: f1(rr * 1.15), ry: f1(rr * .36), transform: 'rotate(' + Math.round(R() * 180) + ' ' + f1(x) + ' ' + f1(y) + ')', opacity: de ? 1 : .7 }));
      }
      B.appendChild(s('circle', { class: P + '-disco', cx: f1(FB[0]), cy: f1(FB[1]), r: f1(rB) }));
      B.appendChild(s('path', { class: P + '-l ' + P + '-lf', d: espiralzinha(FB[0], FB[1], rB, 2.2) }));
      var anel = B.appendChild(s('circle', { class: P + '-alvo', cx: f1(FB[0]), cy: f1(FB[1]), r: f1(rB + 3.5 * e) }));

      // C: o numulito por dentro (em volta de 0,0)
      var RC = Math.min(w, H) * .4, Cg = s('g'), r0 = RC * .06, voltas = 6, borda = RC * .955, passo = (borda - r0) / voltas, d = '', a, sep = '', ang, r1, r2, da;
      function raio(t2) { return r0 + passo * t2 / (Math.PI * 2); }
      function pol(r3, t2) { return f1(Math.cos(t2) * r3) + ' ' + f1(Math.sin(t2) * r3); }
      Cg.appendChild(s('circle', { class: P + '-claro', cx: 0, cy: 0, r: f1(RC) }));
      for (i = 0; i <= voltas * 72; i++) { a = i / 72 * Math.PI * 2; d += (i ? 'L' : 'M') + pol(raio(a), a); }
      Cg.appendChild(s('path', { class: P + '-l ' + P + '-lg', d: d }));
      ang = Math.PI * .6;
      while (ang < voltas * Math.PI * 2) {
        r1 = raio(ang); r2 = Math.min(borda, r1 + passo); da = Math.min(1.1, passo * .92 / r1);
        if (ang > Math.PI * 2 * (voltas - 1)) r2 = borda;
        sep += 'M' + pol(r1, ang) + 'Q' + pol(mix(r1, r2, .55), ang + da * .16) + ' ' + pol(r2, ang - da * .3);
        ang += da;
      }
      Cg.appendChild(s('path', { class: P + '-l', d: sep }));
      Cg.appendChild(s('circle', { class: P + '-l ' + P + '-lg', cx: 0, cy: 0, r: f1(RC) }));
      Cg.appendChild(s('circle', { class: P + '-sombra', cx: 0, cy: 0, r: f1(r0 * 1.15) }));

      cena.appendChild(A); cena.appendChild(B); cena.appendChild(Cg);
      // rótulos, por cima (não entram no zoom)
      var rotA = s('g');
      rotA.appendChild(s('path', { class: P + '-fio', d: 'M' + f1(FA[0] - mw / 2 - 3) + ' ' + f1(FA[1] - mh / 2 - 3) + 'L' + f1(w * .17) + ' ' + f1(H * .3) }));
      rotA.appendChild(s('text', { class: P + '-rt', x: f1(w * .17 - 2), y: f1(H * .3 - 7), 'text-anchor': 'middle' }, 'um bloco'));
      var rotB = s('g');
      rotB.appendChild(s('path', { class: P + '-fio ' + P + '-esc', d: 'M' + f1(C[0] + FB[0] + rB * 1.1) + ' ' + f1(C[1] + FB[1] - rB * 1.1) + 'L' + f1(C[0] + wB * .33) + ' ' + f1(C[1] - hB * .5 + 20 * e) }));
      rotB.appendChild(s('text', { class: P + '-rt ' + P + '-esc', x: f1(C[0] + wB * .33 + 3), y: f1(C[1] - hB * .5 + 17 * e) }, 'um disco'));
      var rotC = s('g'), aC = -.62, rC2 = raio(Math.PI * 2 * 4.4), xc = C[0] + Math.cos(aC) * (rC2 + passo * .5), yc2 = C[1] + Math.sin(aC) * (rC2 + passo * .5);
      rotC.appendChild(s('path', { class: P + '-fio ' + P + '-esc', d: 'M' + f1(xc) + ' ' + f1(yc2) + 'L' + f1(C[0] + RC + 10 * e) + ' ' + f1(C[1] - RC * .78) }));
      rotC.appendChild(s('text', { class: P + '-rt ' + P + '-esc', x: f1(C[0] + RC + 13 * e), y: f1(C[1] - RC * .78 + 4) }, 'câmara'));
      rotC.appendChild(s('path', { class: P + '-fio ' + P + '-esc', d: 'M' + f1(C[0] - r0 * 1.6) + ' ' + f1(C[1] + r0 * 1.6) + 'L' + f1(C[0] - RC - 10 * e) + ' ' + f1(C[1] + RC * .8) }));
      rotC.appendChild(s('text', { class: P + '-rt ' + P + '-esc', x: f1(C[0] - RC - 12 * e), y: f1(C[1] + RC * .8 + 15), 'text-anchor': 'middle' }, 'começo'));
      cena.appendChild(rotA); cena.appendChild(rotB); cena.appendChild(rotC);
      svg.appendChild(cena);
      svg.appendChild(s('rect', { class: P + '-borda', x: .5, y: .5, width: w - 1, height: H - 1, rx: 14 }));
      palcoBox.textContent = ''; palcoBox.appendChild(svg);
      var G1 = wB / mw, G2 = RC / rB;
      Pc = { A: A, B: B, C: Cg, anel: anel, rotA: rotA, rotB: rotB, rotC: rotC, G1: G1, G2: G2, FA: FA, FB: FB, Cc: C,
        P1: [(G1 * FA[0] - C[0]) / (G1 - 1), (G1 * FA[1] - C[1]) / (G1 - 1)],
        P2: [(G2 * (C[0] + FB[0]) - C[0]) / (G2 - 1), (G2 * (C[1] + FB[1]) - C[1]) / (G2 - 1)] };
    }
    function poe(g, tx, ty, k, op) {
      if (op <= .004) { if (g.style.display !== 'none') g.style.display = 'none'; return; }
      if (g.style.display === 'none') g.style.display = '';
      g.setAttribute('transform', 'translate(' + f1(tx) + ' ' + f1(ty) + ') scale(' + k.toFixed(4) + ')');
      g.style.opacity = op >= .996 ? '' : op.toFixed(3);
    }
    function desenha() {
      if (!Pc) return;
      var e1 = lim(z, 0, 1), e2 = lim(z - 1, 0, 1), g1 = Math.pow(Pc.G1, e1), g2 = Math.pow(Pc.G2, e2), C = Pc.Cc, sx, sy;
      // A: cresce em volta do ponto que mantém o bloco marcado no rumo do centro
      Pc.A.style.setProperty('--pcp-k', (1 / g1).toFixed(4));
      poe(Pc.A, Pc.P1[0] * (1 - g1), Pc.P1[1] * (1 - g1), g1, 1 - suave((e1 - .5) / .42));
      if (z <= 1) {
        sx = Pc.P1[0] + g1 * (Pc.FA[0] - Pc.P1[0]); sy = Pc.P1[1] + g1 * (Pc.FA[1] - Pc.P1[1]);
        Pc.B.style.setProperty('--pcp-k', '1');
        poe(Pc.B, sx, sy, g1 / Pc.G1, suave((e1 - .2) / .45));
        poe(Pc.C, 0, 0, 1, 0);
      } else {
        Pc.B.style.setProperty('--pcp-k', (1 / g2).toFixed(4));
        poe(Pc.B, Pc.P2[0] * (1 - g2) + g2 * C[0], Pc.P2[1] * (1 - g2) + g2 * C[1], g2, 1); // o bloco fica: é a pedra em volta do fóssil
        sx = Pc.P2[0] + g2 * (C[0] + Pc.FB[0] - Pc.P2[0]); sy = Pc.P2[1] + g2 * (C[1] + Pc.FB[1] - Pc.P2[1]);
        poe(Pc.C, sx, sy, g2 / Pc.G2, suave((e2 - .2) / .45));
      }
      Pc.anel.style.opacity = (1 - suave(e2 / .6)).toFixed(3);
      Pc.rotA.style.opacity = (1 - suave(e1 / .18)).toFixed(3);
      Pc.rotB.style.opacity = (suave((e1 - .86) / .14) * (1 - suave(e2 / .18))).toFixed(3);
      Pc.rotC.style.opacity = suave((e2 - .86) / .14).toFixed(3);
    }
    var atual = -1;
    function marca() {
      var i = lim(Math.round(z), 0, 2);
      if (i === atual) return; atual = i;
      Array.prototype.forEach.call(leg.children, function (li, j) { li.classList.toggle(P + '-at', j === i); });
      Array.prototype.forEach.call(bts.children, function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    }
    function anima(alvo) {
      cancelAnimationFrame(rafZ); alvoZ = alvo;
      if (U.reduz) { z = alvo; desenha(); marca(); return; }
      var de = z, t0 = 0, dur = 1050 * Math.max(.7, Math.abs(alvo - de));
      rafZ = requestAnimationFrame(function passo(ts) {
        if (!t0) t0 = ts;
        var u = Math.min(1, (ts - t0) / dur), ee = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        z = de + (alvo - de) * ee; desenha(); marca();
        if (u < 1) rafZ = requestAnimationFrame(passo);
      });
    }

    // ----- rolagem: preso (o palco fica parado e o zoom segue a rolagem) ou solto (o zoom dispara pela posição) -----
    var PARADAS = [.03, .51, .97];
    function zDaRolagem(p) { return p < .1 ? 0 : p < .44 ? suave((p - .1) / .34) : p < .58 ? 1 : p < .9 ? 1 + suave((p - .58) / .32) : 2; }
    function faixaPresa() { return Math.max(1, trilho.offsetHeight - gruda.offsetHeight); }
    function irPara(i) {
      if (preso) {
        var r = trilho.getBoundingClientRect(), y = Math.max(0, window.pageYOffset + r.top - topoPx + PARADAS[i] * faixaPresa());
        if ('scrollBehavior' in document.documentElement.style) window.scrollTo({ top: y, behavior: 'smooth' }); else window.scrollTo(0, y);
      } else anima(i);
    }
    var pedido = false, ouvindo = false;
    function aoRolar() {
      if (pedido) return; pedido = true;
      requestAnimationFrame(function () {
        pedido = false;
        if (preso) {
          var r = trilho.getBoundingClientRect(), fx = faixaPresa();
          var cabe = Math.min(1, (document.documentElement.scrollHeight - window.innerHeight - (window.pageYOffset + r.top) + topoPx) / fx); // se a página acaba antes, o fim da faixa vira o fim da rolagem
          var p = lim((topoPx - r.top) / fx, 0, 1); if (cabe > .2 && cabe < 1) p = lim(p / cabe, 0, 1);
          cancelAnimationFrame(rafZ); z = zDaRolagem(p); desenha(); marca();
        } else if (!U.reduz && !manual) {
          var q = palcoBox.getBoundingClientRect(), meio = (q.top + q.height / 2) / window.innerHeight, alvo = meio > .66 ? 0 : meio > .4 ? 1 : 2;
          if (q.bottom < 0 || q.top > window.innerHeight) return;
          if (alvo !== alvoZ) anima(alvo);
        }
      });
    }
    function semCorte() { // algum pai com rolagem própria ou corte impede o "sticky"
      for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        var o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) return false;
      }
      return true;
    }
    var alturaJanela = 0;
    function arma(larg) {
      var largo = larg >= 860, a = largo ? Math.min(560, Math.round((larg - 44) * .52)) : Math.min(larg, 560);
      el.classList.toggle(P + '-largo', largo); el.style.setProperty('--pcp-a', a + 'px');
      fazPalco(a);
      // tenta prender: só se o conjunto couber inteiro na janela
      alturaJanela = window.innerHeight;
      var barra = window.innerWidth < 1000 ? 58 : 16;
      trilho.style.height = ''; gruda.style.position = ''; gruda.style.top = '';
      el.classList.toggle(P + '-uma', !largo && !U.reduz);
      el.style.removeProperty('--pcp-leg');
      if (!largo && !U.reduz) { // no celular, uma legenda por vez: reserva a altura da maior
        var maior = 0; Array.prototype.forEach.call(leg.children, function (li) { li.style.display = 'block'; maior = Math.max(maior, li.offsetHeight); li.style.display = ''; });
        el.style.setProperty('--pcp-leg', maior + 'px');
      }
      var hG = gruda.offsetHeight;
      preso = !U.reduz && !(args && args.solto) && hG + barra + 12 <= alturaJanela && semCorte() && !!(window.CSS && CSS.supports && CSS.supports('position', 'sticky'));
      if (preso) {
        topoPx = Math.max(barra, Math.round((alturaJanela - hG) / 2));
        var passoPx = lim(Math.round(alturaJanela * .55), 360, 600); // rolagem pedida por cada aproximação
        trilho.style.height = (hG + 2 * passoPx) + 'px'; gruda.style.position = 'sticky'; gruda.style.top = topoPx + 'px';
      } else el.classList.remove(P + '-uma');
      introP.textContent = U.reduz ? 'Três aproximações da mesma pedra. Use os botões.' : 'Três aproximações da mesma pedra. Role a página, ou use os botões.';
      desenha(); atual = -1; marca();
      if (preso) aoRolar();
    }
    var ultimaLarg = 0;
    U.aoMedir(el, function (larg) { ultimaLarg = larg; arma(larg); });
    window.addEventListener('resize', function () { if (ultimaLarg && el.isConnected && Math.abs(window.innerHeight - alturaJanela) > 140) arma(ultimaLarg); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ultimaLarg && el.isConnected) arma(ultimaLarg); });
    U.aoVer(trilho, function (v) {
      if (v && !ouvindo) { ouvindo = true; document.addEventListener('scroll', aoRolar, { passive: true, capture: true }); aoRolar(); }
      else if (!v && ouvindo) { ouvindo = false; document.removeEventListener('scroll', aoRolar, { capture: true }); manual = false; }
    }, { uma: false, margem: '200px 0px 200px 0px' });
  });

})();
