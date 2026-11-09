// Inv: cotação de qualquer ação (GET /api/inv-cotacao?s=PETR4.SA&range=2y), para a busca e o detalhe.
// Fontes em cadeia (módulo _inv-fontes.mjs): stooq → brapi.dev (B3; BRAPI_TOKEN opcional) → Twelve Data (TWELVE_DATA_KEY opcional).
// Uma fonte que bate no limite, pede token ou falha 3 vezes seguidas fica de fora por 15 min nesta instância.
// A CDN da Vercel guarda a resposta por 30 min (por endereço), por isso o símbolo é normalizado.
import { readFile } from 'node:fs/promises';
import { cotacaoEmCadeia, estatisticas, simboloOk, novoEstado, partes, BOLSAS, NOMES, RANGES } from './_inv-fontes.mjs';

const POR_HORA = 120;
const pedidos = new Map();
export function conta(mapa, ip, soma) {
  const agora = Date.now();
  const lista = (mapa.get(ip) || []).filter(t => agora - t < 3600e3);
  if (soma) lista.push(agora);
  mapa.set(ip, lista);
  if (mapa.size > 5000) for (const [k, v] of mapa) if (!v.length || agora - v[v.length - 1] > 3600e3) mapa.delete(k);
  return lista.length;
}
function erro(res, st, msg) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(st).json({ erro: msg });
}

// estado das fontes nesta instância: quem saiu volta depois de 15 min
let ESTADO = novoEstado(); let DESDE = Date.now();
export function zeraFontes() { ESTADO = novoEstado(); DESDE = Date.now(); }
function estado() {
  if (Date.now() - DESDE > 15 * 60e3) zeraFontes();
  return ESTADO;
}
// nomes e símbolos do stooq das listas (inv/empresas.json), lidos uma vez
let EMP = null;
async function empresas() {
  if (EMP) return EMP;
  EMP = {};
  try {
    const j = JSON.parse(await readFile(new URL('../inv/empresas.json', import.meta.url), 'utf8'));
    for (const m of j.mercados || []) for (const e of m.empresas || []) EMP[e.simbolo] = e;
  } catch { }
  return EMP;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return erro(res, 405, 'Use GET.'); }
  const q = req.query || {};
  const s = simboloOk(Array.isArray(q.s) ? q.s[0] : q.s);
  if (!s) return erro(res, 400, 'Símbolo inválido.');
  const range = q.range == null || q.range === '' ? '2y' : String(q.range);
  if (!Object.prototype.hasOwnProperty.call(RANGES, range)) return erro(res, 400, 'Intervalo inválido.');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sem-ip';
  if (conta(pedidos, ip, true) > POR_HORA) return erro(res, 429, 'Muitas consultas nesta hora. Tente daqui a pouco.');
  try {
    const e0 = (await empresas())[s] || {};
    const r = await cotacaoEmCadeia(s, { range, stooq: e0.stooq, estado: estado() });
    const e = estatisticas(r.pontos);
    if (!e) return erro(res, 404, 'Símbolo não encontrado.');
    const [, bolsa] = BOLSAS[partes(s).suf] || [null, null];
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({
      simbolo: s, nome: e0.nome || r.nome || s, moeda: r.moeda, bolsa, bolsa_nome: bolsa, tipo: null,
      range, intervalo: RANGES[range], atual: e.atual, data_atual: e.data_atual, media: e.media, dif_pct: e.dif_pct, min: e.min, max: e.max, n: e.n,
      serie: r.pontos.map(([d, v]) => [d, Math.abs(v) > 1 ? Math.round(v * 100) / 100 : Math.round(v * 1e4) / 1e4]),
      fonte: NOMES[r.fonte], obtido_em: new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    });
  } catch (e) {
    if (e.status !== 404) console.error('inv-cotacao', e.status || 500, s, e.motivo || e.message);
    if (e.status === 404) return erro(res, 404, 'Símbolo não encontrado.');
    if (e.status === 400) return erro(res, 400, 'Símbolo inválido.');
    return erro(res, 502, 'A fonte de cotações não respondeu.');
  }
}
