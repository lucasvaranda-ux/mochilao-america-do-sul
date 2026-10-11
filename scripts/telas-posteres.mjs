// Robô de pôsteres do Telas: acha o cartaz de cada título pelo IMDb ID e grava telas/posteres.json.
// 1) TMDB (fonte principal, quando há o segredo TMDB_API_KEY, o mesmo do onde assistir):
//    /find/{imdb_id} -> poster_path. São os mesmos cartazes do Letterboxd, em pé e nítidos;
//    a página monta o srcset (w92 a w780) a partir do poster_path.
// 2) Wikipedia, para o que o TMDB não tem (ou tudo, sem a chave):
//    Wikidata (SPARQL, propriedade P345 = IMDb ID) -> título do artigo na Wikipedia
//    em português e em inglês -> imagem principal do artigo (API PageImages).
//    Primeiro a Wikipedia em português (cartaz brasileiro, quando houver); se ela não tiver
//    imagem que pareça cartaz, a Wikipedia em inglês.
// Node 20+, sem dependências. Política da Wikimedia: User-Agent descritivo (sem e-mail),
// chamadas em série com pausa curta, e respeito ao 429/Retry-After.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UA = 'TelasBot/1.0 (https://mochilao.madeinbr.app/telas)';
export const FONTE = 'Wikipedia (via Wikidata)';
export const FONTE_TMDB = 'TMDB, e a Wikipedia (via Wikidata) para o que faltar';
const TMDB_API = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p/';
const TMDB_TAM = 'w500';            // o img gravado; a página pede o tamanho de cada uso pelo poster_path
const TMDB_PARALELO = 4;            // consultas simultâneas (o TMDB aceita ~50 por segundo)
const PAUSA_TMDB_MS = 50;
const TEMPO_TMDB_MS = 15000;
const TMDB_FALHAS_SEGUIDAS = 8;     // TMDB fora do ar: para cedo e cai na Wikipedia
const TMDB_RENOVA = 30;             // cada cartaz já achado é conferido de novo a cada 30 dias, em rodízio
const POSTER_PATH = /^\/[A-Za-z0-9_-]{4,80}\.(jpe?g|png|webp)$/;
const SPARQL = 'https://query.wikidata.org/sparql';
const API = wiki => `https://${wiki}.wikipedia.org/w/api.php`;
const LOTE_SPARQL = 150;   // ids por consulta (VALUES)
const LOTE_WIKI = 50;      // títulos por chamada (limite da API para quem não é robô registrado)
const URL_MAX = 7000;      // um lote de títulos longos com acento pode estourar a URL antes dos 50
const PAUSA_SPARQL_MS = 1000;
const PAUSA_WIKI_MS = 250;
const TEMPO_SPARQL_MS = 30000; // a consulta é simples (uns poucos segundos); o serviço corta em 60 s
const TEMPO_WIKI_MS = 20000;
const TENTATIVAS = 3;
const PRAZO_MS = 4 * 60000; // depois disso não começa chamada nova: grava o que tem (o passo do workflow tem 6 min)
// Larguras de miniatura aceitas em hotlink pela Wikimedia (as outras são recusadas desde 2026).
const LARGURA = 500;
const PADRAO = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];
const FORMATO_WEB = /\.(jpe?g|png|gif|webp|svg)$/i;

// ---------- AJUDANTES ----------
const dormirPadrao = ms => new Promise(r => setTimeout(r, ms));
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));
const normImdb = v => {
  const s = String(v ?? '').trim().toLowerCase();
  return /^tt\d{7,10}$/.test(s) ? s : null;
};
const ordenar = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const normal = s => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();
const lote = (lista, n) => { const out = []; for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n)); return out; };

