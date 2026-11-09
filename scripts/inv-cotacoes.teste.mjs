// Teste do robô das cotações com um Yahoo falso (429, 404, mudança e não mudança).
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/inv');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const chart = await readFile(join(FIX, 'yahoo-chart-petr4.json'), 'utf8');
const nf = await readFile(join(FIX, 'yahoo-chart-404.json'), 'utf8');
let modo = {}; const conta = {};
const srv = http.createServer((req, res) => {
  const s = decodeURIComponent(req.url.split('/v8/finance/chart/')[1].split('?')[0]);
  conta[s] = (conta[s] || 0) + 1;
  const m = modo[s] || 'ok';
  if (m === '404') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end(nf); }
  if (m === '429' || (m === '429x2' && conta[s] <= 2)) { res.writeHead(429); return res.end('Too Many Requests'); }
  if (m === '500') { res.writeHead(500); return res.end('erro'); }
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(chart);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
process.env.INV_YAHOO_BASE = `http://127.0.0.1:${srv.address().port}`;
process.env.INV_PAUSA_MS = '1'; process.env.INV_ESPERAS_MS = '1,1,1';
const R = await import('./inv-cotacoes.mjs');
const Y = await import('../api/_inv-yahoo.mjs');

// funções puras
const e = Y.estatisticas([['2026-01-01', 10], ['2026-01-02', 12], ['2026-01-05', 14]]);
ok(e.media === 12 && e.atual === 14 && e.dif_pct === 16.7 && e.min === 10 && e.max === 14 && e.n === 3, 'estatisticas: média, atual, dif a 1 casa, mín e máx');
const sem = Y.semanal([['2026-11-02', 1], ['2026-11-04', 2], ['2026-11-06', 3], ['2026-11-09', 4], ['2026-11-10', 5]]);
ok(sem.length === 2 && sem[0][0] === '2026-11-06' && sem[1][1] === 5, 'semanal: último fechamento de cada semana');
ok(Y.simboloOk(' petr4.sa ') === 'PETR4.SA' && Y.simboloOk('BRK-B') === 'BRK-B' && Y.simboloOk('^BVSP') === '^BVSP' && !Y.simboloOk('a b') && !Y.simboloOk('<x>') && !Y.simboloOk(''), 'simboloOk normaliza e recusa');
const ix = Y.indexa100([[['2026-01-01', 10], ['2026-01-02', 20]], [['2026-01-02', 5], ['2026-01-03', 6]]]);
ok(ix.inicio === '2026-01-02' && ix.series[0][0][1] === 100 && ix.series[1][1][1] === 120, 'indexa100 começa na 1ª data comum');

const dir = await mkdtemp(join(tmpdir(), 'inv-cot-')); await mkdir(join(dir, 'inv'));
const emp = { versao: 1, mercados: [{ id: 'br', empresas: [{ simbolo: 'PETR4.SA' }, { simbolo: 'VALE3.SA' }, { simbolo: 'BAD.SA' }] }, { id: 'eua', empresas: [{ simbolo: 'AAPL' }, { simbolo: 'MSFT' }] }] };
await writeFile(join(dir, 'inv/empresas.json'), JSON.stringify(emp));
await writeFile(join(dir, 'inv/cotacoes.json'), '{"versao":1,"gerado_em":null,"itens":{}}\n');
const logs = []; const L = m => logs.push(m);
modo = { 'BAD.SA': '404', AAPL: '429x2', MSFT: '429' };
const r1 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
const j1 = JSON.parse(await readFile(join(dir, 'inv/cotacoes.json'), 'utf8'));
const p = j1.itens['PETR4.SA'];
const fx = JSON.parse(chart).chart.result[0]; const cl = fx.indicators.quote[0].close.filter(v => v != null);
ok(r1.gravou && p && p.erro === null, 'gravou, PETR4.SA sem erro');
ok(p.n === cl.length && p.n === 520, 'null no meio do fechamento: n desconta (' + p.n + ')');
ok(p.atual === cl[cl.length - 1] && Math.abs(p.media_2a - cl.reduce((a, b) => a + b) / cl.length) < .006, 'atual = último fechamento; média dos 2 anos');
ok(p.dif_pct === Math.round((p.atual / (cl.reduce((a, b) => a + b) / cl.length) - 1) * 1000) / 10, 'dif em % a 1 casa');
ok(p.semanal[p.semanal.length - 1][1] === Number(p.atual.toPrecision(4)) && p.semanal.length >= 100 && p.semanal.length <= 106, 'semanal: ~104 pontos e o último é o atual');
ok(typeof p.var_1a_pct === 'number', 'variação em 1 ano');
ok(p.nome === 'Petróleo Brasileiro S.A. - Petrobras' && p.moeda === 'BRL' && p.data_atual === '2026-11-06', 'nome, moeda e data no fuso da bolsa');
ok(j1.itens['BAD.SA'].erro === 'Símbolo não encontrado' && conta['BAD.SA'] === 1, '404: "Símbolo não encontrado" sem nova tentativa');
ok(j1.itens.AAPL.erro === null && conta.AAPL === 3, '429 duas vezes e depois 200: ok na 3ª tentativa');
ok(/em 4 tentativas/.test(j1.itens.MSFT.erro) && j1.itens.MSFT.atual === undefined, '429 sempre: erro, sem número anterior');
ok(logs.some(l => /^5 símbolos: 3 ok, 1 sem dados .*1 não encontrado/.test(l)), 'log do resumo (' + logs.find(l => /símbolos/.test(l)) + ')');
const txt = await readFile(join(dir, 'inv/cotacoes.json'), 'utf8');
ok(txt.split('\n').length === 8 && txt.split('\n')[1].startsWith('"PETR4.SA":'), 'um item por linha');

// sem mudança: não regrava
const m1 = (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs; for (const k in conta) delete conta[k];
await new Promise(r => setTimeout(r, 30));
const r2 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
ok(!r2.gravou && (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs === m1, 'nada mudou: não regrava');

// item com erro hoje mantém o número de ontem e a data antiga
modo = { 'BAD.SA': '404', 'PETR4.SA': '500' }; for (const k in conta) delete conta[k];
await R.main({ raiz: dir, hoje: '2026-11-09', log: L });
const j3 = JSON.parse(await readFile(join(dir, 'inv/cotacoes.json'), 'utf8'));
ok(j3.itens['PETR4.SA'].atual === p.atual && j3.itens['PETR4.SA'].atualizado_em === '2026-11-08' && /500/.test(j3.itens['PETR4.SA'].erro), 'falhou hoje: mantém o atual de ontem, com erro e a data antiga');
ok(j3.itens.AAPL.atualizado_em === '2026-11-09', 'os que deram certo ganham a data de hoje');

// mais da metade falhou: não grava, sai com bloqueio
modo = { 'PETR4.SA': '429', 'VALE3.SA': '429', MSFT: '429', 'BAD.SA': '404' }; for (const k in conta) delete conta[k];
const m4 = (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs;
const r4 = await R.main({ raiz: dir, hoje: '2026-11-10', log: L });
ok(r4.bloqueado && !r4.gravou && (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs === m4, '80% falhou: não grava e avisa');
ok(R.var1a([['2025-11-07', 10], ['2026-11-07', 12]]) === 20 && R.var1a([['2026-10-01', 10], ['2026-11-07', 12]]) === null, 'var1a: 1 ano atrás, ou nada se não houver');

srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
