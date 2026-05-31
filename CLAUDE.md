# CLAUDE.md — Projeto Mochilão América do Sul

Contexto pro Claude Code continuar este projeto de onde paramos no Cowork.

## O que é

App de **página única** (`index.html`) — um guia de viagem interativo, personalizado pro Lucas, pra um mochilão de ~90 dias pela América do Sul (Colômbia → Equador → Peru → Bolívia → Chile → Argentina → Uruguai). Tudo (HTML + CSS + JS) está num único arquivo, sem build.

O conteúdo foi montado a partir do perfil do Lucas (interesses: natureza, espiritualidade, cultura, gastronomia) e de pesquisa em guias de mochileiro.

## Como rodar

É um arquivo estático. Abrir direto no navegador funciona, mas o ideal é servir por HTTP (algumas APIs de imagem se comportam melhor):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000/index.html
```

Não há dependências de build, npm ou bundler.

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
