// Teste do robô de notas com um TSV falso (gzip na memória).
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executar, arredonda } from './telas-notas.mjs';
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const dir = await mkdtemp(join(tmpdir(), 'notas-')); await mkdir(join(dir, 'telas'));
for (const f of ['catalogo.json', 'dados.json']) await copyFile(join('telas', f), join(dir, 'telas', f));
const tsv = 'tconst\taverageRating\tnumVotes\ntt0499549\t7.9\t1412345\ntt0000001\t5.7\t2100\ntt0133093\t8.7\t2154321\n';
const fetchFn = async () => new Response(gzipSync(tsv));
const r = await executar({ raiz: dir, fetchFn, log: () => {} });
const j = JSON.parse(await readFile(join(dir, 'telas/notas.json'), 'utf8'));
ok(r.gravou && j.itens.tt0499549[0] === 7.9 && j.itens.tt0499549[1] === 1400000, 'Avatar: 7,9 com 1,4 milhão de votos (arredondado)');
ok(j.itens.tt0133093 && !j.itens.tt0000001, 'só os títulos que temos');
const r2 = await executar({ raiz: dir, fetchFn, log: () => {} });
ok(!r2.gravou, 'sem mudança, não regrava');
ok(arredonda(24312) === 24000 && arredonda(87) === 87 && arredonda(1234567) === 1200000, 'arredondamento a 2 algarismos');
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
