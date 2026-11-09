// Inv · robô dos indicadores: IPCA, Selic, CDI, IGP-M, poupança e dólar (SGS do Banco Central), metas (CMN e Copom),
// projeções do Focus (API Olinda do BC) e Ibovespa e S&P 500 (Yahoo) → inv/macro.json.
// Node 20, sem dependências. Só regrava o arquivo quando algo além de gerado_em/hoje mudou.
// Testes: node scripts/inv-macro.teste.mjs (servidor falso por INV_BCB_BASE, INV_OLINDA_BASE e INV_YAHOO_BASE).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { yahooChart } from '../api/_inv-yahoo.mjs';

const BCB = () => process.env.INV_BCB_BASE || 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.';
const OLINDA = () => process.env.INV_OLINDA_BASE || 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/';
const ESPERA = () => Number(process.env.INV_ESPERA_MS ?? 1500);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dorme = ms => new Promise(r => setTimeout(r, ms));
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;

async function pegaJson(url, { tentativas = 3, tempoMs = 20000 } = {}) {
  let ult;
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'inv-madeinbr/1.0', accept: 'application/json' }, signal: AbortSignal.timeout(tempoMs) });
      if (r.ok) {
        const j = await r.json();
        if (j && !Array.isArray(j) && j.error) throw Object.assign(new Error(String(j.error)), { final: true });
        return j;
      }
      ult = new Error('HTTP ' + r.status);
      if (r.status !== 429 && r.status < 500) { ult.final = true; throw ult; }
    } catch (e) { ult = e; if (e.final) throw e; }
    if (t < tentativas) await dorme(ESPERA() * t);
  }
  throw ult;
}

// ---------- SGS ----------
export async function sgs(serie, { ini, fim } = {}) {
  let url = `${BCB()}${serie}/dados?formato=json`;
  if (ini) url += `&dataInicial=${ini}`;
  if (fim) url += `&dataFinal=${fim}`;
  const j = await pegaJson(url);
  if (!Array.isArray(j)) throw new Error('série ' + serie + ': resposta inesperada');
  return j.map(x => ({ data: x.data, valor: Number(x.valor) })).filter(x => /^\d\d\/\d\d\/\d{4}$/.test(x.data) && isFinite(x.valor));
}
const anoDe = d => Number(d.slice(6, 10));
const mesDe = d => Number(d.slice(3, 5));

// tira o registro do mês corrente (na 4390/4391 é o acumulado parcial do mês)
export function anosFechados(lista, hoje) {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
  return lista.filter(x => anoDe(x.data) < a || (anoDe(x.data) === a && mesDe(x.data) < m));
}
export function mensalPorAno(lista) {
  const o = {};
  for (const x of lista) (o[anoDe(x.data)] ||= []).push({ mes: mesDe(x.data), valor: x.valor });
  return o;
}
export function compoeAno(mensais) {
  let f = 1;
  for (const m of mensais) f *= 1 + m / 100;
  return r2((f - 1) * 100);
}
export function tolerancia(ano) {
  if (ano < 1999) return null;
  if (ano <= 2002) return 2;
  if (ano <= 2005) return 2.5;
  if (ano <= 2016) return 2;
  return 1.5;
}
const rotuloParcial = meses => meses.length === 1 ? MESES[meses[0] - 1] : `${MESES[meses[0] - 1]}–${MESES[meses[meses.length - 1] - 1]}`;

