// Robô de streaming do Telas: onde cada título da lista está disponível no Brasil —
// assinatura, grátis, com anúncios, aluguel e compra — e grava telas/streaming.json.
// Fonte: API do TMDB, cujos dados de "onde assistir" vêm do JustWatch.
// Precisa do segredo TMDB_API_KEY (chave v3 ou token de leitura v4). Sem ele, não faz nada.
// Node 20+, sem dependências.

import { readFile, writeFile } from 'node:fs/promises';

const PAIS = 'BR';
const ARQ = 'telas/streaming.json';
const PAUSA_MS = 80;            // o TMDB aceita bem mais que isso; folga para não incomodar
const TEMPO_MS = 15000;         // limite de cada requisição
const FALHAS_SEGUIDAS_MAX = 5;  // TMDB fora do ar: desiste cedo, sem gravar nada
const FALHAS_MAX = 20;          // TMDB instável (falha um sim, um não): também desiste
const CHAVE = (process.env.TMDB_API_KEY || '').trim().replace(/^Bearer\s+/i, '');

if (!CHAVE) {
  console.log('sem TMDB_API_KEY: onde assistir não foi atualizado');
  process.exit(0);
}
const V4 = CHAVE.startsWith('eyJ'); // token de leitura (v4) é um JWT; a chave v3 é hexadecimal

const dormir = ms => new Promise(r => setTimeout(r, ms));
const sair = msg => { console.error(msg); process.exit(1); };

// ---------- TMDB ----------
// O caminho entra nas mensagens de erro; a URL completa não, porque a chave v3 vai nela.
async function tmdb(caminho, params = {}) {
  const u = new URL((process.env.TMDB_BASE || 'https://api.themoviedb.org/3') + caminho); // TMDB_BASE: só para teste local
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, String(v));
  if (!V4) u.searchParams.set('api_key', CHAVE);
  const headers = { accept: 'application/json', 'User-Agent': 'telas-mochilao/1.0' };
  if (V4) headers.Authorization = 'Bearer ' + CHAVE;
  for (let t = 0; t < 3; t++) {
    let r;
    try { r = await fetch(u, { headers, signal: AbortSignal.timeout(TEMPO_MS) }); }
    catch { await dormir(1500 * (t + 1)); continue; }
    if (r.status === 429 || r.status >= 500) { await dormir(1000 * (t + 1)); continue; }
    if (r.status === 404) return null;
    if (r.status === 401) throw Object.assign(new Error('o TMDB recusou a chave (401)'), { fatal: true });
    if (!r.ok) throw new Error(`${r.status} em ${caminho}`);
    return r.json();
  }
  throw new Error(`sem resposta em ${caminho}`);
}

