// Teste das funções api/inv-cotacao.mjs e api/inv-busca.mjs (fontes falsas, req/res simulados) e do robô do índice de busca.
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/inv');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const csv = await readFile(join(FIX, 'stooq-petr4-d.csv'), 'utf8');
const brapi = await readFile(join(FIX, 'brapi-petr4.json'), 'utf8');
let fora = false; const urls = [];
const sec = { 0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' }, 1: { cik_str: 1067983, ticker: 'BRK.B', title: 'BERKSHIRE HATHAWAY INC' }, 2: { cik_str: 1, ticker: 'PBR', title: 'PETROLEO BRASILEIRO SA PETROBRAS' } };
for (let i = 3; i < 1200; i++) sec[i] = { cik_str: i, ticker: 'T' + i, title: 'TESTE ' + i + ' CORP' };
const srv = http.createServer((req, res) => {
  urls.push(req.url + ' | ' + req.headers['user-agent']);
  const u = new URL(req.url, 'http://x');
  const manda = (st, t, ct = 'application/json') => { res.writeHead(st, { 'content-type': ct }); res.end(t); };
  if (fora) return manda(503, '');
  if (u.pathname === '/stooq/q/d/l/') {
    const s = u.searchParams.get('s');
    if (s === 'petr4.br' || s === 'xxxx.us') return manda(200, 'No data', 'text/plain');
    return manda(200, csv, 'text/csv');
  }
  if (u.pathname === '/brapi/api/quote/PETR4') return manda(200, brapi);
  if (u.pathname === '/brapi/api/quote/list') return manda(200, JSON.stringify({ stocks: [{ stock: 'PETR4', name: 'PETROBRAS PN' }, ...Array.from({ length: 60 }, (_, i) => ({ stock: 'TST' + i, name: 'Teste ' + i }))] }));
  if (u.pathname.startsWith('/brapi/')) return manda(404, '{"error":true,"message":"não encontrado"}');
  if (u.pathname === '/sec.json') return manda(200, JSON.stringify(sec));
  manda(404, '');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${srv.address().port}`;
process.env.INV_STOOQ_BASE = B + '/stooq'; process.env.INV_BRAPI_BASE = B + '/brapi'; process.env.INV_SEC_URL = B + '/sec.json';
delete process.env.BRAPI_TOKEN; delete process.env.TWELVE_DATA_KEY;
const C = await import('../api/inv-cotacao.mjs');
const cot = C.default;
const bus = (await import('../api/inv-busca.mjs')).default;

function chama(fn, { method = 'GET', query = {}, ip = '1.1.1.1' } = {}) {
  return new Promise(resolve => {
    const r = { headers: {}, statusCode: 200 };
    const res = { setHeader: (k, v) => { r.headers[k.toLowerCase()] = v; }, status(c) { r.statusCode = c; return this; }, json(o) { r.body = o; resolve(r); return this; } };
    fn({ method, query, headers: { 'x-forwarded-for': ip + ', 10.0.0.1' } }, res);
  });
}

let r = await chama(cot, { query: { s: ' aapl ' } });
ok(r.statusCode === 200 && r.body.simbolo === 'AAPL' && r.body.range === '2y' && r.body.intervalo === '1d' && r.body.fonte === 'stooq', 'cotação: 200, símbolo normalizado, 2y diário, pelo stooq');
ok(r.body.n === 520 && r.body.serie.length === 520 && r.body.media > 0 && typeof r.body.dif_pct === 'number' && r.body.moeda === 'USD' && r.body.nome === 'Apple', 'cotação: série, estatísticas, moeda e nome da lista');
ok(/s-maxage=1800/.test(r.headers['cache-control']), 'cotação: cache na CDN por 30 min');
ok(urls.some(u => /^\/stooq\/q\/d\/l\/\?s=aapl\.us&i=d&d1=\d{8}&d2=\d{8} \| inv-madeinbr\//.test(u)), 'chama o stooq com a janela e o User-Agent do robô');
r = await chama(cot, { query: { s: 'PETR4.SA' } });
ok(r.statusCode === 200 && r.body.fonte === 'brapi.dev' && r.body.moeda === 'BRL', 'B3: stooq sem dados → brapi');
r = await chama(cot, { query: { s: 'AAPL', range: '5y' } });
ok(r.statusCode === 200 && r.body.intervalo === '1wk' && urls.some(u => u.includes('s=aapl.us&i=w')), '5y → semanal');
r = await chama(cot, { query: { s: 'AAPL', range: 'max' } });
ok(r.statusCode === 200 && urls.some(u => u.startsWith('/stooq/q/d/l/?s=aapl.us&i=m |')), 'máx → mensal, sem janela');
r = await chama(cot, { query: { s: 'a b' } });
ok(r.statusCode === 400 && r.body.erro === 'Símbolo inválido.' && r.headers['cache-control'] === 'no-store', '400 símbolo inválido, sem cache');
r = await chama(cot, { query: { s: 'AAPL', range: '3y' } });
ok(r.statusCode === 400 && r.body.erro === 'Intervalo inválido.', '400 intervalo inválido');
r = await chama(cot, { query: { s: 'XXXX' } });
ok(r.statusCode === 404 && r.body.erro === 'Símbolo não encontrado.', '404 quando nenhuma fonte tem');
r = await chama(cot, { method: 'POST', query: { s: 'AAPL' } });
ok(r.statusCode === 405 && r.headers.allow === 'GET', '405 em POST');
fora = true; r = await chama(cot, { query: { s: 'MSFT' }, ip: '2.2.2.2' });
ok(r.statusCode === 502 && r.body.erro === 'A fonte de cotações não respondeu.', '502 quando as fontes não respondem'); fora = false;
C.zeraFontes();
let ult; for (let i = 0; i < 121; i++) ult = await chama(cot, { query: { s: 'XXXX' }, ip: '9.9.9.9' });
ok(ult.statusCode === 429 && /Muitas consultas/.test(ult.body.erro), '429 depois de 120 por hora do mesmo IP');
r = await chama(cot, { query: { s: 'XXXX' }, ip: '8.8.8.8' });
ok(r.statusCode === 404, 'outro IP segue livre');

r = await chama(bus, { query: { q: 'petro' } });
const sims = r.body.itens.map(x => x.simbolo);
ok(r.statusCode === 200 && sims[0] === 'PETR4.SA' && sims.includes('PETR3.SA') && r.body.itens.every(x => x.grupo), 'busca no índice: Petrobras PN e ON (' + sims.join() + ')');
r = await chama(bus, { query: { q: 'AAPL' } });
ok(r.body.itens[0].simbolo === 'AAPL' && r.body.itens[0].grupo === 'eua', 'busca por código dos EUA');
ok(/s-maxage=86400/.test(r.headers['cache-control']), 'busca: cache de 1 dia na CDN');
r = await chama(bus, { query: { q: '   ' } });
ok(r.statusCode === 400, 'busca vazia: 400');
r = await chama(bus, { query: { q: 'x'.repeat(41) } });
ok(r.statusCode === 400, 'busca com mais de 40 caracteres: 400');

// robô do índice
const I = await import('./inv-indice.mjs');
const dir = await mkdtemp(join(tmpdir(), 'inv-ix-')); await mkdir(join(dir, 'inv'));
await writeFile(join(dir, 'inv/empresas.json'), JSON.stringify({ mercados: [{ empresas: [{ simbolo: 'PETR4.SA', nome: 'Petrobras' }, { simbolo: 'AAPL', nome: 'Apple' }] }] }));
const logs = []; urls.length = 0;
const x1 = await I.main({ raiz: dir, log: m => logs.push(m) });
const j1 = JSON.parse(await readFile(join(dir, 'inv/busca.json'), 'utf8'));
const mp = new Map(j1.itens);
ok(x1.gravou && j1.completo && mp.get('PETR4.SA') === 'Petrobras' && mp.get('AAPL') === 'Apple' && mp.get('BRK-B') === 'Berkshire Hathaway Inc' && mp.get('TST3.SA') === 'Teste 3', 'índice: listas primeiro, brapi, SEC (BRK.B → BRK-B, nome sem maiúsculas)');
ok(mp.get('VALE3.SA') === 'Vale ON' && mp.size === 2 + 60 + 1 + I.B3_CONHECIDAS.length - 2 + 1200 - 1, 'índice: lista fixa da B3 e sem repetir símbolo (' + mp.size + ')');
ok(urls.filter(u => u.startsWith('/sec.json')).every(u => /inv-madeinbr\/.*github\.com\/lucasvaranda-ux\/mochilao-america-do-sul\)$/.test(u) && !/@/.test(u)), 'SEC: User-Agent com o nome do robô e do repositório, sem e-mail');
const x2 = await I.main({ raiz: dir, log: m => logs.push(m) });
ok(x2.pulou, 'completo e com menos de uma semana: não refaz');
fora = true; process.env.INV_INDICE_FORCA = '1';
const x3 = await I.main({ raiz: dir, log: m => logs.push(m) });
const j3 = JSON.parse(await readFile(join(dir, 'inv/busca.json'), 'utf8'));
ok(x3.falhas.length === 2 && !j3.completo && new Map(j3.itens).get('BRK-B') === 'Berkshire Hathaway Inc' && new Map(j3.itens).get('TST3.SA') === 'Teste 3', 'fontes fora: ficam os itens do arquivo anterior');
fora = false; delete process.env.INV_INDICE_FORCA;

srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