// acumulado no ano: anos completos e o ano incompleto (marcado em "parcial")
export function acumulado(lista, hoje, desde = 1995) {
  const por = mensalPorAno(anosFechados(lista, hoje));
  const realizado = {}, parcial = {};
  for (const [a, ms] of Object.entries(por)) {
    if (Number(a) < desde) continue;
    ms.sort((x, y) => x.mes - y.mes);
    realizado[a] = compoeAno(ms.map(x => x.valor));
    if (ms.length < 12) parcial[a] = rotuloParcial(ms.map(x => x.mes));
  }
  return { realizado, parcial };
}
// nível no fim do ano e variação sobre o ano anterior (dólar)
export function nivelAnual(lista, hoje, desde = 1995) {
  const por = mensalPorAno(anosFechados(lista, hoje));
  const nivel = {}, realizado = {}, parcial = {};
  for (const [a, ms] of Object.entries(por)) {
    ms.sort((x, y) => x.mes - y.mes);
    const ult = ms[ms.length - 1];
    nivel[a] = ult.valor;
    if (ult.mes < 12) parcial[a] = 'até ' + MESES[ult.mes - 1];
  }
  for (const a of Object.keys(nivel)) if (nivel[a - 1]) realizado[a] = r1((nivel[a] / nivel[a - 1] - 1) * 100);
  return { nivel: soDesde(nivel, desde), realizado: soDesde(realizado, desde), parcial: soDesde(parcial, desde) };
}
const soDesde = (o, d) => Object.fromEntries(Object.entries(o).filter(([a]) => Number(a) >= d));

export async function metaInflacao() {
  const l = await sgs(13521);
  const meta = {}, tol = {};
  for (const x of l) { const a = anoDe(x.data); meta[a] = x.valor; tol[a] = tolerancia(a); }
  return { meta, tol };
}
// meta Selic em 31/12 de cada ano (série diária; a API só aceita janelas de 10 anos); ano corrente = valor em "hoje"
export async function metaSelicFimDeAno(hoje) {
  const janelas = [['01/01/1999', '31/12/2008'], ['01/01/2009', '31/12/2018'], ['01/01/2019', null]];
  const meta = {};
  const hojeBr = hoje.slice(8, 10) + '/' + hoje.slice(5, 7) + '/' + hoje.slice(0, 4);
  const chave = d => d.slice(6, 10) + d.slice(3, 5) + d.slice(0, 2);
  const lim = chave(hojeBr);
  const anoHoje = Number(hoje.slice(0, 4));
  let ultimo = null;
  for (const [ini, fim] of janelas) {
    const l = await sgs(432, { ini, fim });
    for (const x of l) {
      if (chave(x.data) > lim) continue;
      if (x.data.startsWith('31/12/')) meta[anoDe(x.data)] = x.valor;
      if (!ultimo || chave(x.data) > chave(ultimo.data)) ultimo = x;
    }
  }
  if (ultimo && anoDe(ultimo.data) === anoHoje) meta[anoHoje] = ultimo.valor;
  return meta;
}

// ---------- Focus ----------
export async function focus(indicador, hoje) {
  const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 45);
  const desde = d.toISOString().slice(0, 10);
  const filtro = encodeURIComponent(`Indicador eq '${indicador}' and Data ge '${desde}'`);
  const url = `${OLINDA()}ExpectativasMercadoAnuais?$format=json&$top=400&$orderby=Data%20desc&$filter=${filtro}`;
  const j = await pegaJson(url);
  const v = (j && Array.isArray(j.value) ? j.value : []).filter(x => x && x.Indicador === indicador && typeof x.Mediana === 'number');
  if (!v.length) throw new Error('Focus ' + indicador + ': vazio');
  const bases = v.map(x => Number(x.baseCalculo)).filter(isFinite);
  const base = bases.includes(0) ? 0 : Math.min(...bases);
  const daBase = v.filter(x => Number(x.baseCalculo) === base);
  const data = daBase.map(x => x.Data).sort().pop();
  const ano = Number(hoje.slice(0, 4));
  const projecao = {};
  for (const x of daBase) {
    const r = Number(x.DataReferencia);
    if (x.Data === data && r >= ano && r <= ano + 3) projecao[r] = r2(x.Mediana);
  }
  if (!Object.keys(projecao).length) throw new Error('Focus ' + indicador + ': sem anos à frente');
  return { projecao, projecao_data: data };
}

