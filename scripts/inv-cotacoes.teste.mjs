// Teste do robô das cotações com fontes falsas (stooq, brapi e Twelve Data): cadeia, fonte fora, limite diário, 404 e não regravar.
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/inv');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const csv = await readFile(join(FIX, 'stooq-petr4-d.csv'), 'utf8');
const brapi = await readFile(join(FIX, 'brapi-petr4.json'), 'utf8');
const brapiTok = await readFile(join(FIX, 'brapi-sem-token.json'), 'utf8');
const td = JSON.stringify({ meta: { currency: 'USD', exchange: 'NASDAQ' }, status: 'ok', values: csv.trim().split('\n').slice(1).map(l => l.split(',')).filter(c => c[4]).map(c => ({ datetime: c[0], close: c[4] })).reverse() });
// modo['stooq:aapl.us'] = 'ok' | 'nodata' | '500' | 'limite'; modo['brapi:PETR4'] = 'ok' | '401' | '404'; modo['td:MSFT'] = 'ok' | '429'
let modo = {}; let chamadas = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let k, m;
  if (u.pathname === '/stooq/q/d/l/') k = 'stooq:' + u.searchParams.get('s');
  else if (u.pathname.startsWith('/brapi/api/quote/')) k = 'brapi:' + decodeURIComponent(u.pathname.split('/').pop());
  else if (u.pathname === '/td/time_series') k = 'td:' + u.searchParams.get('symbol');
  chamadas.push(k + (u.searchParams.get('token') ? '+token' : ''));
  m = modo[k] || (k && k.startsWith('stooq:') ? 'nodata' : '404');
  const txt = (st, t, ct = 'text/plain') => { res.writeHead(st, { 'content-type': ct }); res.end(t); };
  if (k.startsWith('stooq:')) {
    if (m === 'ok') return txt(200, csv, 'text/csv');
    if (m === 'limite') return txt(200, 'Exceeded the daily hits limit');
    if (m === '500') return txt(500, 'erro');
    return txt(200, 'No data');
  }
  if (k.startsWith('brapi:')) {
    if (m === 'ok') return txt(200, brapi, 'application/json');
    if (m === '401') return txt(401, brapiTok, 'application/json');
    return txt(404, '{"error":true,"message":"Não encontramos a ação"}', 'application/json');
  }
  if (m === 'ok') return txt(200, td, 'application/json');
  if (m === '429') return txt(200, '{"code":429,"message":"You have run out of API credits for the day","status":"error"}', 'application/json');
  return txt(200, '{"code":404,"message":"symbol not found","status":"error"}', 'application/json');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${srv.address().port}`;
process.env.INV_STOOQ_BASE = B + '/stooq'; process.env.INV_BRAPI_BASE = B + '/brapi'; process.env.INV_TD_BASE = B + '/td';
process.env.INV_PAUSA_STOOQ_MS = '1'; process.env.INV_PAUSA_BRAPI_MS = '1'; process.env.INV_PAUSA_TD_MS = '1';
delete process.env.BRAPI_TOKEN; delete process.env.TWELVE_DATA_KEY;
const R = await import('./inv-cotacoes.mjs');
const F = await import('../api/_inv-fontes.mjs');

// funções puras
const e = F.estatisticas([['2026-01-01', 10], ['2026-01-02', 12], ['2026-01-05', 14]]);
ok(e.media === 12 && e.atual === 14 && e.dif_pct === 16.7 && e.min === 10 && e.max === 14 && e.n === 3, 'estatisticas: média, atual, dif a 1 casa, mín e máx');
const sem = F.semanal([['2026-11-02', 1], ['2026-11-04', 2], ['2026-11-06', 3], ['2026-11-09', 4], ['2026-11-10', 5]]);
ok(sem.length === 2 && sem[0][0] === '2026-11-06' && sem[1][1] === 5, 'semanal: último fechamento de cada semana');
ok(F.simboloOk(' petr4.sa ') === 'PETR4.SA' && F.simboloOk('BRK-B') === 'BRK-B' && F.simboloOk('^BVSP') === '^BVSP' && !F.simboloOk('a b') && !F.simboloOk('<x>') && !F.simboloOk(''), 'simboloOk normaliza e recusa');
const ix = F.indexa100([[['2026-01-01', 10], ['2026-01-02', 20]], [['2026-01-02', 5], ['2026-01-03', 6]]]);
ok(ix.inicio === '2026-01-02' && ix.series[0][0][1] === 100 && ix.series[1][1][1] === 120, 'indexa100 começa na 1ª data comum');
ok(F.stooqCandidatos('AAPL').join() === 'aapl.us' && F.stooqCandidatos('BRK-B').join() === 'brk-b.us' && F.stooqCandidatos('SHEL.L').join() === 'shel.uk' && F.stooqCandidatos('7203.T').join() === '7203.jp', 'stooq: sufixos .us, .uk e .jp');
ok(F.stooqCandidatos('0700.HK').join() === '700.hk,0700.hk' && F.stooqCandidatos('X.SA', 'abc.xx').join() === 'abc.xx' && F.stooqCandidatos('X.SA', false).length === 0, 'stooq: Hong Kong sem e com zeros; o campo "stooq" vence; false = não tem');
const ind = { itens: [['PETR4.SA', 'Petrobras PN', 'br'], ['PBR', 'Petroleo Brasileiro SA Petrobras', 'eua'], ['AAPL', 'Apple Inc.', 'eua'], ['VALE3.SA', 'Vale ON', 'br'], ['PETR3.SA', 'Petrobras ON', 'br']] };
ok(F.buscaNoIndice(ind, 'petro').map(x => x.simbolo).join() === 'PETR4.SA,PETR3.SA,PBR', 'índice: nome, Brasil antes dos EUA');
ok(F.buscaNoIndice(ind, 'aapl')[0].simbolo === 'AAPL' && F.buscaNoIndice(ind, 'petr4')[0].simbolo === 'PETR4.SA' && F.buscaNoIndice(ind, 'Petróleo')[0].simbolo === 'PBR', 'índice: código com e sem .SA, acento ignorado');

const dir = await mkdtemp(join(tmpdir(), 'inv-cot-')); await mkdir(join(dir, 'inv'));
const emp = { versao: 1, mercados: [
  { id: 'br', empresas: [{ nome: 'Petrobras', simbolo: 'PETR4.SA' }, { nome: 'Vale', simbolo: 'VALE3.SA' }, { nome: 'Itaú', simbolo: 'ITUB4.SA', stooq: false }] },
  { id: 'eua', empresas: [{ nome: 'Apple', simbolo: 'AAPL' }, { nome: 'Microsoft', simbolo: 'MSFT' }, { nome: 'Nvidia', simbolo: 'NVDA' }, { nome: 'Alphabet', simbolo: 'GOOGL' }, { nome: 'Amazon', simbolo: 'AMZN' }] },
  { id: 'china', empresas: [{ nome: 'Tencent', simbolo: '0700.HK' }, { nome: 'Nada', simbolo: 'BAD.HK' }, { nome: 'Toyota', simbolo: '7203.T', stooq: '7203.jp' }] }] };
await writeFile(join(dir, 'inv/empresas.json'), JSON.stringify(emp));
await writeFile(join(dir, 'inv/cotacoes.json'), '{"versao":1,"gerado_em":null,"itens":{}}\n');
const logs = []; const L = m => logs.push(m);

// rodada 1, sem chaves: PETR4 cai no brapi (sem token abre), VALE3 pede token (brapi sai), stooq dá 500 três vezes seguidas e sai
modo = { 'brapi:PETR4': 'ok', 'brapi:VALE3': '401', 'stooq:aapl.us': 'ok', 'stooq:msft.us': '500', 'stooq:nvda.us': '500', 'stooq:googl.us': '500', 'stooq:0700.hk': 'ok' };
const r1 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
const j1 = r1;
const p = j1.itens['PETR4.SA'];
const cl = csv.trim().split('\n').slice(1).map(l => Number(l.split(',')[4])).filter(v => v > 0);
ok(p && p.erro === null && p.fonte === 'brapi', 'PETR4.SA: stooq sem dados → brapi');
ok(chamadas.includes('stooq:petr4.br') && chamadas.includes('brapi:PETR4') && !chamadas.some(c => c.endsWith('+token')), 'tentou stooq .br e brapi sem token');
ok(p.n === cl.length && p.n === 520, 'n = pregões com fechamento (' + p.n + ')');
ok(p.atual === cl[cl.length - 1] && Math.abs(p.media_2a - cl.reduce((a, b) => a + b) / cl.length) < .006, 'atual = último fechamento; média dos 2 anos');
ok(p.semanal[p.semanal.length - 1][1] === Number(p.atual.toPrecision(4)) && p.semanal.length >= 100 && p.semanal.length <= 106, 'semanal: ~104 pontos e o último é o atual');
ok(typeof p.var_1a_pct === 'number' && p.nome === 'Petrobras' && p.moeda === 'BRL' && p.data_atual === '2026-11-06' && p.bolsa === 'B3', 'variação em 1 ano, nome da lista, moeda, data e bolsa');
ok(r1.estado.brapi.fora && /token/.test(r1.estado.brapi.fora) && j1.itens['VALE3.SA'].erro === 'Sem dados hoje', 'brapi pediu token: sai da rodada; VALE3 sem dados');
ok(!chamadas.includes('brapi:ITUB4') && !chamadas.includes('stooq:itub4.br'), 'ITUB4: "stooq": false pula o stooq, brapi fora pula a brapi');
ok(j1.itens.AAPL.fonte === 'stooq' && j1.itens.AAPL.moeda === 'USD' && j1.itens.AAPL.erro === null, 'AAPL pelo stooq');
ok(r1.estado.stooq.fora && /3 falhas seguidas/.test(r1.estado.stooq.fora), '3 falhas seguidas: stooq sai da rodada');
ok(!chamadas.includes('stooq:amzn.us') && j1.itens.AMZN.erro === 'Sem dados hoje' && !chamadas.some(c => c.startsWith('td:')), 'depois disso não chama mais o stooq; sem chave, não chama o Twelve Data');
ok(j1.itens['0700.HK'].erro === 'Sem dados hoje', 'Hong Kong também fica sem (stooq fora)');
ok(logs.some(l => /^11 símbolos: 2 ok, 9 sem dados, 0 não encontrados · por fonte: stooq 1 \(saiu da rodada: 3 falhas seguidas/.test(l)), 'log do resumo (' + logs.find(l => /símbolos/.test(l)) + ')');
ok(r1.bloqueado === true && !r1.gravou && (await readFile(join(dir, 'inv/cotacoes.json'), 'utf8')).startsWith('{"versao":1'), 'mais da metade falhou: não grava e avisa');

// rodada 2: stooq bem, Hong Kong só com zeros, Twelve Data com chave para o que faltar (com um 429 no meio)
process.env.TWELVE_DATA_KEY = 'chave-falsa';
modo = { 'brapi:PETR4': 'ok', 'brapi:VALE3': 'ok', 'brapi:ITUB4': 'ok', 'stooq:aapl.us': 'ok', 'stooq:msft.us': 'ok', 'stooq:nvda.us': 'ok', 'stooq:googl.us': 'nodata', 'td:GOOGL': 'ok', 'stooq:amzn.us': 'nodata', 'td:AMZN': 'ok', 'stooq:0700.hk': 'ok', 'stooq:7203.jp': 'ok' };
chamadas = []; logs.length = 0;
const r2 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
const j2 = JSON.parse(await readFile(join(dir, 'inv/cotacoes.json'), 'utf8'));
ok(r2.gravou && !r2.bloqueado && j2.versao === 2, 'gravou (versão 2)');
ok(j2.itens.GOOGL.fonte === 'twelve' && chamadas.includes('td:GOOGL'), 'GOOGL: stooq sem dados → Twelve Data');
ok(j2.itens.AMZN.fonte === 'twelve' && !r2.estado.twelve.fora && r2.cont.por.twelve === 2, 'AMZN também pelo Twelve Data');
ok(j2.itens['0700.HK'].fonte === 'stooq' && chamadas.indexOf('stooq:700.hk') < chamadas.indexOf('stooq:0700.hk') && r2.descobertos['0700.HK'] === '0700.hk', 'Hong Kong: tenta sem zeros, acha com zeros e avisa no log');
ok(logs.some(l => /pôr em "stooq"/.test(l) && /0700\.hk/.test(l)), 'log lista os símbolos do stooq diferentes do padrão');
ok(j2.itens['BAD.HK'].erro === 'Símbolo não encontrado nas fontes' && j2.itens['7203.T'].fonte === 'stooq' && chamadas.includes('stooq:7203.jp'), 'BAD.HK não encontrado; Toyota pelo símbolo do campo "stooq"');
const txt = await readFile(join(dir, 'inv/cotacoes.json'), 'utf8');
ok(txt.split('\n').length === 14 && txt.split('\n')[1].startsWith('"PETR4.SA":'), 'um item por linha');

// sem mudança: não regrava
const m1 = (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs;
await new Promise(r => setTimeout(r, 30));
const r3 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
ok(!r3.gravou && (await stat(join(dir, 'inv/cotacoes.json'))).mtimeMs === m1, 'nada mudou: não regrava');

// limite diário do stooq e do Twelve Data: param de ser chamados na hora; falhou hoje = número de ontem com erro e a data antiga
modo = { ...modo, 'td:AMZN': '429', 'stooq:0700.hk': 'limite' }; chamadas = [];
const r4 = await R.main({ raiz: dir, hoje: '2026-11-09', log: L });
const j4 = JSON.parse(await readFile(join(dir, 'inv/cotacoes.json'), 'utf8'));
const depois = chamadas.slice(chamadas.indexOf('stooq:0700.hk') + 1);
ok(r4.gravou && !depois.some(c => c.startsWith('stooq:') || c.startsWith('td:')), 'stooq e Twelve Data no limite diário: nenhuma chamada depois');
ok(r4.estado.twelve.fora && /limite/.test(r4.estado.stooq.fora) && j4.itens.AMZN.erro === 'Sem dados hoje', 'os dois saem da rodada');
ok(j4.itens['7203.T'].erro === 'Sem dados hoje' && j4.itens['7203.T'].atual === j2.itens['7203.T'].atual && j4.itens['7203.T'].atualizado_em === '2026-11-08', 'falhou hoje: mantém o número de ontem, com erro e a data antiga');
ok(j4.itens['PETR4.SA'].atualizado_em === '2026-11-09', 'os que deram certo ganham a data de hoje');

// prazo estourado: quem falta fica com o de ontem
process.env.INV_PRAZO_MS = '0'; logs.length = 0;
const r5 = await R.main({ raiz: dir, hoje: '2026-11-10', log: L });
ok(r5.bloqueado && logs.some(l => /prazo estourado/.test(l)), 'prazo da rodada: para e não grava por cima');
delete process.env.INV_PRAZO_MS;
ok(R.var1a([['2025-11-07', 10], ['2026-11-07', 12]]) === 20 && R.var1a([['2026-10-01', 10], ['2026-11-07', 12]]) === null, 'var1a: 1 ano atrás, ou nada se não houver');

srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
