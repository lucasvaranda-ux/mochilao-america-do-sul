// Inv · robô do índice de busca: inv/busca.json = [[símbolo, nome]] de B3 e EUA (o grupo sai do sufixo: .SA = Brasil, sem sufixo = EUA).
// Fontes: as empresas de inv/empresas.json; a lista da brapi.dev (/api/quote/list, ou /api/available sem os nomes; BRAPI_TOKEN opcional);
// uma lista fixa de ações conhecidas da B3 (para quando a brapi não abre); e o arquivo público da SEC (company_tickers.json) para os EUA.
// A SEC pede um User-Agent que identifique quem chama: vai o nome do robô e do repositório, nunca um e-mail pessoal.
// Se uma fonte falhar, ficam os itens dela do arquivo anterior. Com as duas fontes em dia, refaz no máximo uma vez por semana (INV_INDICE_FORCA=1 força).
// Node 20, sem dependências. Teste: node scripts/inv-api.teste.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { UA, simboloOk, grupoDe } from '../api/_inv-fontes.mjs';

const SEC = () => process.env.INV_SEC_URL || 'https://www.sec.gov/files/company_tickers.json';
const BRAPI = () => (process.env.INV_BRAPI_BASE || 'https://brapi.dev').replace(/\/$/, '');

// ações conhecidas da B3 (código e nome), para a busca funcionar mesmo sem a brapi
export const B3_CONHECIDAS = [
  ['PETR4', 'Petrobras PN'], ['PETR3', 'Petrobras ON'], ['VALE3', 'Vale ON'], ['ITUB4', 'Itaú Unibanco PN'], ['ITUB3', 'Itaú Unibanco ON'], ['BBDC4', 'Bradesco PN'], ['BBDC3', 'Bradesco ON'],
  ['BBAS3', 'Banco do Brasil ON'], ['ABEV3', 'Ambev ON'], ['B3SA3', 'B3 ON'], ['WEGE3', 'WEG ON'], ['ITSA4', 'Itaúsa PN'], ['SANB11', 'Santander Brasil Unit'], ['BPAC11', 'BTG Pactual Unit'],
  ['ELET3', 'Eletrobras ON'], ['ELET6', 'Eletrobras PNB'], ['SUZB3', 'Suzano ON'], ['RENT3', 'Localiza ON'], ['RDOR3', "Rede D'Or ON"], ['PRIO3', 'PRIO ON'], ['GGBR4', 'Gerdau PN'], ['GOAU4', 'Metalúrgica Gerdau PN'],
  ['JBSS3', 'JBS ON'], ['BRFS3', 'BRF ON'], ['MRFG3', 'Marfrig ON'], ['BEEF3', 'Minerva ON'], ['EQTL3', 'Equatorial ON'], ['CPLE6', 'Copel PNB'], ['CMIG4', 'Cemig PN'], ['SBSP3', 'Sabesp ON'], ['CSMG3', 'Copasa ON'],
  ['ENEV3', 'Eneva ON'], ['EGIE3', 'Engie Brasil ON'], ['TAEE11', 'Taesa Unit'], ['CPFE3', 'CPFL Energia ON'], ['NEOE3', 'Neoenergia ON'], ['VIVT3', 'Telefônica Brasil (Vivo) ON'], ['TIMS3', 'TIM ON'],
  ['RADL3', 'Raia Drogasil ON'], ['HAPV3', 'Hapvida ON'], ['FLRY3', 'Fleury ON'], ['LREN3', 'Lojas Renner ON'], ['MGLU3', 'Magazine Luiza ON'], ['ASAI3', 'Assaí ON'], ['CRFB3', 'Carrefour Brasil ON'],
  ['NTCO3', 'Natura ON'], ['ARZZ3', 'Arezzo ON'], ['AZZA3', 'Azzas 2154 ON'], ['VBBR3', 'Vibra Energia ON'], ['UGPA3', 'Ultrapar ON'], ['CSAN3', 'Cosan ON'], ['RAIZ4', 'Raízen PN'], ['RAIL3', 'Rumo ON'],
  ['CCRO3', 'CCR ON'], ['MOTV3', 'Motiva ON'], ['EMBR3', 'Embraer ON'], ['AZUL4', 'Azul PN'], ['GOLL4', 'Gol PN'], ['CSNA3', 'CSN ON'], ['USIM5', 'Usiminas PNA'], ['CMIN3', 'CSN Mineração ON'], ['BRAP4', 'Bradespar PN'],
  ['KLBN11', 'Klabin Unit'], ['TOTS3', 'Totvs ON'], ['LWSA3', 'Locaweb ON'], ['CYRE3', 'Cyrela ON'], ['MRVE3', 'MRV ON'], ['EZTC3', 'EZTec ON'], ['MULT3', 'Multiplan ON'], ['ALOS3', 'Allos ON'],
  ['BBSE3', 'BB Seguridade ON'], ['CXSE3', 'Caixa Seguridade ON'], ['PSSA3', 'Porto Seguro ON'], ['IRBR3', 'IRB Brasil ON'], ['BPAN4', 'Banco Pan PN'], ['ABCB4', 'ABC Brasil PN'], ['BRSR6', 'Banrisul PNB'],
  ['SMTO3', 'São Martinho ON'], ['SLCE3', 'SLC Agrícola ON'], ['YDUQ3', 'Yduqs ON'], ['COGN3', 'Cogna ON'], ['CVCB3', 'CVC ON'], ['PETZ3', 'Petz ON'], ['VAMO3', 'Vamos ON'], ['SIMH3', 'Simpar ON'],
  ['HYPE3', 'Hypera ON'], ['ODPV3', 'Odontoprev ON'], ['DXCO3', 'Dexco ON'], ['POMO4', 'Marcopolo PN'], ['RAPT4', 'Randon PN'], ['TUPY3', 'Tupy ON'], ['SAPR11', 'Sanepar Unit'], ['ALUP11', 'Alupar Unit'],
  ['AURE3', 'Auren ON'], ['RECV3', 'PetroReconcavo ON'], ['BRAV3', 'Brava Energia ON'], ['INTB3', 'Intelbras ON'], ['GMAT3', 'Grupo Mateus ON'], ['SMFT3', 'Smart Fit ON'], ['CASH3', 'Méliuz ON'], ['STBP3', 'Santos Brasil ON']
].map(([c, n]) => [c + '.SA', n]);

