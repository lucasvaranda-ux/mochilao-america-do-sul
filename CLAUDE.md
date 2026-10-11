# CLAUDE.md — Projeto Mochilão América do Sul

Contexto pro Claude Code continuar este projeto de onde paramos no Cowork.

## Estado compartilhado (Supabase, não Notion)

Fonte da verdade da viagem: tabela **`public.mochilao_peru_rota`** no projeto
Supabase **`madeinbr`** (`irawlnmcinqkxzgczmrb`). Substitui a antiga página do
Notion — o Claude tem acesso direto a essa tabela por ferramenta, então não é
preciso intermediário.

É um **log append-only**: cada gravação insere uma versão nova.
- **Ler** = pegar a linha mais recente do `slug` (`order by criado_em desc limit 1`).
- **Escrever** = `insert` de uma linha nova. Nunca `update`/`delete`
  (as policies do `anon` nem permitem — o histórico é imutável).

Colunas: `slug` (padrão `lucas`), `origem` (`site` | `claude`), `nota` (recado
livre em texto), `estado` (jsonb: `inicio`, `rota`, `noites`, `volta`, `_idx`,
`_dias`).

Antes de responder qualquer coisa sobre a viagem, ler a versão mais recente.
Depois de qualquer decisão, reserva ou mudança de rota, inserir uma versão nova
com `origem='claude'` e uma `nota` explicando o que mudou.
Se o usuário contradisser o registro, o usuário vence — e grava-se a correção.

O `peru.html` lê e grava nessa mesma tabela (chave anon pública, protegida por
RLS), então a rota do Lucas viaja entre aparelhos e é legível de fora.

## O que é

App de **página única** (`index.html`) — um guia de viagem interativo, personalizado pro Lucas, pra um mochilão de ~90 dias pela América do Sul (Colômbia → Equador → Peru → Bolívia → Chile → Argentina → Uruguai). Tudo (HTML + CSS + JS) está num único arquivo, sem build.

O conteúdo foi montado a partir do perfil do Lucas (interesses: natureza, espiritualidade, cultura, gastronomia) e de pesquisa em guias de mochileiro.

## Como rodar

É um arquivo estático. Abrir direto no navegador funciona, mas o ideal é servir por HTTP (algumas APIs de imagem se comportam melhor):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000/index.html
```

Não há build nem bundler. A única dependência npm é o SDK da Anthropic, usado só pela função `api/telas-perguntar.mjs` (a Vercel instala no deploy).

## Estrutura do arquivo

Tudo em `index.html`:
- `<style>` — tema escuro com variáveis CSS em `:root` (--bg, --accent, etc.).
- HTML das 5 abas: Perfil, Roteiro, Datas, Finanças, Compras (cada uma é `<section class="tabpanel" id="tab-...">`).
- `<script>` no fim, dividido em blocos comentados (`// ---------- NOME ----------`).

### Dados (editar aqui pra mudar conteúdo)
- `stops` — array das 20 paradas do roteiro. Cada objeto: `n, name, pais, flag, coord:[lat,lng], wiki, dias, tag, vibe, bairros, ver:[], nat:[], hostels:[], comer:[], custo, trans`.
- `finStops` — custo/dia (`cd`) + tours marcantes (`ex:[[label,valor]]`) por parada (chave = `n` da parada). A aba Finanças é **gerada a partir do roteiro** via `buildFinModel()`.
- `finPre` (pré-viagem), `finTrans` (voos internos) — linhas fixas das finanças.
- `shopItems` — 14 produtos reais da aba Compras: `nome, cat, why, preco, emoji, kw:[], link` (link = página oficial do produto).

