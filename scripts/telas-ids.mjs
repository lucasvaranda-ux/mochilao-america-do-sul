// Robô de IDs do Telas: completa o imdb_id (e o tmdb_id) dos títulos de telas/catalogo.json e telas/dados.json
// que ainda não têm. Os outros robôs (pôsteres e onde assistir) dependem do IMDb ID; sem ele, o título fica
// sem cartaz e sem "onde assistir".
// Fonte: API do TMDB (/search/movie ou /search/tv, depois /{tipo}/{id}/external_ids).
// Só aceita casamento seguro: o título normalizado (sem acento, pontuação e artigo inicial) igual a um dos títulos
// do resultado, o ano com folga de 1 e um único candidato assim. O resto fica sem ID e vai para a lista de dúvidas
// (telas/ids-pendentes.json), que também evita procurar de novo todo dia o que não casou (de novo só após 30 dias).
// Precisa do segredo TMDB_API_KEY (chave v3 ou token de leitura v4, como o robô de onde assistir). Sem ele, não faz nada.
// Node 20+, sem dependências.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TMDB_API = 'https://api.themoviedb.org/3';
const PAUSA_MS = 60;             // o TMDB aceita ~50 por segundo; folga
const TEMPO_MS = 15000;          // limite de cada requisição
const FALHAS_SEGUIDAS_MAX = 6;   // TMDB fora do ar: para cedo e grava o que já achou
const PRAZO_MS = 6 * 60000;      // o passo do workflow tem 8 min
const REPETE_DIAS = 30;          // o que não casou só é procurado de novo depois disso
const IMDB = /^tt\d{7,10}$/;

const dormirPadrao = ms => new Promise(r => setTimeout(r, ms));
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));

// ---------- NORMALIZAÇÃO ----------
const ARTIGOS = /^(the|a|an|o|a|os|as|um|uma|el|la|los|las|le|les|il|lo|der|die|das)\s+/;
export function normTitulo(s) {
  const t = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  return t.replace(ARTIGOS, '');
}
export const anoDe = s => { const m = String(s ?? '').match(/\d{4}/); return m ? +m[0] : null; };

// os títulos de um item que valem para casar (pt, original, inglês), sem repetir
export function titulosDe(it) {
  return [...new Set([it.titulo_original, it.titulo_en, it.titulo].filter(Boolean).map(String))];
}

// Escolhe o resultado seguro numa lista de resultados do TMDB: título normalizado igual a um dos do item, ano ±1.
// Devolve {ok: resultado} ou {duvida: motivo}. Mais de um candidato com ids diferentes é dúvida, não palpite.
export function escolher(it, tipo, resultados) {
  const ano = anoDe(it.ano);
  const meus = new Set(titulosDe(it).map(normTitulo).filter(Boolean));
  const cands = new Map();
  for (const r of Array.isArray(resultados) ? resultados : []) {
    if (!r || typeof r.id !== 'number') continue;
    const nomes = tipo === 'movie' ? [r.title, r.original_title] : [r.name, r.original_name];
    if (!nomes.some(n => n && meus.has(normTitulo(n)))) continue;
    const a = anoDe(tipo === 'movie' ? r.release_date : r.first_air_date);
    if (!ano || !a || Math.abs(a - ano) > 1) continue;
    cands.set(r.id, r);
  }
  if (cands.size === 1) return { ok: [...cands.values()][0] };
  if (cands.size > 1) return { duvida: `${cands.size} candidatos com o mesmo título e ano` };
  return { duvida: 'nenhum resultado com o mesmo título e ano (±1)' };
}