// "APPLE INC." → "Apple Inc." (a SEC grava tudo em maiúsculas)
export function bonito(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(\-/&.])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Usa|Us|Etf|Reit|Ii|Iii|Iv)\b/g, m => m.toUpperCase());
}

async function json(url, tempoMs = 30000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(tempoMs) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
export async function daSec() {
  const j = await json(SEC());
  const out = [];
  for (const x of Object.values(j || {})) {
    const s = simboloOk(String(x && x.ticker || '').replace(/\./g, '-'));
    if (s && x.title) out.push([s, bonito(x.title)]);
  }
  if (out.length < 1000) throw new Error('SEC: só ' + out.length + ' itens');
  return out;
}
export async function daBrapi() {
  const tok = process.env.BRAPI_TOKEN;
  const q = tok ? '&token=' + encodeURIComponent(tok) : '';
  try {
    const j = await json(BRAPI() + '/api/quote/list?type=stock&limit=5000' + q);
    const l = (j.stocks || []).map(x => [simboloOk(String(x.stock || '') + '.SA'), String(x.name || x.stock || '').replace(/\s+/g, ' ').trim()]).filter(x => x[0]);
    if (l.length > 50) return { itens: l, de: 'brapi /api/quote/list' };
  } catch { }
  const j = await json(BRAPI() + '/api/available' + (tok ? '?token=' + encodeURIComponent(tok) : ''));
  const l = (j.stocks || []).map(c => [simboloOk(String(c) + '.SA'), String(c)]).filter(x => x[0]);
  if (l.length < 50) throw new Error('brapi: só ' + l.length + ' itens');
  return { itens: l, de: 'brapi /api/available' };
}

export async function main({ raiz = process.cwd(), log = console.log, agora = new Date() } = {}) {
  const arq = join(raiz, 'inv/busca.json');
  let antes = null;
  try { antes = JSON.parse(await readFile(arq, 'utf8')); } catch { }
  if (antes && antes.completo && antes.gerado_em && !process.env.INV_INDICE_FORCA && agora - Date.parse(antes.gerado_em) < 6.5 * 864e5) {
    log('busca.json tem menos de uma semana: fica como está.'); return { gravou: false, pulou: true };
  }
  const emp = JSON.parse(await readFile(join(raiz, 'inv/empresas.json'), 'utf8'));
  const ant = (antes && antes.itens) || [];
  const fontes = []; const falhas = [];
  const listas = [];
  listas.push(emp.mercados.flatMap(m => m.empresas.map(e => [e.simbolo, e.nome])));
  let br = null;
  try { br = await daBrapi(); fontes.push(br.de); } catch (e) { falhas.push('brapi: ' + e.message); log('brapi: falhou (' + e.message + ')'); }
  listas.push(B3_CONHECIDAS);
  if (br) listas.push(br.itens); else listas.push(ant.filter(x => grupoDe(x[0]) === 'br'));
  let us = null;
  try { us = await daSec(); fontes.push('SEC company_tickers.json'); } catch (e) { falhas.push('SEC: ' + e.message); log('SEC: falhou (' + e.message + ')'); }
  listas.push(us || ant.filter(x => grupoDe(x[0]) === 'eua'));
  // o primeiro nome de cada símbolo vence (as listas curadas vêm antes); só Brasil e EUA, fora as empresas das listas
  const vistos = new Map();
  for (const l of listas) for (const x of l) {
    const s = simboloOk(x[0]); if (!s || vistos.has(s)) continue;
    vistos.set(s, [s, String(x[1] || s).slice(0, 80)]);
  }
  const itens = [...vistos.values()];
  const novo = { versao: 1, gerado_em: agora.toISOString().replace(/\.\d+Z$/, 'Z'), fonte: ['inv/empresas.json', 'lista fixa da B3', ...fontes].join(', '), completo: !falhas.length, itens };
  const sem = o => o && JSON.stringify({ ...o, gerado_em: null });
  const gravou = sem(novo) !== sem(antes);
  // um item por linha, para o diff ser legível
  if (gravou) await writeFile(arq, JSON.stringify({ ...novo, itens: undefined }).slice(0, -1) + ',"itens":[\n' + itens.map(x => JSON.stringify(x)).join(',\n') + '\n]}\n');
  log(`busca.json: ${itens.length} símbolos (${itens.filter(x => grupoDe(x[0]) === 'br').length} da B3, ${itens.filter(x => grupoDe(x[0]) === 'eua').length} dos EUA); ${gravou ? 'gravado' : 'sem mudanças'}${falhas.length ? '; falharam: ' + falhas.join(', ') : ''}.`);
  return { gravou, falhas, n: itens.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
