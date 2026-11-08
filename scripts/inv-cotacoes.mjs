// Inv · robô das cotações: inv/empresas.json → Yahoo Finance (2 anos, diário) → inv/cotacoes.json.
// Por empresa: atual, média dos 2 anos, diferença em %, mínimo, máximo, variação em 1 ano e o fechamento de cada semana.
// Falhou hoje: fica o número de ontem, com "erro". Mais da metade falhou (o Yahoo bloqueou): não grava nada e sai com erro.
// Node 20, sem dependências. Teste: node scripts/inv-cotacoes.teste.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { yahooChart, estatisticas, semanal } from '../api/_inv-yahoo.mjs';

const dorme = ms => new Promise(r => setTimeout(r, ms));
const PAUSA = () => Number(process.env.INV_PAUSA_MS ?? 500);
const ESPERAS = () => (process.env.INV_ESPERAS_MS || '2000,6000,15000').split(',').map(Number);

// fechamento mais próximo de 365 dias antes do último
export function var1a(pontos) {
  if (!pontos.length) return null;
  const [du, vu] = pontos[pontos.length - 1];
  const alvo = Date.parse(du) - 365 * 864e5;
  let melhor = null, dist = Infinity;
  for (const [d, v] of pontos) { const x = Math.abs(Date.parse(d) - alvo); if (x < dist) { dist = x; melhor = v; } }
  if (!melhor || dist > 15 * 864e5) return null;
  return Math.round((vu / melhor - 1) * 1000) / 10;
}

export async function cotaUm(simbolo, { log = () => {} } = {}) {
  const esperas = ESPERAS();
  let ult;
  for (let t = 0; t <= esperas.length; t++) {
    try {
      const { meta, pontos } = await yahooChart(simbolo, { range: '2y', interval: '1d' });
      const e = estatisticas(pontos);
      if (!e) throw Object.assign(new Error('sem pontos'), { status: 502 });
      return {
        nome: meta.nome, moeda: meta.moeda, bolsa: meta.bolsa, bolsa_nome: meta.bolsa_nome,
        atual: e.atual, data_atual: e.data_atual, media_2a: e.media, dif_pct: e.dif_pct, min_2a: e.min, max_2a: e.max, n: e.n,
        var_1a_pct: var1a(pontos), semanal: semanal(pontos)
      };
    } catch (e) {
      ult = e;
      if (e.status === 404 || e.status === 400) throw e; // símbolo errado: não adianta tentar de novo
      if (t < esperas.length) { log(`${simbolo}: ${e.motivo || e.message}, nova tentativa`); await dorme(esperas[t]); }
    }
  }
  ult.tentativas = esperas.length + 1;
  throw ult;
}


// plano B (opcional): Twelve Data, só com o segredo TWELVE_DATA_KEY e só para quem falhou por bloqueio (não 404).
// Plano grátis: 8 pedidos por minuto, por isso a pausa de 8 s. Sem a chave, não faz nada.
const TD_BOLSA = { '.SA': 'BVMF', '.L': 'LSE', '.PA': 'Euronext', '.DE': 'XETR', '.AS': 'Euronext', '.SW': 'SIX', '.CO': 'OMXC', '.HK': 'HKEX', '.SS': 'XSHG', '.SZ': 'XSHE', '.T': 'JPX', '.NS': 'NSE', '.KS': 'KRX', '.TO': 'TSX', '.AX': 'ASX', '.TW': 'TWSE', '.SR': 'Tadawul' };
export async function twelveData(simbolo, chave) {
  const m = simbolo.match(/^(.+?)(\.[A-Z]+)?$/); const base = m[1], suf = m[2] || '';
  if (suf && !TD_BOLSA[suf]) throw new Error('bolsa sem par no Twelve Data');
  const u = new URL('https://api.twelvedata.com/time_series');
  u.searchParams.set('symbol', base.replace('-', '.')); if (suf) u.searchParams.set('exchange', TD_BOLSA[suf]);
  u.searchParams.set('interval', '1day'); u.searchParams.set('outputsize', '520'); u.searchParams.set('apikey', chave);
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  if (j.status !== 'ok' || !Array.isArray(j.values)) throw new Error('Twelve Data: ' + (j.message || r.status));
  const pontos = j.values.map(v => [v.datetime.slice(0, 10), Number(v.close)]).filter(p => isFinite(p[1])).reverse();
  const e = estatisticas(pontos); if (!e) throw new Error('Twelve Data: sem pontos');
  return { nome: simbolo, moeda: (j.meta && j.meta.currency) || null, bolsa: (j.meta && j.meta.exchange) || null, bolsa_nome: (j.meta && j.meta.exchange) || null,
    atual: e.atual, data_atual: e.data_atual, media_2a: e.media, dif_pct: e.dif_pct, min_2a: e.min, max_2a: e.max, n: e.n, var_1a_pct: var1a(pontos), semanal: semanal(pontos), fonte: 'Twelve Data' };
}

