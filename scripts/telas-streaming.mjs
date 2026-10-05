// Robô de streaming do Telas: onde cada título da lista está disponível no Brasil —
// assinatura, grátis, com anúncios, aluguel e compra — e grava telas/streaming.json.
// Fonte: API do TMDB, cujos dados de "onde assistir" vêm do JustWatch.
// Precisa do segredo TMDB_API_KEY (chave v3 ou token de leitura v4). Sem ele, não faz nada.
// Node 20+, sem dependências.

import { readFile, writeFile } from 'node:fs/promises';

const PAIS = 'BR';
const ARQ = 'telas/streaming.json';
const PAUSA_MS = 80; // o TMDB aceita bem mais que isso; folga para não incomodar
const CHAVE = (process.env.TMDB_API_KEY || '').trim();

if (!CHAVE) {
  console.log('sem TMDB_API_KEY: onde assistir não foi atualizado');
  process.exit(0);
}
const V4 = CHAVE.startsWith('eyJ'); // token de leitura (v4) é um JWT; a chave v3 é hexadecimal

const lerJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- TMDB ----------
// O caminho entra nas mensagens de erro; a URL completa não, porque a chave v3 vai nela.
async function tmdb(caminho, params = {}) {
  const u = new URL((process.env.TMDB_BASE || 'https://api.themoviedb.org/3') + caminho); // TMDB_BASE: só para teste local
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, String(v));
  if (!V4) u.searchParams.set('api_key', CHAVE);
  const headers = { accept: 'application/json', 'User-Agent': 'telas-mochilao/1.0' };
  if (V4) headers.Authorization = 'Bearer ' + CHAVE;
  for (let t = 0; t < 4; t++) {
    let r;
    try { r = await fetch(u, { headers }); } catch { await dormir(1500 * (t + 1)); continue; }
    if (r.status === 429 || r.status >= 500) { await dormir(2000 * (t + 1)); continue; }
    if (r.status === 404) return null;
    if (r.status === 401) throw Object.assign(new Error('o TMDB recusou a chave (401)'), { fatal: true });
    if (!r.ok) throw new Error(`${r.status} em ${caminho}`);
    return r.json();
  }
  throw new Error(`sem resposta em ${caminho}`);
}

// ---------- NOMES DOS SERVIÇOS ----------
// O TMDB lista variantes do mesmo serviço (plano com anúncios, canal dentro de outra loja).
// Junta as variantes de plano; canal vira "Serviço (canal na Loja)", que é outra assinatura.
const NOMES = {
  'amazon prime video': 'Prime Video', 'amazon video': 'Prime Video (loja)',
  'disney plus': 'Disney+', 'apple tv plus': 'Apple TV+', 'apple tv': 'Apple TV (loja)',
  'paramount plus': 'Paramount+', 'hbo max': 'Max', 'max': 'Max',
  'google play movies': 'Google Play', 'claro video': 'Claro tv+', 'mubi': 'MUBI',
  'crunchyroll': 'Crunchyroll', 'globoplay': 'Globoplay', 'netflix': 'Netflix',
  'telecine': 'Telecine', 'looke': 'Looke', 'star plus': 'Star+',
};
function nomeServico(bruto) {
  let n = String(bruto || '').trim();
  let canal = '';
  const m = n.match(/^(.*?)\s+(Amazon|Apple TV|Prime Video)\s+Channels?$/i);
  if (m) { n = m[1]; canal = /amazon|prime/i.test(m[2]) ? 'Prime Video' : 'Apple TV'; }
  n = n.replace(/\s+(basic|standard|premium)?\s*with ads$/i, '').replace(/\s+/g, ' ').trim();
  const base = NOMES[n.toLowerCase()] || n;
  return canal ? `${base} (canal na ${canal})` : base;
}
const nomes = lista => [...new Set((lista || [])
  .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
  .map(p => nomeServico(p.provider_name)).filter(Boolean))];

// ---------- QUAIS TÍTULOS ----------
const dados = await lerJson('telas/dados.json', { filmes: [], series: [] });
const anterior = await lerJson(ARQ, { titulos: {} });
const antes = anterior.titulos || {};

const anoDe = s => { const m = String(s || '').match(/\d{4}/); return m ? +m[0] : null; };

async function acharId(it, tipo) {
  const salvo = antes[it.id]?.tmdb; // o id do TMDB não muda: só procura uma vez
  if (salvo) return salvo;
  if (it.imdb_id) {
    const f = await tmdb(`/find/${it.imdb_id}`, { external_source: 'imdb_id' });
    await dormir(PAUSA_MS);
    const r = (tipo === 'movie' ? f?.movie_results : f?.tv_results)?.[0]
      || f?.movie_results?.[0] || f?.tv_results?.[0];
    if (r) return `${r.media_type || (f.movie_results?.includes(r) ? 'movie' : 'tv')}/${r.id}`;
  }
  // sem IMDb (ou sem achado): busca pelo título e confere o ano
  const ano = anoDe(it.ano);
  for (const q of [it.titulo_original, it.titulo].filter(Boolean)) {
    const busca = await tmdb(`/search/${tipo}`, tipo === 'movie'
      ? { query: q, year: ano, language: 'pt-BR' }
      : { query: q, first_air_date_year: ano, language: 'pt-BR' });
    await dormir(PAUSA_MS);
    const ok = (busca?.results || []).find(r => {
      const a = anoDe(r.release_date || r.first_air_date);
      return !ano || !a || Math.abs(a - ano) <= 1;
    });
    if (ok) return `${tipo}/${ok.id}`;
  }
  return null;
}

const titulos = {};
let falhas = 0, total = 0;
for (const [lista, tipo] of [['filmes', 'movie'], ['series', 'tv']]) {
  for (const it of dados[lista] || []) {
    if (!it?.id) continue;
    total++;
    try {
      const ref = await acharId(it, tipo);
      if (!ref) { titulos[it.id] = { nao_encontrado: true }; continue; }
      const prov = await tmdb(`/${ref}/watch/providers`);
      await dormir(PAUSA_MS);
      const br = prov?.results?.[PAIS];
      titulos[it.id] = {
        tmdb: ref,
        link: br?.link || '',
        assinatura: nomes(br?.flatrate),
        gratis: nomes(br?.free),
        anuncios: nomes(br?.ads),
        aluguel: nomes(br?.rent),
        compra: nomes(br?.buy),
      };
    } catch (e) {
      if (e.fatal) { console.error(e.message); process.exit(1); }
      falhas++;
      console.log(`falhou ${it.id}: ${e.message}`);
      if (antes[it.id]) titulos[it.id] = antes[it.id]; // mantém o último dado bom
    }
  }
}

console.log(`títulos: ${total}, falhas: ${falhas}, sem achado no TMDB: ${Object.values(titulos).filter(t => t.nao_encontrado).length}`);
if (total && falhas > total / 2) {
  console.error('falhas demais — não gravo nada para não apagar o que já estava certo');
  process.exit(1);
}

// Só grava quando a disponibilidade muda; assim o robô não gera commit (nem deploy) todo dia.
const ordenar = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const novo = ordenar(titulos);
if (JSON.stringify(novo) === JSON.stringify(ordenar(antes))) {
  console.log('onde assistir: nada mudou');
} else {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  await writeFile(ARQ, JSON.stringify({
    pais: PAIS,
    fonte: 'JustWatch, via API do TMDB',
    atualizado_em: hoje,
    titulos: novo,
  }, null, 1) + '\n');
  console.log(`onde assistir: gravado (${Object.keys(novo).length} títulos)`);
}
