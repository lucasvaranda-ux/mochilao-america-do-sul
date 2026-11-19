// Cofre do Estudos: guarda a chave no aparelho e abre (decifra) o catálogo e cada estudo.
// Nada neste arquivo é segredo. A chave nunca fica no repositório: chega pelo link-chave (#k=…) ou colada na porta.
// Formato de cada arquivo de estudos/dados: "EST1" + 12 bytes de vetor + AES-256-GCM (texto comprimido com gzip + selo de 16 bytes).
// O nome do arquivo sai da chave (HMAC do nome lógico), então quem não tem a chave não sabe nem quantos títulos há por nome.
// O mesmo arquivo serve ao navegador e ao teste em Node (scripts/estudos-cifra.teste.mjs).
(function (g) {
  'use strict';
  var SAL = 'estudos.madeinbr.app/v1';
  var enc = new TextEncoder(), dec = new TextDecoder();
  var sub = g.crypto && g.crypto.subtle;
  var BANCO = 'estudos-cofre', LOJA = 'chaves', ID = 'v1', SESSAO = 'estudos_k';

  function b64uParaBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function bytesParaB64u(u) {
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // aceita o link-chave inteiro (…#k=XXXX) ou só a chave; devolve a chave limpa ou null
  function limpaChave(t) {
    t = String(t || '').trim();
    var m = t.match(/[#&?]k=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/);
    if (m) return m[1];
    m = t.match(/^[A-Za-z0-9_-]{43}$/);
    return m ? m[0] : null;
  }

  // da chave em texto saem duas chaves de uso: uma decifra, a outra dá os nomes dos arquivos
  async function deriva(chaveTxt) {
    if (!sub) throw new Error('navegador');
    var bruta = b64uParaBytes(chaveTxt);
    if (bruta.length !== 32) throw new Error('chave');
    var base = await sub.importKey('raw', bruta, 'HKDF', false, ['deriveKey']);
    function p(info) { return { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(SAL), info: enc.encode(info) }; }
    var cifra = await sub.deriveKey(p('cifra'), base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var nomes = await sub.deriveKey(p('nomes'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
    return { cifra: cifra, nomes: nomes };
  }

  async function nomeDe(K, logico) {
    var m = new Uint8Array(await sub.sign('HMAC', K.nomes, enc.encode('nome:' + logico)));
    return bytesParaB64u(m).slice(0, 24);
  }

  async function gunzip(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('navegador');
    var s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  // abre um arquivo cifrado; erro "chave" quando a chave não é a dele (ou o arquivo foi mexido)
  async function abre(K, logico, dados) {
    var u = new Uint8Array(dados);
    if (u.length < 33 || u[0] !== 69 || u[1] !== 83 || u[2] !== 84 || u[3] !== 49) throw new Error('formato');
    var claro;
    try {
      claro = await sub.decrypt({ name: 'AES-GCM', iv: u.subarray(4, 16), additionalData: enc.encode('estudos/v1:' + logico), tagLength: 128 }, K.cifra, u.subarray(16));
    } catch (e) { throw new Error('chave'); }
    return dec.decode(await gunzip(new Uint8Array(claro)));
  }

  // busca e abre; erro "nao-achei" (404), "rede", "chave" ou "navegador"
  async function busca(K, logico, base) {
    var n = await nomeDe(K, logico), r;
    try { r = await fetch((base || '/estudos/dados/') + n + '.bin', { cache: 'no-cache' }); } catch (e) { throw new Error('rede'); }
    if (r.status === 404) throw new Error('nao-achei');
    if (!r.ok) throw new Error('rede');
    return abre(K, logico, await r.arrayBuffer());
  }

  // ---------- a chave no aparelho ----------
  // Fica no IndexedDB como chave de uso que o JavaScript não consegue ler de volta.
  // Se o navegador não deixar (modo privado, por exemplo), fica só nesta aba, em texto, até ela fechar.
  function banco() {
    return new Promise(function (ok, erro) {
      try {
        var r = g.indexedDB.open(BANCO, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(LOJA); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { erro(r.error); };
        r.onblocked = function () { erro(new Error('bloqueado')); };
      } catch (e) { erro(e); }
    });
  }
  function noBanco(modo, fn) {
    return banco().then(function (db) {
      return new Promise(function (ok, erro) {
        var t = db.transaction(LOJA, modo), q = fn(t.objectStore(LOJA));
        t.oncomplete = function () { db.close(); ok(q && q.result); };
        t.onerror = t.onabort = function () { db.close(); erro(t.error); };
      });
    });
  }
  async function guarda(chaveTxt) {
    var K = await deriva(chaveTxt);
    try { await noBanco('readwrite', function (s) { return s.put(K, ID); }); try { g.sessionStorage.removeItem(SESSAO); } catch (e) {} }
    catch (e) { try { g.sessionStorage.setItem(SESSAO, chaveTxt); } catch (e2) {} }
    return K;
  }
  async function le() {
    try {
      var K = await noBanco('readonly', function (s) { return s.get(ID); });
      if (K && K.cifra && K.nomes) return K;
    } catch (e) {}
    try {
      var t = g.sessionStorage.getItem(SESSAO);
      if (t && limpaChave(t)) return await deriva(t);
    } catch (e) {}
    return null;
  }
  async function apaga() {
    try { g.sessionStorage.removeItem(SESSAO); } catch (e) {}
    try { await noBanco('readwrite', function (s) { return s.delete(ID); }); } catch (e) {}
  }

  g.Cofre = { limpaChave: limpaChave, deriva: deriva, nomeDe: nomeDe, abre: abre, busca: busca, guarda: guarda, le: le, apaga: apaga };
})(typeof window !== 'undefined' ? window : globalThis);
