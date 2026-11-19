// Estudos (estudos.madeinbr.app): cifra o catálogo e cada estudo e grava em estudos/dados/.
//
// Este repositório é público, e os estudos são particulares. Por isso o texto deles NUNCA entra aqui:
// as fontes (catalogo.json, emblemas.json e um <slug>.html por estudo) e a chave ficam fora, num lugar privado,
// e este script só grava o resultado cifrado. O navegador decifra com estudos/cofre.js.
//
// Uso:
//   node scripts/estudos-cifra.mjs --fontes <pasta privada> --chave <arquivo da chave> [--saida estudos/dados] [--nova-chave]
//
// --nova-chave cria o arquivo da chave se ele não existir (32 bytes ao acaso, em base64url). Trocar a chave tranca
// todos os aparelhos até o link-chave novo ser aberto neles.
//
// Cada arquivo: "EST1" + vetor de 12 bytes + AES-256-GCM(gzip(texto)) + selo de 16 bytes.
// O vetor sai do próprio conteúdo (HMAC), então rodar de novo sem mudar nada grava os mesmos bytes (nenhum diff).
// O nome do arquivo é um HMAC do nome lógico ("catalogo", "estudo:<slug>"): sem a chave, não diz nada.
// Sem dependências (Node 20 ou mais novo).
import { createCipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SAL = 'estudos.madeinbr.app/v1';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function leChave(txt) {
  const t = String(txt).trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(t)) throw new Error('A chave tem de ter 43 letras e números (32 bytes em base64url).');
  const bruta = Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/') + '=', 'base64');
  if (bruta.length !== 32) throw new Error('A chave não tem 32 bytes.');
  return bruta;
}
export function deriva(bruta) {
  const d = (info) => Buffer.from(hkdfSync('sha256', bruta, Buffer.from(SAL), Buffer.from(info), 32));
  return { cifra: d('cifra'), nomes: d('nomes') };
}
export const nomeDe = (K, logico) => b64u(createHmac('sha256', K.nomes).update('nome:' + logico).digest()).slice(0, 24);
export function sela(K, logico, texto) {
  const gz = gzipSync(Buffer.from(texto, 'utf8'), { level: 9 });
  const iv = createHmac('sha256', K.nomes).update('iv:' + logico + '\0').update(gz).digest().subarray(0, 12);
  const c = createCipheriv('aes-256-gcm', K.cifra, iv);
  c.setAAD(Buffer.from('estudos/v1:' + logico));
  const ct = Buffer.concat([c.update(gz), c.final()]);
  return Buffer.concat([Buffer.from('EST1'), iv, ct, c.getAuthTag()]);
}

// endereço das fontes das capas: uma família por capa, só com as letras dos títulos
function fontesDasCapas(estudos) {
  const fams = new Map();
  for (const e of estudos) { const c = e.capa || {}; if (c.fonte) fams.set(c.fonte, [c.peso || 400, c.estilo === 'italic']); }
  if (!fams.size) return '';
  const letras = [...new Set(estudos.map(e => e.titulo + e.titulo.toUpperCase() + e.titulo.toLowerCase()).join(''))].sort().join('');
  const fam = ([nome, [peso, ital]]) => {
    const n = nome.replace(/ /g, '+');
    if (ital) return `family=${n}:ital,wght@1,${peso}`;
    return peso === 400 ? `family=${n}` : `family=${n}:wght@${peso}`;
  };
  return 'https://fonts.googleapis.com/css2?' + [...fams.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(fam).join('&') + '&display=swap&text=' + encodeURIComponent(letras);
}

export function confere(cat, pasta) {
  const erros = [];
  const temas = new Set((cat.temas || []).map(t => t.id));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cat.atualizada_em || '')) erros.push('atualizada_em precisa ser AAAA-MM-DD');
  const vistos = new Set();
  for (const e of cat.estudos || []) {
    const q = 'estudo ' + (cat.estudos.indexOf(e) + 1);
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(e.slug || '')) { erros.push(q + ': slug inválido'); continue; }
    if (vistos.has(e.slug)) erros.push(q + ': slug repetido'); vistos.add(e.slug);
    for (const k of ['titulo', 'tipo']) if (!e[k] || typeof e[k] !== 'string') erros.push(q + ': falta ' + k);
    if (!temas.has(e.tema)) erros.push(q + ': tema desconhecido');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data || '')) erros.push(q + ': data precisa ser AAAA-MM-DD');
    if (!e.capa || !e.capa.bg || !e.capa.fg) erros.push(q + ': falta a capa');
    if (e.onde === 'claude') { if (!/^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9-]+$/.test(e.url || '')) erros.push(q + ': onde=claude pede o endereço do artefato'); }
    else if (e.onde === 'app') { if (!existsSync(join(pasta, e.slug + '.html'))) erros.push(q + ': falta o arquivo <slug>.html nas fontes'); }
    else erros.push(q + ': onde precisa ser "app" ou "claude"');
    for (const d of e.dentro || []) if (!d.t) erros.push(q + ': item de "dentro" sem texto');
  }
  for (const f of cat.fios || []) for (const k of ['de', 'para']) if (!vistos.has(f[k])) erros.push('fio aponta para um estudo que não existe');
  return erros;
}