// um item por linha, para o diff diário ser legível
export function formatoItens(obj) {
  const { itens, ...cab } = obj;
  const linhas = Object.keys(itens).map(k => JSON.stringify(k) + ':' + JSON.stringify(itens[k]));
  const c = JSON.stringify(cab).slice(0, -1);
  return c + ',"itens":{\n' + linhas.join(',\n') + '\n}}\n';
}
const semData = o => JSON.stringify({ ...o, gerado_em: null });

export async function main({ raiz = process.cwd(), hoje, log = console.log } = {}) {
  hoje = hoje || process.env.INV_HOJE || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const emp = JSON.parse(await readFile(join(raiz, 'inv/empresas.json'), 'utf8'));
  let antes = { itens: {} };
  try { antes = JSON.parse(await readFile(join(raiz, 'inv/cotacoes.json'), 'utf8')); } catch { }
  const simbolos = [...new Set(emp.mercados.flatMap(m => m.empresas.map(e => e.simbolo)))];
  const itens = {}; const cont = { ok: 0, sem: [], nao: [] };
  for (let i = 0; i < simbolos.length; i++) {
    const s = simbolos[i];
    if (i) await dorme(PAUSA() + Math.random() * PAUSA() * .6);
    try {
      itens[s] = { ...(await cotaUm(s, { log })), atualizado_em: hoje, erro: null };
      cont.ok++;
    } catch (e) {
      const nao = e.status === 404;
      const motivo = nao ? 'Símbolo não encontrado' : `${e.motivo || e.message}${e.tentativas ? ' em ' + e.tentativas + ' tentativas' : ''}`;
      const ant = antes.itens && antes.itens[s];
      itens[s] = ant && ant.atual != null ? { ...ant, erro: motivo } : { erro: motivo, atualizado_em: hoje };
      (nao ? cont.nao : cont.sem).push(`${s}: ${motivo}`);
    }
  }
  const CHAVE = process.env.TWELVE_DATA_KEY;
  if (CHAVE && cont.sem.length) {
    for (const linha of [...cont.sem]) {
      const s = linha.split(':')[0];
      try {
        await dorme(8000);
        itens[s] = { ...(await twelveData(s, CHAVE)), atualizado_em: hoje, erro: null };
        cont.sem.splice(cont.sem.indexOf(linha), 1); cont.ok++;
      } catch (e) { log(`${s}: plano B falhou (${e.message})`); }
    }
  }
  const resumo = `${simbolos.length} símbolos: ${cont.ok} ok, ${cont.sem.length} sem dados${cont.sem.length ? ' (' + cont.sem.join('; ') + ')' : ''}, ${cont.nao.length} não encontrado${cont.nao.length === 1 ? '' : 's'}${cont.nao.length ? ' (' + cont.nao.join('; ') + ')' : ''}`;
  log(resumo);
  const falhou = cont.sem.length + cont.nao.length;
  if (falhou > simbolos.length / 2) {
    log('Mais da metade falhou (a fonte deve ter bloqueado): nada gravado; a página segue com o arquivo anterior.');
    return { gravou: false, bloqueado: true, cont };
  }
  const novo = { versao: 1, gerado_em: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), fonte: 'Yahoo Finance (não oficial); preços de fechamento não ajustados', janela: '2 anos (≈ 500 pregões)', itens };
  const gravou = semData(novo) !== semData({ ...antes, itens: antes.itens || {} }) || !antes.versao;
  if (gravou) await writeFile(join(raiz, 'inv/cotacoes.json'), formatoItens(novo));
  log(gravou ? 'cotacoes.json gravado.' : 'cotacoes.json sem mudanças.');
  return { gravou, bloqueado: false, cont };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = await main();
  if (r.bloqueado) process.exit(1);
}
