# 🌎 Mochilão América do Sul

Guia de viagem interativo (página única) pra um mochilão de ~90 dias pela América do Sul: **Colômbia → Equador → Peru → Bolívia → Chile → Argentina → Uruguai**.

Arquivo principal: **`mochilao-america-do-sul.html`** (HTML + CSS + JS num só arquivo, sem build).

## Abas
- **🧭 Perfil** — o viajante por trás do mochilão.
- **🗺️ Roteiro** — mapa interativo (Leaflet) com 20 paradas; clique pra abrir o guia completo (bairros, monumentos, natureza, hostels, onde comer, custos).
- **📅 Datas** — cronograma a partir da data de saída + voos internos.
- **💰 Finanças** — orçamento planejado × realizado, editável, salvo no navegador.
- **🎒 Compras** — 14 produtos reais com link pra página oficial.

## Como rodar localmente

```bash
# na pasta do projeto
python3 -m http.server 8000
# abra: http://localhost:8000/mochilao-america-do-sul.html
```

> Precisa de internet: o mapa (Leaflet/CARTO) e as fotos (APIs da Wikipedia e do Wikimedia Commons) carregam em tempo real.

## Como continuar no Claude Code

1. Instale o Claude Code (veja https://docs.claude.com → Claude Code). Em geral:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
2. Abra um terminal nesta pasta e rode:
   ```bash
   claude
   ```
3. O Claude Code lê automaticamente o `CLAUDE.md` deste diretório, então ele já entra com todo o contexto do projeto (estrutura, dados, convenções e gotchas).

## Versionar com git (opcional, recomendado)

```bash
git init
git add mochilao-america-do-sul.html CLAUDE.md README.md .gitignore
git commit -m "Mochilão América do Sul — versão inicial migrada do Cowork"
```

## Estrutura

```
mochilao-america-do-sul.html   # o app inteiro
CLAUDE.md                       # contexto pro Claude Code
README.md                       # este arquivo
.gitignore
```

Detalhes técnicos (onde ficam os dados, como adicionar uma parada, etc.) estão no `CLAUDE.md`.
