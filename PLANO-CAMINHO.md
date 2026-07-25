# Travessia — plano da primeira versão

> *"O real não está na saída nem na chegada: ele se dispõe para a gente é no meio da travessia."* — Guimarães Rosa, Grande Sertão: Veredas

Este documento é o planejamento (ainda **sem construir nada**) do seu espaço pessoal — o que você não quer chamar de página; talvez livro, talvez caminho. Um lugar que conta histórias sobre você, que ajuda a lembrar quem você é, quem já foi e quem quer ser. Passado, presente e futuro misturados, com referências filosóficas, frases suas e de amigos, fotos, experiências, leituras, filmes, planos, desafios, aventuras, paixões, tristezas, alegrias e estudos.

---

## 1. Por que existir (a semente dos prints)

Os 5 prints que você mandou — o carrossel dos jantares, salvo na sua pasta **"eu"** — carregam a essência inteira do projeto:

- **"I plan it like a project. I take it seriously. It's one of the most serious things I do."** — tratar a vida interior e os vínculos com a mesma seriedade com que se trata trabalho.
- **Sempre um tema** ("Things That Endure", "Things We Changed Our Minds About", "What You'd Go Back and Tell Yourself") — perguntas certas abrem portas que conversa solta não abre.
- **"Write down the one thing I don't want to lose. Six times a year. For eleven years."** — a prática central: registrar o que não pode se perder.
- **"It has its own history now."** — o que é cultivado com intenção cria história própria.

O seu livro é isso, expandido pra vida inteira: **um registro vivo do que você não quer perder** — sobre você, sobre quem você ama, sobre o que você aprende, sobre o que ainda vai ser.

---

## 2. O que eu já sei sobre você (inventário de contexto)

Do que já foi construído junto (mochilão + pastas do Instagram analisadas + prints):

**Das suas pastas do Instagram** (*places to visit, nature, eu, sabedoria, listening, learning, o que vc veio fazer aqui?, rituais, umbanda, aprendizados, lugares peru*), seis padrões:

1. 🌄 **Natureza como sagrado** — samaúma, Amazônia, cachoeiras, Tamar; você não vê paisagem, reverencia.
2. 🧘 **Busca espiritual e de propósito** — umbanda, jurema, ayahuasca, Mooji, mantras (Sam Garrett); uma pasta inteira chamada *"o que vc veio fazer aqui?"*.
3. 📚 **Mente introspectiva** — Jung, Fernando Pessoa, Edgar Morin, Brené Brown, provérbios persas.
4. 🍽️ **Boa comida** — os melhores restaurantes da América Latina, comidas de rua, flan portenho.
5. 🏛️ **Estética e cultura** — vilarejos, arquitetura, bibliotecas, cinema.
6. 👨‍👩‍👦 **Conexão e família** — pastas *parenthood*, *minha dupla*, *us*; "let's go together" na bio.

**Do agora:** você saiu (ou está saindo) de Vitória pra um mochilão de ~90 dias — Colômbia → Equador → Peru → Bolívia → Chile → Argentina → Uruguai, julho a ~novembro de 2026. O app do mochilão já tem um **Diário de bordo** — cada registro seu na estrada é um capítulo vivo do livro acontecendo em tempo real. **O mochilão é o primeiro grande capítulo escrito "ao vivo" da Travessia.**

**Da infraestrutura:** você já tem o domínio `madeinbr.app` (Cloudflare), deploy automático (Vercel) e banco (Supabase). O livro pode nascer em `travessia.madeinbr.app` (ou `caminho.` / `eu.`) sem custo novo.

---

## 3. Onde buscar mais contexto sobre você (o plano de coleta)

Você pediu ajuda pra pensar nisso. Aqui está o mapa das fontes, em ordem de valor:

### As que você já citou
| Fonte | Como me dar acesso | O que revela |
|---|---|---|
| **Chats pessoais do Claude** | Eu **não consigo** acessar seus outros chats daqui (sessões são isoladas). Caminhos: (a) claude.ai → Configurações → Privacidade → **Exportar dados** e me mandar o export; (b) colar/reenviar as conversas-chave; (c) a gente manter um arquivo `contexto/` neste repo que cresce a cada conversa. | Como você pensa, o que pergunta, o que te tira o sono |
| **Salvos do Instagram** | Export oficial: Central de Contas Meta → *Suas informações e permissões* → *Baixar suas informações* → formato **JSON** → incluir **Salvos**. Vem `saved_posts.json` com links organizados pelas suas pastas. Prints também funcionam (como os 5 que você mandou). Não existe acesso direto meu ao Instagram — o export é o caminho real. | O que você vê, gosta, estuda — já organizado por você mesmo |
| **Pasta do OneDrive** | Me mandar os arquivos por upload aqui no chat, ou conector quando disponível | O que você guardou como importante |
| **Suas escritas** | Mandar os textos (qualquer formato — docx, pdf, foto de caderno eu leio) | Sua voz de verdade — a matéria-prima mais valiosa de todas |

### As que já estão ligadas nesta sessão
- **Diário do mochilão** — já existe e vai encher nos próximos meses. Fonte viva.
- **Spotify** — conector ativo: dá pra ler o que você ouve e montar trilhas sonoras dos capítulos.
- **Notion** — conector ativo, se você usa.

