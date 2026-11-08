// Inv: cotação de qualquer ação (GET /api/inv-cotacao?s=PETR4.SA&range=2y), para a busca e o detalhe.
// Sem chave: Yahoo Finance pelo módulo _inv-yahoo.mjs. A CDN da Vercel guarda a resposta por 30 min (por endereço),
// por isso o símbolo é normalizado: todo mundo que abrir a mesma ação no mesmo período pega o mesmo cache.
import { yahooChart, estatisticas, simboloOk, RANGES } from './_inv-yahoo.mjs';

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
    const { meta, pontos } = await yahooChart(s, { range });
    const e = estatisticas(pontos);
    if (!e) return erro(res, 404, 'Símbolo não encontrado.');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({
      simbolo: meta.simbolo || s, nome: meta.nome, moeda: meta.moeda, bolsa: meta.bolsa, bolsa_nome: meta.bolsa_nome, tipo: meta.tipo,
      range, intervalo: RANGES[range], atual: e.atual, data_atual: e.data_atual, media: e.media, dif_pct: e.dif_pct, min: e.min, max: e.max, n: e.n,
      serie: pontos.map(([d, v]) => [d, Math.abs(v) > 1 ? Math.round(v * 100) / 100 : Math.round(v * 1e4) / 1e4]),
      fonte: 'Yahoo Finance (não oficial)', obtido_em: new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    });
  } catch (e) {
    if (e.status !== 404) console.error('inv-cotacao', e.status || 500, s, e.motivo || '');
    if (e.status === 404) return erro(res, 404, 'Símbolo não encontrado.');
    if (e.status === 400) return erro(res, 400, 'Símbolo inválido.');
    return erro(res, 502, 'A fonte de cotações não respondeu.');
  }
}
