// Inv: módulo compartilhado pelas funções (api/inv-*.mjs) e pelos robôs (scripts/inv-*.mjs).
// O "_" no nome faz a Vercel não publicar este arquivo como função.
// Fonte: Yahoo Finance, API de gráfico v8 e busca v1 (não oficial, sem chave). Se o formato mudar, a correção fica toda aqui.
// INV_YAHOO_BASE aponta para um servidor falso nos testes.

export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
export const RANGES = { '6mo': '1d', '1y': '1d', '2y': '1d', '5y': '1wk', 'max': '1mo' };
const EUA = new Set(['NMS', 'NYQ', 'NGM', 'NCM', 'ASE', 'PCX', 'BTS', 'NAS', 'NYS', 'NIM', 'NSQ']);
const TIPOS = new Set(['EQUITY', 'ETF', 'INDEX']);

function hosts(base) {
  const b = base || process.env.INV_YAHOO_BASE;
  return b ? [b.replace(/\/$/, '')] : HOSTS;
}
function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

// símbolo normalizado (maiúsculas, sem espaços) ou null
export function simboloOk(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toUpperCase();
  return /^[A-Z0-9^][A-Z0-9.\-=^]{0,14}$/.test(t) ? t : null;
}

// data ISO (AAAA-MM-DD) de um instante no fuso da bolsa
export function dataNoFuso(seg, fuso) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seg * 1000));
  } catch { return new Date(seg * 1000).toISOString().slice(0, 10); }
}

async function pega(url, tempoMs) {
  return fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(tempoMs) });
}

export async function yahooChart(simbolo, { range = '2y', interval, base, tempoMs = 8000 } = {}) {
  const s = simboloOk(simbolo);
  if (!s) throw erro(400, 'Símbolo inválido.');
  const iv = interval || RANGES[range] || '1d';
  let ultimo = 'sem resposta';
  for (const h of hosts(base)) {
    let r;
    try {
      r = await pega(`${h}/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${iv}&includePrePost=false&events=div%2Csplit`, tempoMs);
    } catch (e) { ultimo = 'rede: ' + (e.name || e.message); continue; }
    if (r.status === 404) throw erro(404, 'Símbolo não encontrado.');
    if (r.status === 429 || r.status >= 500) { ultimo = String(r.status); continue; }
    let j;
    try { j = await r.json(); } catch { ultimo = 'resposta não é JSON'; continue; }
    const c = j && j.chart;
    if (c && c.error) throw erro(404, 'Símbolo não encontrado.');
    const res = c && Array.isArray(c.result) && c.result[0];
    if (!r.ok || !res) { ultimo = r.ok ? 'sem resultado' : String(r.status); continue; }
    const m = res.meta || {};
    const fuso = m.exchangeTimezoneName || 'UTC';
    const ts = res.timestamp || [];
    const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const cl = q.close || [];
    const pontos = [];
    for (let i = 0; i < ts.length; i++) {
      const v = cl[i];
      if (typeof v === 'number' && isFinite(v)) pontos.push([dataNoFuso(ts[i], fuso), v]);
    }
    // a mesma data duas vezes (o último pregão às vezes repete): fica a última
    const limpos = [];
    for (const p of pontos) { if (limpos.length && limpos[limpos.length - 1][0] === p[0]) limpos[limpos.length - 1] = p; else limpos.push(p); }
    const nome = String(m.longName || m.shortName || s).replace(/\s+/g, ' ').trim();
    return {
      meta: {
        simbolo: m.symbol || s, nome, moeda: m.currency || null, bolsa: m.exchangeName || null, bolsa_nome: m.fullExchangeName || null,
        tipo: m.instrumentType || null, fuso,
        atual: typeof m.regularMarketPrice === 'number' ? m.regularMarketPrice : null,
        data_atual: m.regularMarketTime ? dataNoFuso(m.regularMarketTime, fuso) : null
      },
      pontos: limpos
    };
  }
  const e = erro(502, 'A fonte de cotações não respondeu.'); e.motivo = ultimo; throw e;
}

export function grupoDe(bolsa) { return bolsa === 'SAO' ? 'br' : EUA.has(bolsa) ? 'eua' : 'outro'; }

export async function yahooBusca(q, { base, tempoMs = 8000 } = {}) {
  let ultimo = 'sem resposta';
  for (const h of hosts(base)) {
    let r;
    try {
      r = await pega(`${h}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0&enableFuzzyQuery=false&lang=pt-BR&region=BR`, tempoMs);
    } catch (e) { ultimo = 'rede'; continue; }
    if (r.status === 429 || r.status >= 500 || !r.ok) { ultimo = String(r.status); continue; }
    let j; try { j = await r.json(); } catch { ultimo = 'não é JSON'; continue; }
    const ordem = { br: 0, eua: 1, outro: 2 };
    const itens = (Array.isArray(j.quotes) ? j.quotes : [])
      .filter(x => x && TIPOS.has(x.quoteType) && simboloOk(x.symbol))
      .map(x => ({
        simbolo: simboloOk(x.symbol), nome: String(x.longname || x.shortname || x.symbol).replace(/\s+/g, ' ').trim(),
        curto: String(x.shortname || '').replace(/\s+/g, ' ').trim(), bolsa: x.exchange || '', bolsa_nome: x.exchDisp || x.exchange || '',
        tipo: x.quoteType, grupo: grupoDe(x.exchange)
      }))
      .map((x, i) => [x, i]).sort((a, b) => ordem[a[0].grupo] - ordem[b[0].grupo] || a[1] - b[1]).map(a => a[0])
      .slice(0, 12);
    return itens;
  }
  const e = erro(502, 'A fonte de cotações não respondeu.'); e.motivo = ultimo; throw e;
}

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
