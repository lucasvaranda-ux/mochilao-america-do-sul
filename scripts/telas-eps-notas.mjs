// Robô das notas por episódio do Telas/Whatch: a nota e os votos do IMDb de cada episódio das séries com imdb_id
// (catálogo, página e extras), das bases públicas do IMDb (datasets.imdbws.com: title.episode e title.ratings, uso não
// comercial). Grava um arquivo por série, telas/eps-notas/<tt da série>.json = {"<temporada>": [[episódio, nota, votos], …]}
// (votos arredondados a 2 algarismos), que a folha da série busca quando abre. Só regrava o arquivo que mudou e apaga o
// das séries que saíram. Node 20+, sem dependências.

import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arredonda } from './telas-notas.mjs';

const URL_EPS = 'https://datasets.imdbws.com/title.episode.tsv.gz';
const URL_NOTAS = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const IMDB = /^tt\d{7,10}$/;
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));

export function seriesDe(catalogo, dados) {
  const s = new Set(), poe = it => { if (it && IMDB.test(String(it.imdb_id || ''))) s.add(it.imdb_id); };
  (catalogo?.itens || []).filter(x => x && x.tipo === 'serie').forEach(poe);
  (dados?.series || []).forEach(poe);
  (dados?.extras || []).filter(x => x && x.tipo === 'serie').forEach(poe);
  return s;
}
// title.episode: tconst, parentTconst, seasonNumber, episodeNumber -> só os episódios das nossas séries
export async function lerEpisodios(linhas, series) {
  const eps = new Map();
  for await (const l of linhas) {
    const c = l.split('\t'); if (c.length < 4 || !series.has(c[1])) continue;
    const t = parseInt(c[2], 10), e = parseInt(c[3], 10);
    if (t > 0 && e > 0 && t < 200 && e < 5000) eps.set(c[0], [c[1], t, e]);
  }
  return eps;
}
// title.ratings: tconst, averageRating, numVotes -> por série, por temporada
export async function lerNotasEps(linhas, eps) {
  const out = {};
  for await (const l of linhas) {
    const i = l.indexOf('\t'); if (i < 0) continue;
    const ep = eps.get(l.slice(0, i)); if (!ep) continue;
    const [, nota, votos] = l.split('\t');
    const n = Math.round(parseFloat(nota) * 10) / 10, v = parseInt(votos, 10);
    if (!isFinite(n) || !isFinite(v) || v <= 0) continue;
    const [pai, t, e] = ep, s = (out[pai] ||= {}), lt = (s[t] ||= []);
    lt.push([e, n, arredonda(v)]);
  }
  for (const pai in out) for (const t in out[pai]) out[pai][t].sort((a, b) => a[0] - b[0]);
  return out;
}

const abre = async (fetchFn, url) => {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'telas-mochilao/1.0' } });
  if (!r.ok || !r.body) throw new Error(`IMDb respondeu ${r.status} em ${url.split('/').pop()}`);
  return createInterface({ input: Readable.fromWeb(r.body).pipe(createGunzip()), crlfDelay: Infinity });
};

export async function executar({ raiz = process.cwd(), fetchFn = globalThis.fetch, log = console.log } = {}) {
  let catalogo, dados;
  try { catalogo = await lerJson(join(raiz, 'telas/catalogo.json')); dados = await lerJson(join(raiz, 'telas/dados.json')); }
  catch (e) { log(`arquivo ilegível (${e.message})`); return { codigo: 1, gravou: 0 }; }
  const series = seriesDe(catalogo, dados);
  let notas;
  try {
    const eps = await lerEpisodios(await abre(fetchFn, URL_EPS), series);
    notas = await lerNotasEps(await abre(fetchFn, URL_NOTAS), eps);
  } catch (e) { log(e.message); return { codigo: 1, gravou: 0 }; }
  const DIR = join(raiz, 'telas/eps-notas'); await mkdir(DIR, { recursive: true });
  let gravou = 0, apagou = 0;
  for (const pai of Object.keys(notas)) {
    const arq = join(DIR, pai + '.json'), novo = JSON.stringify(notas[pai]) + '\n';
    let antes = ''; try { antes = await readFile(arq, 'utf8'); } catch { /* novo */ }
    if (antes !== novo) { await writeFile(arq, novo); gravou++; }
  }
  for (const f of await readdir(DIR)) {
    const m = /^(tt\d+)\.json$/.exec(f);
    if (m && !notas[m[1]]) { await unlink(join(DIR, f)); apagou++; }
  }
  const nEps = Object.values(notas).reduce((a, s) => a + Object.values(s).reduce((b, l) => b + l.length, 0), 0);
  log(`notas por episódio: ${Object.keys(notas).length} de ${series.size} séries, ${nEps} episódios; ${gravou} arquivos regravados, ${apagou} apagados`);
  return { codigo: 0, gravou, apagou, series: Object.keys(notas).length };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  executar().then(r => process.exit(r.codigo)).catch(e => { console.error(e); process.exit(1); });
}
