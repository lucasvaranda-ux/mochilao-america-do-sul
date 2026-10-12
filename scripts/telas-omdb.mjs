// Robô das outras notas do Telas/Whatch: Rotten Tomatoes (crítica) e Metacritic de todo título com imdb_id, pela OMDb
// (https://www.omdbapi.com, chave grátis de 1.000 consultas por dia; dados sob CC BY-NC 4.0, uso não comercial).
// A nota do IMDb continua vindo da base pública do IMDb (telas-notas.mjs); a do público do Rotten e a do Letterboxd
// não existem em API aberta.
// Grava telas/notas-fora.json: {gerado_em, fonte, itens: {tt…: [rt|null, mc|null, 'AAAA-MM-DD']}}. A data é a da
// consulta: título sem nota também fica gravado (com null), para não ser perguntado de novo todo dia. Por rodada, primeiro
// o que nunca foi consultado, depois o que tem mais de 45 dias, até OMDB_LIMITE (padrão 800: sobra para um disparo
// manual no mesmo dia) ou 5 minutos. "Request limit reached" para a rodada e grava o que já veio; chave inválida para sem gravar.
// Sem o segredo OMDB_API_KEY, não faz nada. Node 20+, sem dependências.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe } from './telas-notas.mjs';

const VALIDADE_DIAS = 45;
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));
const espera = ms => new Promise(r => setTimeout(r, ms));

// da resposta da OMDb, só as duas notas: "94%" e "83" (de "83/100" ou do Metascore)
export function lerResposta(j) {
  if (!j || j.Response !== 'True') return null;
  let rt = null, mc = null;
  for (const r of Array.isArray(j.Ratings) ? j.Ratings : []) {
    const v = String(r && r.Value || '');
    if (r && r.Source === 'Rotten Tomatoes' && /^\d{1,3}%$/.test(v)) rt = v;
    if (r && r.Source === 'Metacritic') { const m = /^(\d{1,3})\/100$/.exec(v); if (m) mc = m[1]; }
  }
  if (!mc && /^\d{1,3}$/.test(String(j.Metascore || ''))) mc = String(j.Metascore);
  return [rt, mc];
}

export async function executar({ raiz = process.cwd(), fetchFn = globalThis.fetch, log = console.log, agora = () => new Date(),
  chave = process.env.OMDB_API_KEY || '', limite = +(process.env.OMDB_LIMITE || 800), pausa = 80, tempoMax = 5 * 60e3 } = {}) {
  if (!chave) { log('sem OMDB_API_KEY: nada a fazer'); return { codigo: 0, gravou: false }; }
  let catalogo, dados;
  try { catalogo = await lerJson(join(raiz, 'telas/catalogo.json')); dados = await lerJson(join(raiz, 'telas/dados.json')); }
  catch (e) { log(`arquivo ilegível (${e.message})`); return { codigo: 1, gravou: false }; }
  const ids = idsDe(catalogo, dados);
  const ARQ = join(raiz, 'telas/notas-fora.json');
  let antes = {}; try { const a = await lerJson(ARQ); if (a && a.itens && typeof a.itens === 'object') antes = a.itens; } catch { /* primeira vez */ }

  const hoje = agora().toISOString().slice(0, 10), corte = new Date(agora().getTime() - VALIDADE_DIAS * 864e5).toISOString().slice(0, 10);
  const itens = {};
  for (const id of ids) if (Array.isArray(antes[id])) itens[id] = antes[id]; // o que saiu do catálogo sai daqui também
  const novos = [...ids].filter(id => !itens[id]);
  const velhos = [...ids].filter(id => itens[id] && String(itens[id][2] || '') < corte).sort((a, b) => String(itens[a][2]).localeCompare(String(itens[b][2])));
  const fila = novos.concat(velhos).slice(0, Math.max(0, limite));

  let feitos = 0, comNota = 0, parou = '';
  const inicio = Date.now();
  for (const id of fila) {
    if (Date.now() - inicio > tempoMax) { parou = 'tempo da rodada'; break; } // grava antes de o passo do workflow estourar
    let r;
    try { r = await fetchFn(`https://www.omdbapi.com/?i=${id}&apikey=${encodeURIComponent(chave)}`); }
    catch (e) { log(`${id}: rede (${e.message})`); continue; }
    let j = null; try { j = await r.json(); } catch { /* resposta sem JSON */ }
    const erro = String(j && j.Error || '');
    if (/limit reached/i.test(erro)) { parou = 'limite do dia'; break; }
    if (/invalid api key|no api key/i.test(erro) || r.status === 401) { log('OMDb recusou a chave'); return { codigo: 1, gravou: false }; }
    if (!r.ok && r.status !== 404) { log(`${id}: OMDb respondeu ${r.status}`); continue; }
    const n = lerResposta(j) || [null, null];
    itens[id] = [n[0], n[1], hoje]; feitos++; if (n[0] || n[1]) comNota++;
    if (pausa) await espera(pausa);
  }
  const total = Object.values(itens).filter(v => v[0] || v[1]).length;
  log(`OMDb: ${feitos} consultados (${comNota} com nota)${parou ? ', parou no ' + parou : ''}; ${total} de ${ids.size} títulos com Rotten ou Metacritic; faltam ${Math.max(0, novos.length - feitos)} nunca consultados`);
  if (JSON.stringify(antes) === JSON.stringify(itens)) { log('sem mudança'); return { codigo: 0, gravou: false }; }
  await writeFile(ARQ, JSON.stringify({ gerado_em: hoje, fonte: 'OMDb (omdbapi.com): Rotten Tomatoes e Metacritic', itens }) + '\n');
  return { codigo: 0, gravou: true, feitos, total };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  executar().then(r => process.exit(r.codigo)).catch(e => { console.error(e); process.exit(1); });
}
