// Egito, de hoje para trás — utilidades comuns e registro das peças visuais.
// Uma peça é uma função registrada com EGITO.peca('nome', function (el, dados, util, args) { ... }):
// ela desenha dentro de `el`, usando só as variáveis de cor da era (--fundo, --s1, --s2, --tinta, --tinta2,
// --linha, --acento, --acento2, --sobre-acento). Texto vindo dos dados entra sempre por textContent.
(function (g) {
  'use strict';
  var HOJE = 2026;
  var NS = 'http://www.w3.org/2000/svg';

  function poe(e, filhos) {
    for (var i = 0; i < filhos.length; i++) {
      var k = filhos[i];
      if (k == null || k === false) continue;
      if (Array.isArray(k)) { poe(e, k); continue; }
      e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    }
    return e;
  }
  function cria(e, attrs, filhos) {
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') { for (var p in v) e.style.setProperty(p, v[p]); }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    return poe(e, filhos);
  }
  /** elemento HTML: h('p', { class: 'x' }, 'texto', outroElemento) */
  function h(tag, attrs) { return cria(document.createElement(tag), attrs, Array.prototype.slice.call(arguments, 2)); }
  /** elemento SVG: s('circle', { cx: 1, cy: 2, r: 3 }) */
  function s(tag, attrs) { return cria(document.createElementNS(NS, tag), attrs, Array.prototype.slice.call(arguments, 2)); }

  function urlOk(u) { return typeof u === 'string' && /^https:\/\/[^\s<>"']+$/.test(u); }
  /** link para fora (só https); sem endereço válido devolve só o texto */
  function link(texto, url) {
    return urlOk(url) ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, texto) : document.createTextNode(texto);
  }

  function int(n) { return Math.round(n).toLocaleString('pt-BR'); }
  function dec(n, casas) { return n.toLocaleString('pt-BR', { maximumFractionDigits: casas == null ? 1 : casas }); }
  /** 109540965 -> "109,5 milhões"; 870000 -> "870 mil" */
  function compacto(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return dec(n / 1e9, 1) + (a >= 2e9 ? ' bilhões' : ' bilhão');
    if (a >= 1e6) return dec(n / 1e6, 1) + (a >= 2e6 ? ' milhões' : ' milhão');
    if (a >= 1e4) return dec(n / 1e3, 0) + ' mil';
    return int(n);
  }
  /** ano com sinal -> texto: -2560 "2560 a.C."; 641 "641"; -40000000 "40 milhões de anos atrás" */
  function ano(n) {
    if (n == null || isNaN(n)) return '';
    if (n <= -1e6) return dec(-n / 1e6, -n >= 1e7 ? 0 : 1) + (-n >= 2e6 ? ' milhões de anos atrás' : ' milhão de anos atrás');
    if (n <= -11000) return 'há ' + dec((HOJE - n) / 1000, 0) + ' mil anos';
    if (n < 0) return int(-n).replace('.', '') + ' a.C.';
    return String(Math.round(n));
  }
  /** quantos anos atrás (não existe ano zero) */
  function anosAtras(n) { return HOJE - n - (n < 0 ? 1 : 0); }
  function atras(n) {
    if (n == null || isNaN(n)) return '';
    var d = anosAtras(n);
    if (d <= 0) return 'agora';
    if (d >= 1e6) return dec(d / 1e6, d >= 1e7 ? 0 : 1) + (d >= 2e6 ? ' milhões de anos atrás' : ' milhão de anos atrás');
    if (d >= 20000) return dec(d / 1000, 0) + ' mil anos atrás';
    return int(d) + (d === 1 ? ' ano atrás' : ' anos atrás');
  }

  var reduz = !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** chama fn(true/false) quando el entra/sai da tela. opcoes: { uma: true (padrão), margem } */
  function aoVer(el, fn, opcoes) {
    opcoes = opcoes || {};
    var uma = opcoes.uma !== false;
    if (!('IntersectionObserver' in g)) { fn(true); return { parar: function () {} }; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { fn(true, e); if (uma) io.disconnect(); }
        else if (!uma) fn(false, e);
      });
    }, { rootMargin: opcoes.margem || '0px 0px -12% 0px', threshold: opcoes.limiar || 0 });
    io.observe(el);
    return { parar: function () { io.disconnect(); } };
  }

  /** "Ver os números": tabela recolhida, para quem não vê o desenho ou quer o dado */
  function tabela(titulo, colunas, linhas) {
    var t = h('table', null,
      h('thead', null, h('tr', null, colunas.map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null, linhas.map(function (l) { return h('tr', null, l.map(function (c) { return h('td', null, c == null ? '' : c); })); })));
    return h('details', { class: 'pc-tabela' }, h('summary', null, titulo || 'Ver os números'), t);
  }
  function fonte(texto, url) { return h('p', { class: 'pc-fonte' }, 'Fonte: ', link(texto, url)); }
  /** botões de escolha única. opcoes: [{ id, rotulo }] */
  function botoes(opcoes, valor, aoMudar, rotulo) {
    var caixa = h('div', { class: 'pc-botoes', role: 'group', 'aria-label': rotulo || 'Escolha' });
    opcoes.forEach(function (o) {
      caixa.appendChild(h('button', {
        type: 'button', 'aria-pressed': o.id === valor ? 'true' : 'false',
        onclick: function () {
          Array.prototype.forEach.call(caixa.children, function (b) { b.setAttribute('aria-pressed', 'false'); });
          this.setAttribute('aria-pressed', 'true'); aoMudar(o.id);
        }
      }, o.rotulo));
    });
    return caixa;
  }
  /** escala linear e logarítmica: devolve função valor -> posição */
  function escala(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }
  function escalaLog(d0, d1, r0, r1) { var a = Math.log(d0), b = Math.log(d1); return function (v) { return r0 + (Math.log(v) - a) / (b - a) * (r1 - r0); }; }
  /** valor de uma variável de cor da era no elemento: cor(el, 'acento') */
  function cor(el, nome) { return getComputedStyle(el).getPropertyValue('--' + nome).trim(); }
  /** largura útil de um elemento (para desenhar o SVG no tamanho certo e refazer ao girar a tela) */
  function aoMedir(el, fn) {
    var ult = 0;
    function mede() { var w = Math.round(el.getBoundingClientRect().width); if (w && Math.abs(w - ult) > 2) { ult = w; fn(w); } }
    if ('ResizeObserver' in g) new ResizeObserver(mede).observe(el); else g.addEventListener('resize', mede);
    mede();
  }

  g.EGITO = {
    HOJE: HOJE,
    pecas: {},
    peca: function (nome, fn) { this.pecas[nome] = fn; },
    util: {
      h: h, s: s, link: link, urlOk: urlOk, int: int, dec: dec, compacto: compacto, ano: ano, atras: atras, anosAtras: anosAtras,
      reduz: reduz, aoVer: aoVer, tabela: tabela, fonte: fonte, botoes: botoes, escala: escala, escalaLog: escalaLog, cor: cor, aoMedir: aoMedir,
      HOJE: HOJE
    }
  };
})(window);