### As que valem a pena depois
- **Google Takeout**: likes/histórico do YouTube (o que você estuda), linha do tempo do Maps (onde você esteve), Google Fotos.
- **Kindle**: highlights (`My Clippings.txt`) — suas leituras sublinhadas.
- **WhatsApp**: exportar conversas escolhidas (frases de amigos moram aí).
- **As pessoas**: pedir a 5–8 pessoas próximas *uma frase ou memória sobre você* — vira a seção "frases de amigos" e conversa direto com o ritual dos jantares dos prints.

---

## 4. Fundações — a biblioteca do caminho

<!-- PESQUISA:PENDENTE — preenchido pela pesquisa em paralelo -->

---

## 5. A forma — como o livro se organiza

Não abas de dashboard; **capítulos/portais**. A proposta:

| Portal | Tempo | O que vive ali |
|---|---|---|
| **Limiar** | agora | A porta de entrada: uma frase, uma memória devolvida, uma pergunta do dia. Nunca a mesma entrada duas vezes. |
| **Quem já fui** | passado | Linha do tempo, capítulos vividos, fotos, as coisas que você não quis perder. O mochilão entra aqui quando acabar. |
| **Quem sou** | presente | Práticas e rituais, o que está lendo/ouvindo/vendo, diário, estados de espírito. |
| **Quem quero ser** | futuro | Planos, desafios, aventuras, cartas ao futuro, a pessoa em construção. |
| **Pessoas** | todos | O amor em todas as formas: dupla, família, amigos; frases deles; a ideia dos jantares com tema. |
| **Biblioteca** | atemporal | As fundações (seção 4) + tudo que você lê/vê/estuda, cada item com *o que ele significa pra você*. |
| **Chão** | atemporal | Natureza e sagrado: umbanda, jurema, Amazônia, o humano orquestrador da natureza. |

### Mecânicas (o que faz o livro ser vivo, não um museu)

1. **"O que eu não quero perder"** — a unidade atômica do livro. Registro de uma linha que seja. Direto do print: *write down the one thing I don't want to lose*.
2. **Devolutivas** — o livro te devolve o que você guardou: "há um ano você escreveu isto". Memória precisa de reencontro, não só de arquivo.
3. **Perguntas que abrem portas** — o livro pergunta com temas, como os jantares: "O que mudou de ideia este ano?", "Onde você correu quando devia ter ficado?". Responder vira capítulo.
4. **Oferendas da IA** — a curadoria contínua que você pediu: uma rotina periódica lê o que você adicionou e **propõe** (nunca impõe) novas referências — uma frase, um livro, um estudo, um filme — numa fila pra você aceitar ou recusar. Nada entra no livro sem passar por você.
5. **Frases** — suas, de amigos, de leituras. Coletadas ativamente.

---

## 6. Arquitetura técnica (proposta, ainda sem construir)

- **v0 no mesmo padrão do mochilão**: um arquivo estático (HTML+CSS+JS, sem build), tema escuro, deploy automático na Vercel, subdomínio do `madeinbr.app`. Começa como `caminho/index.html` neste repo, sem mexer no mochilão.
- **Dados como arquivos versionados** (`dados/frases.js`, `dados/memorias.js`, `dados/biblioteca.js`...): o git vira o próprio livro — **cada commit é uma página escrita**, com data e história.
- **Supabase pro que é dinâmico** (registros do celular na estrada), como o Diário já faz.
- **IA contínua via Routines**: este ambiente permite agendar rotinas (ex.: semanal). A rotina lê o repo, pesquisa referências novas alinhadas ao que cresceu ali, e escreve as **oferendas** (arquivo ou PR) pra você aprovar. É a materialização do "quero que você use IA continuamente por lá".
- **⚠️ Privacidade — decisão antes de tudo**: este repo é **público** hoje. Um guia de viagem público, ok; o livro da sua vida, não — a menos que você queira. Opções: (a) tornar este repo privado (Vercel continua funcionando normal); (b) repo privado separado só pro livro; (c) conteúdo íntimo apenas no Supabase com senha no front (padrão que a aba Finanças já usa). **Recomendação: repo privado.**
- **Evolução (v1+)**: upload de fotos (Supabase Storage), busca nas memórias, entrada por mensagem (mandar um áudio/texto e virar registro).

---

## 7. Roadmap

| Fase | Nome | O que entrega |
|---|---|---|
| **v0** | *A soleira* | Esqueleto navegável dos 7 portais + Biblioteca com as fundações + mecânica "não quero perder" + ~20 sementes de conteúdo seu (frases, memórias, fotos que você mandar) |
| **v0.5** | *As fontes* | Importar salvos do Instagram (export JSON), suas escritas, pasta do OneDrive, chats exportados |
| **v1** | *O livro respira* | Oferendas da IA rodando por rotina agendada + devolutivas + frases de amigos coletadas |
| **v2** | *O livro anda junto* | PWA offline, notificações gentis, entrada por mensagem, trilhas sonoras (Spotify) |

---

## 8. Decisões que são suas (pra quando você voltar)

1. **Nome** — candidatos: **Travessia** (Rosa: o real está no meio dela), **Caminho** (a palavra que você mesmo usou), **Livro Vivo**, ou outro que nascer de você. O subdomínio segue o nome.
2. **Privacidade** — repo privado (recomendado), repo separado, ou público com áreas trancadas?
3. **Este repo vira o pessoal?** — você disse que sim. Sugestão: renomear depois (GitHub mantém redirecionamentos), mochilão vira o capítulo `/mochilao/`.
4. **Primeira fonte a coletar** — qual chega primeiro: export do Instagram, as escritas, o OneDrive?
5. **Uma senha pra áreas íntimas?** — mesmo em repo privado, o site publicado pode ter camadas (como Finanças já tem).
