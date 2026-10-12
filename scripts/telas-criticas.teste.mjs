// Teste do robô de resenhas com um TMDB falso.
import { mkdtemp, mkdir, copyFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executar, trecho, escolhe, titulosDe } from './telas-criticas.mjs';
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const dir = await mkdtemp(join(tmpdir(), 'crit-')); await mkdir(join(dir, 'telas'));
for (const f of ['catalogo.json', 'dados.json']) await copyFile(join('telas', f), join(dir, 'telas', f));
const tit = titulosDe(JSON.parse(await readFile('telas/catalogo.json', 'utf8')), JSON.parse(await readFile('telas/dados.json', 'utf8')));

const longo = 'Um filme lindo. '.repeat(40);
ok(trecho(longo).length <= 360 && trecho(longo).endsWith('.'), 'trecho corta em frase');
ok(trecho('**Ótimo** [link](https://x.y) <b>sim</b> ' + 'palavra '.repeat(80)).startsWith('Ótimo link sim') && trecho('palavra '.repeat(80)).endsWith('…'), 'tira markdown e HTML; sem frase, corta em palavra com …');
const rv = (id, n, txt, pt) => ({ id, author: 'a' + id, author_details: { name: 'Pessoa ' + id, rating: n }, content: txt, created_at: '2024-05-02T10:00:00Z', url: 'https://www.themoviedb.org/review/' + id, _pt: pt });
const e = escolhe([rv('1', 9, longo), rv('2', 8, longo), rv('3', 10, longo), rv('4', 3, longo), rv('5', null, 'curta')]);
ok(e.length === 3 && e.some(x => x.nota === 3) && !e.some(x => x.autor === 'Pessoa 5'), 'escolhe 2 boas e 1 negativa; ignora a curta');
ok(escolhe([rv('1', 9, longo), rv('2', null, longo, true)])[0].lingua === 'pt', 'português primeiro');
ok(escolhe([{ ...rv('1', 9, longo), url: 'javascript:alert(1)' }])[0].url === null, 'link estranho não entra');

ok(escolhe([rv('1', 9, 'English The good we do is our advocate. This is a film about faith and it was made with care and the cast is great. ' + longo.replace(/Um filme lindo. /g, 'This is the best. '), null, true)])[0].lingua === 'en', 'resenha em inglês que veio na busca em português fica "en"');
ok(/^Este filme/.test(escolhe([rv('1', 9, 'Português: Este filme é muito bonito e não tem nada igual, uma obra que fica com a gente para sempre, com fotografia e música que são de outro mundo. English: This film is very beautiful and there is nothing like it, a work that stays with us forever.', null, false)])[0].trecho), 'bilíngue: fica a parte em português');
let pedidos = [];
const avatar = 'tt0499549';
const fetchFn = async u => {
  u = new URL(u); pedidos.push(u.pathname + '?' + u.searchParams.get('language'));
  if (u.pathname.startsWith('/3/find/')) return new Response(JSON.stringify({ movie_results: [{ id: 19995 }], tv_results: [{ id: 777 }] }));
  if (/\/reviews$/.test(u.pathname)) {
    const pt = u.searchParams.get('language') === 'pt-BR';
    if (u.pathname === '/3/movie/19995/reviews') return new Response(JSON.stringify({ results: pt ? [] : [rv('a1', 9, longo), rv('a2', 4, longo)] }));
    return new Response(JSON.stringify({ results: [] }));
  }
  return new Response('{}', { status: 404 });
};
const r0 = await executar({ raiz: dir, fetchFn, chave: '', log: () => {} });
ok(r0.gravou === 0 && !pedidos.length, 'sem chave, não faz nada');
const r1 = await executar({ raiz: dir, fetchFn, chave: 'k', limite: 40, dormir: async () => {}, log: () => {}, agora: () => new Date('2026-10-12T10:00:00Z') });
const f = JSON.parse(await readFile(join(dir, 'telas/criticas/_feito.json'), 'utf8'));
ok(Object.keys(f).length === 40, 'respeita o limite (40 consultados)');
const tem = (await readdir(join(dir, 'telas/criticas'))).filter(x => x !== '_feito.json');
ok(tem.length === (f[avatar] ? 1 : 0) && tem.every(x => /^tt\d+\.json$/.test(x)), 'só quem tem resenha ganha arquivo (' + tem.length + ')');
if (f[avatar]) {
  const a = JSON.parse(await readFile(join(dir, 'telas/criticas', avatar + '.json'), 'utf8'));
  ok(a.total === 2 && a.itens.length === 2 && a.itens[0].nota === 9 && a.itens[0].url && a.itens[0].data === '2024-05', 'Avatar: 2 resenhas, nota, mês e link');
}
pedidos = [];
await executar({ raiz: dir, fetchFn, chave: 'k', limite: 5000, dormir: async () => {}, log: () => {}, agora: () => new Date('2026-10-13T10:00:00Z') });
const f2 = JSON.parse(await readFile(join(dir, 'telas/criticas/_feito.json'), 'utf8'));
ok(Object.keys(f2).length === tit.size, 'a 2ª rodada completa todos (' + tit.size + ')');
const a = JSON.parse(await readFile(join(dir, 'telas/criticas', avatar + '.json'), 'utf8'));
ok(a.itens[0].autor === 'Pessoa a1', 'Avatar gravado');
pedidos = [];
await executar({ raiz: dir, fetchFn, chave: 'k', dormir: async () => {}, log: () => {}, agora: () => new Date('2026-10-20T10:00:00Z') });
ok(!pedidos.length, 'uma semana depois, nada a consultar');
const r4 = await executar({ raiz: dir, fetchFn: async () => new Response('', { status: 401 }), chave: 'k', dormir: async () => {}, log: () => {}, agora: () => new Date('2027-01-20T10:00:00Z') });
ok(r4.n === 0, 'chave recusada para a rodada');
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
