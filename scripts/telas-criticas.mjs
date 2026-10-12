// Robô das resenhas do Telas/Whatch: para cada título com imdb_id, até 3 resenhas do TMDB (as de quem escreveu com nota,
// em português primeiro), com autor, nota de 0 a 10, mês, um trecho curto (até ~360 caracteres, cortado em frase) e o link
// para ler inteira no TMDB. Um arquivo por título: telas/criticas/<tt>.json = {total, itens: [{autor, nota, lingua, data,
// trecho, url}]}. Quem não tem resenha não ganha arquivo; telas/criticas/_feito.json lembra a data de cada consulta para não
// perguntar de novo antes de 30 dias. Por rodada, os nunca consultados primeiro, até CRITICAS_LIMITE (padrão 500) ou 5 min.
// Precisa do segredo TMDB_API_KEY (o mesmo do onde assistir); sem ele, não faz nada. Node 20+, sem dependências.

import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarTmdb } from './telas-ids.mjs';

const VALIDADE_DIAS = 30;
const IMDB = /^tt\d{7,10}$/;
const lerJson = async p => JSON.parse(await readFile(p, 'utf8'));

// os títulos que interessam, com o tipo do TMDB (movie/tv) e o tmdb_id quando já existe
export function titulosDe(catalogo, dados) {
  const m = new Map(), poe = (it, tipo) => {
    if (!it || !IMDB.test(String(it.imdb_id || '')) || m.has(it.imdb_id)) return;
    m.set(it.imdb_id, { imdb: it.imdb_id, tipo: tipo === 'serie' ? 'tv' : 'movie', tmdb: +it.tmdb_id > 0 ? +it.tmdb_id : null });
  };
  for (const it of catalogo?.itens || []) poe(it, it.tipo);
  for (const it of dados?.filmes || []) poe(it, 'filme');
  for (const it of dados?.series || []) poe(it, 'serie');
  for (const ex of dados?.extras || []) { if (ex?.tipo === 'saga') (ex.filmes || []).forEach(f => poe(f, 'filme')); else poe(ex, ex?.tipo); }
  return m;
}

