// Inv: módulo compartilhado pelas funções (api/inv-*.mjs) e pelos robôs (scripts/inv-*.mjs).
// O "_" no nome faz a Vercel não publicar este arquivo como função.
// Fontes de cotação, em cadeia (todas permitem uso por programa):
//   1. stooq (CSV diário, sem chave; o limite diário aparece como "Exceeded the daily hits limit")
//   2. brapi.dev (B3; token opcional BRAPI_TOKEN; sem token só algumas ações abrem)
//   3. Twelve Data (token opcional TWELVE_DATA_KEY; 8 por minuto e 800 por dia no plano grátis)
// O Yahoo Finance saiu em 09/11/2026: ele responde 429 a servidores (GitHub Actions e Vercel) e não tem API oficial.
// Os endereços podem apontar para servidores falsos nos testes: INV_STOOQ_BASE, INV_BRAPI_BASE, INV_TD_BASE.

export const UA = 'inv-madeinbr/2.0 (robo do repositorio github.com/lucasvaranda-ux/mochilao-america-do-sul)';
export const RANGES = { '6mo': '1d', '1y': '1d', '2y': '1d', '5y': '1wk', 'max': '1mo' };
const DIAS = { '6mo': 186, '1y': 368, '2y': 735, '5y': 1830 };

function erro(status, msg, extra) { const e = new Error(msg); e.status = status; return Object.assign(e, extra || {}); }
const base = (env, padrao) => (process.env[env] || padrao).replace(/\/$/, '');

// símbolo normalizado (maiúsculas, sem espaços) ou null
export function simboloOk(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toUpperCase();
  return /^[A-Z0-9^][A-Z0-9.\-=^]{0,14}$/.test(t) ? t : null;
}
export function partes(simbolo) {
  const m = String(simbolo).match(/^(.+?)(\.[A-Z]+)?$/);
  return { raiz: m[1], suf: m[2] || '' };
}

// moeda e bolsa pelo sufixo (os códigos seguem o padrão usado em inv/empresas.json)
export const BOLSAS = {
  '': ['USD', 'EUA'], '.SA': ['BRL', 'B3'], '.L': ['GBp', 'Londres'], '.PA': ['EUR', 'Paris'], '.DE': ['EUR', 'Xetra'], '.AS': ['EUR', 'Amsterdã'],
  '.SW': ['CHF', 'Suíça'], '.CO': ['DKK', 'Copenhague'], '.HK': ['HKD', 'Hong Kong'], '.SS': ['CNY', 'Xangai'], '.SZ': ['CNY', 'Shenzhen'],
  '.T': ['JPY', 'Tóquio'], '.NS': ['INR', 'Índia (NSE)'], '.KS': ['KRW', 'Coreia'], '.TO': ['CAD', 'Toronto'], '.AX': ['AUD', 'Austrália'],
  '.TW': ['TWD', 'Taiwan'], '.SR': ['SAR', 'Arábia Saudita']
};
export function grupoDe(simbolo) { const { suf } = partes(simbolo); return suf === '.SA' ? 'br' : suf === '' && !simbolo.startsWith('^') ? 'eua' : 'outro'; }

// data ISO (AAAA-MM-DD) de um instante no fuso da bolsa
export function dataNoFuso(seg, fuso) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seg * 1000));
  } catch { return new Date(seg * 1000).toISOString().slice(0, 10); }
}
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');

async function pega(url, tempoMs, accept) {
  return fetch(url, { headers: { 'User-Agent': UA, accept: accept || '*/*' }, signal: AbortSignal.timeout(tempoMs) });
}
function limpa(pontos) {
  const ord = pontos.filter(p => typeof p[1] === 'number' && isFinite(p[1]) && p[1] > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p[0])).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const out = [];
  for (const p of ord) { if (out.length && out[out.length - 1][0] === p[0]) out[out.length - 1] = p; else out.push(p); }
  return out;
}

