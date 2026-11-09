// Teste das funções api/inv-cotacao.mjs e api/inv-busca.mjs com um Yahoo falso e req/res simulados.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/inv');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const chart = await readFile(join(FIX, 'yahoo-chart-petr4.json'), 'utf8');
const nf = await readFile(join(FIX, 'yahoo-chart-404.json'), 'utf8');
const busca = await readFile(join(FIX, 'yahoo-search-petro.json'), 'utf8');
let fora = false; const urls = [];
const srv = http.createServer((req, res) => {
  urls.push(req.url);
  if (fora) { res.writeHead(503); return res.end(); }
  if (req.url.startsWith('/v1/finance/search')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(busca); }
  if (req.url.includes('/chart/XXXX')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end(nf); }
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(chart);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
process.env.INV_YAHOO_BASE = `http://127.0.0.1:${srv.address().port}`;
const cot = (await import('../api/inv-cotacao.mjs')).default;
const bus = (await import('../api/inv-busca.mjs')).default;

function chama(fn, { method = 'GET', query = {}, ip = '1.1.1.1' } = {}) {
  return new Promise(resolve => {
    const r = { headers: {}, statusCode: 200 };
    const res = { setHeader: (k, v) => { r.headers[k.toLowerCase()] = v; }, status(c) { r.statusCode = c; return this; }, json(o) { r.body = o; resolve(r); return this; } };
    fn({ method, query, headers: { 'x-forwarded-for': ip + ', 10.0.0.1' } }, res);
  });
}

let r = await chama(cot, { query: { s: ' petr4.sa ' } });
ok(r.statusCode === 200 && r.body.simbolo === 'PETR4.SA' && r.body.range === '2y' && r.body.intervalo === '1d', 'cotação: 200, símbolo normalizado, 2y diário');
ok(r.body.n === 520 && r.body.serie.length === 520 && r.body.media > 0 && typeof r.body.dif_pct === 'number' && r.body.moeda === 'BRL', 'cotação: série e estatísticas');
ok(/s-maxage=1800/.test(r.headers['cache-control']), 'cotação: cache na CDN por 30 min');
ok(urls.some(u => u.startsWith('/v8/finance/chart/PETR4.SA?range=2y&interval=1d')), 'chama o gráfico v8 com range e intervalo');
r = await chama(cot, { query: { s: 'AAPL', range: '5y' } });
ok(r.statusCode === 200 && r.body.intervalo === '1wk' && urls.some(u => u.includes('AAPL?range=5y&interval=1wk')), '5y → semanal');
r = await chama(cot, { query: { s: 'a b' } });
ok(r.statusCode === 400 && r.body.erro === 'Símbolo inválido.' && r.headers['cache-control'] === 'no-store', '400 símbolo inválido, sem cache');
r = await chama(cot, { query: { s: 'AAPL', range: '3y' } });
ok(r.statusCode === 400 && r.body.erro === 'Intervalo inválido.', '400 intervalo inválido');
r = await chama(cot, { query: { s: 'XXXX' } });
ok(r.statusCode === 404 && r.body.erro === 'Símbolo não encontrado.', '404 símbolo não encontrado');
r = await chama(cot, { method: 'POST', query: { s: 'AAPL' } });
ok(r.statusCode === 405 && r.headers.allow === 'GET', '405 em POST');
fora = true; r = await chama(cot, { query: { s: 'AAPL' }, ip: '2.2.2.2' });
ok(r.statusCode === 502 && r.body.erro === 'A fonte de cotações não respondeu.', '502 quando o Yahoo não responde'); fora = false;
let ult; for (let i = 0; i < 121; i++) ult = await chama(cot, { query: { s: 'XXXX' }, ip: '9.9.9.9' });
ok(ult.statusCode === 429 && /Muitas consultas/.test(ult.body.erro), '429 depois de 120 por hora do mesmo IP');
r = await chama(cot, { query: { s: 'XXXX' }, ip: '8.8.8.8' });
ok(r.statusCode === 404, 'outro IP segue livre');

r = await chama(bus, { query: { q: 'petro' } });
const sims = r.body.itens.map(x => x.simbolo).join();
ok(r.statusCode === 200 && sims === 'PETR4.SA,PETR3.SA,PBR,PJXA.F', 'busca: Brasil, EUA e outras, sem cripto (' + sims + ')');
ok(r.body.itens[0].grupo === 'br' && r.body.itens[2].grupo === 'eua' && r.body.itens[3].grupo === 'outro' && r.body.itens[0].curto === 'PETROBRAS PN N2', 'busca: grupos e nome curto sem espaços duplos');
ok(/s-maxage=86400/.test(r.headers['cache-control']), 'busca: cache de 1 dia na CDN');
r = await chama(bus, { query: { q: '   ' } });
ok(r.statusCode === 400, 'busca vazia: 400');
r = await chama(bus, { query: { q: 'x'.repeat(41) } });
ok(r.statusCode === 400, 'busca com mais de 40 caracteres: 400');
fora = true; r = await chama(bus, { query: { q: 'vale' }, ip: '3.3.3.3' });
ok(r.statusCode === 502, 'busca: 502 quando o Yahoo não responde'); fora = false;

srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
