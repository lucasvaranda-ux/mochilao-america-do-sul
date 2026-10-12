// Robô de sagas do Telas/Whatch: completa as sagas pelas coleções do TMDB (belongs_to_collection).
// Para cada filme do catálogo e da página, descobre a coleção do TMDB a que ele pertence; para cada coleção com algum
// filme nosso, busca as partes. As partes que não estão no catálogo (o último Avatar, as continuações de Matrix...)
// entram como itens novos, com país, gêneros, popularidade e dimensões herdados dos filmes da mesma coleção que já
// temos (marcados com origem "tmdb-colecao"); com 2 filmes ou mais, a coleção vira saga em catalogo.json > sagas
// (ou completa a saga que já existe com aqueles filmes). As sagas de dados.json > extras (Harry Potter, O Senhor dos
// Anéis, Animais Fantásticos) são curadas à mão e ficam de fora.
// Lembra a coleção de cada filme em telas/sagas-tmdb.json (de novo só depois de 30 dias). Só entram partes lançadas
// (ou que estreiam nos próximos 6 meses). Precisa do segredo TMDB_API_KEY; sem ele, não faz nada. Node 20+.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarTmdb, formatoCatalogo, normTitulo, anoDe } from './telas-ids.mjs';

const REPETE_DIAS = 30;
const PRAZO_MS = 6 * 60000;
const NOVOS_MAX = 250;          // por rodada: um catálogo que dobra de tamanho de uma vez não é o que se quer
const IMDB = /^tt\d{7,10}$/;
const dormirPadrao = ms => new Promise(r => setTimeout(r, ms));
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));

export function slug(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}
// "Avatar - Coleção", "Coleção Matrix", "The Matrix Collection" -> "Avatar", "Matrix", "The Matrix"
export function nomeColecao(n) {
  return String(n || '').replace(/\s*[-–:]\s*(cole[çc][ãa]o|collection|saga)\s*$/i, '').replace(/^(cole[çc][ãa]o|saga)\s+(de\s+|do\s+|da\s+)?/i, '')
    .replace(/\s+(collection|cole[çc][ãa]o)$/i, '').trim();
}
const media = l => { const ok = l.filter(d => Array.isArray(d) && d.length === 9); if (!ok.length) return null; return Array.from({ length: 9 }, (_, i) => Math.round(ok.reduce((a, d) => a + (+d[i] || 0), 0) / ok.length)); };
const uniao = ls => [...new Set(ls.flat().filter(Boolean))];