// ---------- stooq ----------
// sufixo do Yahoo (o código das listas) → sufixo do stooq; o robô confirma no Actions qual existe de fato
const STOOQ_SUF = { '': ['.us'], '.SA': ['.br'], '.L': ['.uk'], '.DE': ['.de'], '.PA': ['.fr'], '.T': ['.jp'], '.HK': ['.hk'], '.AS': ['.nl'], '.SW': ['.ch'], '.CO': ['.dk'], '.SS': ['.cn'], '.SZ': ['.cn'], '.NS': ['.in'], '.KS': ['.kr'], '.TO': ['.ca'], '.AX': ['.au'], '.TW': ['.tw'], '.SR': ['.sa'] };
// candidatos no stooq para um símbolo das listas; override (campo "stooq" de empresas.json) vence; false = não existe lá
export function stooqCandidatos(simbolo, override) {
  if (override === false) return [];
  if (typeof override === 'string' && override) return [override.toLowerCase()];
  if (simbolo.startsWith('^')) return [simbolo.toLowerCase()];
  const { raiz, suf } = partes(simbolo);
  const sufs = STOOQ_SUF[suf];
  if (!sufs) return [];
  const r = raiz.toLowerCase();
  const out = [];
  for (const s of sufs) {
    if (suf === '.HK') { out.push(r.replace(/^0+(?=\d)/, '') + s); out.push(r + s); } else out.push(r + s);
  }
  return [...new Set(out)];
}

// série de fechamentos do stooq. Erros: status 404 (não tem esse símbolo), limite:true (limite diário: parar de chamar), 502 (falha)
export async function stooqSerie(sim, { range = '2y', hoje = new Date(), tempoMs = 12000 } = {}) {
  const iv = range === 'max' ? 'm' : range === '5y' ? 'w' : 'd';
  const u = new URL(base('INV_STOOQ_BASE', 'https://stooq.com') + '/q/d/l/');
  u.searchParams.set('s', sim); u.searchParams.set('i', iv);
  if (DIAS[range]) { u.searchParams.set('d1', ymd(new Date(hoje - DIAS[range] * 864e5))); u.searchParams.set('d2', ymd(hoje)); }
  let r, t;
  // stooq.com e stooq.pl são o mesmo serviço; se um recusar (403), tenta o outro uma vez
  const hosts = process.env.INV_STOOQ_BASE ? [u.origin] : ['https://stooq.com', 'https://stooq.pl'];
  for (const h of hosts) {
    const uu = new URL(u.pathname + u.search, h);
    try { r = await pega(uu, tempoMs, 'text/csv,text/plain,*/*'); t = await r.text(); } catch (e) { throw erro(502, 'stooq: rede (' + (e.name || e.message) + ')'); }
    if (r.status !== 403) break;
  }
  if (/daily hits limit/i.test(t)) throw erro(429, 'stooq: limite diário', { limite: true });
  if (r.status === 404) throw erro(404, 'stooq: não encontrado');
  if (r.status === 403) throw erro(403, 'stooq: acesso negado a este servidor (HTTP 403)', { limite: true });
  if (!r.ok) throw erro(r.status === 429 ? 429 : 502, 'stooq: HTTP ' + r.status + ' (' + String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) + ')', { limite: r.status === 429 });
  if (/apikey/i.test(t) && !/^date,/i.test(t.trim())) throw erro(401, 'stooq: pede chave (' + t.replace(/\s+/g, ' ').trim().slice(0, 100) + ')', { semToken: true });
  const linhas = t.trim().split(/\r?\n/);
  const cab = (linhas[0] || '').toLowerCase().split(',');
  const iD = cab.indexOf('date'), iC = cab.indexOf('close');
  if (iD < 0 || iC < 0) {
    if (/no data|brak danych|^\s*$/i.test(t) || t.length < 40) throw erro(404, 'stooq: sem dados');
    throw erro(502, 'stooq: resposta inesperada (' + t.slice(0, 60).replace(/\s+/g, ' ') + ')');
  }
  const pontos = limpa(linhas.slice(1).map(l => { const c = l.split(','); return [c[iD], Number(c[iC])]; }));
  if (!pontos.length) throw erro(404, 'stooq: sem dados');
  return pontos;
}

