// Estudos sem internet. Guarda neste aparelho o app, o leitor, as bibliotecas e os arquivos cifrados dos estudos.
// Os arquivos continuam cifrados no aparelho: a chave fica à parte (IndexedDB) e só a página decifra.
// No endereço do app (estudos.madeinbr.app) o escopo é "/"; em outro endereço, "/estudos".
var VERSAO = 'v1';
var CASCA = 'estudos-casca-' + VERSAO;      // o app, o leitor e as bibliotecas (trocam com a versão)
var DADOS = 'estudos-dados';                // os arquivos cifrados (ficam de uma versão para outra)
var RAIZ = new URL(self.registration.scope).pathname === '/';
var APP = RAIZ ? '/' : '/estudos';
var LEITOR = '/estudos/ler';
var CASCA_ARQS = [APP, LEITOR, '/estudos/cofre.js', '/estudos/manifest.webmanifest',
  '/estudos/icone-180.png', '/estudos/icone-192.png', '/estudos/icone-512.png', '/estudos/icone.svg',
  '/estudos/lib/d3-7.9.0.min.js', '/estudos/lib/topojson-3.0.2.min.js', '/estudos/lib/three-r128.min.js'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CASCA).then(function (c) {
    return Promise.all(CASCA_ARQS.map(function (u) {
      return fetch(u, { cache: 'reload' }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('estudos-casca-') === 0 && k !== CASCA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// a página da estante pede para guardar os estudos e para esquecer os que saíram
self.addEventListener('message', function (ev) {
  var d = ev.data || {};
  if (d.tipo === 'esquece-dados') ev.waitUntil(caches.delete(DADOS));
});

function rede(req, guardaEm, chave) {
  return fetch(req).then(function (r) {
    if (r && r.ok && guardaEm) { var copia = r.clone(); caches.open(guardaEm).then(function (c) { return c.put(chave || req, copia); }); }
    return r;
  });
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin !== location.origin) return;          // fontes do Google e o resto: o navegador decide
  var p = u.pathname;

  // arquivos cifrados: primeiro a rede (pega o estudo novo); sem rede, a cópia do aparelho.
  // Sem cópia, devolve erro de rede (nunca 404: 404 quer dizer "chave errada" para a página).
  if (p.indexOf('/estudos/dados/') === 0) {
    var chave = u.origin + p;
    ev.respondWith(rede(req, DADOS, chave).then(function (r) {
      if (r.ok || r.status === 404) return r;
      return caches.match(chave, { cacheName: DADOS }).then(function (c) { return c || r; });
    }).catch(function () {
      return caches.match(chave, { cacheName: DADOS }).then(function (c) { return c || Response.error(); });
    }));
    return;
  }

  // páginas: primeiro a rede; sem rede, o app ou o leitor guardados
  if (req.mode === 'navigate') {
    var ehApp = p === APP || p === '/estudos' || p === '/estudos.html' || (RAIZ && p === '/index.html');
    var alvo = ehApp ? APP : LEITOR;
    var ehLeitor = !ehApp && (p === LEITOR || p === '/estudos/ler.html' || (RAIZ && /^\/[a-z0-9][a-z0-9-]+$/.test(p)));
    if (!ehApp && !ehLeitor) return;
    ev.respondWith(rede(req, CASCA, alvo).catch(function () {
      return caches.match(alvo, { cacheName: CASCA }).then(function (c) { return c || Response.error(); });
    }));
    return;
  }

  // o resto do app (cofre.js, bibliotecas, ícones): a cópia do aparelho na hora, e atualiza por trás
  if (CASCA_ARQS.indexOf(p) >= 0) {
    ev.respondWith(caches.match(p, { cacheName: CASCA }).then(function (c) {
      var nova = rede(req, CASCA, p).catch(function () { return c || Response.error(); });
      return c || nova;
    }));
  }
});