export async function executar({
  raiz = process.cwd(), fetchFn = globalThis.fetch, dormir = dormirPadrao, log = console.log, agora = () => new Date(),
  prazoMs = PRAZO_MS, chave = process.env.TMDB_API_KEY, base = process.env.TMDB_BASE || undefined,
} = {}) {
  if (!String(chave || '').trim()) { log('sem TMDB_API_KEY: sagas não foram completadas'); return { codigo: 0, gravou: false }; }
  const ARQ_CAT = join(raiz, 'telas/catalogo.json'), ARQ_DADOS = join(raiz, 'telas/dados.json'), ARQ_CACHE = join(raiz, 'telas/sagas-tmdb.json');
  let catalogo, dados, cache = { sobre: 'Coleção do TMDB de cada filme (scripts/telas-sagas.mjs). null = não pertence a nenhuma.', filmes: {} };
  try { catalogo = await lerJson(ARQ_CAT); dados = await lerJson(ARQ_DADOS); } catch (e) { log(`arquivo ilegível (${e.message}) — não gravo nada`); return { codigo: 1, gravou: false }; }
  try { const c = await lerJson(ARQ_CACHE); if (c && c.filmes) cache = c; } catch { /* primeira vez */ }
  const tmdb = criarTmdb({ chave, ...(base ? { base } : {}), fetchFn, dormir });
  const hoje = agora(), prazo = Date.now() + prazoMs, hojeStr = hoje.toISOString().slice(0, 10);
  const limiteData = new Date(hoje.getTime() + 182 * 864e5).toISOString().slice(0, 10);

  // os filmes nossos: catálogo (filmes), página (filmes) e filmes avulsos de extras; as sagas curadas de extras ficam de fora
  const nossos = [];
  for (const it of catalogo.itens || []) if (it && it.tipo === 'filme') nossos.push({ it, onde: 'cat' });
  for (const it of dados.filmes || []) if (it) nossos.push({ it, onde: 'dados' });
  for (const ex of dados.extras || []) if (ex && ex.tipo === 'filme') nossos.push({ it: ex, onde: 'dados' });
  const curados = new Set();
  for (const ex of dados.extras || []) if (ex && ex.tipo === 'saga') for (const f of ex.filmes || []) { if (f.id) curados.add(f.id); if (f.tmdb_id) curados.add('tmdb:' + f.tmdb_id); if (f.imdb_id) curados.add(f.imdb_id); }

  // 1) a coleção de cada filme (com cache)
  const recente = c => { const d = Date.parse(c?.em || ''); return isFinite(d) && hoje - d < REPETE_DIAS * 864e5; };
  let consultas = 0, falhas = 0;
  for (const { it } of nossos) {
    if (Date.now() > prazo) { log('prazo: paro de procurar coleções e gravo o que achei'); break; }
    const c = cache.filmes[it.id];
    if (c && recente(c)) continue;
    try {
      let id = +it.tmdb_id || null;
      if (!id && IMDB.test(String(it.imdb_id || ''))) { const f = await tmdb(`/find/${it.imdb_id}`, { external_source: 'imdb_id' }); id = f?.movie_results?.[0]?.id || null; consultas++; }
      if (!id) { cache.filmes[it.id] = { tmdb: null, colecao: null, em: hojeStr }; continue; }
      const m = await tmdb(`/movie/${id}`, { language: 'pt-BR' }); consultas++;
      cache.filmes[it.id] = { tmdb: id, colecao: m?.belongs_to_collection?.id || null, em: hojeStr };
    } catch (e) { if (e.fatal) { log(e.message); return { codigo: 1, gravou: false }; } if (++falhas > 6) { log('TMDB falhando: paro'); break; } }
  }
  log(`coleções: ${consultas} consultas ao TMDB`);

  // 2) agrupa por coleção
  const porColecao = new Map(), porTmdb = new Map(), porId = new Map();
  for (const n of nossos) {
    porId.set(n.it.id, n.it);
    const c = cache.filmes[n.it.id];
    if (c?.tmdb) porTmdb.set(c.tmdb, n.it.id);
    if (c?.colecao) { if (!porColecao.has(c.colecao)) porColecao.set(c.colecao, []); porColecao.get(c.colecao).push(n.it.id); }
  }
  const sagaDe = new Map();
  for (const s of catalogo.sagas || []) for (const f of s.filmes || []) sagaDe.set(f, s);
  const idsUsados = new Set([...(catalogo.itens || []).map(x => x.id), ...(dados.filmes || []).map(x => x.id), ...(dados.series || []).map(x => x.id), ...(dados.extras || []).map(x => x.id), ...(catalogo.sagas || []).map(x => x.id)]);
  const porTituloAno = new Map();
  for (const n of nossos) porTituloAno.set(normTitulo(n.it.titulo) + '|' + anoDe(n.it.ano), n.it.id);

  let novos = 0, sagasNovas = 0, sagasMaiores = 0;
  for (const [col, ids] of porColecao) {
    if (Date.now() > prazo || novos >= NOVOS_MAX) break;
    if (ids.some(id => curados.has(id) || curados.has(porId.get(id)?.imdb_id))) continue; // Harry Potter & cia: curadas à mão
    let pt, en;
    try { pt = await tmdb(`/collection/${col}`, { language: 'pt-BR' }); en = await tmdb(`/collection/${col}`, { language: 'en-US' }); }
    catch (e) { if (e.fatal) { log(e.message); return { codigo: 1, gravou: false }; } continue; }
    if (!pt?.parts?.length) continue;
    const enPor = new Map((en?.parts || []).map(p => [p.id, p]));
    const partes = pt.parts.filter(p => p && p.release_date && p.release_date <= limiteData).sort((a, b) => a.release_date.localeCompare(b.release_date));
    const base = ids.map(id => porId.get(id)).filter(Boolean);
    const herda = {
      pais: base[0]?.pais || '', generos: uniao(base.map(b => b.generos || [])), dims: media(base.map(b => b.dims)),
      pop: Math.max(2, Math.min(...base.map(b => +b.pop || 3))), autor: '',
    };
    const membros = [];
    for (const p of partes) {
      let id = porTmdb.get(p.id) || porTituloAno.get(normTitulo(p.title) + '|' + anoDe(p.release_date)) || porTituloAno.get(normTitulo(p.original_title) + '|' + anoDe(p.release_date));
      if (!id) {
        if (novos >= NOVOS_MAX || !herda.dims) continue;
        let imdb = '';
        try { const ext = await tmdb(`/movie/${p.id}/external_ids`); imdb = String(ext?.imdb_id || ''); } catch { /* sem IMDb: entra assim mesmo */ }
        const ano = String(anoDe(p.release_date) || '');
        let nid = slug(p.title || p.original_title) + '-' + ano, k = 2;
        while (idsUsados.has(nid)) nid = slug(p.title || p.original_title) + '-' + ano + '-' + (k++);
        const enP = enPor.get(p.id);
        const item = { id: nid, tipo: 'filme', titulo: p.title || p.original_title, titulo_original: p.original_title || p.title, titulo_en: enP?.title || p.original_title || p.title, ano,
          autor: herda.autor, pais: herda.pais, generos: herda.generos, pop: herda.pop, dims: herda.dims, tmdb_id: p.id, origem: 'tmdb-colecao' };
        if (IMDB.test(imdb)) item.imdb_id = imdb;
        catalogo.itens.push(item); idsUsados.add(nid); porTmdb.set(p.id, nid); porId.set(nid, item);
        cache.filmes[nid] = { tmdb: p.id, colecao: col, em: hojeStr };
        id = nid; novos++;
      }
      membros.push(id);
    }
    if (membros.length < 2) continue;
    const existente = membros.map(id => sagaDe.get(id)).find(Boolean);
    const itens = membros.map(id => porId.get(id)).filter(Boolean);
    const anos = itens.map(x => anoDe(x.ano)).filter(Boolean);
    if (existente) {
      const antes = existente.filmes.length;
      for (const id of membros) if (!existente.filmes.includes(id)) existente.filmes.push(id);
      existente.filmes.sort((a, b) => (anoDe(porId.get(a)?.ano) || 0) - (anoDe(porId.get(b)?.ano) || 0));
      if (existente.filmes.length > antes) { sagasMaiores++; const as = existente.filmes.map(id => anoDe(porId.get(id)?.ano)).filter(Boolean); existente.anos = Math.min(...as) + '–' + Math.max(...as); }
      continue;
    }
    const nome = nomeColecao(pt.name) || nomeColecao(en?.name) || itens[0].titulo;
    let sid = 'saga-' + slug(nome), k = 2; while (idsUsados.has(sid)) sid = 'saga-' + slug(nome) + '-' + (k++);
    const saga = { id: sid, tipo: 'saga', titulo: nome, titulo_original: nomeColecao(en?.name) || nome, titulo_en: nomeColecao(en?.name) || nome, ano: String(Math.min(...anos)), anos: Math.min(...anos) + '–' + Math.max(...anos),
      pais: herda.pais, autor: uniao(itens.map(x => x.autor)).join(', '), generos: uniao(itens.map(x => x.generos || [])), pop: Math.max(...itens.map(x => +x.pop || 1)),
      dims: media(itens.map(x => x.dims)) || herda.dims, filmes: membros, origem: 'tmdb-colecao' };
    (catalogo.sagas = catalogo.sagas || []).push(saga); idsUsados.add(sid); membros.forEach(id => sagaDe.set(id, saga)); sagasNovas++;
  }
  log(`sagas: ${novos} filmes novos no catálogo, ${sagasNovas} sagas novas, ${sagasMaiores} sagas completadas`);
  await writeFile(ARQ_CACHE, JSON.stringify(cache, null, 1) + '\n');
  if (novos || sagasNovas || sagasMaiores) { await writeFile(ARQ_CAT, formatoCatalogo(catalogo)); return { codigo: 0, gravou: true, novos, sagasNovas, sagasMaiores }; }
  return { codigo: 0, gravou: false, novos, sagasNovas, sagasMaiores };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  executar().then(r => process.exit(r.codigo)).catch(e => { console.error(e); process.exit(1); });
}
