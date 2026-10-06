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
- **Perguntar (caixa de IA):** aba "Perguntar" do `telas.html` + função da Vercel `api/telas-perguntar.mjs` (única dependência npm do repo: `@anthropic-ai/sdk`, em `package.json`). A página monta o contexto no navegador (notas, status, coleções com vezes e fase, pesos, mais conectados, serviços, a lista com ids) e manda com a pergunta; a função chama o Claude (`claude-opus-5-5`, effort `medium`, `fallbacks: "default"`) e devolve a resposta pela ferramenta estrita `indicar`. Busca na web só quando o usuário marca a opção. Variáveis no projeto da Vercel, **nunca no código**: `ANTHROPIC_API_KEY` e `TELAS_SENHA` (a página manda a senha no cabeçalho `x-telas-senha`; fica em `localStorage` `telas_ia_senha`, fora do backup). Limite de 30 perguntas por hora por IP e `maxDuration` 60 s em `vercel.json`.
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
