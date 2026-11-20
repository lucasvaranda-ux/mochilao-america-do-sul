// Teste do estudo do Egito: os dados (egito/dados.json), as fotos, a hospedagem (middleware e vercel.json).
// Não usa rede. Rodar: node scripts/egito.teste.mjs
import { readFile, access, readdir } from 'node:fs/promises';
import middleware from '../middleware.js';

let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const raiz = new URL('..', import.meta.url);
const le = async p => readFile(new URL(p, raiz), 'utf8');
const existe = async p => access(new URL(p, raiz)).then(() => true, () => false);

const D = JSON.parse(await le('egito/dados.json'));
const pagina = await le('egito.html');
const V = JSON.parse(await le('vercel.json'));

// ---------- dados ----------
const ERAS = ['moderno', 'islamico', 'classico', 'faraonico', 'prehist', 'profundo', 'nilo'];
ok(Array.isArray(D.camadas) && D.camadas.length === 27, '27 camadas (' + D.camadas.length + ')');
ok(D.camadas[0].id === 'hoje' && D.camadas[D.camadas.length - 1].id === 'nilo', 'começa em "hoje" e termina no Nilo');
ok(new Set(D.camadas.map(c => c.id)).size === D.camadas.length && D.camadas.every(c => /^[a-z][a-z0-9-]+$/.test(c.id)), 'ids únicos e simples');
ok(D.camadas.every(c => ERAS.includes(c.era)), 'toda camada tem uma era conhecida');
ok(D.camadas.map(c => ERAS.indexOf(c.era)).every((e, i, a) => i === 0 || e >= a[i - 1]), 'as eras descem em ordem, sem voltar');
let desce = true;
for (let i = 1; i < D.camadas.length - 1; i++) { const a = D.camadas[i - 1], b = D.camadas[i]; if (!(b.fim <= a.fim && b.inicio <= a.inicio)) desce = false; }
ok(desce, 'cada camada é mais antiga que a de cima (início e fim)');
ok(D.camadas.every(c => c.titulo && c.periodo_txt && c.resumo && c.resumo.length > 120), 'título, período e resumo em todas');
ok(D.camadas.every(c => c.fatos.length >= 8), 'pelo menos 8 fatos por camada (mínimo: ' + Math.min(...D.camadas.map(c => c.fatos.length)) + ')');
const fatos = D.camadas.flatMap(c => c.fatos);
ok(fatos.every(f => f.titulo && f.texto && f.texto.length > 60 && (f.ano_txt || f.ano != null)), 'todo fato tem título, texto e data (' + fatos.length + ' fatos)');
ok(fatos.every(f => ['alta', 'media', 'baixa'].includes(f.certeza)), 'todo fato tem grau de conferência');
ok(fatos.every(f => f.fonte && f.fonte.length > 2), 'todo fato cita a fonte');
ok(fatos.filter(f => f.certeza !== 'alta').every(f => f.ressalva && f.ressalva.length > 10), 'fato não conferido por inteiro explica o que ficou de fora');
const naoHttps = [];
const vistaUrl = u => { if (u != null && !/^https:\/\/[^\s<>"']+$/.test(u)) naoHttps.push(u); };
fatos.forEach(f => vistaUrl(f.url)); D.camadas.forEach(c => c.numeros.forEach(n => vistaUrl(n.url))); (D.fontes || []).forEach(f => vistaUrl(f.url));
(D.creditos || []).forEach(f => { vistaUrl(f.pagina); vistaUrl(f.licenca_url || null); });
ok(naoHttps.length === 0, 'todo endereço é https (' + naoHttps.slice(0, 3).join(' ') + ')');
ok(D.camadas.every(c => c.numeros.every(n => n.rotulo && n.valor != null && String(n.valor).length > 0)), 'números com rótulo e valor');
ok(D.camadas.every(c => c.onde.length >= 3 && c.onde.every(o => o.lugar)), 'pelo menos 3 lugares para ver em cada camada');
const coord = D.camadas.flatMap(c => c.onde).filter(o => o.lat != null || o.lon != null);
ok(coord.every(o => typeof o.lat === 'number' && typeof o.lon === 'number' && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180), 'coordenadas válidas (' + coord.length + ')');
ok(coord.filter(o => o.lat >= 21.5 && o.lat <= 32 && o.lon >= 24.5 && o.lon <= 37).length >= coord.length * 0.75, 'a maior parte dos lugares fica dentro do Egito');
const texto = JSON.stringify(D);
ok(!/<script|javascript:|onerror=|<iframe/i.test(texto), 'nada com cara de código dentro dos dados');
ok(!/—/.test(D.camadas.map(c => c.resumo).join(' ')), 'resumos sem travessão');
for (const id of ['populacao', 'escritas', 'religioes', 'descobertas', 'nilo']) ok(D.series && D.series[id] && (D.series[id].pontos || D.series[id].itens || []).length >= 5, 'série ' + id + ' com dados');
ok(D.series.descobertas.nao_sabemos.length >= 5, '"o que ainda não sabemos" tem conteúdo');
ok((D.entre || []).every(x => D.camadas.some(c => c.id === x.depois)), 'cada interlúdio aponta para uma camada que existe');

// ---------- fotos ----------
const fotos = D.camadas.flatMap(c => (c.fotos || []).map(f => ({ ...f, camada: c.id })));
let faltaArq = 0; for (const f of fotos) if (!(await existe('egito/img/' + f.arquivo))) faltaArq++;
ok(faltaArq === 0, 'todo arquivo de foto citado existe (' + fotos.length + ' fotos)');
ok(fotos.every(f => /^[a-z0-9-]+\.webp$/.test(f.arquivo)), 'nomes de arquivo simples, em webp');
ok(fotos.every(f => f.autor && f.licenca && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(f.pagina || '')), 'toda foto tem autor, licença e a página de origem');
ok(fotos.every(f => /dom[ií]nio p[úu]blico|public domain|^PD|CC0|CC BY/i.test(f.licenca)), 'só licenças livres (domínio público, CC0, CC BY, CC BY-SA)');
ok(fotos.every(f => f.legenda && f.legenda.length > 8), 'toda foto tem legenda');
const comFoto = D.camadas.filter(c => (c.fotos || []).length).length;
ok(comFoto >= 20, 'pelo menos 20 camadas com foto (' + comFoto + ' de 27)');
if (await existe('egito/img')) {
  const arqs = (await readdir(new URL('egito/img/', raiz))).filter(n => n.endsWith('.webp'));
  const usados = new Set(fotos.map(f => f.arquivo));
  ok(arqs.every(n => usados.has(n)), 'nenhuma foto sobrando na pasta sem crédito (' + arqs.filter(n => !usados.has(n)).slice(0, 3).join(', ') + ')');
}

// ---------- página ----------
ok(/<html lang="pt-BR">/.test(pagina) && /<meta name="robots" content="noindex">/.test(pagina), 'página em pt-BR, fora dos buscadores');
for (const a of ['/egito/egito.css', '/egito/base.js', '/egito/pagina.js', '/egito/pecas/mapa.js', '/egito/pecas/graficos.js', '/egito/pecas/cenas.js', '/egito/pecas/profundo.js']) {
  ok(pagina.includes(a) && await existe(a.slice(1)), 'a página carrega ' + a + ' e o arquivo existe');
}
const js = (await le('egito/pagina.js')) + (await le('egito/base.js'));
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js), 'a página não monta HTML a partir de texto (só textContent)');
const pecasDoc = new Set([...D.camadas.flatMap(c => c.pecas || []), ...(D.entre || []).map(x => x.peca), 'mapa']);
const pecasJs = (await Promise.all(['mapa', 'graficos', 'cenas', 'profundo'].map(n => le('egito/pecas/' + n + '.js')))).join('\n');
const registradas = new Set([...pecasJs.matchAll(/\.peca\(\s*'([a-z-]+)'/g)].map(m => m[1]));
ok([...pecasDoc].every(p => registradas.has(p)), 'toda peça pedida pelos dados existe (' + [...pecasDoc].filter(p => !registradas.has(p)).join(', ') + ')');
ok(!/innerHTML\s*=\s*[^'"`]/.test(pecasJs.replace(/textContent/g, '')), 'as peças não põem texto dos dados como HTML');

// ---------- hospedagem ----------
const pedidos = [];
globalThis.fetch = async (u, o) => { pedidos.push({ u: String(u), h: (o && o.headers) || {} }); return new Response(pagina, { status: 200, headers: { 'content-type': 'text/html' } }); };
let r = await middleware(new Request('https://egito.madeinbr.app/'));
let html = await r.text();
ok(pedidos.length === 1 && pedidos[0].u === 'https://egito.madeinbr.app/egito' && pedidos[0].h['x-egito-interno'] === '1', 'na raiz de egito.madeinbr.app, o middleware busca /egito');
ok(/<title>Egito, de hoje para trás<\/title>/.test(html) && /og:image" content="https:\/\/egito\.madeinbr\.app\/egito\/og\.jpg"/.test(html), 'título e imagem da prévia do link');
ok(r.headers.get('x-robots-tag') === 'noindex', 'cabeçalho fora dos buscadores');
pedidos.length = 0;
r = await middleware(new Request('https://mochilao.madeinbr.app/'));
ok(pedidos.length === 0 && r.headers.get('x-middleware-next') === '1', 'no endereço do mochilão o middleware não faz nada');
r = await middleware(new Request('https://egitologia.exemplo.com/'));
ok(r.headers.get('x-middleware-next') === '1', 'um endereço que só começa parecido não vira o estudo');
const re = (src) => new RegExp('^' + src + '$');
const casaHost = (regra, host) => (regra.has || []).every(h => h.type !== 'host' || new RegExp('^' + h.value + '$').test(host));
const redir = (host, caminho, cab = {}) => { const x = V.redirects.find(q => casaHost(q, host) && (q.missing || []).every(m => !(m.key in cab)) && re(q.source).test(caminho)); return x ? x.destination : null; };
ok(redir('egito.madeinbr.app', '/egito') === '/' && redir('egito.madeinbr.app', '/telas') === '/' && redir('egito.madeinbr.app', '/egito', { 'x-egito-interno': '1' }) === null, 'no endereço do Egito, as páginas do repositório voltam para a raiz (menos a busca interna)');
ok(redir('egito.madeinbr.app', '/egito/dados.json') === null && redir('egito.madeinbr.app', '/egito/img/x.webp') === null, 'dados e fotos não são redirecionados');
ok(redir('mochilao.madeinbr.app', '/egito') === null && redir('inv.madeinbr.app', '/egito') === '/', 'no mochilão /egito abre; no Inv volta para a raiz');
ok(await existe('egito/icone.svg') && await existe('egito/icone-180.png') && await existe('egito/og.jpg'), 'ícones e imagem da prévia existem');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