// ---------- NOMES DOS SERVIÇOS ----------
// Primeiro pelo id do provedor, que não muda quando a marca muda; depois pelo nome.
// O TMDB lista variantes do mesmo serviço (plano com anúncios, canal dentro de outra loja):
// junta as variantes de plano; canal vira "Serviço (canal na Loja)", que é outra assinatura.
const POR_ID = {
  8: 'Netflix', 119: 'Prime Video', 10: 'Prime Video (loja)', 337: 'Disney+',
  350: 'Apple TV', 2: 'Apple TV (loja)', 3: 'Google Play',
};
const NOMES = {
  'amazon prime video': 'Prime Video', 'amazon video': 'Prime Video (loja)',
  'disney plus': 'Disney+', 'apple tv plus': 'Apple TV', 'apple tv+': 'Apple TV',
  'paramount plus': 'Paramount+', 'hbo max': 'HBO Max', 'max': 'HBO Max',
  'google play movies': 'Google Play', 'claro video': 'Claro tv+', 'mubi': 'MUBI',
  'crunchyroll': 'Crunchyroll', 'globoplay': 'Globoplay', 'netflix': 'Netflix',
  'telecine': 'Telecine', 'looke': 'Looke', 'star plus': 'Star+',
};
// "Apple TV" sem id conhecido: na lista de assinatura é o serviço; em aluguel/compra é a loja
function nomeServico(p, loja) {
  if (POR_ID[p.provider_id]) return POR_ID[p.provider_id];
  let n = String(p.provider_name || '').trim();
  let canal = '';
  const m = n.match(/^(.*?)\s+(Amazon|Apple TV|Prime Video)\s+Channels?$/i);
  if (m) { n = m[1]; canal = /amazon|prime/i.test(m[2]) ? 'Prime Video' : 'Apple TV'; }
  n = n.replace(/\s+(basic|standard|premium)?\s*with ads$/i, '').replace(/\s+/g, ' ').trim();
  const k = n.toLowerCase();
  const base = k === 'apple tv' ? (loja ? 'Apple TV (loja)' : 'Apple TV') : (NOMES[k] || n);
  return canal ? `${base} (canal na ${canal})` : base;
}
// ordem alfabética: a ordem do JustWatch muda sem a disponibilidade mudar
const nomes = (lista, loja) => [...new Set((lista || []).map(p => nomeServico(p, loja)).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

// ---------- QUAIS TÍTULOS ----------
let dados;
try { dados = JSON.parse(await readFile('telas/dados.json', 'utf8')); }
catch (e) { sair(`telas/dados.json ilegível (${e.message}) — não gravo nada`); }
let anterior = { titulos: {} };
try { anterior = JSON.parse(await readFile(ARQ, 'utf8')); } catch { /* primeira vez */ }
const antes = anterior.titulos || {};

const anoDe = s => { const m = String(s || '').match(/\d{4}/); return m ? +m[0] : null; };

async function acharId(it, tipo, usarCache = true) {
  const salvo = antes[it.id];
  // o id do TMDB não muda; só procura de novo se o IMDb do título mudou
  if (usarCache && salvo?.tmdb && (salvo.imdb || null) === (it.imdb_id || null)) return salvo.tmdb;
  if (it.imdb_id) {
    const f = await tmdb(`/find/${it.imdb_id}`, { external_source: 'imdb_id' });
    await dormir(PAUSA_MS);
    const mov = f?.movie_results?.[0], tv = f?.tv_results?.[0];
    const r = tipo === 'movie' ? (mov || tv) : (tv || mov);
    if (r) return `${r === mov ? 'movie' : 'tv'}/${r.id}`;
  }
  // sem IMDb (ou sem achado): busca pelo título e confere o ano com folga de um ano,
  // porque o ano da lista às vezes é o de festival e o TMDB guarda o de estreia
  const ano = anoDe(it.ano);
  const aceita = r => { const a = anoDe(r.release_date || r.first_air_date); return !ano || !a || Math.abs(a - ano) <= 1; };
  for (const q of [...new Set([it.titulo_original, it.titulo].filter(Boolean))]) {
    for (const comAno of ano ? [true, false] : [false]) {
      const params = { query: q, language: 'pt-BR' };
      if (comAno) params[tipo === 'movie' ? 'year' : 'first_air_date_year'] = ano;
      const busca = await tmdb(`/search/${tipo}`, params);
      await dormir(PAUSA_MS);
      const ok = (busca?.results || []).find(aceita);
      if (ok) return `${tipo}/${ok.id}`;
    }
  }
  return null;
}

async function provedores(ref) {
  const prov = await tmdb(`/${ref}/watch/providers`);
  await dormir(PAUSA_MS);
  return prov;
}

// a lista principal, mais as séries e os filmes das sagas das coleções (Desligar, Repetidos)
const fila = [];
const vistos = new Set();
const poe = (it, tipo) => { if (it?.id && !vistos.has(it.id)) { vistos.add(it.id); fila.push([it, tipo]); } };
for (const it of dados.filmes || []) poe(it, 'movie');
for (const it of dados.series || []) poe(it, 'tv');
for (const ex of dados.extras || []) {
  if (ex?.tipo === 'saga') for (const f of ex.filmes || []) poe(f, 'movie');
  else poe(ex, ex?.tipo === 'filme' ? 'movie' : 'tv');
}

const titulos = {};
let falhas = 0, seguidas = 0, total = 0;
for (const [it, tipo] of fila) {
  {
    total++;
    try {
      let ref = await acharId(it, tipo);
      if (!ref) { titulos[it.id] = { nao_encontrado: true, imdb: it.imdb_id || null }; seguidas = 0; continue; }
      let prov = await provedores(ref);
      if (!prov) { // id apagado ou fundido no TMDB: procura de novo, sem o cache
        ref = await acharId(it, tipo, false);
        prov = ref ? await provedores(ref) : null;
        if (!prov) throw Object.assign(new Error(`id ${ref || '?'} sumiu do TMDB`), { sumiu: true });
      }
      const br = prov.results?.[PAIS];
      titulos[it.id] = {
        tmdb: ref,
        imdb: it.imdb_id || null,
        link: br?.link || '',
        assinatura: nomes(br?.flatrate, false),
        gratis: nomes(br?.free, false),
        anuncios: nomes(br?.ads, false),
        aluguel: nomes(br?.rent, true),
        compra: nomes(br?.buy, true),
      };
      seguidas = 0;
    } catch (e) {
      if (e.fatal) sair(e.message);
      falhas++; seguidas++;
      console.log(`falhou ${it.id}: ${e.message}`);
      if (seguidas >= FALHAS_SEGUIDAS_MAX) sair(`${seguidas} falhas seguidas — o TMDB parece fora do ar; não gravo nada`);
      if (falhas >= FALHAS_MAX) sair(`${falhas} falhas — o TMDB está instável; não gravo nada`);
      // mantém o último dado bom; se o id sumiu do TMDB, tira o id para procurar de novo amanhã
      if (antes[it.id]) {
        const { tmdb: _t, ...resto } = antes[it.id];
        titulos[it.id] = e.sumiu ? resto : antes[it.id];
      }
    }
  }
}

console.log(`títulos: ${total}, falhas: ${falhas}, sem achado no TMDB: ${Object.values(titulos).filter(t => t.nao_encontrado).length}`);
if (!total) sair('nenhum título em telas/dados.json — não gravo nada');
if (falhas > total / 2) sair('falhas demais — não gravo nada para não apagar o que já estava certo');

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
