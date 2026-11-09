// Inv: busca de ações por nome ou código (GET /api/inv-busca?q=petro). Brasil primeiro, EUA depois, outras bolsas no fim.
import { yahooBusca } from './_inv-yahoo.mjs';
import { conta } from './inv-cotacao.mjs';

const POR_HORA = 120;
const pedidos = new Map();
function erro(res, st, msg) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(st).json({ erro: msg });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return erro(res, 405, 'Use GET.'); }
  const bruto = (req.query || {}).q;
  const q = String(Array.isArray(bruto) ? bruto[0] : bruto ?? '').trim();
  if (!q || q.length > 40 || /[\u0000-\u001f\u007f]/.test(q)) return erro(res, 400, 'Digite ao menos 1 caractere (e até 40).');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sem-ip';
  if (conta(pedidos, ip, true) > POR_HORA) return erro(res, 429, 'Muitas buscas nesta hora. Espere um pouco.');
  try {
    const itens = await yahooBusca(q);
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ q, itens, fonte: 'Yahoo Finance (não oficial)' });
  } catch (e) {
    console.error('inv-busca', e.status || 500, e.motivo || '');
    return erro(res, 502, 'A busca não respondeu. Tente de novo.');
  }
}
