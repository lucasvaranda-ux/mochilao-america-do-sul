// Teste do robô de notas por episódio com bases falsas (gzip na memória).
import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executar } from './telas-eps-notas.mjs';
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const dir = await mkdtemp(join(tmpdir(), 'epsn-')); await mkdir(join(dir, 'telas/eps-notas'), { recursive: true });
for (const f of ['catalogo.json', 'dados.json']) await copyFile(join('telas', f), join(dir, 'telas', f));
// The Gentlemen (tt13210838) é série da página; tt0133093 (Matrix) é filme e não pode entrar
const EPS = 'tconst\tparentTconst\tseasonNumber\tepisodeNumber\ntt9000002\ttt13210838\t1\t2\ntt9000001\ttt13210838\t1\t1\ntt9000003\ttt13210838\t2\t1\ntt9000004\ttt13210838\t\\N\t\\N\ntt9000005\ttt0133093\t1\t1\n';
let NOTAS = 'tconst\taverageRating\tnumVotes\ntt9000001\t8.4\t12345\ntt9000002\t7.9\t11000\ntt9000003\t8.8\t9000\ntt9000004\t9.9\t100\ntt9000005\t5\t10\n';
const fetchFn = async u => new Response(gzipSync(/episode/.test(u) ? EPS : NOTAS));
await writeFile(join(dir, 'telas/eps-notas/tt0000001.json'), '{}\n');
const r = await executar({ raiz: dir, fetchFn, log: () => {} });
const arq = join(dir, 'telas/eps-notas/tt13210838.json'), j = JSON.parse(await readFile(arq, 'utf8'));
ok(JSON.stringify(j) === '{"1":[[1,8.4,12000],[2,7.9,11000]],"2":[[1,8.8,9000]]}', 'The Gentlemen por temporada, em ordem, votos arredondados');
const fs = await readdir(join(dir, 'telas/eps-notas'));
ok(!fs.includes('tt0133093.json'), 'filme não entra');
ok(!fs.includes('tt0000001.json') && r.apagou === 1, 'série que saiu tem o arquivo apagado');
const r2 = await executar({ raiz: dir, fetchFn, log: () => {} });
ok(r2.gravou === 0, 'sem mudança, não regrava');
NOTAS = NOTAS.replace('8.8\t9000', '8.7\t9100');
const r3 = await executar({ raiz: dir, fetchFn, log: () => {} });
ok(r3.gravou === 1, 'nota mudou, regrava só aquela série');
const r4 = await executar({ raiz: dir, fetchFn: async () => new Response('x', { status: 503 }), log: () => {} });
ok(r4.codigo === 1 && r4.gravou === 0, 'IMDb fora: sai com erro sem mexer');
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