// ---------- bolsas (Yahoo) ----------
export async function bolsa(simbolo, desde = 1995) {
  const { meta, pontos } = await yahooChart(simbolo, { range: 'max', interval: '1mo' });
  if (!pontos.length) throw new Error(simbolo + ': sem pontos');
  const nivel = {}, parcial = {};
  for (const [d, v] of pontos) if (d.slice(5, 7) === '12') nivel[Number(d.slice(0, 4))] = r2(v);
  const anoAtual = meta.data_atual ? Number(meta.data_atual.slice(0, 4)) : Number(pontos[pontos.length - 1][0].slice(0, 4));
  const atual = meta.atual ?? pontos[pontos.length - 1][1];
  if (!nivel[anoAtual]) {
    nivel[anoAtual] = r2(atual);
    const dt = meta.data_atual || pontos[pontos.length - 1][0];
    parcial[anoAtual] = 'até ' + dt.slice(8, 10) + '/' + dt.slice(5, 7);
  }
  const realizado = {};
  for (const a of Object.keys(nivel)) if (nivel[a - 1]) realizado[a] = r1((nivel[a] / nivel[a - 1] - 1) * 100);
  return { nivel: soDesde(nivel, desde), realizado: soDesde(realizado, desde), parcial };
}

// ---------- montagem ----------
const NOTAS_IPCA = [
  'Até 2024 a meta era apurada no ano-calendário; desde 2025 é contínua (3% ao ano, tolerância de 1,5 ponto, conferida em janelas de 12 meses). O gráfico mostra o acumulado no ano-calendário em todos os anos.',
  'Em 2003 e 2004 o BC perseguiu metas ajustadas (8,5% e 5,5%); a linha mostra a meta do CMN.'
];
export function base() {
  return {
    ipca: { nome: 'IPCA', tipo: 'inflacao', unidade: 'pct_ano', serie: 433, desde: 1995, descricao: 'Inflação oficial (IBGE), acumulada no ano a partir das variações mensais', meta_serie: 13521, meta_rotulo: 'Meta de inflação do CMN', meta_ajustada: { 2003: 8.5, 2004: 5.5 }, notas: NOTAS_IPCA },
    igpm: { nome: 'IGP-M', tipo: 'inflacao', unidade: 'pct_ano', serie: 189, desde: 1995, descricao: 'Índice Geral de Preços do Mercado (FGV), acumulado no ano', meta: null, notas: ['O IGP-M não tem meta; a projeção é a mediana do Focus.'] },
    selic: { nome: 'Selic', tipo: 'juros', unidade: 'pct_ano', serie: 4390, desde: 1995, descricao: 'Taxa Selic efetiva acumulada no ano (composição das taxas mensais)', meta_serie: 432, meta_rotulo: 'Meta Selic em vigor em 31/12', notas: ['A meta Selic existe desde março de 1999; antes disso a linha de meta fica vazia. A projeção do Focus é a meta no fim do ano.'] },
    cdi: { nome: 'CDI', tipo: 'juros', unidade: 'pct_ano', serie: 4391, desde: 1995, descricao: 'Taxa DI (B3) acumulada no ano', meta: null, projecao: null, notas: ['O CDI não tem meta nem projeção do Focus; ele acompanha a Selic.'] },
    poupanca: { nome: 'Poupança', tipo: 'juros', unidade: 'pct_ano', serie: 7828, desde: 1995, descricao: 'Rendimento da caderneta acumulado no ano (regra nova desde maio de 2012)', meta: null, projecao: null },
    dolar: { nome: 'Dólar', tipo: 'cambio', unidade: 'brl', serie: 3696, desde: 1995, descricao: 'Cotação de venda (PTAX) no fim do ano; a variação é sobre o fim do ano anterior', meta: null, projecao_unidade: 'brl', notas: ['A projeção do Focus é a cotação no fim do ano, em reais.'] },
    ibovespa: { nome: 'Ibovespa', tipo: 'bolsa', unidade: 'pontos', fonte: 'yahoo:^BVSP', desde: 1995, descricao: 'Fechamento do índice no fim do ano; a variação é nominal, em reais', meta: null, projecao: null },
    sp500: { nome: 'S&P 500', tipo: 'bolsa', unidade: 'pontos', fonte: 'yahoo:^GSPC', desde: 1995, descricao: 'Fechamento do índice no fim do ano; a variação é nominal, em dólares', meta: null, projecao: null }
  };
}

export function mudou(a, b) {
  const tira = o => { if (!o) return null; const { gerado_em, hoje, ...r } = o; return JSON.stringify(r); };
  return tira(a) !== tira(b);
}

