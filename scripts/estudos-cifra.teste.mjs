// Teste do cofre do Estudos: cifra com scripts/estudos-cifra.mjs e abre com o mesmo estudos/cofre.js que o navegador usa.
// Tudo com um catálogo de mentira e uma chave feita na hora; nada particular entra aqui.
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { b64u, monta, grava, nomeDe, deriva, leChave, confere } from './estudos-cifra.mjs';
await import('../estudos/cofre.js');
const Cofre = globalThis.Cofre;
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const falha = async (p) => { try { await p; return ''; } catch (e) { return e.message; } };

const dir = await mkdtemp(join(tmpdir(), 'estudos-')), fontes = join(dir, 'fontes'), saida = join(dir, 'dados');
await mkdir(fontes);
const chave = b64u(randomBytes(32)), outra = b64u(randomBytes(32));
const TIT = 'Título Secretíssimo', PAG = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + TIT + '</title></head><body><h1 id="um">' + TIT + '</h1><p>' + 'Texto que ninguém de fora pode ler. '.repeat(40) + '</p></body></html>';
const cat = {
  atualizada_em: '2026-01-02', vistos: 3,
  temas: [{ id: 'um', cota: 'UM', nome: 'Tema Um' }, { id: 'dois', cota: 'DOIS', nome: 'Tema Dois' }],
  estudos: [
    { slug: 'titulo-secretissimo', titulo: TIT, tema: 'um', tipo: 'Estudo', data: '2026-01-02', onde: 'app', resumo: 'Resumo particular.', medida: '3 partes', dentro: [{ t: 'Parte um', h: 'um' }], falta: 'Nada.', capa: { bg: '#8A2027', fg: '#fff', ac: '#f0c', fonte: 'Marcellus', pilha: '"Marcellus",serif', peso: 400, larg: 0.54, emblema: 'livro' } },
    { slug: 'curso-la-fora', titulo: 'Curso Lá Fora', tema: 'dois', tipo: 'Curso', data: '2026-01-01', onde: 'claude', url: 'https://claude.ai/artifact/AbCdEf123', capa: { bg: '#111', fg: '#eee', ac: '#0c9', fonte: 'Bodoni Moda', pilha: '"Bodoni Moda",serif', peso: 500, larg: 0.5, estilo: 'italic' } }
  ],
  fios: [{ titulo: 'Um fio', texto: 'Liga os dois.', de: 'titulo-secretissimo', para: 'curso-la-fora' }]
};
await writeFile(join(fontes, 'catalogo.json'), JSON.stringify(cat));
await writeFile(join(fontes, 'emblemas.json'), JSON.stringify({ livro: "<path d='M1 1h2'/>" }));
await writeFile(join(fontes, 'titulo-secretissimo.html'), PAG);

const m = monta(fontes, chave), r = grava(m.arquivos, saida);
const arqs = (await readdir(saida)).sort();
ok(arqs.length === 2 && r.novos === 2 && m.resumo.noApp === 1, 'um arquivo para o catálogo e um para o estudo que fica no app (o do Claude não vira arquivo)');
ok(arqs.every(a => /^[A-Za-z0-9_-]{24}\.bin$/.test(a)), 'nomes de arquivo opacos, de 24 caracteres');

// nada legível nos arquivos
const tudo = Buffer.concat(await Promise.all(arqs.map(a => readFile(join(saida, a)))));
const acha = (s) => tudo.includes(Buffer.from(s, 'utf8')) || tudo.includes(Buffer.from(s, 'latin1'));
ok(!acha(TIT) && !acha('secretissimo') && !acha('Resumo particular') && !acha('claude.ai') && !acha('ninguém de fora'), 'título, slug, resumo, endereço e texto não aparecem nos arquivos');
ok(!arqs.some(a => a.includes('secret') || a.includes('catalogo')), 'o nome do arquivo não entrega o slug');

// o navegador (cofre.js) abre o que o script cifrou
const K = await Cofre.deriva(chave), Kn = deriva(leChave(chave));
ok(await Cofre.nomeDe(K, 'catalogo') === nomeDe(Kn, 'catalogo') && await Cofre.nomeDe(K, 'estudo:titulo-secretissimo') === nomeDe(Kn, 'estudo:titulo-secretissimo'), 'navegador e script chegam ao mesmo nome de arquivo');
const lido = async (logico, k = K) => Cofre.abre(k, logico, await readFile(join(saida, await Cofre.nomeDe(K, logico) + '.bin')));
const c = JSON.parse(await lido('catalogo'));
ok(c.v === 1 && c.estudos.length === 2 && c.estudos[0].titulo === TIT && c.estudos[1].url === cat.estudos[1].url && c.fios.length === 1 && c.emblemas.livro, 'catálogo volta inteiro: estudos, fios e emblemas');
ok(/family=Bodoni\+Moda:ital,wght@1,500/.test(c.fontes_url) && /family=Marcellus(&|$)/.test(c.fontes_url) && /&text=/.test(c.fontes_url), 'endereço das fontes das capas montado (itálico e peso certos, só as letras dos títulos)');
ok(await lido('estudo:titulo-secretissimo') === PAG, 'a página do estudo volta byte a byte');