// ---------- brapi.dev (B3) ----------
const BRAPI_RANGE = { '6mo': ['6mo', '1d'], '1y': ['1y', '1d'], '2y': ['2y', '1d'], '5y': ['5y', '1wk'], 'max': ['max', '1mo'] };
// erros: 404 (não tem), semToken:true (pede token ou plano: parar de chamar), 502
export async function brapiSerie(simbolo, { range = '2y', token = process.env.BRAPI_TOKEN, tempoMs = 15000 } = {}) {
  const { raiz, suf } = partes(simbolo);
  if (suf !== '.SA' && !simbolo.startsWith('^')) throw erro(404, 'brapi: só B3');
  const [rg, iv] = BRAPI_RANGE[range] || BRAPI_RANGE['2y'];
  const u = new URL(base('INV_BRAPI_BASE', 'https://brapi.dev') + '/api/quote/' + encodeURIComponent(raiz));
  u.searchParams.set('range', rg); u.searchParams.set('interval', iv);
  if (token) u.searchParams.set('token', token);
  let r, j;
  try { r = await pega(u, tempoMs, 'application/json'); j = await r.json().catch(() => null); } catch (e) { throw erro(502, 'brapi: rede (' + (e.name || e.message) + ')'); }
  const msg = (j && j.message) ? String(j.message).slice(0, 120) : 'HTTP ' + r.status;
  if (r.status === 404) throw erro(404, 'brapi: não encontrado');
  if (r.status === 401 || r.status === 402 || r.status === 403) throw erro(r.status, 'brapi: ' + msg, { semToken: true });
  if (r.status === 429) throw erro(429, 'brapi: limite', { limite: true });
  const res = j && Array.isArray(j.results) && j.results[0];
  if (!r.ok || !res) throw erro(502, 'brapi: ' + msg);
  const hist = Array.isArray(res.historicalDataPrice) ? res.historicalDataPrice : [];
  const pontos = limpa(hist.map(x => [typeof x.date === 'number' ? dataNoFuso(x.date, 'America/Sao_Paulo') : String(x.date || '').slice(0, 10), Number(x.close)]));
  if (!pontos.length) throw erro(502, 'brapi: sem histórico');
  return { pontos, nome: String(res.longName || res.shortName || '').replace(/\s+/g, ' ').trim() || null, moeda: res.currency || 'BRL', alcance: rg };
}

// ---------- Twelve Data ----------
const TD_BOLSA = { '.SA': 'BOVESPA', '.L': 'LSE', '.PA': 'Euronext', '.DE': 'XETR', '.AS': 'Euronext', '.SW': 'SIX', '.CO': 'OMXC', '.HK': 'HKEX', '.SS': 'SSE', '.SZ': 'SZSE', '.T': 'JPX', '.NS': 'NSE', '.KS': 'KRX', '.TO': 'TSX', '.AX': 'ASX', '.TW': 'TWSE', '.SR': 'Tadawul' };
const TD_IV = { '6mo': ['1day', 130], '1y': ['1day', 260], '2y': ['1day', 520], '5y': ['1week', 262], 'max': ['1month', 5000] };
// erros: 404 (não tem), semToken:true, limite:true (por minuto ou por dia), 502
export async function twelveSerie(simbolo, { range = '2y', chave = process.env.TWELVE_DATA_KEY, tempoMs = 20000 } = {}) {
  if (!chave) throw erro(401, 'Twelve Data: sem chave', { semToken: true });
  const { raiz, suf } = partes(simbolo);
  if (suf && !TD_BOLSA[suf]) throw erro(404, 'Twelve Data: bolsa sem par');
  const [iv, n] = TD_IV[range] || TD_IV['2y'];
  const u = new URL(base('INV_TD_BASE', 'https://api.twelvedata.com') + '/time_series');
  u.searchParams.set('symbol', raiz.replace('-', '.')); if (suf) u.searchParams.set('exchange', TD_BOLSA[suf]);
  u.searchParams.set('interval', iv); u.searchParams.set('outputsize', String(n)); u.searchParams.set('apikey', chave);
  let r, j;
  try { r = await pega(u, tempoMs, 'application/json'); j = await r.json().catch(() => null); } catch (e) { throw erro(502, 'Twelve Data: rede (' + (e.name || e.message) + ')'); }
  if (!j) throw erro(502, 'Twelve Data: HTTP ' + r.status);
  if (j.status !== 'ok' || !Array.isArray(j.values)) {
    const c = Number(j.code) || r.status, m = String(j.message || '').slice(0, 120);
    if (c === 429) throw erro(429, 'Twelve Data: limite (' + m + ')', { limite: /day|daily|dia/i.test(m), porMinuto: !/day|daily/i.test(m) });
    // símbolo fora do plano grátis (bolsas fora dos EUA, em geral): não é falha da fonte, só desse símbolo
    if (/plan|upgrade|grow|venture|enterprise|available starting/i.test(m)) throw erro(404, 'Twelve Data: fora do plano (' + m.slice(0, 60) + ')');
    if (c === 401 || c === 403) throw erro(c, 'Twelve Data: ' + m, { semToken: true });
    if (c === 400 || c === 404) throw erro(404, 'Twelve Data: ' + (m || 'não encontrado'));
    throw erro(502, 'Twelve Data: ' + (m || c));
  }
  const pontos = limpa(j.values.map(v => [String(v.datetime).slice(0, 10), Number(v.close)]));
  if (!pontos.length) throw erro(502, 'Twelve Data: sem pontos');
  return { pontos, moeda: (j.meta && j.meta.currency) || null };
}

