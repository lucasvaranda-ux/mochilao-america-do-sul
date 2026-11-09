// Teste do robô dos indicadores com um servidor falso (BCB, Olinda e stooq) servindo scripts/fixtures/inv.
import http from 'node:http';
import { mkdtemp, mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/inv');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const modo = { olinda: 200, stooq: 200 };
const chamadas = [];
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); chamadas.push(u.pathname + u.search);
  const manda = async (f, st = 200) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(f ? await readFile(join(FIX, f)) : '{}'); };
  let m;
  if ((m = u.pathname.match(/^\/sgs\/bcdata\.sgs\.(\d+)\/dados$/))) {
    const s = m[1];
    if (s === '432') { const ini = (u.searchParams.get('dataInicial') || '').slice(6); return manda(`sgs-432-${ini}.json`); }
    return manda(`sgs-${s}.json`);
  }
  if (u.pathname.startsWith('/olinda/')) {
    if (modo.olinda !== 200) { res.writeHead(modo.olinda); return res.end('erro'); }
    const f = u.searchParams.get('$filter') || '';
    if (f.includes("'IPCA'")) return manda('olinda-ipca.json');
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"value":[]}');
  }
  if (u.pathname === '/stooq/q/d/l/') {
    if (modo.stooq === 'limite') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Exceeded the daily hits limit'); }
    if (modo.stooq !== 200) { res.writeHead(modo.stooq); return res.end('erro'); }
    if (u.searchParams.get('i') !== 'm') { res.writeHead(400); return res.end('esperava mensal'); }
    res.writeHead(200, { 'content-type': 'text/csv' }); return res.end(await readFile(join(FIX, 'stooq-bvp-m.csv')));
  }
  res.writeHead(404); res.end();
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${srv.address().port}`;
process.env.INV_BCB_BASE = B + '/sgs/bcdata.sgs.';
process.env.INV_OLINDA_BASE = B + '/olinda/';
process.env.INV_STOOQ_BASE = B + '/stooq';
process.env.INV_ESPERA_MS = '1';
const R = await import('./inv-macro.mjs');

// funções puras
ok(R.compoeAno([1.70, 1.02, 1.55, 2.43, 2.67, 2.26, 2.36, 0.99, 0.99, 1.41, 1.47, 1.56]) === 22.41, 'IPCA 1995 = 22,41');
ok(R.compoeAno([3.37, 3.25, 4.26, 4.26, 4.25, 4.04, 4.02, 3.84, 3.32, 3.09, 2.88, 2.78]) === 53.08, 'Selic 1995 = 53,08');
ok([1999, 2003, 2005, 2006, 2016, 2017, 2026].map(R.tolerancia).join() === '2,2.5,2.5,2,2,1.5,1.5', 'tolerância por ano');
ok(R.tolerancia(1998) === null, 'sem tolerância antes de 1999');

const dir = await mkdtemp(join(tmpdir(), 'inv-macro-')); await mkdir(join(dir, 'inv'));
const log = []; const L = m => log.push(m);
const r = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
const j = JSON.parse(await readFile(join(dir, 'inv/macro.json'), 'utf8'));
const I = j.indicadores;
ok(r.gravou, 'gravou o arquivo');
ok(I.ipca.realizado['1995'] === 22.41 && I.selic.realizado['1995'] === 53.08 && I.cdi.realizado['1995'] === 53.09, 'IPCA, Selic e CDI de 1995 pelas séries');
ok(I.ipca.realizado['2025'] === 4.26 && I.selic.realizado['2025'] === 14.33, 'IPCA 2025 = 4,26 e Selic 2025 = 14,33');
ok(I.ipca.parcial['2026'] === 'jan–set', 'IPCA 2026 parcial jan–set');
ok(I.selic.parcial['2026'] === 'jan–out' && I.cdi.parcial['2026'] === 'jan–out', 'Selic/CDI: o mês corrente sai (jan–out)');
ok(I.poupanca.parcial['2026'] === 'jan–out', 'poupança: o mês corrente sai');
ok(!I.ipca.parcial['2025'], '2025 completo não é parcial');
ok(I.ipca.meta['2026'] === 3 && I.ipca.meta['1999'] === 8 && I.ipca.tol['2003'] === 2.5 && I.ipca.tol['2026'] === 1.5, 'meta e tolerância da inflação');
ok(I.selic.meta['2008'] === 13.75 && I.selic.meta['1999'] === 19, 'meta Selic em 31/12 (2008 = 13,75; 1999 = 19)');
ok(I.selic.meta['2026'] === 13.75, 'meta Selic de 2026 = a de hoje (não a de depois de hoje)');
ok(chamadas.filter(c => c.includes('sgs.432')).length === 3, 'meta Selic em 3 janelas de até 10 anos');
ok(chamadas.filter(c => c.includes('sgs.4')).every(c => !/ultimos/.test(c)), 'nunca usa /ultimos');
ok(I.dolar.nivel['2024'] === 6.1923 && I.dolar.realizado['2025'] === Math.round((5.5024 / 6.1923 - 1) * 1000) / 10, 'dólar: nível de dez/2024 e variação de 2025');
ok(I.dolar.parcial['2026'] === 'até out' && I.dolar.nivel['2026'] === 5.4212, 'dólar 2026 até out');
ok(I.ipca.projecao && I.ipca.projecao['2026'] === 4.21 && I.ipca.projecao['2029'] === 3.5 && !I.ipca.projecao['2030'], 'Focus: maior data, base 0, mediana, até ano+3');
ok(I.ipca.projecao_data === '2026-11-06', 'Focus: data guardada');
ok(I.selic.projecao === null, 'Focus vazio para a Selic: sem projeção (e sem anterior)');
ok(I.ibovespa.nivel['2025'] === 136281 && I.ibovespa.realizado['2025'] === Math.round((136281 / 116965 - 1) * 1000) / 10, 'Ibovespa: nível de dezembro e variação');
ok(I.ibovespa.parcial['2026'] === 'até 06/11' && I.ibovespa.nivel['2026'] === 151227, 'Ibovespa 2026: último fechamento do mês corrente, até 06/11');
ok(chamadas.some(c => c === '/stooq/q/d/l/?s=%5Ebvp&i=m') && chamadas.some(c => c === '/stooq/q/d/l/?s=%5Espx&i=m'), 'stooq: ^bvp e ^spx, mensal, sem janela');
ok(/stooq/.test(j.fontes.bolsa) && I.ibovespa.fonte === 'stooq:^bvp', 'fonte das bolsas: stooq');
ok(!('1994' in I.ibovespa.nivel) && '1995' in I.ibovespa.realizado, 'Ibovespa a partir de 1995 (1994 só para a variação)');
ok(j.hoje === '2026-11-08' && j.versao === 1, 'cabeçalho do arquivo');

// rodar de novo sem mudança não regrava
const m1 = (await stat(join(dir, 'inv/macro.json'))).mtimeMs;
await new Promise(r => setTimeout(r, 30));
const r2 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
ok(!r2.gravou && (await stat(join(dir, 'inv/macro.json'))).mtimeMs === m1, 'sem mudança, não regrava');
ok(!R.mudou({ a: 1, gerado_em: 'x', hoje: 'y' }, { a: 1, gerado_em: 'z', hoje: 'w' }) && R.mudou({ a: 1 }, { a: 2 }), 'mudou() ignora gerado_em e hoje');

// Focus fora e stooq no limite diário: mantém o anterior
modo.olinda = 500; modo.stooq = 'limite';
const r3 = await R.main({ raiz: dir, hoje: '2026-11-08', log: L });
const j3 = JSON.parse(await readFile(join(dir, 'inv/macro.json'), 'utf8'));
ok(j3.indicadores.ipca.projecao['2026'] === 4.21 && j3.indicadores.ipca.projecao_data === '2026-11-06', 'Focus 500: mantém a projeção anterior');
ok(j3.indicadores.ibovespa.nivel['2025'] === 136281, 'stooq no limite: mantém o Ibovespa anterior');
ok(r3.falhas.includes('Focus IPCA') && r3.falhas.includes('stooq ^bvp') && !r3.gravou, 'falhas registradas e nada mudou');

// stooq sem o índice (404 em tudo, sem anterior): série vazia com nota
modo.stooq = 404;
const dir2 = await mkdtemp(join(tmpdir(), 'inv-macro-')); await mkdir(join(dir2, 'inv'));
await R.main({ raiz: dir2, hoje: '2026-11-08', log: L });
const j4 = JSON.parse(await readFile(join(dir2, 'inv/macro.json'), 'utf8'));
ok(!Object.keys(j4.indicadores.ibovespa.nivel).length && /não tem o índice/.test((j4.indicadores.ibovespa.notas || [])[0]), 'stooq sem o índice: série vazia e nota no JSON');

srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
