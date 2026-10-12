// Teste do robô da OMDb com respostas falsas.
import { mkdtemp, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executar, lerResposta } from './telas-omdb.mjs';
import { idsDe } from './telas-notas.mjs';
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const dir = await mkdtemp(join(tmpdir(), 'omdb-')); await mkdir(join(dir, 'telas'));
for (const f of ['catalogo.json', 'dados.json']) await copyFile(join('telas', f), join(dir, 'telas', f));
const ids = idsDe(JSON.parse(await readFile('telas/catalogo.json', 'utf8')), JSON.parse(await readFile('telas/dados.json', 'utf8')));
const ARQ = join(dir, 'telas/notas-fora.json'), le = async () => JSON.parse(await readFile(ARQ, 'utf8'));

const AVATAR = { Response: 'True', Ratings: [{ Source: 'Internet Movie Database', Value: '7.9/10' }, { Source: 'Rotten Tomatoes', Value: '81%' }, { Source: 'Metacritic', Value: '83/100' }], Metascore: '83' };
ok(JSON.stringify(lerResposta(AVATAR)) === '["81%","83"]', 'lê Rotten 81% e Metacritic 83');
ok(JSON.stringify(lerResposta({ Response: 'True', Ratings: [], Metascore: '71' })) === '[null,"71"]', 'Metascore sozinho também vale');
ok(JSON.stringify(lerResposta({ Response: 'True', Ratings: [{ Source: 'Rotten Tomatoes', Value: '<b>99%' }], Metascore: 'N/A' })) === '[null,null]', 'valor estranho não entra');
ok(lerResposta({ Response: 'False', Error: 'Incorrect IMDb ID.' }) === null, 'título que a OMDb não conhece');

let pedidos = [];
const resp = (j, s = 200) => new Response(JSON.stringify(j), { status: s });
const fetchOk = async u => { pedidos.push(u); return resp(/tt0499549/.test(u) ? AVATAR : { Response: 'True', Ratings: [], Metascore: 'N/A' }); };

const r0 = await executar({ raiz: dir, fetchFn: fetchOk, log: () => {}, chave: '', pausa: 0 });
ok(!r0.gravou && r0.codigo === 0 && !pedidos.length, 'sem chave, não faz nada');

const r1 = await executar({ raiz: dir, fetchFn: fetchOk, log: () => {}, chave: 'k', limite: 50, pausa: 0, agora: () => new Date('2026-10-12T10:00:00Z') });
let j = await le();
ok(r1.gravou && pedidos.length === 50 && Object.keys(j.itens).length === 50, 'respeita o limite da rodada (50)');
ok(pedidos.every(u => u.includes('apikey=k')), 'manda a chave');

pedidos = [];
await executar({ raiz: dir, fetchFn: fetchOk, log: () => {}, chave: 'k', limite: 5000, pausa: 0, agora: () => new Date('2026-10-13T10:00:00Z') });
j = await le();
ok(pedidos.length === ids.size - 50 && Object.keys(j.itens).length === ids.size, 'a 2ª rodada pega só os que faltavam');
ok(JSON.stringify(j.itens.tt0499549.slice(0, 2)) === '["81%","83"]', 'Avatar gravado');
ok(j.itens[[...ids].find(i => i !== 'tt0499549')][0] === null, 'título sem nota fica com null (não é perguntado de novo amanhã)');

pedidos = [];
const r3 = await executar({ raiz: dir, fetchFn: fetchOk, log: () => {}, chave: 'k', limite: 5000, pausa: 0, agora: () => new Date('2026-10-20T10:00:00Z') });
ok(!pedidos.length && !r3.gravou, 'uma semana depois, nada a consultar');

pedidos = [];
await executar({ raiz: dir, fetchFn: fetchOk, log: () => {}, chave: 'k', limite: 30, pausa: 0, agora: () => new Date('2026-12-01T10:00:00Z') });
j = await le();
ok(pedidos.length === 30 && Object.values(j.itens).filter(v => v[2] === '2026-12-01').length === 30, 'depois de 45 dias, renova os mais velhos primeiro');
ok(pedidos.every(u => { const id = /i=(tt\d+)/.exec(u)[1]; return true && id; }) && JSON.parse(await readFile(ARQ, 'utf8')).itens[/i=(tt\d+)/.exec(pedidos[0])[1]][2] === '2026-12-01', 'o renovado ganha a data nova');

// limite do dia: para e grava o que veio
await writeFile(ARQ, JSON.stringify({ itens: {} }));
let n = 0;
const fetchLimite = async () => (++n > 3 ? resp({ Response: 'False', Error: 'Request limit reached!' }, 401) : resp(AVATAR));
const r4 = await executar({ raiz: dir, fetchFn: fetchLimite, log: () => {}, chave: 'k', pausa: 0 });
j = await le();
ok(r4.gravou && r4.codigo === 0 && Object.keys(j.itens).length === 3 && n === 4, 'limite do dia: para e grava os 3 que vieram');

// chave inválida: para sem gravar
await writeFile(ARQ, JSON.stringify({ itens: {} }));
const r5 = await executar({ raiz: dir, fetchFn: async () => resp({ Response: 'False', Error: 'Invalid API key!' }, 401), log: () => {}, chave: 'x', pausa: 0 });
ok(r5.codigo === 1 && !r5.gravou && JSON.stringify((await le()).itens) === '{}', 'chave inválida: sai com erro e não grava');

// rede falhando num título não derruba a rodada
await writeFile(ARQ, JSON.stringify({ itens: {} }));
let m = 0;
const r6 = await executar({ raiz: dir, fetchFn: async () => { if (++m === 2) throw new Error('reset'); return resp(AVATAR); }, log: () => {}, chave: 'k', limite: 5, pausa: 0 });
ok(r6.gravou && Object.keys((await le()).itens).length === 4, 'um erro de rede pula só aquele título');

// tempo da rodada: para e grava
await writeFile(ARQ, JSON.stringify({ itens: {} }));
const r7 = await executar({ raiz: dir, fetchFn: async () => { await new Promise(r => setTimeout(r, 30)); return resp(AVATAR); }, log: () => {}, chave: 'k', pausa: 0, tempoMax: 100 });
const n7 = Object.keys((await le()).itens).length;
ok(r7.gravou && n7 >= 2 && n7 <= 6, `tempo da rodada: para e grava o que veio (${n7})`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