// ---------- cadeia ----------
// estado das fontes numa rodada: 3 falhas seguidas (ou limite, ou falta de token) = fonte fora até o fim da rodada
export function novoEstado() { return { stooq: { seguidas: 0, fora: null, ok: 0 }, brapi: { seguidas: 0, fora: null, ok: 0 }, twelve: { seguidas: 0, fora: null, ok: 0 } }; }
export const NOMES = { stooq: 'stooq', brapi: 'brapi.dev', twelve: 'Twelve Data' };
function anota(est, f, e) {
  const s = est[f];
  if (!e) { s.seguidas = 0; s.ok++; return; }
  if (e.status === 404) return; // não ter o símbolo não é falha da fonte
  if (e.limite || e.semToken) { s.fora = e.message; return; }
  if (++s.seguidas >= 3) s.fora = '3 falhas seguidas (' + e.message + ')';
}

// tenta cada fonte em ordem; devolve { pontos, fonte, simbolo_fonte, nome?, moeda } ou lança o melhor erro (404 se ninguém tem)
export async function cotacaoEmCadeia(simbolo, { range = '2y', stooq, estado = novoEstado(), pausa = async () => {}, esperaMinuto = null, log = () => {}, fontes = ['stooq', 'brapi', 'twelve'], hoje } = {}) {
  const { suf } = partes(simbolo);
  const moedaSuf = (BOLSAS[suf] || [null])[0];
  const motivos = [];
  let todos404 = true;
  for (const f of fontes) {
    if (estado[f].fora) { motivos.push(NOMES[f] + ' fora'); todos404 = false; continue; }
    if (f === 'brapi' && suf !== '.SA') continue;
    if (f === 'twelve' && !process.env.TWELVE_DATA_KEY) continue;
    const cands = f === 'stooq' ? stooqCandidatos(simbolo, stooq) : [simbolo];
    for (const c of cands) {
      if (estado[f].fora) break;
      await pausa(f);
      try {
        let out;
        if (f === 'stooq') out = { pontos: await stooqSerie(c, { range, hoje }), moeda: moedaSuf };
        else if (f === 'brapi') out = await brapiSerie(simbolo, { range });
        else {
          try { out = await twelveSerie(simbolo, { range }); }
          catch (e) { if (!e.porMinuto || !esperaMinuto) throw e; log(`${simbolo}: Twelve Data pediu para esperar um minuto`); await esperaMinuto(); out = await twelveSerie(simbolo, { range }); }
        }
        anota(estado, f, null);
        return { ...out, moeda: out.moeda || moedaSuf, fonte: f, simbolo_fonte: f === 'stooq' ? c : simbolo };
      } catch (e) {
        anota(estado, f, e);
        if (e.status !== 404) todos404 = false;
        motivos.push(e.message);
        log(`${simbolo}: ${e.message}${estado[f].fora ? ' → ' + NOMES[f] + ' fora nesta rodada' : ''}`);
      }
    }
  }
  if (todos404 && motivos.length) throw erro(404, 'Símbolo não encontrado', { motivo: motivos.join('; ') });
  throw erro(502, 'A fonte de cotações não respondeu.', { motivo: motivos.join('; ') || 'nenhuma fonte disponível' });
}