// monta tudo em memória: { arquivos: Map(nome → Buffer), resumo }
export function monta(pasta, chaveTxt) {
  const K = deriva(leChave(chaveTxt));
  const cat = JSON.parse(readFileSync(join(pasta, 'catalogo.json'), 'utf8'));
  const erros = confere(cat, pasta);
  if (erros.length) throw new Error('Catálogo com problema:\n- ' + erros.join('\n- '));
  const emb = existsSync(join(pasta, 'emblemas.json')) ? JSON.parse(readFileSync(join(pasta, 'emblemas.json'), 'utf8')) : {};
  const carga = { v: 1, atualizada_em: cat.atualizada_em, vistos: cat.vistos || null, temas: cat.temas, estudos: cat.estudos, fios: cat.fios || [], emblemas: emb, fontes_url: fontesDasCapas(cat.estudos) };
  const arquivos = new Map();
  arquivos.set(nomeDe(K, 'catalogo') + '.bin', sela(K, 'catalogo', JSON.stringify(carga)));
  let noApp = 0, bytesClaros = 0;
  for (const e of cat.estudos) {
    if (e.onde !== 'app') continue;
    const html = readFileSync(join(pasta, e.slug + '.html'), 'utf8');
    if (!/<html[\s>]/i.test(html)) throw new Error('Uma das páginas não é um documento HTML inteiro (falta <html>).');
    arquivos.set(nomeDe(K, 'estudo:' + e.slug) + '.bin', sela(K, 'estudo:' + e.slug, html));
    noApp++; bytesClaros += Buffer.byteLength(html);
  }
  if (arquivos.size !== noApp + 1) throw new Error('Dois nomes lógicos deram o mesmo nome de arquivo.');
  return { arquivos, resumo: { estudos: cat.estudos.length, noApp, bytesClaros } };
}

export function grava(arquivos, saida) {
  mkdirSync(saida, { recursive: true });
  let novos = 0, iguais = 0, apagados = 0, bytes = 0;
  for (const [nome, buf] of arquivos) {
    const p = join(saida, nome); bytes += buf.length;
    if (existsSync(p) && readFileSync(p).equals(buf)) { iguais++; continue; }
    writeFileSync(p, buf); novos++;
  }
  for (const f of readdirSync(saida)) if (f.endsWith('.bin') && !arquivos.has(f)) { unlinkSync(join(saida, f)); apagados++; }
  return { novos, iguais, apagados, bytes };
}

function principal() {
  const a = process.argv.slice(2), op = (n) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : null; };
  const pasta = op('fontes'), arqChave = op('chave'), saida = resolve(op('saida') || join(RAIZ, 'estudos/dados'));
  if (!pasta || !arqChave) { console.error('Uso: node scripts/estudos-cifra.mjs --fontes <pasta privada> --chave <arquivo> [--saida estudos/dados] [--nova-chave]'); process.exit(2); }
  if (resolve(pasta).startsWith(RAIZ + '/') || resolve(arqChave).startsWith(RAIZ + '/')) { console.error('As fontes e a chave não podem ficar dentro deste repositório, que é público.'); process.exit(2); }
  if (!existsSync(arqChave)) {
    if (!a.includes('--nova-chave')) { console.error('Não achei o arquivo da chave. Para criar uma nova, acrescente --nova-chave.'); process.exit(2); }
    mkdirSync(dirname(resolve(arqChave)), { recursive: true });
    writeFileSync(arqChave, b64u(randomBytes(32)) + '\n', { mode: 0o600 });
    console.log('Chave nova criada. Ela não aparece aqui: está só no arquivo indicado.');
  }
  const { arquivos, resumo } = monta(pasta, readFileSync(arqChave, 'utf8'));
  const r = grava(arquivos, saida);
  // o log não diz títulos: só contas
  console.log(`${resumo.estudos} estudos no catálogo, ${resumo.noApp} dentro do app (${(resumo.bytesClaros / 1024).toFixed(0)} KB antes de cifrar).`);
  console.log(`${arquivos.size} arquivos cifrados, ${(r.bytes / 1024).toFixed(0)} KB: ${r.novos} gravados, ${r.iguais} iguais, ${r.apagados} apagados.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { principal(); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
