// Teste da hospedagem do Estudos: o middleware (raiz do endereço abre a porta) e as regras do vercel.json
// (redirecionamentos, a reescrita de /slug para o leitor, cabeçalhos). Não usa rede nem nada particular.
import { readFile, readdir } from 'node:fs/promises';
import middleware, { config } from '../middleware.js';

let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const raiz = new URL('..', import.meta.url);
const pagina = await readFile(new URL('estudos.html', raiz), 'utf8');
const leitor = await readFile(new URL('estudos/ler.html', raiz), 'utf8');
const V = JSON.parse(await readFile(new URL('vercel.json', raiz), 'utf8'));

// ---------- middleware ----------
const pedidos = [];
globalThis.fetch = async (u, o) => { pedidos.push({ u: String(u), h: (o && o.headers) || {} }); return new Response(String(u).endsWith('/estudos') ? pagina : '<title>x</title>', { status: 200, headers: { 'content-type': 'text/html' } }); };
ok(JSON.stringify(config.matcher) === '["/"]', 'o middleware só roda na raiz');
let r = await middleware(new Request('https://estudos.madeinbr.app/'));
let html = await r.text();
ok(pedidos.length === 1 && pedidos[0].u === 'https://estudos.madeinbr.app/estudos' && pedidos[0].h['x-estudos-interno'] === '1', 'na raiz do Estudos, busca /estudos com o cabeçalho interno');
ok(/<title>Estudos<\/title>/.test(html) && /og:title" content="Estudos"/.test(html) && /og:description" content="Estante particular\."/.test(html), 'título e prévia do link genéricos');
ok(html.includes('id="porta"') && html.includes('/estudos/cofre.js') && /noindex, nofollow/.test(html), 'a página servida é a porta, fora dos buscadores');
ok(r.headers.get('x-robots-tag') === 'noindex, nofollow' && r.headers.get('x-frame-options') === 'DENY' && r.headers.get('referrer-policy') === 'no-referrer', 'cabeçalhos de proteção na resposta do middleware');
ok(/must-revalidate/.test(r.headers.get('cache-control') || ''), 'a porta não fica velha no cache');
pedidos.length = 0;
r = await middleware(new Request('https://estudos-git-teste-conta.vercel.app/'));
ok(pedidos.length === 1 && pedidos[0].u.endsWith('/estudos'), 'endereço de teste que começa com "estudos-" também abre o app');
pedidos.length = 0;
r = await middleware(new Request('https://inv.madeinbr.app/'));
ok(pedidos[0].u === 'https://inv.madeinbr.app/inv' && !r.headers.get('x-frame-options'), 'o Inv continua igual');
pedidos.length = 0;
r = await middleware(new Request('https://whatch.madeinbr.app/'));
ok(pedidos[0].u === 'https://whatch.madeinbr.app/telas', 'o Whatch continua igual');
pedidos.length = 0;
r = await middleware(new Request('https://mochilao.madeinbr.app/'));
ok(pedidos.length === 0 && r.headers.get('x-middleware-next') === '1', 'no endereço do mochilão o middleware não faz nada');
r = await middleware(new Request('https://estudosdealguem.exemplo.com/'));
ok(r.headers.get('x-middleware-next') === '1', 'um endereço que só começa parecido não vira o app');
globalThis.fetch = async () => { throw new Error('caiu'); };
r = await middleware(new Request('https://estudos.madeinbr.app/'));
ok(r.headers.get('x-middleware-rewrite') === 'https://estudos.madeinbr.app/estudos', 'se a busca falhar, reescreve para /estudos');