export async function main({ raiz = process.cwd(), hoje, log = console.log } = {}) {
  hoje = hoje || process.env.INV_HOJE || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const arq = join(raiz, 'inv/macro.json');
  let antes = null;
  try { antes = JSON.parse(await readFile(arq, 'utf8')); } catch { }
  const ant = (antes && antes.indicadores) || {};
  const I = base();
  const falhas = [];
  const tenta = async (nome, f) => { try { return await f(); } catch (e) { falhas.push(nome); log(`${nome}: falhou (${e.message})`); return null; } };

  // séries mensais
  const mensais = { ipca: 433, igpm: 189, selic: 4390, cdi: 4391, poupanca: 7828 };
  for (const [k, s] of Object.entries(mensais)) {
    const l = await tenta(`SGS ${s} (${I[k].nome})`, () => sgs(s, { ini: '01/01/1995' }));
    if (l) Object.assign(I[k], acumulado(l, hoje));
    else if (ant[k]) Object.assign(I[k], { realizado: ant[k].realizado, parcial: ant[k].parcial });
  }
  const dol = await tenta('SGS 3696 (Dólar)', () => sgs(3696, { ini: '01/01/1995' }));
  if (dol) Object.assign(I.dolar, nivelAnual(dol, hoje));
  else if (ant.dolar) Object.assign(I.dolar, { nivel: ant.dolar.nivel, realizado: ant.dolar.realizado, parcial: ant.dolar.parcial });

  const mi = await tenta('SGS 13521 (meta de inflação)', metaInflacao);
  if (mi) Object.assign(I.ipca, mi); else if (ant.ipca) Object.assign(I.ipca, { meta: ant.ipca.meta, tol: ant.ipca.tol });
  const ms = await tenta('SGS 432 (meta Selic)', () => metaSelicFimDeAno(hoje));
  I.selic.meta = ms || (ant.selic && ant.selic.meta) || null;

  // Focus: se falhar, fica a projeção anterior (com a data dela)
  for (const [k, ind] of [['ipca', 'IPCA'], ['selic', 'Selic'], ['dolar', 'Câmbio'], ['igpm', 'IGP-M']]) {
    const f = await tenta(`Focus ${ind}`, () => focus(ind, hoje));
    if (f) Object.assign(I[k], f);
    else { I[k].projecao = (ant[k] && ant[k].projecao) || null; if (ant[k] && ant[k].projecao_data) I[k].projecao_data = ant[k].projecao_data; }
  }
  // bolsas
  for (const [k, s] of [['ibovespa', '^BVSP'], ['sp500', '^GSPC']]) {
    const b = await tenta(`Yahoo ${s}`, () => bolsa(s));
    if (b) Object.assign(I[k], b);
    else Object.assign(I[k], { nivel: (ant[k] && ant[k].nivel) || {}, realizado: (ant[k] && ant[k].realizado) || {}, parcial: (ant[k] && ant[k].parcial) || {} });
  }

  const novo = {
    versao: 1, gerado_em: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    fontes: {
      sgs: 'Banco Central do Brasil — Sistema Gerenciador de Séries Temporais (api.bcb.gov.br), licença ODbL',
      focus: 'Banco Central do Brasil — Expectativas de mercado (Focus), API Olinda',
      bolsa: 'Yahoo Finance (não oficial) — ^BVSP e ^GSPC'
    },
    hoje, indicadores: I
  };
  const essenciais = ['SGS 433 (IPCA)', 'SGS 4390 (Selic)', 'SGS 4391 (CDI)'];
  if (essenciais.every(n => falhas.includes(n)) && !antes) { log('Banco Central fora do ar e sem arquivo anterior: nada gravado.'); return { gravou: false, falhas, obj: novo }; }
  const gravou = mudou(antes, novo);
  if (gravou) await writeFile(arq, JSON.stringify(novo, null, 1) + '\n');
  log(`macro.json: ${gravou ? 'gravado' : 'sem mudanças'}; ${falhas.length ? 'falharam: ' + falhas.join(', ') : 'todas as fontes responderam'}.`);
  return { gravou, falhas, obj: novo };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = await main();
  // o passo fica vermelho só se o Banco Central (o essencial) falhou
  if (r.falhas.some(f => f.startsWith('SGS'))) process.exit(1);
}