// texto limpo (sem markdown, HTML e links) e o trecho: corta na última frase que cabe; sem frase, na última palavra
export function limpa(t) {
  return String(t || '').replace(/<[^>]*>/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~`#>]+/g, '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function trecho(t, max = 360) {
  t = limpa(t); if (t.length <= max) return t;
  const c = t.slice(0, max), f = Math.max(c.lastIndexOf('. '), c.lastIndexOf('! '), c.lastIndexOf('? '));
  if (f > max * 0.45) return c.slice(0, f + 1);
  return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}
// escolhe até 3: as em português primeiro, depois as com nota e texto de tamanho bom; se houver uma crítica negativa
// (nota até 5) entre as boas, ela entra para equilibrar
export function escolhe(lista) {
  const ok = (lista || []).filter(r => r && r.content && limpa(r.content).length >= 120)
    .map(r => {
      const n = r.author_details && r.author_details.rating != null ? +r.author_details.rating : null, len = limpa(r.content).length;
      return { r, n: n != null && n >= 0 && n <= 10 ? n : null, s: (r._pt ? 100 : 0) + (n != null ? 20 : 0) + Math.min(len, 2500) / 250 };
    }).sort((a, b) => b.s - a.s);
  const out = ok.slice(0, 2), neg = ok.slice(2).find(x => x.n != null && x.n <= 5);
  if (neg && !out.some(x => x.n != null && x.n <= 5)) out.push(neg); else if (ok[2]) out.push(ok[2]);
  return out.map(({ r, n }) => ({
    autor: String((r.author_details && (r.author_details.name || r.author_details.username)) || r.author || 'anônimo').slice(0, 60),
    nota: n, lingua: r._pt ? 'pt' : 'en', data: String(r.created_at || '').slice(0, 7), trecho: trecho(r.content),
    url: /^https:\/\/www\.themoviedb\.org\/review\/[\w-]+$/.test(String(r.url || '')) ? r.url : null,
  }));
}

export async function executar({ raiz = process.cwd(), fetchFn = globalThis.fetch, log = console.log, agora = () => new Date(),
  chave = process.env.TMDB_API_KEY || '', limite = +(process.env.CRITICAS_LIMITE || 500), tempoMax = 5 * 60e3, base, dormir } = {}) {
  if (!chave) { log('sem TMDB_API_KEY: nada a fazer'); return { codigo: 0, gravou: 0 }; }
  let catalogo, dados;
  try { catalogo = await lerJson(join(raiz, 'telas/catalogo.json')); dados = await lerJson(join(raiz, 'telas/dados.json')); }
  catch (e) { log(`arquivo ilegível (${e.message})`); return { codigo: 1, gravou: 0 }; }
  const tmdb = criarTmdb({ chave, fetchFn, ...(base ? { base } : {}), ...(dormir ? { dormir } : {}) });
  const titulos = titulosDe(catalogo, dados), DIR = join(raiz, 'telas/criticas'), ARQ_F = join(DIR, '_feito.json');
  await mkdir(DIR, { recursive: true });
  let feito = {}; try { feito = await lerJson(ARQ_F) || {}; } catch { /* primeira vez */ }
  const hoje = agora().toISOString().slice(0, 10), corte = new Date(agora().getTime() - VALIDADE_DIAS * 864e5).toISOString().slice(0, 10);
  const novos = [...titulos.keys()].filter(k => !feito[k]);
  const velhos = [...titulos.keys()].filter(k => feito[k] && feito[k] < corte).sort((a, b) => feito[a].localeCompare(feito[b]));
  const fila = novos.concat(velhos).slice(0, Math.max(0, limite));
  let n = 0, gravou = 0, comResenha = 0, parou = '';
  const inicio = Date.now();
  for (const k of fila) {
    if (Date.now() - inicio > tempoMax) { parou = 'tempo da rodada'; break; }
    const t = titulos.get(k);
    try {
      let id = t.tmdb;
      if (!id) {
        const f = await tmdb(`/find/${k}`, { external_source: 'imdb_id' });
        const l = f && (t.tipo === 'tv' ? f.tv_results : f.movie_results);
        id = l && l[0] && l[0].id;
      }
      let res = [];
      if (id) {
        const [pt, en] = await Promise.all([tmdb(`/${t.tipo}/${id}/reviews`, { language: 'pt-BR' }), tmdb(`/${t.tipo}/${id}/reviews`, { language: 'en-US' })]);
        const vistos = new Set();
        for (const [lista, ehPt] of [[pt && pt.results, true], [en && en.results, false]])
          for (const r of lista || []) if (r && !vistos.has(r.id)) { vistos.add(r.id); res.push({ ...r, _pt: ehPt && (r.iso_639_1 ? r.iso_639_1 === 'pt' : true) }); }
      }
      const itens = escolhe(res), arq = join(DIR, k + '.json');
      if (itens.length) {
        comResenha++;
        const novo = JSON.stringify({ total: res.length, itens }) + '\n';
        let antes = ''; try { antes = await readFile(arq, 'utf8'); } catch { /* novo */ }
        if (antes !== novo) { await writeFile(arq, novo); gravou++; }
      } else { try { await unlink(arq); gravou++; } catch { /* não tinha */ } }
      feito[k] = hoje; n++;
    } catch (e) {
      if (e.fatal) { log(e.message); break; }
      log(`${k}: ${e.message}`);
    }
  }
  // o que saiu do catálogo sai daqui também
  for (const f of await readdir(DIR)) { const m = /^(tt\d+)\.json$/.exec(f); if (m && !titulos.has(m[1])) { await unlink(join(DIR, f)); gravou++; } }
  for (const k of Object.keys(feito)) if (!titulos.has(k)) delete feito[k];
  const ordenado = Object.fromEntries(Object.keys(feito).sort().map(k => [k, feito[k]]));
  const antesF = await readFile(ARQ_F, 'utf8').catch(() => ''), novoF = JSON.stringify(ordenado) + '\n';
  if (antesF !== novoF) await writeFile(ARQ_F, novoF);
  log(`resenhas: ${n} títulos consultados (${comResenha} com resenha)${parou ? ', parou no ' + parou : ''}; ${gravou} arquivos mudaram; faltam ${Math.max(0, novos.length - n)} nunca consultados`);
  return { codigo: 0, gravou, n };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  executar().then(r => process.exit(r.codigo)).catch(e => { console.error(e); process.exit(1); });
}