// ---------- índice de busca (inv/busca.json) ----------
export const normaliza = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.^ -]+/g, ' ').replace(/\s+/g, ' ').trim();
// indice.itens = [[simbolo, nome]] (o grupo sai do sufixo; um 3º campo, se houver, vence); devolve até 12 em { simbolo, nome, bolsa_nome, grupo }, Brasil primeiro
export function buscaNoIndice(indice, q, limite = 12) {
  const n = normaliza(q);
  if (!n || !indice || !Array.isArray(indice.itens)) return [];
  const ordem = { br: 0, eua: 1, outro: 2 };
  const achados = [];
  indice.itens.forEach((x, i) => {
    if (!Array.isArray(x) || typeof x[0] !== 'string') return;
    const sim = x[0].toLowerCase(), raiz = sim.replace(/\.[a-z]+$/, ''), nome = normaliza(x[1]);
    let p = null;
    if (sim === n || raiz === n) p = 0;
    else if (sim.startsWith(n) || raiz.startsWith(n)) p = 1;
    else if ((' ' + nome).includes(' ' + n)) p = 2;
    else if (n.length >= 3 && nome.includes(n)) p = 3;
    if (p != null) { const g = x[2] || grupoDe(x[0]); achados.push([p, ordem[g] ?? 2, i, x, g]); }
  });
  achados.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return achados.slice(0, limite).map(([, , , x, g]) => ({ simbolo: x[0], nome: x[1] || x[0], bolsa_nome: (BOLSAS[partes(x[0]).suf] || [])[1] || '', grupo: g }));
}

// ---------- contas ----------
const r2 = v => Math.round(v * 100) / 100;
const r4 = v => Math.round(v * 1e4) / 1e4;
export const preco = v => (Math.abs(v) > 1 ? r2(v) : r4(v));
export const sig4 = v => Number(Number(v).toPrecision(4));

// média simples, atual (último fechamento) e quanto o atual está acima ou abaixo da média
export function estatisticas(pontos) {
  const vs = (pontos || []).filter(p => typeof p[1] === 'number' && isFinite(p[1]));
  if (!vs.length) return null;
  let soma = 0, mn = Infinity, mx = -Infinity;
  for (const [, v] of vs) { soma += v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const media = soma / vs.length;
  const [data_atual, atual] = vs[vs.length - 1];
  return { atual: preco(atual), data_atual, media: preco(media), dif_pct: Math.round((atual / media - 1) * 1000) / 10, min: preco(mn), max: preco(mx), n: vs.length };
}

function semanaIso(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dia + 3); // quinta da mesma semana
  const ano = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  return ano + '-' + (1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7));
}
// último fechamento de cada semana ISO
export function semanal(pontos) {
  const out = []; let ult = null;
  for (const [d, v] of pontos || []) {
    if (typeof v !== 'number') continue;
    const k = semanaIso(d);
    if (k === ult) out[out.length - 1] = [d, sig4(v)]; else { out.push([d, sig4(v)]); ult = k; }
  }
  return out;
}

// séries [[data, valor]] → indexadas a 100 a partir da 1ª data em que todas têm dado
export function indexa100(series) {
  const cheias = series.filter(s => s && s.length);
  if (!cheias.length) return { inicio: null, series: series.map(() => []) };
  const inicio = cheias.map(s => s[0][0]).sort().pop();
  return {
    inicio,
    series: series.map(s => {
      if (!s || !s.length) return [];
      const r = s.filter(p => p[0] >= inicio);
      if (!r.length) return [];
      const v0 = r[0][1];
      return r.map(([d, v]) => [d, Math.round(v / v0 * 1e4) / 100]);
    })
  };
}
