// Teste do robô de IDs com um TMDB falso (sem rede). Uso: node scripts/telas-ids.teste.mjs
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { executar, escolher, normTitulo, formatoCatalogo } from './telas-ids.mjs';

let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

// ---- funções puras
ok(normTitulo('O Poderoso Chefão') === 'poderoso chefao' && normTitulo('The Godfather') === 'godfather', 'normaliza acento, pontuação e artigo');
ok(!!escolher({ titulo: 'Shrek', ano: '2001' }, 'movie', [{ id: 808, title: 'Shrek', original_title: 'Shrek', release_date: '2001-05-18' }]).ok, 'casa título igual e mesmo ano');
ok(!!escolher({ titulo: 'Duna', titulo_original: 'Dune', ano: '2021' }, 'movie', [{ id: 438631, title: 'Duna', original_title: 'Dune', release_date: '2020-09-03' }]).ok, 'ano com folga de 1');
ok(!!escolher({ titulo: 'X', ano: '1990' }, 'movie', [{ id: 1, title: 'X', original_title: 'X', release_date: '1995-01-01' }]).duvida, 'ano longe vira dúvida');
ok(/candidatos/.test(escolher({ titulo: 'Amor', ano: '2012' }, 'movie', [{ id: 1, title: 'Amor', release_date: '2012-01-01' }, { id: 2, title: 'Amor', release_date: '2012-06-01' }]).duvida || ''), 'dois candidatos iguais viram dúvida');
ok(!!escolher({ titulo: 'Shrek 2', ano: '2004' }, 'movie', [{ id: 9, title: 'Shrek', release_date: '2004-01-01' }]).duvida, 'título diferente não casa');

// ---- execução com TMDB falso
const raiz = await mkdtemp(join(tmpdir(), 'telas-ids-'));
await mkdir(join(raiz, 'telas'));
const catalogo = {
  gerado_em: '2026-10-11', itens: [
    { id: 'shrek-2001', tipo: 'filme', titulo: 'Shrek', titulo_original: 'Shrek', ano: '2001' },
    { id: 'amor-2012', tipo: 'filme', titulo: 'Amor', titulo_original: 'Amour', ano: '2012' },
    { id: 'dark-2017', tipo: 'serie', titulo: 'Dark', titulo_original: 'Dark', ano: '2017' },
    { id: 'ja-tem-1999', tipo: 'filme', titulo: 'Matrix', ano: '1999', imdb_id: 'tt0133093' },
    { id: 'repetido-2000', tipo: 'filme', titulo: 'Repetido', ano: '2000' },
  ], sugestoes: { desligar: [{ id: 'shrek-2001', membro: 'x', por_que: 'y' }] },
};
const dados = { filmes: [{ id: 'f1', titulo: 'Já tem', imdb_id: 'tt0000001', ano: '2000' }], series: [], extras: [{ id: 'serie-x-2010', tipo: 'serie', titulo: 'Série X', ano: '2010' }] };
await writeFile(join(raiz, 'telas/catalogo.json'), formatoCatalogo(catalogo));
await writeFile(join(raiz, 'telas/dados.json'), JSON.stringify(dados));
const chamadas = [];
const resp = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o });
const fetchFalso = async (u) => {
  u = new URL(u); chamadas.push(u.pathname + '?' + u.searchParams.toString());
  const q = u.searchParams.get('query');
  if (u.searchParams.get('api_key') !== 'chave123') return resp({}, 401);
  if (u.pathname === '/3/search/movie') {
    if (q === 'Shrek') return resp({ results: [{ id: 808, title: 'Shrek', original_title: 'Shrek', release_date: '2001-05-18' }] });
    if (q === 'Amour' || q === 'Amor') return resp({ results: [{ id: 86837, title: 'Amor', original_title: 'Amour', release_date: '2012-09-20' }, { id: 5, title: 'Amor', original_title: 'Amor', release_date: '2012-02-02' }] });
    if (q === 'Repetido') return resp({ results: [{ id: 77, title: 'Repetido', release_date: '2000-01-01' }] });
    return resp({ results: [] });
  }
  if (u.pathname === '/3/search/tv') {
    if (q === 'Dark') return resp({ results: [{ id: 70523, name: 'Dark', original_name: 'Dark', first_air_date: '2017-12-01' }] });
    if (q === 'Série X') return resp({ results: [{ id: 99, name: 'Série X', original_name: 'Series X', first_air_date: '2010-03-01' }] });
    return resp({ results: [] });
  }
  if (u.pathname === '/3/movie/808/external_ids') return resp({ imdb_id: 'tt0126029' });
  if (u.pathname === '/3/movie/77/external_ids') return resp({ imdb_id: 'tt0133093' }); // o mesmo do Matrix: dúvida
  if (u.pathname === '/3/tv/70523/external_ids') return resp({ imdb_id: 'tt5753856' });
  if (u.pathname === '/3/tv/99/external_ids') return resp({ imdb_id: 'tt1234567' });
  return resp({}, 404);
};
const logs = [];
const r = await executar({ raiz, fetchFn: fetchFalso, dormir: async () => {}, log: m => logs.push(m), chave: 'chave123', base: 'https://tmdb.falso/3', agora: () => new Date('2026-10-12T10:00:00Z') });
const cat2 = JSON.parse(await readFile(join(raiz, 'telas/catalogo.json'), 'utf8'));
const dad2 = JSON.parse(await readFile(join(raiz, 'telas/dados.json'), 'utf8'));
const pend = JSON.parse(await readFile(join(raiz, 'telas/ids-pendentes.json'), 'utf8'));
const por = Object.fromEntries(cat2.itens.map(x => [x.id, x]));
ok(r.codigo === 0 && r.gravou, 'execução termina bem e grava');
ok(por['shrek-2001'].imdb_id === 'tt0126029' && por['shrek-2001'].tmdb_id === 808, 'filme do catálogo ganha imdb_id e tmdb_id');
ok(por['dark-2017'].imdb_id === 'tt5753856' && por['dark-2017'].tmdb_id === 70523, 'série do catálogo pelo /search/tv');
ok(!por['amor-2012'].imdb_id && /candidatos/.test(pend.itens['amor-2012'].motivo), 'ambíguo fica sem ID e vai para as dúvidas');
ok(!por['repetido-2000'].imdb_id && /já é de/.test(pend.itens['repetido-2000'].motivo), 'IMDb repetido de outro título fica de fora');
ok(dad2.extras[0].imdb_id === 'tt1234567', 'extras de dados.json também ganham ID');
ok(por['ja-tem-1999'].imdb_id === 'tt0133093' && !chamadas.some(c => /Matrix/.test(c)), 'quem já tem IMDb não é procurado');
ok((await readFile(join(raiz, 'telas/catalogo.json'), 'utf8')).split('\n')[2].startsWith('{"id":"shrek-2001"'), 'catalogo.json continua com um item por linha');
ok(cat2.sugestoes.desligar[0].id === 'shrek-2001', 'as sugestões continuam no lugar');
ok(chamadas.every(c => /api_key=chave123/.test(c)), 'chave v3 vai como api_key');