// ---------- TMDB ----------
export function criarTmdb({ chave, base = TMDB_API, fetchFn = globalThis.fetch, dormir = dormirPadrao }) {
  const k = String(chave || '').trim().replace(/^Bearer\s+/i, '');
  const v4 = k.startsWith('eyJ'); // token de leitura (v4) é um JWT; a chave v3 é hexadecimal
  // o caminho entra nas mensagens de erro; a URL completa não, porque a chave v3 vai nela
  return async function tmdb(caminho, params = {}) {
    const u = new URL(base + caminho);
    for (const [n, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(n, String(v));
    if (!v4) u.searchParams.set('api_key', k);
    const headers = { accept: 'application/json', 'User-Agent': 'telas-mochilao/1.0' };
    if (v4) headers.Authorization = 'Bearer ' + k;
    for (let t = 0; t < 3; t++) {
      let r;
      try { r = await fetchFn(u, { headers, signal: AbortSignal.timeout(TEMPO_MS) }); }
      catch { await dormir(1500 * (t + 1)); continue; }
      if (r.status === 429 || r.status >= 500) { await dormir(1000 * (t + 1)); continue; }
      if (r.status === 404) return null;
      if (r.status === 401) throw Object.assign(new Error('o TMDB recusou a chave (401)'), { fatal: true });
      if (!r.ok) throw new Error(`${r.status} em ${caminho}`);
      await dormir(PAUSA_MS);
      return r.json();
    }
    throw new Error(`sem resposta em ${caminho}`);
  };
}

// Procura um item: cada título (original, inglês, pt), com o ano e, sem achado, sem o ano; em pt-BR e, sem
// achado, em inglês (o "title" do resultado muda com a língua). Para no primeiro casamento seguro.
export async function procurar(tmdb, it, tipo) {
  const ano = anoDe(it.ano);
  let duvida = 'nenhum resultado com o mesmo título e ano (±1)';
  for (const lingua of ['pt-BR', 'en-US']) {
    for (const q of titulosDe(it)) {
      for (const comAno of ano ? [true, false] : [false]) {
        const params = { query: q, language: lingua, include_adult: 'false' };
        if (comAno) params[tipo === 'movie' ? 'year' : 'first_air_date_year'] = ano;
        const busca = await tmdb(`/search/${tipo}`, params);
        const e = escolher(it, tipo, busca?.results);
        if (e.ok) {
          const ext = await tmdb(`/${tipo}/${e.ok.id}/external_ids`);
          const imdb = String(ext?.imdb_id || '').trim();
          if (!IMDB.test(imdb)) return { duvida: `TMDB ${tipo}/${e.ok.id} sem IMDb`, tmdb: e.ok.id };
          return { imdb, tmdb: e.ok.id };
        }
        if (/candidatos/.test(e.duvida)) duvida = e.duvida; // ambíguo: não adianta tentar sem o ano
        if (/candidatos/.test(e.duvida)) return { duvida };
      }
    }
  }
  return { duvida };
}

// os itens sem imdb_id: catálogo (itens), dados.json (filmes, series, extras e os filmes das sagas de extras)
export function semImdb(catalogo, dados) {
  const out = [];
  const tipoDe = (it, padrao) => (it.tipo === 'serie' ? 'tv' : it.tipo === 'filme' ? 'movie' : padrao);
  const poe = (it, padrao, onde) => {
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !it.titulo) return;
    if (IMDB.test(String(it.imdb_id || ''))) return;
    out.push({ it, tipo: tipoDe(it, padrao), onde });
  };
  for (const it of catalogo?.itens || []) poe(it, it?.tipo === 'serie' ? 'tv' : 'movie', 'catalogo');
  for (const it of dados?.filmes || []) poe(it, 'movie', 'dados');
  for (const it of dados?.series || []) poe(it, 'tv', 'dados');
  for (const ex of dados?.extras || []) {
    if (ex?.tipo === 'saga') { for (const f of ex.filmes || []) poe(f, 'movie', 'dados'); continue; }
    poe(ex, ex?.tipo === 'filme' ? 'movie' : 'tv', 'dados');
  }
  return out;
}

// os mesmos formatos dos arquivos de hoje: catalogo.json com um item por linha; dados.json numa linha só
export function formatoCatalogo(o) {
  const J = x => JSON.stringify(x);
  return '{' + Object.entries(o).map(([k, v]) => {
    if (Array.isArray(v)) return J(k) + ':[\n' + v.map(J).join(',\n') + '\n]';
    if (v && typeof v === 'object') return J(k) + ':{\n' + Object.entries(v).map(([kk, vv]) =>
      J(kk) + (Array.isArray(vv) ? ':[\n' + vv.map(J).join(',\n') + '\n]' : ':' + J(vv))).join(',\n') + '\n}';
    return J(k) + ':' + J(v);
  }).join(',\n') + '}\n';
}

// ---------- EXECUÇÃO ----------
export async function executar({
  raiz = process.cwd(),
  fetchFn = globalThis.fetch,
  dormir = dormirPadrao,
  log = console.log,
  agora = () => new Date(),
  prazoMs = PRAZO_MS,
  chave = process.env.TMDB_API_KEY,
  base = process.env.TMDB_BASE || TMDB_API, // TMDB_BASE: só para teste local
} = {}) {
  const fim = (codigo, gravou, extra = {}) => ({ codigo, gravou, ...extra });
  if (!String(chave || '').trim()) { log('sem TMDB_API_KEY: IDs não foram procurados'); return fim(0, false); }
  const ARQ_CAT = join(raiz, 'telas/catalogo.json'), ARQ_DADOS = join(raiz, 'telas/dados.json'), ARQ_PEND = join(raiz, 'telas/ids-pendentes.json');
  let catalogo, dados;
  try { catalogo = await lerJson(ARQ_CAT); } catch (e) { log(`telas/catalogo.json ilegível (${e.message}) — não gravo nada`); return fim(1, false); }
  try { dados = await lerJson(ARQ_DADOS); } catch (e) { log(`telas/dados.json ilegível (${e.message}) — não gravo nada`); return fim(1, false); }
  let pend = {};
  try { const p = await lerJson(ARQ_PEND); if (p && p.itens && typeof p.itens === 'object') pend = p.itens; } catch { /* primeira vez */ }

  // IMDb já usados: um achado que repete o de outro título é dúvida (dois títulos não podem ser a mesma obra)
  const usados = new Map();
  const marca = (it) => { if (it && IMDB.test(String(it.imdb_id || ''))) usados.set(it.imdb_id, it.id); };
  (catalogo.itens || []).forEach(marca);
  [...(dados.filmes || []), ...(dados.series || [])].forEach(marca);
  for (const ex of dados.extras || []) { marca(ex); for (const f of ex?.filmes || []) marca(f); }

  const hoje = agora();
  const recente = id => { const d = Date.parse(pend[id]?.tentado_em || ''); return isFinite(d) && hoje - d < REPETE_DIAS * 864e5; };
  const fila = semImdb(catalogo, dados).filter(x => !recente(x.it.id));
  log(`sem imdb_id: ${semImdb(catalogo, dados).length}; nesta rodada: ${fila.length} (os outros foram tentados há menos de ${REPETE_DIAS} dias)`);
  if (!fila.length) return fim(0, false);

  const tmdb = criarTmdb({ chave, base, fetchFn, dormir });
  const prazo = Date.now() + prazoMs;
  let achados = 0, mudouCat = false, mudouDados = false, seguidas = 0, falhas = 0;
  const duvidas = [];
  for (const { it, tipo, onde } of fila) {
    if (Date.now() > prazo) { log('prazo: paro aqui e gravo o que achei (o resto fica para amanhã)'); break; }
    let r;
    try { r = await procurar(tmdb, it, tipo); seguidas = 0; }
    catch (e) {
      if (e.fatal) { log(e.message); return fim(1, false); }
      falhas++; seguidas++; log(`falhou ${it.id}: ${e.message}`);
      if (seguidas >= FALHAS_SEGUIDAS_MAX) { log(`${seguidas} falhas seguidas — o TMDB parece fora do ar; gravo só o que já achei`); break; }
      continue;
    }
    if (r.imdb && usados.has(r.imdb) && usados.get(r.imdb) !== it.id) r = { duvida: `o IMDb ${r.imdb} já é de ${usados.get(r.imdb)}`, tmdb: r.tmdb };
    if (r.imdb) {
      it.imdb_id = r.imdb; it.tmdb_id = r.tmdb; usados.set(r.imdb, it.id); achados++;
      if (onde === 'catalogo') mudouCat = true; else mudouDados = true;
      delete pend[it.id];
    } else {
      pend[it.id] = { titulo: it.titulo, ano: String(it.ano || ''), tipo: tipo === 'tv' ? 'serie' : 'filme', motivo: r.duvida, tentado_em: hoje.toISOString().slice(0, 10) };
      duvidas.push(`${it.titulo} (${it.ano || '?'}): ${r.duvida}`);
    }
  }
  log(`IDs achados: ${achados}; dúvidas: ${duvidas.length}; falhas: ${falhas}`);
  if (duvidas.length) log('dúvidas (ficaram sem ID):\n- ' + duvidas.slice(0, 200).join('\n- ') + (duvidas.length > 200 ? `\n… e mais ${duvidas.length - 200}` : ''));
  if (mudouCat) await writeFile(ARQ_CAT, formatoCatalogo(catalogo));
  if (mudouDados) await writeFile(ARQ_DADOS, JSON.stringify(dados));
  const pendOrd = Object.fromEntries(Object.keys(pend).sort().map(k => [k, pend[k]]));
  await writeFile(ARQ_PEND, JSON.stringify({ sobre: 'Títulos sem IMDb ID que o robô de IDs (scripts/telas-ids.mjs) não casou com segurança no TMDB. Conferir à mão e pôr o imdb_id no catálogo ou em dados.json.', itens: pendOrd }, null, 1) + '\n');
  return fim(0, mudouCat || mudouDados, { achados, duvidas });
}

// ---------- LINHA DE COMANDO ----------
const principal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (principal) {
  const r = await executar();
  process.exitCode = r.codigo;
}