// Só aceita imagem servida pelo próprio servidor de arquivos da Wikimedia.
const urlImagemOk = u => {
  if (typeof u !== 'string' || !/^https:\/\/upload\.wikimedia\.org\/[^\s"'<>\\]+$/.test(u)) return false;
  try { return new URL(u).hostname === 'upload.wikimedia.org'; } catch { return false; }
};
const absoluta = u => (typeof u === 'string' && u.startsWith('//') ? 'https:' + u : u);
const dimOk = n => Number.isInteger(n) && n > 0 && n < 100000;

// entrada do TMDB: só o caminho do cartaz (poster_path), validado, e a página do título no TMDB
export function entradaTmdb(achado, imdb) {
  if (!achado || !POSTER_PATH.test(achado.path || '') || !Number.isInteger(achado.id) || achado.id <= 0) return null;
  if (achado.tipo !== 'movie' && achado.tipo !== 'tv') return null;
  return { img: TMDB_IMG + TMDB_TAM + achado.path, w: 500, h: 750, pagina: `https://www.themoviedb.org/${achado.tipo}/${achado.id}`, fonte: 'tmdb', tmdb: achado.path, imdb };
}
export const okTmdb = e => !!e && typeof e === 'object' && e.fonte === 'tmdb' && POSTER_PATH.test(e.tmdb || '') &&
  e.img === TMDB_IMG + TMDB_TAM + e.tmdb && dimOk(e.w) && dimOk(e.h) && /^https:\/\/www\.themoviedb\.org\/(movie|tv)\/\d+$/.test(e.pagina || '') && normImdb(e.imdb) === e.imdb;
// rodízio estável: o mesmo título cai sempre no mesmo dia do ciclo
const diaDoCiclo = (imdb, agora) => {
  let h = 7; for (const c of imdb) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % TMDB_RENOVA === Math.floor(agora.getTime() / 864e5) % TMDB_RENOVA;
};

// endereço legível do artigo: espaço vira _, e : / , ficam sem escape, como a própria Wikipedia faz
export const urlPagina = (wiki, titulo) => `https://${wiki}.wikipedia.org/wiki/` +
  encodeURIComponent(String(titulo).replace(/ /g, '_')).replace(/%3A/gi, ':').replace(/%2F/gi, '/').replace(/%2C/gi, ',');

const tituloDaUrl = u => {
  try { return decodeURIComponent(new URL(u).pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' '); } catch { return null; }
};

// Troca a largura de uma miniatura (".../thumb/a/ab/X.jpg/338px-X.jpg") por outra largura padrão.
export function trocarLargura(url, largura) {
  if (!/\/thumb\//.test(url)) return null;
  const m = url.match(/\/((?:lossy-|lossless-)?(?:page\d+-)?(?:lang[a-z]{2,3}(?:-[a-z]+)?-)?)(\d+)px-([^/]+)$/);
  if (!m) return null;
  return url.slice(0, m.index) + `/${m[1]}${largura}px-${m[3]}`;
}

// Miniatura a partir do original, no esquema da Wikimedia:
// .../wikipedia/commons/a/ab/X.jpg -> .../wikipedia/commons/thumb/a/ab/X.jpg/500px-X.jpg (SVG vira PNG)
export function miniaturaDoOriginal(url, largura) {
  const m = String(url).match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[a-z0-9.-]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
  if (!m || !FORMATO_WEB.test(m[4])) return null;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${largura}px-${m[4]}${/\.svg$/i.test(m[4]) ? '.png' : ''}`;
}

// Escolhe a URL que o navegador vai carregar: o original quando ele tem até 500 px de largura
// (o cartaz não livre da Wikipedia em inglês costuma ter uns 220–300 px), senão a miniatura
// de exatamente 500 px. A PageImages encaixa a miniatura num quadrado (um cartaz em pé volta
// com ~338 px de largura), e essa largura fora do padrão seria recusada no hotlink.
export function escolherImagem(pg) {
  const or = pg?.original, th = pg?.thumbnail;
  const oSrc = absoluta(or?.source), tSrc = absoluta(th?.source);
  if (or && urlImagemOk(oSrc) && dimOk(or.width) && dimOk(or.height)) {
    if (or.width <= LARGURA && FORMATO_WEB.test(new URL(oSrc).pathname)) return { img: oSrc, w: or.width, h: or.height };
    if (or.width > LARGURA) {
      const u = (urlImagemOk(tSrc) && trocarLargura(tSrc, LARGURA)) || miniaturaDoOriginal(oSrc, LARGURA);
      if (u && urlImagemOk(u)) return { img: u, w: LARGURA, h: Math.round(or.height * LARGURA / or.width) };
    }
  }
  // sem o original (resposta incompleta): usa a miniatura, levando a largura para um padrão
  if (th && urlImagemOk(tSrc) && dimOk(th.width) && dimOk(th.height)) {
    if (!/\/thumb\//.test(tSrc)) return FORMATO_WEB.test(new URL(tSrc).pathname) ? { img: tSrc, w: th.width, h: th.height } : null;
    if (PADRAO.includes(th.width)) return { img: tSrc, w: th.width, h: th.height };
    const p = [...PADRAO].reverse().find(x => x <= th.width);
    const u = p && trocarLargura(tSrc, p);
    if (u && urlImagemOk(u)) return { img: u, w: p, h: Math.round(th.height * p / th.width) };
  }
  return null;
}

// A Wikipedia em português não hospeda cartaz sob "uso justo" como a em inglês: a imagem
// principal de um artigo de filme lá costuma ser foto do diretor ou do elenco. Só aceita a
// imagem portuguesa se o nome do arquivo disser que é cartaz/capa, ou se trouxer o título
// da obra e a imagem for em pé (proporção de cartaz).
const PARECE_CARTAZ = /\b(cartaz|cartazes|poster|posters|affiche|plakat|locandina|cartel|capa|cover|onesheet|one sheet|keyart|key art|dvd|bluray|blu ray|vhs)\b/;
export function pareceCartaz(arquivo, titulo, w, h) {
  const nome = normal(String(arquivo || '').replace(/\.[a-z0-9]+$/i, ''));
  if (!nome) return false;
  if (PARECE_CARTAZ.test(nome)) return true;
  const t = normal(String(titulo || '').replace(/\s*\([^)]*\)\s*$/, ''));
  return t.length >= 3 && (` ${nome} `).includes(` ${t} `) && h >= w * 1.2;
}

// ---------- QUAIS TÍTULOS ----------
// dados.json: filmes, series e extras (a saga traz a lista "filmes").
// catalogo.json: { itens: [...] }, ou uma lista solta, ou { itens: { id: {...} } }.
export function coletarTitulos(dados, catalogo) {
  const ids = new Map();     // id -> imdb
  const sagas = new Map();   // id da saga -> ids dos filmes, na ordem
  let semImdb = 0;
  const idDe = it => {
    const v = typeof it.id === 'number' ? String(it.id) : typeof it.id === 'string' ? it.id.trim() : '';
    return v && v.length <= 200 && !/[\u0000-\u001f]/.test(v) ? v : '';
  };
  const poe = it => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return '';
    const id = idDe(it);
    if (Array.isArray(it.filmes) && it.filmes.length) {
      const filhos = it.filmes.map(poe).filter(Boolean);
      if (id && filhos.length && !sagas.has(id) && !normImdb(it.imdb_id)) sagas.set(id, filhos);
      if (!normImdb(it.imdb_id)) return id; // a saga em si não tem IMDb: o cartaz vem do 1º filme
    }
    if (!id) return '';
    const imdb = normImdb(it.imdb_id);
    if (!imdb) { if (!ids.has(id)) semImdb++; return id; }
    if (!ids.has(id)) ids.set(id, imdb); // o primeiro que aparece vale (dados.json antes do catálogo)
    return id;
  };
  const lista = v => (Array.isArray(v) ? v : []);
  for (const k of ['filmes', 'series', 'extras']) lista(dados?.[k]).forEach(poe);
  let doCatalogo = [];
  if (Array.isArray(catalogo)) doCatalogo = catalogo;
  else if (catalogo && typeof catalogo === 'object') {
    if (Array.isArray(catalogo.itens)) doCatalogo = catalogo.itens;
    else if (catalogo.itens && typeof catalogo.itens === 'object') {
      doCatalogo = Object.entries(catalogo.itens).map(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v, id: v.id ?? k } : null));
    }
    for (const k of ['filmes', 'series', 'extras']) doCatalogo = doCatalogo.concat(lista(catalogo[k]));
  }
  doCatalogo.forEach(poe);
  for (const [s] of sagas) if (ids.has(s)) sagas.delete(s);
  return { ids, sagas, semImdb };
}

// ---------- REDE ----------
function criarRede({ fetchFn, dormir, prazo }) {
  let ultima = 0; // fim da chamada anterior
  // Uma chamada por vez, com pausa curta entre elas; 429 respeita o Retry-After.
  async function pedir(url, init, { pausa, tempo, rotulo }) {
    let erro = 'sem resposta';
    for (let t = 1; t <= TENTATIVAS; t++) {
      if (Date.now() > prazo) throw new Error(`prazo total esgotado antes de ${rotulo}`);
      const falta = ultima + pausa - Date.now();
      if (ultima && falta > 0) await dormir(falta);
      let r;
      try {
        r = await fetchFn(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers || {}) }, signal: AbortSignal.timeout(tempo) });
      } catch (e) {
        ultima = Date.now();
        erro = `rede: ${e?.name === 'TimeoutError' ? 'tempo esgotado' : e?.message || e}`;
        if (t < TENTATIVAS) await dormir(2000 * t);
        continue;
      }
      ultima = Date.now();
      const descartar = async () => { try { await r.body?.cancel(); } catch { /* já fechado */ } };
      if (r.status === 429 || r.status >= 500) {
        await descartar();
        erro = `HTTP ${r.status}`;
        const ra = Number(r.headers?.get?.('retry-after'));
        if (t < TENTATIVAS) await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 3000 * t);
        continue;
      }
      if (!r.ok) { await descartar(); throw new Error(`HTTP ${r.status} em ${rotulo}`); } // 403 = bloqueio de política: não insiste
      try { return await r.json(); } catch { erro = 'resposta não é JSON'; }
    }
    throw new Error(`${erro} em ${rotulo}`);
  }

  // Wikidata: IMDb ID -> títulos dos artigos em pt e en
  async function wikidata(imdbs) {
    const valores = imdbs.map(i => `"${i}"`).join(' '); // ids já validados por normImdb
    const query = `SELECT ?imdb ?item ?pt ?ptNome ?en ?enNome WHERE {
  VALUES ?imdb { ${valores} }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?pt schema:about ?item ; schema:isPartOf <https://pt.wikipedia.org/> ; schema:name ?ptNome . }
  OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enNome . }
}`;
    const corpo = new URLSearchParams({ query, format: 'json' });
    const j = await pedir(SPARQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
      body: corpo.toString(),
    }, { pausa: PAUSA_SPARQL_MS, tempo: TEMPO_SPARQL_MS, rotulo: `Wikidata (${imdbs.length} ids)` });
    if (!Array.isArray(j?.results?.bindings)) throw new Error('resposta do Wikidata sem results.bindings');
    // Mais de um item com o mesmo IMDb ID acontece (duplicata no Wikidata): fica o que tem
    // mais artigos e, no empate, o de menor número Q, para o resultado não variar entre dias.
    const melhor = new Map();
    for (const b of j.results.bindings) {
      const imdb = normImdb(b?.imdb?.value);
      if (!imdb || !imdbs.includes(imdb)) continue;
      const q = Number(String(b?.item?.value || '').match(/Q(\d+)$/)?.[1] || Infinity);
      const pt = b?.ptNome?.value || (b?.pt?.value ? tituloDaUrl(b.pt.value) : null);
      const en = b?.enNome?.value || (b?.en?.value ? tituloDaUrl(b.en.value) : null);
      const cand = { q, pt: pt || null, en: en || null, nota: (pt ? 1 : 0) + (en ? 1 : 0) };
      const atual = melhor.get(imdb);
      if (!atual || cand.nota > atual.nota || (cand.nota === atual.nota && cand.q < atual.q)) melhor.set(imdb, cand);
    }
    return melhor;
  }

  // PageImages: título -> página (com thumbnail/original/pageimage), já seguindo
  // normalização e redirecionamento. null = página não existe.
  async function imagens(wiki, titulos) {
    const base = new URLSearchParams({
      action: 'query', prop: 'pageimages', piprop: 'thumbnail|name|original', pithumbsize: String(LARGURA),
      pilicense: 'any', pilimit: '50', redirects: '1', format: 'json', formatversion: '2',
    });
    const paginas = new Map(), norm = new Map(), redir = new Map();
    let cont = null;
    for (let volta = 0; volta < 10; volta++) {
      const p = new URLSearchParams(base);
      p.set('titles', titulos.join('|'));
      if (cont) for (const [k, v] of Object.entries(cont)) p.set(k, String(v));
      const j = await pedir(`${API(wiki)}?${p}`, { headers: { Accept: 'application/json' } },
        { pausa: PAUSA_WIKI_MS, tempo: TEMPO_WIKI_MS, rotulo: `${wiki}.wikipedia (${titulos.length} títulos)` });
      if (j?.error) throw new Error(`${wiki}.wikipedia: ${j.error.code || 'erro'} ${j.error.info || ''}`.trim());
      const q = j?.query;
      if (!q || !Array.isArray(q.pages)) throw new Error(`${wiki}.wikipedia: resposta sem query.pages`);
      for (const n of q.normalized || []) if (n?.from && n?.to) norm.set(n.from, n.to);
      for (const r of q.redirects || []) if (r?.from && r?.to) redir.set(r.from, r.to);
      for (const pg of q.pages) if (pg?.title) paginas.set(pg.title, { ...(paginas.get(pg.title) || {}), ...pg });
      if (!j.continue) break;
      cont = j.continue;
    }
    const out = new Map();
    for (const t of titulos) {
      let x = norm.get(t) ?? t;
      x = redir.get(x) ?? x;
      const pg = paginas.get(x);
      out.set(t, pg && !pg.missing && !pg.invalid ? pg : null);
    }
    return out;
  }

  return { wikidata, imagens };
}

// TMDB: IMDb ID -> poster_path (filme ou série). A chave v3 vai na URL e nunca entra nos logs;
// o token v4 (JWT) vai no cabeçalho Authorization.
function criarTmdb({ fetchFn, dormir, chave, base, prazo }) {
  const v4 = chave.startsWith('eyJ');
  async function find(imdb) {
    const u = new URL(`${base}/find/${imdb}`); // imdb já validado por normImdb
    u.searchParams.set('external_source', 'imdb_id');
    if (!v4) u.searchParams.set('api_key', chave);
    const headers = { Accept: 'application/json', 'User-Agent': UA };
    if (v4) headers.Authorization = 'Bearer ' + chave;
    let erro = 'sem resposta';
    for (let t = 1; t <= TENTATIVAS; t++) {
      if (Date.now() > prazo) throw new Error('prazo total esgotado');
      let r;
      try { r = await fetchFn(u, { headers, signal: AbortSignal.timeout(TEMPO_TMDB_MS) }); }
      catch (e) { erro = `rede: ${e?.name === 'TimeoutError' ? 'tempo esgotado' : e?.message || e}`; if (t < TENTATIVAS) await dormir(1500 * t); continue; }
      const descartar = async () => { try { await r.body?.cancel(); } catch { /* já fechado */ } };
      if (r.status === 401) { await descartar(); throw Object.assign(new Error('o TMDB recusou a chave (401)'), { fatal: true }); }
      if (r.status === 404) { await descartar(); return null; }
      if (r.status === 429 || r.status >= 500) {
        await descartar(); erro = `HTTP ${r.status}`;
        const ra = Number(r.headers?.get?.('retry-after'));
        if (t < TENTATIVAS) await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1000 * t);
        continue;
      }
      if (!r.ok) { await descartar(); throw new Error(`HTTP ${r.status} no TMDB`); }
      let j;
      try { j = await r.json(); } catch { erro = 'resposta não é JSON'; continue; }
      const lista = v => (Array.isArray(v) ? v : []);
      const cands = [...lista(j?.movie_results).map(x => ({ x, tipo: 'movie' })), ...lista(j?.tv_results).map(x => ({ x, tipo: 'tv' }))];
      const c = cands.find(({ x }) => x && typeof x.poster_path === 'string' && POSTER_PATH.test(x.poster_path) && Number.isInteger(x.id));
      return c ? { path: c.x.poster_path, id: c.x.id, tipo: c.tipo } : null;
    }
    throw new Error(`${erro} no TMDB`);
  }
  return { find };
}

// lotes de até 50 títulos, sem deixar a URL passar de URL_MAX
function lotesDeTitulos(titulos) {
  const out = [];
  let atual = [], tam = 0;
  for (const t of titulos) {
    const c = encodeURIComponent(t).length + 3;
    if (atual.length && (atual.length >= LOTE_WIKI || tam + c > URL_MAX - 400)) { out.push(atual); atual = []; tam = 0; }
    atual.push(t); tam += c;
  }
  if (atual.length) out.push(atual);
  return out;
}

// ---------- EXECUÇÃO ----------
export async function executar({
  raiz = process.cwd(),
  fetchFn = globalThis.fetch,
  dormir = dormirPadrao,
  log = console.log,
  agora = () => new Date(),
  prazoMs = PRAZO_MS,
  tmdbChave = process.env.TMDB_API_KEY,
  tmdbBase = process.env.TMDB_BASE || TMDB_API, // TMDB_BASE: só para teste local
} = {}) {
  const ARQ = join(raiz, 'telas/posteres.json');
  const fim = (codigo, gravou, extra = {}) => ({ codigo, gravou, ...extra });

  let dados;
  try { dados = await lerJson(join(raiz, 'telas/dados.json')); }
  catch (e) { log(`telas/dados.json ilegível (${e.message}) — não gravo nada`); return fim(1, false); }
  let catalogo = null;
  try { catalogo = await lerJson(join(raiz, 'telas/catalogo.json')); }
  catch (e) { if (e?.code !== 'ENOENT') log(`telas/catalogo.json ilegível (${e.message}) — sigo só com dados.json`); }
  let antes = {};
  try {
    const a = await lerJson(ARQ);
    if (a && a.itens && typeof a.itens === 'object' && !Array.isArray(a.itens)) antes = a.itens;
  } catch { /* primeira vez */ }

  const { ids, sagas, semImdb } = coletarTitulos(dados, catalogo);
  const porImdb = new Map(); // imdb -> [ids]
  for (const [id, imdb] of ids) porImdb.set(imdb, [...(porImdb.get(imdb) || []), id]);
  const imdbs = [...porImdb.keys()].sort();
  log(`títulos com IMDb: ${ids.size} (${imdbs.length} IMDb distintos); sem IMDb, ignorados: ${semImdb}; sagas: ${sagas.size}`);
  if (!imdbs.length) { log('nenhum título com imdb_id — não gravo nada'); return fim(1, false); }

  const prazo = Date.now() + prazoMs;
  const rede = criarRede({ fetchFn, dormir, prazo });
  const falhou = new Set(); // imdb com alguma consulta que falhou: guarda o dado anterior

  // 0) TMDB, a fonte principal (com a chave). O que ele já achou antes é reaproveitado e
  //    conferido de novo uma vez a cada TMDB_RENOVA dias, em rodízio.
  const chave = String(tmdbChave || '').trim().replace(/^Bearer\s+/i, '');
  const doTmdb = new Map(); // imdb -> entrada do TMDB
  let tmdbParou = '', tmdbConsultas = 0, tmdbFalhas = 0, tmdbSem = 0, tmdbReuso = 0;
  const velhoTmdb = imdb => porImdb.get(imdb).map(id => antes[id]).find(e => okTmdb(e) && e.imdb === imdb) || null;
  if (chave) {
    const tm = criarTmdb({ fetchFn, dormir, chave, base: String(tmdbBase).replace(/\/+$/, ''), prazo });
    const fila = [], hoje = agora();
    for (const imdb of imdbs) {
      const v = velhoTmdb(imdb);
      if (v && !diaDoCiclo(imdb, hoje)) { doTmdb.set(imdb, v); tmdbReuso++; } else fila.push(imdb);
    }
    const naoFeitos = new Set(fila);
    let seguidas = 0;
    const trabalhador = async () => {
      while (fila.length && !tmdbParou) {
        const imdb = fila.shift();
        try {
          const achado = await tm.find(imdb);
          tmdbConsultas++; seguidas = 0; naoFeitos.delete(imdb);
          const e = entradaTmdb(achado, imdb);
          if (e) doTmdb.set(imdb, e); else tmdbSem++;
        } catch (e) {
          tmdbFalhas++;
          if (e?.fatal) tmdbParou = e.message;
          else if (++seguidas >= TMDB_FALHAS_SEGUIDAS) tmdbParou = `${seguidas} falhas seguidas (${e.message})`;
          else if (/prazo/.test(e.message)) tmdbParou = e.message;
        }
        if (fila.length) await dormir(PAUSA_TMDB_MS);
      }
    };
    await Promise.all(Array.from({ length: TMDB_PARALELO }, trabalhador));
    // o que não deu para conferir hoje fica com o cartaz do TMDB que já tinha; sem ele, vai para a Wikipedia
    for (const imdb of naoFeitos) { const v = velhoTmdb(imdb); if (v) doTmdb.set(imdb, v); }
    log(`TMDB: ${doTmdb.size} de ${imdbs.length} IMDb com cartaz (consultados hoje: ${tmdbConsultas}, reaproveitados: ${tmdbReuso}, sem cartaz no TMDB: ${tmdbSem}, falhas: ${tmdbFalhas})` +
      (tmdbParou ? ` — parou: ${tmdbParou}; o resto vai para a Wikipedia` : ''));
  } else {
    log('sem TMDB_API_KEY: pôsteres só da Wikipedia');
  }
  const paraWiki = imdbs.filter(i => !doTmdb.has(i));

  // 1) Wikidata
  const artigos = new Map(); // imdb -> { pt, en }
  let sparqlOk = 0, sparqlFalhas = 0;
  for (const grupo of lote(paraWiki, LOTE_SPARQL)) {
    try {
      const r = await rede.wikidata(grupo);
      for (const [imdb, a] of r) artigos.set(imdb, a);
      sparqlOk++;
    } catch (e) {
      sparqlFalhas++;
      grupo.forEach(i => falhou.add(i));
      log(`lote do Wikidata falhou (${grupo[0]}…): ${e.message}`);
    }
  }
  // sem nenhum dado novo de lugar nenhum: não grava
  if (paraWiki.length && !sparqlOk && !doTmdb.size) { log('nenhuma consulta ao Wikidata funcionou — não gravo nada'); return fim(1, false); }
  if (paraWiki.length && !sparqlOk) log('nenhuma consulta ao Wikidata funcionou — gravo só o que veio do TMDB e mantenho o resto');
  if (paraWiki.length) log(`Wikidata: ${artigos.size} de ${paraWiki.length} IMDb achados; com artigo pt: ${[...artigos.values()].filter(a => a.pt).length}, en: ${[...artigos.values()].filter(a => a.en).length}`);

  // 2) Wikipedia: português primeiro, inglês para o que faltar
  let wikiOk = 0, wikiFalhas = 0, rejeitadasPt = 0;
  const consultar = async (wiki, titulos) => {
    const res = new Map(), ruins = new Set();
    for (const grupo of lotesDeTitulos([...new Set(titulos)].sort())) {
      try { for (const [t, pg] of await rede.imagens(wiki, grupo)) res.set(t, pg); wikiOk++; }
      catch (e) { wikiFalhas++; grupo.forEach(t => ruins.add(t)); log(`lote da ${wiki}.wikipedia falhou (${grupo[0]}…): ${e.message}`); }
    }
    return { res, ruins };
  };
  const escolha = new Map(); // imdb -> entrada
  const pt = await consultar('pt', [...artigos.values()].map(a => a.pt).filter(Boolean));
  const precisaEn = [];
  for (const [imdb, a] of artigos) {
    if (a.pt && pt.ruins.has(a.pt)) falhou.add(imdb);
    const pg = a.pt ? pt.res.get(a.pt) : null;
    const im = pg ? escolherImagem(pg) : null;
    if (im && pareceCartaz(pg.pageimage, pg.title, im.w, im.h)) {
      escolha.set(imdb, { ...im, pagina: urlPagina('pt', pg.title), wiki: 'pt' });
      continue;
    }
    if (im) rejeitadasPt++;
    if (a.en) precisaEn.push(imdb);
  }
  const en = await consultar('en', precisaEn.map(i => artigos.get(i).en));
  for (const imdb of precisaEn) {
    const t = artigos.get(imdb).en;
    if (en.ruins.has(t)) { falhou.add(imdb); continue; }
    const pg = en.res.get(t);
    const im = pg ? escolherImagem(pg) : null;
    if (im) escolha.set(imdb, { ...im, pagina: urlPagina('en', pg.title), wiki: 'en' });
  }
  const tentouWiki = wikiOk + wikiFalhas;
  if (tentouWiki && !wikiOk && !doTmdb.size) { log('nenhuma chamada à Wikipedia funcionou — não gravo nada'); return fim(1, false); }
  if (tentouWiki && !wikiOk) { log('nenhuma chamada à Wikipedia funcionou — gravo só o que veio do TMDB e mantenho o resto'); artigos.forEach((_, i) => falhou.add(i)); }

  // 3) monta o arquivo
  const okWiki = e => !!e && typeof e === 'object' && urlImagemOk(e.img) && dimOk(e.w) && dimOk(e.h) &&
    /^https:\/\/(pt|en)\.wikipedia\.org\/wiki\//.test(e.pagina || '') && (e.wiki === 'pt' || e.wiki === 'en');
  const ok = e => okTmdb(e) || okWiki(e);
  const limpa = e => (okTmdb(e)
    ? { img: e.img, w: e.w, h: e.h, pagina: e.pagina, fonte: 'tmdb', tmdb: e.tmdb, imdb: e.imdb }
    : { img: e.img, w: e.w, h: e.h, pagina: e.pagina, wiki: e.wiki });
  const itens = {};
  for (const [id, imdb] of ids) {
    // o TMDB vem primeiro; na Wikipedia, se alguma consulta deste título falhou hoje, mantém o
    // último dado bom, para não trocar o cartaz de um dia para o outro (só usa o novo se não havia nenhum)
    let e = doTmdb.get(imdb) || escolha.get(imdb) || null;
    if (!doTmdb.has(imdb) && falhou.has(imdb) && ok(antes[id])) e = antes[id];
    if (e && ok(e)) itens[id] = limpa(e);
  }
  for (const [saga, filmes] of sagas) {
    const primeiro = filmes.find(f => itens[f]);
    if (primeiro) itens[saga] = { ...itens[primeiro] };
  }
  const novo = ordenar(itens);
  const n = Object.keys(novo).length;
  const contar = w => Object.values(novo).filter(e => e.wiki === w).length;
  const nTmdb = Object.values(novo).filter(e => e.fonte === 'tmdb').length;
  log(`pôsteres: ${n} (TMDB: ${nTmdb}, pt: ${contar('pt')}, en: ${contar('en')}); imagem pt recusada por não parecer cartaz: ${rejeitadasPt}; lotes com falha: Wikidata ${sparqlFalhas}, Wikipedia ${wikiFalhas}`);
  const parcial = !!(sparqlFalhas || wikiFalhas || tmdbParou);

  // trava: se sumir mais da metade do que já existia para os mesmos títulos, algo quebrou
  const vivos = new Set([...ids.keys(), ...sagas.keys()]);
  const antesVivos = Object.keys(antes).filter(k => vivos.has(k) && ok(antes[k])).length;
  if (antesVivos >= 10 && n < antesVivos / 2) {
    log(`queda suspeita: ${antesVivos} pôsteres antes, ${n} agora — não gravo nada`);
    return fim(1, false, { itens: novo });
  }

  // Só grava quando algo muda (sem contar o gerado_em): assim não há commit nem deploy à toa.
  if (JSON.stringify(novo) === JSON.stringify(ordenar(antes))) {
    log('pôsteres: nada mudou');
    return fim(0, false, { itens: novo, parcial });
  }
  await writeFile(ARQ, JSON.stringify({ gerado_em: agora().toISOString(), fonte: nTmdb ? FONTE_TMDB : FONTE, itens: novo }, null, 1) + '\n');
  log(`pôsteres: gravado (${n} títulos)`);
  return fim(0, true, { itens: novo, parcial });
}

// ---------- LINHA DE COMANDO ----------
const principal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (principal) {
  const r = await executar();
  if (r.parcial) console.log('::warning::Pôsteres: parte das consultas (TMDB ou Wikipedia) falhou; mantive o último dado bom desses títulos');
  process.exitCode = r.codigo;
}