// chave errada, arquivo trocado, arquivo mexido
ok(await falha(lido('catalogo', await Cofre.deriva(outra))) === 'chave', 'outra chave não abre');
const bCat = await readFile(join(saida, await Cofre.nomeDe(K, 'catalogo') + '.bin')), bEst = await readFile(join(saida, await Cofre.nomeDe(K, 'estudo:titulo-secretissimo') + '.bin'));
ok(await falha(Cofre.abre(K, 'catalogo', bEst)) === 'chave' && await falha(Cofre.abre(K, 'estudo:titulo-secretissimo', bCat)) === 'chave', 'um arquivo posto no lugar do outro não abre');
const mexido = Buffer.from(bEst); mexido[mexido.length - 20] ^= 1;
ok(await falha(Cofre.abre(K, 'estudo:titulo-secretissimo', mexido)) === 'chave', 'um bit mexido e o arquivo não abre');
ok(await falha(Cofre.abre(K, 'catalogo', Buffer.from('<!doctype html><html>página de erro</html>'))) === 'formato', 'uma página de erro no lugar do arquivo é recusada pelo formato');

// busca pelo fetch: 404 e rede
const fetchDe = (resp) => { globalThis.fetch = async (u) => resp(String(u)); };
fetchDe(async (u) => { const n = u.split('/').pop(); try { return new Response(await readFile(join(saida, n))); } catch { return new Response('', { status: 404 }); } });
ok(await Cofre.busca(K, 'estudo:titulo-secretissimo', 'https://x/estudos/dados/') === PAG, 'busca: acha o arquivo pelo nome e abre');
ok(await falha(Cofre.busca(K, 'estudo:nao-existe', 'https://x/estudos/dados/')) === 'nao-achei', 'busca: estudo que não existe vira "nao-achei"');
fetchDe(async () => { throw new Error('caiu'); });
ok(await falha(Cofre.busca(K, 'catalogo', 'https://x/')) === 'rede', 'busca: queda de rede vira "rede"');

// rodar de novo não muda nada; mudar um estudo muda só o arquivo dele; tirar um estudo apaga o arquivo
const r2 = grava(monta(fontes, chave).arquivos, saida);
ok(r2.novos === 0 && r2.iguais === 2 && r2.apagados === 0, 'rodar de novo sem mudar nada não regrava (mesmos bytes)');
await writeFile(join(fontes, 'titulo-secretissimo.html'), PAG.replace('ninguém', 'quase ninguém'));
const r3 = grava(monta(fontes, chave).arquivos, saida);
ok(r3.novos === 1 && r3.iguais === 1, 'mudar a página regrava só o arquivo dela');
cat.estudos[0].onde = 'claude'; cat.estudos[0].url = 'https://claude.ai/artifact/Zz9'; await writeFile(join(fontes, 'catalogo.json'), JSON.stringify(cat));
const r4 = grava(monta(fontes, chave).arquivos, saida);
ok(r4.apagados === 1 && (await readdir(saida)).length === 1, 'estudo que sai do app tem o arquivo apagado');

// chave nova muda todos os nomes
const m5 = monta(fontes, outra);
ok(![...m5.arquivos.keys()].some(n => arqs.includes(n)), 'com outra chave, os nomes dos arquivos são outros');

// conferência do catálogo e leitura da chave
const ruim = JSON.parse(JSON.stringify(cat)); ruim.estudos[0].slug = 'Com Espaço'; ruim.estudos[1].tema = 'xyz'; ruim.fios[0].para = 'sumiu';
ok(confere(ruim, fontes).length >= 3, 'catálogo com slug ruim, tema que não existe e fio solto é recusado');
ok(await falha((async () => monta(fontes, 'curta'))()) !== '', 'chave fora do formato é recusada pelo script');
const L = Cofre.limpaChave;
ok(L(chave) === chave && L('  ' + chave + '\n') === chave && L('https://estudos.madeinbr.app/#k=' + chave) === chave && L('https://x/y?a=1#k=' + chave) === chave, 'a porta aceita a chave pura ou o link-chave inteiro');
ok(L('') === null && L('abc') === null && L(chave + 'x') === null && L('#k=' + chave + 'x') === null && L(chave.slice(1)) === null, 'e recusa o que não tem cara de chave');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