// segunda rodada no mesmo dia: as dúvidas não são procuradas de novo (só depois de 30 dias)
chamadas.length = 0;
const r2 = await executar({ raiz, fetchFn: fetchFalso, dormir: async () => {}, log: () => {}, chave: 'chave123', base: 'https://tmdb.falso/3', agora: () => new Date('2026-10-13T10:00:00Z') });
ok(r2.codigo === 0 && !r2.gravou && chamadas.length === 0, 'dúvidas recentes não são procuradas de novo');

// token v4 vai no cabeçalho
let cab = null;
await executar({ raiz, fetchFn: async (u, o) => { cab = o.headers.Authorization; return resp({ results: [] }); }, dormir: async () => {}, log: () => {}, chave: 'eyJabc.def', base: 'https://tmdb.falso/3', agora: () => new Date('2026-12-20T10:00:00Z') });
ok(cab === 'Bearer eyJabc.def', 'token v4 vai no cabeçalho Authorization');

// sem chave: não faz nada
const r3 = await executar({ raiz, fetchFn: () => { throw new Error('não devia chamar'); }, log: () => {}, chave: '' });
ok(r3.codigo === 0 && !r3.gravou, 'sem a chave, não faz nada');

// chave recusada (401): para sem gravar
const r4 = await executar({ raiz, fetchFn: async () => resp({}, 401), dormir: async () => {}, log: () => {}, chave: 'errada', base: 'https://tmdb.falso/3', agora: () => new Date('2027-03-01T10:00:00Z') });
ok(r4.codigo === 1 && !r4.gravou, 'chave recusada: sai com erro sem gravar');

// o formato do catálogo de verdade é reproduzido exatamente
try {
  const real = await readFile(new URL('../telas/catalogo.json', import.meta.url), 'utf8');
  ok(formatoCatalogo(JSON.parse(real)) === real, 'formatoCatalogo reproduz telas/catalogo.json byte a byte');
  const realD = await readFile(new URL('../telas/dados.json', import.meta.url), 'utf8');
  ok(JSON.stringify(JSON.parse(realD)) === realD, 'dados.json continua numa linha só');
} catch (e) { ok(false, 'formato real: ' + e.message); }

assert.ok(true);
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exitCode = falhas ? 1 : 0;