### Lógica
- `initMap()` — inicializa o mapa Leaflet de forma **preguiçosa** (só quando a aba Roteiro abre) e **guardada** em try/catch. Se o Leaflet/CDN falhar, mostra aviso e o resto segue funcionando.
- `openModal(i)` — abre o guia completo de uma parada num modal.
- `buildFin()/calcFin()/saveFin()` — tabela editável planejado×realizado; persiste em `localStorage` na chave `mochilao_fin_v3`.
- `buildCrono()` — gera o cronograma com datas a partir da data de saída (input `#dep-date`).
- `loadWiki()` — busca foto de cada destino na API REST da Wikipedia.
- `loadCommons()` — busca foto dos produtos na API do Wikimedia Commons (tenta marca, depois categoria; fallback = emoji).
- `showTab()` — controla as abas; chama `initMap()` ao abrir o Roteiro.

## Página /telas (filmes e séries)

`telas.html` é uma página separada do roteiro (mesmo padrão do `peru.html`: arquivo único, JS puro, try/catch por bloco). Lista top 100 filmes e top 100 séries com porcentagem de conexão, nota pessoal 0–100, status e calendário de episódios.

- **Dados públicos:** `telas/dados.json` — títulos, notas de IMDb/RT/Metacritic/Letterboxd, críticos, visão do autor, leitura arquetípica, as 9 dimensões e seus pesos. É gerado a partir de uma pesquisa cuja versão completa (com as pontes pessoais) fica no repositório **privado** `caminho`, em `contexto/telas/DOSSIE.md`. **Nunca** colocar aqui nada além de tema: nada de nomes de pessoas da vida do Lucas, diário, sonhos, áudio ou mensagens privadas.
- **Estado do usuário** (notas, status, pesos): `localStorage`, chave `telas_v1`, com backup/restauração em JSON na aba Backup.
- **Robô de episódios:** `.github/workflows/telas-episodios.yml` roda `scripts/telas-episodios.mjs` todo dia (cron só roda no `main`). Busca no TVmaze pelo IMDb ID, grava `telas/episodios.json` e `telas/lancamentos.ics`, e manda e-mail via Resend se existirem os segredos `RESEND_API_KEY` e `ALERT_EMAIL`. O e-mail do Lucas fica **só** no segredo, nunca no código.
- **Onde assistir:** o mesmo workflow roda `scripts/telas-streaming.mjs`, que consulta a API do TMDB (dados do JustWatch) e grava `telas/streaming.json` com assinatura, grátis, com anúncios, aluguel e compra no Brasil. Só regrava quando algo muda. Precisa do segredo `TMDB_API_KEY`; sem ele, não faz nada e a página mostra um link de busca no JustWatch. Se o passo falhar, os episódios ainda são salvos e a execução fica vermelha.
- **Coleções (abas Desligar e Repetidos):** `dados.json` tem `colecoes` (`desligar`, `repetidos`, cada uma com a lista `itens` de ids) e `extras` (séries, filmes avulsos e sagas que não estão no top 100: `tipo` é `"serie"`, `"filme"` ou `"saga"`, e a saga traz a lista `filmes`). Um id de coleção pode ser de `filmes`, `series` ou `extras`. O que o Lucas acrescenta ou tira na página, o contador de vezes e a nota de fase ficam só no aparelho (`telas_v1`: `col`, `livres`, `vezes`, `fase`) e vão no backup. Quando ele pedir um título novo no chat, entra em `extras` (com IMDb conferido) e no `itens` da coleção. O robô de streaming também consulta os `extras`.
- **Catálogo (`telas/catalogo.json`, público):** 965 títulos (610 filmes, 355 séries) só com dados de obra: `id, tipo` (`filme`/`serie`), `titulo, titulo_original, titulo_en, ano` (e `anos` em séries), `autor` (direção ou criação), `pais, generos:[]`, `pop` (1 a 5, quão conhecido é no Brasil), `dims` (as 9 dimensões, na mesma régua de `dados.json`) e, em alguns, `imdb_id`. Nunca nada pessoal do Lucas. Os ids não repetem os de `dados.json`; título+ano+tipo também não. As 14 séries acrescentadas para Desligar (American Dad!, Bob's Burgers, Archer, Big Mouth, O Rei do Pedaço, Inside Job, Final Space, Smiling Friends, Krapopolis, Georgie & Mandy's First Marriage, Mike & Molly, Frasier, Arrested Development, It's Always Sunny in Philadelphia) entraram sem busca na web (a cota tinha acabado): conferir título no Brasil e IMDb quando der. Também traz `sugestoes.desligar` e `sugestoes.repetidos`: listas de `{id, membro, por_que}` (o id pode ser do catálogo ou de `dados.json`; `membro` é o id do título da coleção a que a sugestão se liga, usado no rodízio). Os `extras` de `dados.json` têm `dims` e `generos`, e os 206 títulos da página também têm `generos` (mesmo vocabulário do catálogo; se o `dados.json` for regerado, manter esse campo).
- **Aba Avaliar:** junta o catálogo com os 206 títulos de `dados.json`, as séries de `extras` (Rick and Morty, Friends...) e os filmes das sagas de `extras` (1.184, sem duplicar; os da página vêm primeiro e ganham `pop` pelos votos do IMDb; os das coleções, pop 5). Filme de saga que não está na página nem no catálogo herda da saga país, gêneros e dimensões (`SAGAF`, que `achar()` também consulta). Lista paginada (12 por padrão; 10, 20, 50), começando pelos mais conhecidos e alternando filme e série. A nota é sempre de 0 a 100, como no resto da página (pedido do Lucas, 11/10/2026): os botões mostram 10, 20… 100 (`data-n` = 1 a 10, grava `ST.notas[id] = n*10`) e o aviso traz "Ajustar", que abre um campo para a nota exata (ex.: 95; tecla A no computador; `notaRapida()`/`abreAjuste()`/`salvaAjuste()`). Grava também o status `assisti` (a não ser que esteja `acompanhando` ou `abandonei`); "Não vi" grava em `ST.naovi` (objeto id → 1); "Quero ver" põe status `quero`; tudo sem confirmar, com "Desfazer" por 7 s (4 s em ações seguidas); "Não vi" num título que já tem nota pede um segundo toque. O "Desfazer" volta só o que a ação mudou (nota, status, "não vi" dos ids dela e um passo próprio para "Pôr em" e "Não é pra mim"), e o aviso fecha ao trocar de aba. No celular o aviso fica no alto, logo abaixo das abas, e só o botão recebe toque; depois de uma nota pelo toque, a linha seguinte entra na tela. Teclado no computador: 1–9 (10 a 90) e 0 (100), A (nota exata), N, Q, U (desfaz), ↑↓ ou K/J, ←→ (página). Filtros: tipo, década, origem (Brasil, América Latina, EUA e Reino Unido, Europa, Ásia, outros, pela função `origem()`), "Para avaliar" / "Com nota" / "Não vi / quero ver", busca; ordem: mais conhecidos, aleatório (semente estável), parecidos com o que ele amou (cosseno com as notas 8+), sua nota. A fila é uma foto (`AV.lista`) tirada quando um filtro muda: o que ele avalia continua na página até trocar de filtro, para nada pular debaixo do dedo. Filtros da aba ficam em `ST.av` (a década só vale se existir na lista).
- **Seu gosto:** com 15 notas ou mais em títulos com dimensões, `gostoCalc()` ajusta as notas às 9 dimensões padronizadas por regressão linear com pesos não negativos e penalidade ridge (descida por coordenadas com projeção; lambda de 0,02·n a 30·n por validação cruzada em 5 partes), volta os coeficientes para a escala das dimensões e os converte em pesos de 0 a 30. `res.bom` só é verdadeiro quando o ajuste erra menos que o palpite pela média fora da amostra e a correlação em teste (`rCV`) passa de 0,3 e supera a dos pesos em uso em 0,05; aí "Usar pesos aprendidos" fica em destaque; senão o botão vira "Usar mesmo assim", discreto, com um aviso. O painel abre com uma frase ("suas notas sobem com..."), mostra o acerto em palavras (nenhum, fraco, médio, bom) com a correlação em letra menor, cada dimensão com a descrição curta, os pesos aprendidos ao lado dos em uso, médias por tipo, década, origem e gênero, surpresas (nota longe da prevista) e "Pode ser a sua cara" (10 sem nota, fora das coleções e dos filmes das sagas delas, de maior conexão com os pesos aprendidos se passaram no teste, senão com os em uso). "Usar pesos aprendidos" grava `ST.pesos` e guarda os anteriores em `ST.pesosAntes` (`{p: array ou null}`) para "Voltar aos anteriores". Um resumo fica na aba Conexão. "Copiar resumo para o Claude" gera texto com as nove dimensões e o que cada uma quer dizer, notas por título (com mais de 150, só as de 9 e 10 e de 1 a 4, e o meio resumido), "não vi" e "quero ver" pelo nome, pesos, acerto, médias, surpresas, "Pode ser a sua cara", coleções com nota, fase e vezes, e o que ele escondeu como "Não é pra mim", para colar no chat.
- **Importar notas:** CSV do Letterboxd (`ratings.csv`: Name, Year, Rating de 0,5 a 5 → ×20) e do IMDb (Const, Your Rating, Title, Original Title, Year, Title Type → ×10; episódios ignorados). Casa pelo código IMDb (títulos da página têm `imdb_id`), depois pelo título normalizado (sem acento e pontuação) em `titulo`, `titulo_original` e `titulo_en`, com o ano exato ou ±1; se só casar sem o artigo inicial, exige o ano exato. O artigo tirado é só o da língua do campo (o/a/os/as/um/uma no `titulo`; the/a/an em `titulo_en`, `titulo_original` e no Name do Letterboxd), para "Die Hard" não virar "Hard". Arquivo com aspa sem fechar dá erro em vez de "0 de 0". Mostra o que casou para revisar (notas já existentes vêm desmarcadas) antes de gravar.
- **Sugestões em Desligar e Repetidos:** abaixo dos títulos dele, 6 de cada vez ("Mais sugestões"), com um atalho "Ver as N sugestões ↓" logo abaixo da abertura da aba (no celular elas ficam depois da primeira tela). Ordem: (1) até 6 já vistos com nota 70 ou mais que estão perto de algum título da coleção, com o selo "você deu 90"; (2) as fixas de `catalogo.json > sugestoes`, em rodízio pelo `membro` (uma de Rick and Morty, uma de Os Simpsons, uma de Big Bang...); (3) até 12 automáticas ("parecido pelo cálculo"), também em rodízio: para cada título da coleção, o candidato mais perto dele, e o motivo cita só esse título. Em Desligar, só comédia (comédia, sitcom, sátira, paródia), e pesam mais gêneros em comum, animação ou não, série ou filme e o pop, com desconto para família/infantil e gêneros pesados que o membro não tem; em Repetidos, pesam mais as nove dimensões. Ficam de fora o que está na coleção, o que ele escondeu, o que viu e não gostou (nota abaixo de 6 ou "abandonei") e os filmes das sagas da coleção; o que ele acompanha aparece com "você acompanha" e o botão "Dar nota". Se o catálogo não carregar, a aba avisa, as automáticas usam os títulos da página, e um título do catálogo que já está na coleção vira cartão provisório (nome tirado do id) em vez de sumir. Botões: "Pôr em Desligar/Repetidos" (`adicionarId()`, a mesma do campo Adicionar, que agora reconhece ids e títulos do catálogo), "Já vi" (nota rápida de 10 a 100, com "Ajustar") e "Não é pra mim" (`ST.sugOcultas[col]`, lista de ids; tem "voltar a mostrar"). O robô de streaming também consulta as sugestões fixas do catálogo, e os cartões mostram onde assistir quando há dado.
- **Backup:** leva o `ST` inteiro (versão 2), inclusive `naovi`, `sugOcultas`, `pesosAntes` e `av`; a restauração devolve tudo isso. Na carga do aparelho e na restauração (`restauraTudo`), só entra o que tem o formato certo: notas numéricas de 0 a 100 (arredondadas), status entre os quatro conhecidos, pesos com 9 números de 0 a 30; o resto é descartado. `card()` e `renderPesos()` também passam esses valores por `esc()`.
- **Perguntar (caixa de IA):** aba "Perguntar" do `telas.html` + função da Vercel `api/telas-perguntar.mjs` (única dependência npm do repo: `@anthropic-ai/sdk`, em `package.json`). A página monta o contexto no navegador (notas agrupadas por valor, inclusive as do catálogo; status, com "assisti" só para os vistos sem nota; "não vi" do catálogo, até 150; o gosto calculado, com `aprendidos_passaram_no_teste`; coleções com vezes e fase; pesos; mais conectados; serviços; a lista com ids) e manda com a pergunta (a função só aceita as chaves de `CHAVES_CONTEXTO` e até 60 mil caracteres). Se passar de 56 mil, `cortaContexto()` corta em camadas: "não vi" além de 30, notas de 40 a 70, listas de status e biblioteca, notas de 71 a 79 e de 20 a 39, o resto do "não vi", notas de 80+ e abaixo de 20, e por último a lista de ids; grupo de notas cortado ganha `e_mais`, lista cortada termina com "(e mais N, cortados pelo tamanho)", e o `SISTEMA` da função explica isso; a função chama o Claude (`claude-opus-5-5`, effort `medium`, `fallbacks: "default"`) e devolve a resposta pela ferramenta estrita `indicar`. Busca na web só quando o usuário marca a opção. Variáveis no projeto da Vercel, **nunca no código**: `ANTHROPIC_API_KEY` e `TELAS_SENHA` (a página manda a senha no cabeçalho `x-telas-senha`; fica só no `sessionStorage`, fora do backup). A senha deve ser longa e aleatória (ex.: `openssl rand -base64 24`), e a chave deve ficar num workspace do Console da Anthropic com limite de gasto mensal — é o único teto de custo garantido. Freios em memória: 8 senhas erradas e 30 perguntas por hora por IP. `maxDuration` 300 s em `vercel.json` (exige Fluid Compute, padrão em projetos novos); cada chamada usa só o tempo que sobra, sem nova tentativa automática.
- **Segurança do `peru.html`:** o que vem da tabela pública do Supabase (`_idx`, `_dias`, `inicio`) passa por `limpaIdx`/`limpaDias`/`limpaData` antes de qualquer uso — a tabela aceita insert anônimo, e antes um texto gravado lá chegava ao `innerHTML` (XSS no domínio inteiro).
- **Títulos em inglês:** campo `titulo_en` de cada título em `dados.json` (conferido por busca em 05/10/2026). Se o `dados.json` for regerado, manter esse campo.
- **O que o robô acompanha:** séries com status "em exibição"/"renovada" em `dados.json` (calendário geral) e as de `telas/acompanhando.json` (alertas e calendário assinável). A página gera essa lista pronta pra colar.

## Dependências de runtime (precisam de internet)
- **Leaflet** 1.9.4 (unpkg) + tiles do **CARTO** — mapa.
- **API REST da Wikipedia** — fotos dos destinos.
- **API do Wikimedia Commons** — fotos dos produtos.

## Convenções e cuidados
- Cada bloco grande de JS está em try/catch por iteração pra que uma falha isolada não derrube as abas. **Manter esse padrão** ao adicionar código.
- Sem frameworks: JS puro (vanilla). Manter assim.
- Câmbio base usado nas estimativas: US$ 1 ≈ R$ 5,00 (maio/2026). Preços são estimativas 2025–2026.
- Datas/idioma: tudo em pt-BR.

## Ideias de próximos passos (pendências/possíveis)
- Embutir as fotos reais dos produtos localmente (baixar imagens) em vez de depender das APIs.
- Exportar o orçamento (Finanças) pra CSV/Excel.
- Modo offline real (cachear tiles/imagens).
- Opcional: separar em arquivos (index.html + css + js + data.js) se o arquivo único ficar grande demais.
