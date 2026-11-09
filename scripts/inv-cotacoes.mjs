// Inv · robô das cotações: inv/empresas.json → stooq, brapi.dev (B3) e Twelve Data, em cadeia (2 anos, diário) → inv/cotacoes.json.
// Por empresa: atual, média dos 2 anos, diferença em %, mínimo, máximo, variação em 1 ano, o fechamento de cada semana e a fonte.
// Cada fonte que falha 3 vezes seguidas (ou bate no limite, ou pede token) sai da rodada e a cadeia segue na próxima.
// Falhou hoje: fica o número de ontem, com "erro". Mais da metade falhou: não grava nada e sai com erro.
// Ordem: os mais desatualizados primeiro; quem não coube no prazo fica para a próxima rodada (não conta como falha).
// Segredos opcionais: BRAPI_TOKEN (B3 inteira na brapi) e TWELVE_DATA_KEY (plano C). Sem eles, grava o que o stooq cobriu.
// Node 20, sem dependências. Teste: node scripts/inv-cotacoes.teste.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cotacaoEmCadeia, estatisticas, semanal, novoEstado, stooqCandidatos, partes, BOLSAS, NOMES } from '../api/_inv-fontes.mjs';

const dorme = ms => new Promise(r => setTimeout(r, ms));
const num = (v, p) => { const n = Number(v); return isFinite(n) ? n : p; };
// pausa antes de cada chamada, por fonte (ms); Twelve Data grátis = 8 por minuto
const PAUSAS = () => ({ stooq: num(process.env.INV_PAUSA_STOOQ_MS, 1000), brapi: num(process.env.INV_PAUSA_BRAPI_MS, 600), twelve: num(process.env.INV_PAUSA_TD_MS, 8000) });
// prazo da rodada: o passo do workflow tem 12 min; depois disso, quem falta fica com o número de ontem
const PRAZO = () => num(process.env.INV_PRAZO_MS, 10 * 60e3);

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
  const t0 = Date.now();
  const emp = JSON.parse(await readFile(join(raiz, 'inv/empresas.json'), 'utf8'));
  let antes = { itens: {} };
  try { antes = JSON.parse(await readFile(join(raiz, 'inv/cotacoes.json'), 'utf8')); } catch { }
  const lista = []; const visto = new Set();
  for (const m of emp.mercados) for (const e of m.empresas) if (!visto.has(e.simbolo)) { visto.add(e.simbolo); lista.push(e); }
  const ordemArq = lista.map(e => e.simbolo);
  // os mais desatualizados primeiro (sem número antes de todos): se o prazo acabar, a próxima rodada continua de onde parou
  const idade = e => { const a = antes.itens && antes.itens[e.simbolo]; return a && a.atual != null && a.atualizado_em ? a.atualizado_em : ''; };
  lista.sort((x, y) => (idade(x) < idade(y) ? -1 : idade(x) > idade(y) ? 1 : 0));
  const estado = novoEstado();
  const P = PAUSAS(); const usou = {};
  const pausa = async f => { if (usou[f]) await dorme(P[f] + Math.random() * P[f] * .3); usou[f] = 1; };
  const itens = {}; const cont = { ok: 0, sem: [], nao: [], por: { stooq: 0, brapi: 0, twelve: 0 } };
  const descobertos = {}; let estourou = false;
  for (const e of lista) {
    const s = e.simbolo;
    const ant = antes.itens && antes.itens[s];
    if (Date.now() - t0 > PRAZO()) {
      estourou = true;
      itens[s] = ant && ant.atual != null ? { ...ant, erro: 'Sem tempo nesta rodada' } : { erro: 'Sem tempo nesta rodada', atualizado_em: hoje };
      cont.tempo = (cont.tempo || 0) + 1; continue;
    }
    try {
      const r = await cotacaoEmCadeia(s, { range: '2y', stooq: e.stooq, estado, pausa, esperaMinuto: () => dorme(num(process.env.INV_ESPERA_MINUTO_MS, 61e3)), log, hoje: new Date(hoje + 'T23:00:00Z') });
      const st = estatisticas(r.pontos);
      if (!st) throw Object.assign(new Error('sem pontos'), { status: 502 });
      const [moeda0, bolsa] = BOLSAS[partes(s).suf] || [null, null];
      itens[s] = {
        nome: e.nome || r.nome || s, moeda: r.moeda || moeda0, bolsa: bolsa,
        atual: st.atual, data_atual: st.data_atual, media_2a: st.media, dif_pct: st.dif_pct, min_2a: st.min, max_2a: st.max, n: st.n,
        var_1a_pct: var1a(r.pontos), semanal: semanal(r.pontos), fonte: r.fonte, atualizado_em: hoje, erro: null
      };
      if (r.fonte === 'stooq' && r.simbolo_fonte !== stooqCandidatos(s)[0]) descobertos[s] = r.simbolo_fonte;
      cont.ok++; cont.por[r.fonte]++;
    } catch (err) {
      const nao = err.status === 404;
      const motivo = nao ? 'Símbolo não encontrado nas fontes' : 'Sem dados hoje';
      itens[s] = ant && ant.atual != null ? { ...ant, erro: motivo } : { erro: motivo, atualizado_em: hoje };
      (nao ? cont.nao : cont.sem).push(`${s}: ${err.motivo || err.message}`);
    }
  }
  const fontes = Object.keys(estado).map(f => `${NOMES[f]} ${cont.por[f]}${estado[f].fora ? ' (saiu da rodada: ' + estado[f].fora + ')' : ''}`).join(', ');
  const resumo = `${lista.length} símbolos: ${cont.ok} ok, ${cont.sem.length} sem dados,${cont.tempo ? ' ' + cont.tempo + ' para a próxima rodada (prazo),' : ''} ${cont.nao.length} não encontrado${cont.nao.length === 1 ? '' : 's'} · por fonte: ${fontes} · ${Math.round((Date.now() - t0) / 1000)} s${estourou ? ' (prazo estourado)' : ''}`;
  log(resumo);
  if (cont.sem.length) log('Sem dados: ' + cont.sem.join(' | '));
  if (cont.nao.length) log('Não encontrados: ' + cont.nao.join(' | '));
  if (Object.keys(descobertos).length) log('Símbolos do stooq diferentes do padrão (pôr em "stooq" no empresas.json): ' + JSON.stringify(descobertos));
  // os que ficaram para a próxima rodada (prazo) não contam: a rodada só não grava quando as fontes falharam de verdade
  const falhou = cont.sem.length + cont.nao.length;
  if (falhou > (lista.length - (cont.tempo || 0)) / 2 || !cont.ok) {
    log('Mais da metade falhou: nada gravado; a página segue com o arquivo anterior.');
    return { gravou: false, bloqueado: true, cont, estado, descobertos, itens };
  }
  const itensOrd = {}; for (const k of ordemArq) itensOrd[k] = itens[k];
  const novo = { versao: 2, gerado_em: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), fonte: 'stooq, brapi.dev (B3) e Twelve Data, em cadeia; o campo "fonte" de cada item diz de onde veio', janela: '2 anos (≈ 500 pregões)', itens: itensOrd };
  const gravou = semData(novo) !== semData({ ...antes, itens: antes.itens || {} }) || antes.versao !== 2;
  if (gravou) await writeFile(join(raiz, 'inv/cotacoes.json'), formatoItens(novo));
  log(gravou ? 'cotacoes.json gravado.' : 'cotacoes.json sem mudanças.');
  return { gravou, bloqueado: false, cont, estado, descobertos, itens };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = await main();
  if (r.bloqueado) process.exit(1);
}
