// Teste do robô de sagas com um TMDB falso: Avatar ganha o 3º filme (e não o 4º, sem data perto), Matrix vira saga,
// a saga curada (Harry Potter) não é tocada, o cache evita perguntar de novo, e sem chave nada acontece.
import { mkdtemp, mkdir, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executar, nomeColecao } from './telas-sagas.mjs';
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const dir = await mkdtemp(join(tmpdir(), 'sagas-')); await mkdir(join(dir, 'telas'));
for (const f of ['catalogo.json', 'dados.json']) await copyFile(join('telas', f), join(dir, 'telas', f));
const COL = {
  87096: { name: 'Avatar - Coleção', en: 'Avatar Collection', parts: [[19995, 'Avatar', '2009-12-15'], [76600, 'Avatar: O Caminho da Água', '2022-12-14'], [83533, 'Avatar: Fogo e Cinzas', '2025-12-17'], [216527, 'Avatar 4', '2029-12-19']] },
  2344: { name: 'Matrix - Coleção', en: 'The Matrix Collection', parts: [[603, 'Matrix', '1999-03-30'], [604, 'Matrix Reloaded', '2003-05-15'], [605, 'Matrix Revolutions', '2003-11-05'], [624860, 'Matrix Resurrections', '2021-12-16']] },
};
const FIND = { tt0499549: 19995, tt0133093: 603 }, MOV = { 19995: 87096, 76600: 87096, 603: 2344 };
let chamadas = 0;
const fetchFn = async (u) => {
  chamadas++; const url = new URL(u); const p = url.pathname.replace('/3', ''); let body = null;
  let m;
  if ((m = p.match(/^\/find\/(tt\d+)$/))) body = { movie_results: FIND[m[1]] ? [{ id: FIND[m[1]] }] : [] };
  else if ((m = p.match(/^\/movie\/(\d+)\/external_ids$/))) body = { imdb_id: 'tt9' + m[1].padStart(7, '0') };
  else if ((m = p.match(/^\/movie\/(\d+)$/))) body = { id: +m[1], belongs_to_collection: MOV[m[1]] ? { id: MOV[m[1]] } : null };
  else if ((m = p.match(/^\/collection\/(\d+)$/))) { const c = COL[m[1]]; const en = url.searchParams.get('language') === 'en-US';
    body = { name: en ? c.en : c.name, parts: c.parts.map(([id, t, d]) => ({ id, title: en ? t.replace('O Caminho da Água', 'The Way of Water').replace('Fogo e Cinzas', 'Fire and Ash') : t, original_title: t, release_date: d })) }; }
  return { ok: !!body, status: body ? 200 : 404, json: async () => body };
};
const agora = () => new Date('2026-10-12T12:00:00Z');
const r0 = await executar({ raiz: dir, chave: '', log: () => {} }); ok(r0.codigo === 0 && !r0.gravou, 'sem chave: nada');
const r = await executar({ raiz: dir, chave: 'abc', fetchFn, dormir: async () => {}, agora, log: () => {} });
const cat = JSON.parse(await readFile(join(dir, 'telas/catalogo.json'), 'utf8'));
const av = cat.sagas.find(s => s.id === 'saga-avatar'), fa = cat.itens.find(x => x.tmdb_id === 83533);
ok(fa && fa.titulo === 'Avatar: Fogo e Cinzas' && fa.titulo_en === 'Avatar: Fire and Ash' && fa.ano === '2025' && fa.origem === 'tmdb-colecao' && fa.dims && fa.dims.length === 9, 'Avatar: Fogo e Cinzas entra no catálogo com dados herdados');
ok(av && av.filmes.length === 3 && av.filmes[2] === fa.id && av.anos === '2009–2025', 'a saga Avatar passa a ter 3 filmes, em ordem');
ok(!cat.itens.some(x => x.tmdb_id === 216527), 'Avatar 4 (2029) fica de fora');
const mx = cat.sagas.find(s => /matrix/.test(s.id));
ok(mx && mx.titulo === 'Matrix' && mx.filmes.length === 4 && mx.filmes[0] === 'matrix-1999', 'Matrix vira saga de 4 filmes (o da página primeiro)');
ok(r.novos === 4 && r.sagasNovas === 1 && r.sagasMaiores === 1, 'contagem: 4 novos, 1 saga nova, 1 completada');
ok(!cat.sagas.some(s => /harry/.test(s.id)), 'Harry Potter (curada em dados.json) não vira saga do catálogo');
const antes = chamadas; await executar({ raiz: dir, chave: 'abc', fetchFn, dormir: async () => {}, agora, log: () => {} });
const cat2 = JSON.parse(await readFile(join(dir, 'telas/catalogo.json'), 'utf8'));
ok(cat2.itens.length === cat.itens.length && cat2.sagas.length === cat.sagas.length, 'segunda rodada não duplica nada');
ok(chamadas - antes < 10, 'cache: a segunda rodada quase não pergunta ao TMDB (' + (chamadas - antes) + ' chamadas)');
ok(nomeColecao('Coleção Harry Potter') === 'Harry Potter' && nomeColecao('The Matrix Collection') === 'The Matrix', 'nome da coleção sem "Coleção"/"Collection"');
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
