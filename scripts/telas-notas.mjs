// Robô de notas do Telas/Whatch: a nota e os votos do IMDb de todos os títulos com imdb_id (catálogo e página),
// da base pública do IMDb (https://datasets.imdbws.com/title.ratings.tsv.gz, atualizada todo dia, uso não comercial).
// Grava telas/notas.json: {gerado_em, fonte, itens: {tt…: [nota, votos]}}. Os votos vão arredondados a 2 algarismos
// (24.312 → 24.000), para o arquivo não mudar todo dia por pouco; só regrava quando algo muda. Node 20+, sem dependências.
// As notas pesquisadas à mão em dados.json (IMDb, Rotten, Metacritic, Letterboxd) continuam valendo onde existem.

import { readFile, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_IMDB = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const IMDB = /^tt\d{7,10}$/;
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));
export const arredonda = v => { v = Math.round(+v || 0); if (v < 100) return v; const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };

// os IMDb IDs que interessam: catálogo, página, extras e filmes das sagas de extras
export function idsDe(catalogo, dados) {
  const s = new Set(), poe = it => { if (it && IMDB.test(String(it.imdb_id || ''))) s.add(it.imdb_id); };
  (catalogo?.itens || []).forEach(poe);
  [...(dados?.filmes || []), ...(dados?.series || [])].forEach(poe);
  for (const ex of dados?.extras || []) { poe(ex); (ex?.filmes || []).forEach(poe); }
  return s;
}
// lê o TSV linha a linha (são ~1,5 milhão) e guarda só os nossos
export async function lerNotas(linhas, ids) {
  const out = {};
  for await (const l of linhas) {
    const t = l.indexOf('\t'); if (t < 0) continue;
    const id = l.slice(0, t); if (!ids.has(id)) continue;
    const [, nota, votos] = l.split('\t');
    const n = Math.round(parseFloat(nota) * 10) / 10, v = parseInt(votos, 10);
    if (isFinite(n) && isFinite(v) && v > 0) out[id] = [n, arredonda(v)];
  }
  return out;
}

export async function executar({ raiz = process.cwd(), fetchFn = globalThis.fetch, log = console.log, agora = () => new Date() } = {}) {
  let catalogo, dados;
  try { catalogo = await lerJson(join(raiz, 'telas/catalogo.json')); dados = await lerJson(join(raiz, 'telas/dados.json')); }
  catch (e) { log(`arquivo ilegível (${e.message})`); return { codigo: 1, gravou: false }; }
  const ids = idsDe(catalogo, dados);
  const r = await fetchFn(URL_IMDB, { headers: { 'User-Agent': 'telas-mochilao/1.0' } });
  if (!r.ok || !r.body) { log(`IMDb respondeu ${r.status}`); return { codigo: 1, gravou: false }; }
  const linhas = createInterface({ input: Readable.fromWeb(r.body).pipe(createGunzip()), crlfDelay: Infinity });
  const itens = await lerNotas(linhas, ids);
  const ARQ = join(raiz, 'telas/notas.json');
  let antes = null; try { antes = await lerJson(ARQ); } catch { /* primeira vez */ }
  log(`notas do IMDb: ${Object.keys(itens).length} de ${ids.size} títulos`);
  if (antes && JSON.stringify(antes.itens) === JSON.stringify(itens)) { log('sem mudança'); return { codigo: 0, gravou: false }; }
  await writeFile(ARQ, JSON.stringify({ gerado_em: agora().toISOString().slice(0, 10), fonte: 'IMDb (datasets.imdbws.com, title.ratings)', itens }) + '\n');
  return { codigo: 0, gravou: true, n: Object.keys(itens).length };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  executar().then(r => process.exit(r.codigo)).catch(e => { console.error(e); process.exit(1); });
}
