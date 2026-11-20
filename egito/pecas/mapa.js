// Peça "mapa": o Egito desenhado (costa, Nilo, delta, canal, oásis) com os lugares de uma camada.
// args: { pontos: [{ lugar, cidade, lat, lon }], numerar?: boolean, grande?: boolean }
// O contorno é um desenho simplificado a partir de coordenadas aproximadas: serve para situar, não para medir.
(function () {
  'use strict';
  var E = window.EGITO; if (!E) return;

  var LON0 = 24.4, LON1 = 37.1, LAT0 = 32.05, LAT1 = 21.55, K = 38, CX = Math.cos(26.5 * Math.PI / 180);
  var W = Math.round((LON1 - LON0) * CX * K), H = Math.round((LAT0 - LAT1) * K);
  function X(lon) { return (lon - LON0) * CX * K; }
  function Y(lat) { return (LAT0 - lat) * K; }
  function caminho(pts, fecha) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ') + (fecha ? ' Z' : '');
  }
  // [lon, lat]
  var TERRA = [
    [25.15, 31.57], [25.9, 31.62], [26.5, 31.5], [27.24, 31.36], [27.9, 31.1], [28.4, 31.07], [28.95, 30.84], [29.5, 30.97], [29.9, 31.2], [30.1, 31.3],
    [30.37, 31.47], [30.7, 31.55], [31.1, 31.6], [31.5, 31.5], [31.84, 31.52], [32.3, 31.27], [32.6, 31.1], [33.1, 31.1], [33.8, 31.15], [34.22, 31.32],
    [34.9, 29.49], [34.66, 29.03], [34.52, 28.5], [34.33, 27.87], [34.25, 27.73], [33.95, 28.2], [33.62, 28.24], [33.2, 28.9], [33.1, 29.05], [32.7, 29.6], [32.55, 29.97],
    [32.33, 29.6], [32.66, 29.11], [33.08, 28.36], [33.5, 27.8], [33.81, 27.26], [33.94, 26.73], [34.28, 26.1], [34.89, 25.07], [35.47, 23.95], [35.59, 23.13], [36.64, 22.22], [36.88, 22.0],
    [25.0, 22.0], [25.0, 31.3]
  ];
  var NILO = [
    [32.90, 24.09], [32.93, 24.45], [32.87, 24.98], [32.55, 25.29], [32.64, 25.69], [32.72, 26.16], [32.25, 26.05], [31.9, 26.34], [31.69, 26.56], [31.18, 27.18],
    [30.8, 27.75], [30.75, 28.10], [30.9, 28.6], [31.10, 29.07], [31.25, 29.6], [31.24, 30.04], [31.12, 30.18]
  ];
  var LAGO = [[32.88, 23.97], [32.8, 23.5], [32.6, 23.1], [32.2, 22.8], [31.9, 22.6], [31.62, 22.34], [31.4, 22.0]];
  var ROSETA = [[31.12, 30.18], [30.9, 30.55], [30.8, 30.9], [30.55, 31.1], [30.42, 31.40], [30.37, 31.47]];
  var DAMIETA = [[31.12, 30.18], [31.2, 30.47], [31.25, 30.8], [31.38, 31.04], [31.7, 31.3], [31.81, 31.42], [31.84, 31.52]];
  var DELTA = [[31.12, 30.18], [29.9, 31.2], [30.37, 31.47], [31.1, 31.6], [31.84, 31.52], [32.3, 31.27]];
  var CANAL = [[32.30, 31.26], [32.31, 30.86], [32.27, 30.60], [32.35, 30.33], [32.55, 29.97]];
  var OASIS = [['Siwa', 25.52, 29.20], ['Bahariya', 28.86, 28.35], ['Farafra', 27.97, 27.06], ['Dakhla', 29.0, 25.49], ['Kharga', 30.55, 25.44]];
  var CIDADES = [['Cairo', 31.24, 30.04, 'd'], ['Alexandria', 29.92, 31.2, 'e'], ['Luxor', 32.64, 25.69, 'd'], ['Assuã', 32.9, 24.09, 'd'], ['Abu Simbel', 31.62, 22.34, 'e']];

  // a mesma geometria serve às outras peças (EGITO.geo)
  E.geo = { X: X, Y: Y, W: W, H: H, caminho: caminho, TERRA: TERRA, NILO: NILO, LAGO: LAGO, ROSETA: ROSETA, DAMIETA: DAMIETA, DELTA: DELTA, CANAL: CANAL, OASIS: OASIS, CIDADES: CIDADES };

  var estiloPosto = false;
  function estilo() {
    if (estiloPosto) return; estiloPosto = true;
    var st = document.createElement('style');
    st.textContent =
      '.pc-mapa{--rio:#5aa6d8}.pc-mapa.claro{--rio:#2a6fa8}' +
      '.pc-mapa svg{display:block;width:100%;height:auto;overflow:visible}' +
      '.pc-mapa .terra{fill:var(--s2);stroke:var(--linha);stroke-width:1}' +
      '.pc-mapa .delta{fill:var(--rio);opacity:.2}' +
      '.pc-mapa .vale{fill:none;stroke:var(--rio);stroke-width:7;opacity:.16;stroke-linecap:round;stroke-linejoin:round}' +
      '.pc-mapa .rio{fill:none;stroke:var(--rio);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
      '.pc-mapa .lago{fill:none;stroke:var(--rio);stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;opacity:.85}' +
      '.pc-mapa .canal{fill:none;stroke:var(--rio);stroke-width:1.2;stroke-dasharray:3 2.5}' +
      '.pc-mapa .rot{font:500 9.5px var(--sem);fill:var(--tinta2)}' +
      '.pc-mapa .mar{font:italic 400 10.5px var(--serifa);fill:var(--tinta2);letter-spacing:.08em}' +
      '.pc-mapa .oasis{fill:var(--tinta2)}' +
      '.pc-mapa .cid{fill:var(--tinta);opacity:.75}' +
      '.pc-mapa .pino circle{fill:var(--acento);stroke:var(--fundo);stroke-width:1.6;cursor:pointer;transition:r .15s ease}' +
      '.pc-mapa .pino .fio{stroke:var(--acento);stroke-width:1;opacity:.7}' +
      '.pc-mapa .pino text{font:700 8.5px var(--sem);fill:var(--sobre-acento);text-anchor:middle;pointer-events:none}' +
      '.pc-mapa .pino:hover circle,.pc-mapa .pino:focus circle,.pc-mapa .pino.sel circle{r:8.5}' +
      '.pc-mapa .pino:focus{outline:none}' +
      '.pc-mapa .pino{opacity:0;transition:opacity .4s ease}.pc-mapa.vis .pino{opacity:1}' +
      '.pc-mapa .traco{stroke-dasharray:var(--l);stroke-dashoffset:var(--l);transition:stroke-dashoffset 2.2s ease}' +
      '.pc-mapa.vis .traco{stroke-dashoffset:0}' +
      '.pc-mapa .leg{min-height:2.6em;font-size:13.5px;color:var(--tinta2);margin:8px 0 0}' +
      '.pc-mapa .leg b{color:var(--tinta)}' +
      '.pc-mapa .fora{font-size:12.5px;color:var(--tinta2);margin:4px 0 0}' +
      '@media (prefers-reduced-motion: reduce){.pc-mapa .pino{opacity:1;transition:none}.pc-mapa .traco{stroke-dasharray:none;stroke-dashoffset:0;transition:none}}';
    document.head.appendChild(st);
  }
  function claro(el, U) {
    var c = U.cor(el, 'fundo'), m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
  }

  E.peca('mapa', function (el, dados, U, args) {
    estilo();
    var s = U.s, h = U.h;
    var pontos = (args.pontos || []).filter(function (p) { return typeof p.lat === 'number' && typeof p.lon === 'number'; });
    var dentro = [], fora = [];
    (args.pontos || []).forEach(function (p, i) {
      p = { p: p, n: i + 1 };
      if (typeof p.p.lat !== 'number' || typeof p.p.lon !== 'number') return;
      if (p.p.lat < LAT1 + 0.1 || p.p.lat > LAT0 - 0.1 || p.p.lon < LON0 + 0.1 || p.p.lon > LON1 - 0.1) fora.push(p); else dentro.push(p);
    });
    el.classList.add('pc-mapa'); if (claro(el, U)) el.classList.add('claro');
    var svg = s('svg', { viewBox: '-6 -6 ' + (W + 12) + ' ' + (H + 12), role: 'img',
      'aria-label': 'Mapa do Egito com ' + dentro.length + (dentro.length === 1 ? ' lugar marcado' : ' lugares marcados') + ' ao longo do Nilo, do delta e do deserto.' });
    svg.appendChild(s('path', { class: 'terra', d: caminho(TERRA, true) }));
    svg.appendChild(s('path', { class: 'delta', d: caminho(DELTA, true) }));
    svg.appendChild(s('path', { class: 'vale', d: caminho(NILO) }));
    svg.appendChild(s('path', { class: 'lago', d: caminho(LAGO) }));
    [NILO, ROSETA, DAMIETA].forEach(function (pts) {
      var p = s('path', { class: 'rio traco', d: caminho(pts) });
      svg.appendChild(p);
      try { p.style.setProperty('--l', Math.ceil(p.getTotalLength ? 600 : 600)); } catch (e) {}
    });
    svg.appendChild(s('path', { class: 'canal', d: caminho(CANAL) }));
    svg.appendChild(s('ellipse', { class: 'delta', cx: X(30.62), cy: Y(29.47), rx: 9, ry: 2.6, style: 'opacity:.7' }));
    svg.appendChild(s('text', { class: 'mar', x: X(27.4), y: Y(31.75), 'text-anchor': 'middle' }, 'Mediterrâneo'));
    svg.appendChild(s('text', { class: 'mar', x: X(35.2), y: Y(26.2), 'text-anchor': 'middle', transform: 'rotate(58 ' + X(35.2) + ' ' + Y(26.2) + ')' }, 'Mar Vermelho'));
    svg.appendChild(s('text', { class: 'rot', x: X(33.75), y: Y(29.65), 'text-anchor': 'middle' }, 'Sinai'));
    OASIS.forEach(function (o) {
      svg.appendChild(s('circle', { class: 'oasis', cx: X(o[1]), cy: Y(o[2]), r: 1.8 }));
      if (args.grande) svg.appendChild(s('text', { class: 'rot', x: X(o[1]) + 5, y: Y(o[2]) + 3 }, o[0]));
    });
    CIDADES.forEach(function (c) {
      svg.appendChild(s('circle', { class: 'cid', cx: X(c[1]), cy: Y(c[2]), r: 1.6 }));
      var esq = c[3] === 'e';
      svg.appendChild(s('text', { class: 'rot', x: X(c[1]) + (esq ? -6 : 6), y: Y(c[2]) + 3, 'text-anchor': esq ? 'end' : 'start' }, c[0]));
    });

    var leg = h('p', { class: 'leg', 'aria-live': 'polite' }, dentro.length ? 'Toque num ponto para ver o lugar.' : '');
    function mostra(g, q) {
      Array.prototype.forEach.call(svg.querySelectorAll('.pino.sel'), function (x) { x.classList.remove('sel'); });
      g.classList.add('sel'); leg.textContent = '';
      leg.appendChild(h('b', null, (args.numerar ? q.n + '. ' : '') + (q.p.lugar || '')));
      if (q.p.cidade) leg.appendChild(document.createTextNode(' · ' + q.p.cidade));
    }
    // pinos: quando vários caem no mesmo ponto (Cairo, Luxor), abrem em leque em volta do lugar, com um fio até ele
    var R = args.numerar ? 7 : 4.6, postos = [];
    function livre(x, y) { return !postos.some(function (o) { return Math.abs(o[0] - x) < R * 2 + 1 && Math.abs(o[1] - y) < R * 2 + 1; }); }
    dentro.sort(function (a, b) { return b.p.lat - a.p.lat; }).forEach(function (q, i) {
      var x0 = X(q.p.lon), y0 = Y(q.p.lat), x = x0, y = y0, t = 0;
      while (!livre(x, y) && t < 40) {
        var anel = 1 + Math.floor(t / 8), ang = (t % 8) * Math.PI / 4 + (anel % 2 ? Math.PI / 8 : 0) - Math.PI / 2;
        x = x0 + Math.cos(ang) * anel * (R * 2 + 3); y = y0 + Math.sin(ang) * anel * (R * 2 + 3); t++;
      }
      x = Math.max(R, Math.min(W - R, x)); y = Math.max(R, Math.min(H - R, y));
      postos.push([x, y]);
      var g = s('g', { class: 'pino', tabindex: 0, role: 'button', 'aria-label': (q.p.lugar || '') + (q.p.cidade ? ', ' + q.p.cidade : ''), style: 'transition-delay:' + Math.min(1400, 500 + i * 70) + 'ms' },
        s('title', null, (q.p.lugar || '') + (q.p.cidade ? ' · ' + q.p.cidade : '')),
        (x !== x0 || y !== y0) ? s('line', { x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x.toFixed(1), y2: y.toFixed(1), class: 'fio' }) : null,
        s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: R }),
        args.numerar ? s('text', { x: x.toFixed(1), y: (y + 3).toFixed(1) }, String(q.n)) : null);
      g.addEventListener('click', function () { mostra(g, q); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); mostra(g, q); } });
      svg.appendChild(g);
    });
    el.appendChild(svg); el.appendChild(leg);
    if (fora.length) {
      el.appendChild(h('p', { class: 'fora' }, 'Fora do mapa: ' + fora.map(function (q) { return (args.numerar ? q.n + '. ' : '') + (q.p.cidade || q.p.lugar); }).join('; ') + '.'));
    }
    Array.prototype.forEach.call(svg.querySelectorAll('.traco'), function (p) {
      try { p.style.setProperty('--l', Math.ceil(p.getTotalLength()) + 2); } catch (e) {}
    });
    U.aoVer(el, function () { el.classList.add('vis'); });
  });
})();