// ---------- vercel.json ----------
// conversão mínima das fontes usadas neste arquivo (o formato inteiro é o path-to-regexp; aqui só o que as regras do Estudos usam)
const re = (src) => new RegExp('^' + src.replace(/\/:[a-z]+\(/g, '/(') + '$');
const casaHost = (regra, host) => (regra.has || []).every(h => h.type !== 'host' || new RegExp('^' + h.value + '$').test(host));
const faltaCab = (regra, cab) => (regra.missing || []).every(m => m.type !== 'header' || !(m.key in cab));
const redir = (host, caminho, cab = {}) => { const x = V.redirects.find(q => casaHost(q, host) && faltaCab(q, cab) && re(q.source).test(caminho)); return x ? x.destination : null; };
const reesc = (host, caminho) => { const x = (V.rewrites || []).find(q => casaHost(q, host) && re(q.source).test(caminho)); return x ? x.destination : null; };
const cabs = (host, caminho) => { const o = {}; V.headers.filter(q => casaHost(q, host) && re(q.source).test(caminho)).forEach(q => q.headers.forEach(h => { o[h.key.toLowerCase()] = h.value; })); return o; };
const E = 'estudos.madeinbr.app', P = 'estudos-git-teste-conta.vercel.app', M = 'mochilao.madeinbr.app';

ok(V.cleanUrls === true, 'endereços sem .html (o leitor é /estudos/ler)');
ok(redir(E, '/estudos') === '/' && redir(E, '/estudos.html') === '/' && redir(E, '/telas') === '/' && redir(E, '/inv') === '/' && redir(E, '/peru') === '/' && redir(E, '/index.html') === '/', 'no Estudos, as outras páginas do repositório voltam para a raiz');
ok(redir(E, '/estudos', { 'x-estudos-interno': '1' }) === null, 'a busca do middleware (com o cabeçalho interno) não é redirecionada');
ok(redir(E, '/estudos/ler') === null && redir(E, '/estudos/dados/abc.bin') === null && redir(E, '/estudos/cofre.js') === null && redir(E, '/um-estudo') === null, 'leitor, dados e scripts não são redirecionados');
ok(reesc(E, '/um-estudo') === '/estudos/ler' && reesc(E, '/outro-estudo-2') === '/estudos/ler' && reesc(P, '/um-estudo') === '/estudos/ler', '/slug abre o leitor no endereço do app e no de teste');
ok(reesc(E, '/') === null && reesc(E, '/um/dois') === null && reesc(E, '/arquivo.bin') === null && reesc(E, '/Um-Estudo') === null && reesc(E, '/-x') === null, 'a reescrita só pega um trecho de letras minúsculas, números e hífen');
ok(V.rewrites.length === 2 && V.rewrites[1].source === V.rewrites[0].source && V.rewrites[1].destination === '/estudos/ler.html' && JSON.stringify(V.rewrites[1].has) === JSON.stringify(V.rewrites[0].has), 'a mesma regra tem um segundo destino, com .html, para o caso de o primeiro não existir na hospedagem');
ok(/fetch\('\/rota-de-teste',\{method:'HEAD'/.test(pagina) && /\/estudos\/ler\?e=/.test(pagina), 'a estante confere a regra /slug e, se ela não responder, usa o leitor com ?e=');
ok(reesc(M, '/um-estudo') === null && reesc('inv.madeinbr.app', '/um-estudo') === null && reesc('whatch.madeinbr.app', '/um-estudo') === null, 'nos outros endereços não há reescrita');
ok(redir('inv.madeinbr.app', '/estudos') === '/' && redir('whatch.madeinbr.app', '/estudos') === '/' && redir(M, '/estudos') === null, 'no Inv e no Whatch, /estudos volta para a raiz deles');
ok(redir('inv.madeinbr.app', '/inv', { 'x-inv-interno': '1' }) === null && redir('inv.madeinbr.app', '/telas') === '/' && redir('whatch.madeinbr.app', '/telas', { 'x-whatch-interno': '1' }) === null, 'as regras do Inv e do Whatch seguem como eram');
let c = cabs(E, '/um-estudo');
ok(c['x-robots-tag'] === 'noindex, nofollow' && c['x-frame-options'] === 'DENY' && c['referrer-policy'] === 'no-referrer' && c['x-content-type-options'] === 'nosniff', 'no Estudos, toda resposta sai com os cabeçalhos de proteção');
const csp = c['content-security-policy'] || '';
ok(/default-src 'none'/.test(csp) && /connect-src 'self'(;|$)/.test(csp) && /script-src 'self' 'unsafe-inline'(;|$)/.test(csp) && /frame-ancestors 'none'/.test(csp) && /form-action 'none'/.test(csp) && !/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)/.test(csp), 'política de conteúdo: nada de script nem envio para fora, e a página não pode ser embutida em outro site (só as fontes do Google)');
const metaCsp = (h) => (h.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const dirs = (p) => Object.fromEntries(p.split(';').map(x => x.trim()).filter(Boolean).map(x => [x.split(/\s+/)[0], x.split(/\s+/).slice(1).sort().join(' ')]));
const dL = dirs(metaCsp(leitor)), dC = dirs(csp);
ok(Object.keys(dL).length >= 9 && Object.keys(dL).every(k => dC[k] === dL[k]), 'a política do cabeçalho é a mesma do leitor (mais a que impede embutir)');
ok(/connect-src 'self'/.test(metaCsp(pagina)) && /default-src 'none'/.test(metaCsp(pagina)) && !/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)/.test(metaCsp(pagina)), 'a porta traz a própria política, mais estreita');
ok(Object.keys(cabs(M, '/um-estudo')).length === 0 && !cabs(M, '/telas')['content-security-policy'], 'nos outros endereços, nada muda nos cabeçalhos');
ok(/immutable/.test(cabs(E, '/estudos/lib/d3-7.9.0.min.js')['cache-control']) && /must-revalidate/.test(cabs(E, '/estudos/dados/abc.bin')['cache-control']) && /must-revalidate/.test(cabs(M, '/estudos/ler')['cache-control']), 'cache: bibliotecas fixas, dados e leitor sempre conferidos');

// ---------- o que é público não entrega nada ----------
const publicos = [pagina, leitor, await readFile(new URL('estudos/cofre.js', raiz), 'utf8'), await readFile(new URL('estudos/manifest.webmanifest', raiz), 'utf8'), await readFile(new URL('middleware.js', raiz), 'utf8')].join('\n');
ok(!/claude\.ai\/artifact/.test(publicos) && !/[#&?]k=[A-Za-z0-9_-]{43}/.test(publicos), 'página, leitor, cofre e middleware não trazem endereço de artefato nem chave');
const dados = await readdir(new URL('estudos/dados/', raiz));
ok(dados.length >= 1 && dados.every(n => /^[A-Za-z0-9_-]{24}\.bin$/.test(n)), 'a pasta de dados só tem arquivos cifrados de nome opaco (' + dados.length + ')');
let cab4 = true; for (const n of dados) { const b = await readFile(new URL('estudos/dados/' + n, raiz)); if (b.subarray(0, 4).toString('latin1') !== 'EST1' || b.length < 33) cab4 = false; }
ok(cab4, 'todo arquivo de dados começa com a marca do formato');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
