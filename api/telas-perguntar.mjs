// Caixa de perguntas do Telas: recebe a pergunta e o contexto que a página monta no navegador
// (notas, status, coleções, pesos das dimensões, o que já está na lista) e pede indicações ao Claude.
// Variáveis na Vercel (nunca no código): ANTHROPIC_API_KEY e TELAS_SENHA.
// A página manda a senha no cabeçalho x-telas-senha; sem ela, a função não gasta nada.

import Anthropic from '@anthropic-ai/sdk';
import { createHash, timingSafeEqual } from 'node:crypto';

const MODELO = 'claude-opus-5-5';
const LIMITE_PERGUNTA = 800;      // caracteres
const LIMITE_CONTEXTO = 90000;    // caracteres do contexto em JSON
const POR_HORA = 30;              // perguntas por hora por IP (melhor esforço: cada instância conta a sua)
const PAUSAS_MAX = 3;             // retomadas de turno pausado pela busca na web

const SISTEMA = `Você ajuda o Lucas a escolher filmes e séries, dentro da página pessoal dele.

Junto com cada pergunta vem o contexto da página: as notas que ele deu (0 a 100), o status de cada título (quero ver, assisti, acompanhando, abandonei), as coleções "Desligar o cérebro" (com a fase da vida em que aquilo serviu, quando ele anotou) e "Repetidos" (com quantas vezes viu), os pesos que ele dá a nove dimensões de conexão, os títulos mais conectados com ele, os serviços de streaming que assina e a lista completa do que já está na página.

Como responder:
- Baseie as indicações nesse contexto e diga, em cada uma, o que nele levou a ela (por exemplo, uma nota alta, uma coleção, um peso).
- Indique títulos que ainda não estão na página, a não ser que a pergunta peça o contrário. Se citar algo que já está, preencha ja_na_lista com o id dele.
- Não invente títulos. Se não tiver certeza do ano ou do título original, diga isso no por_que.
- Português do Brasil, frases curtas, sem elogio ao gosto dele e sem entusiasmo de vendedor.
- Até 8 indicações, a não ser que a pergunta peça outro número.

Ao terminar, chame a ferramenta indicar uma única vez, com a resposta e as indicações.`;

const INDICAR = {
  name: 'indicar',
  description: 'Entrega a resposta final à página: um texto curto e a lista de indicações.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      resposta: { type: 'string', description: 'Resposta curta à pergunta, em pt-BR (até ~120 palavras).' },
      indicacoes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            titulo: { type: 'string', description: 'Título como saiu no Brasil (ou o original, se não saiu).' },
            titulo_original: { type: 'string' },
            ano: { type: 'string', description: 'Ano de lançamento ou de estreia; para séries, "2007–2019" ou "2021–".' },
            tipo: { type: 'string', enum: ['filme', 'série'] },
            por_que: { type: 'string', description: 'Uma ou duas frases ligando a indicação ao contexto dele.' },
            ja_na_lista: { type: 'string', description: 'Id do título se ele já está na página; senão, texto vazio.' },
          },
          required: ['titulo', 'titulo_original', 'ano', 'tipo', 'por_que', 'ja_na_lista'],
        },
      },
    },
    required: ['resposta', 'indicacoes'],
  },
};

// ---------- PROTEÇÕES ----------
function senhaConfere(dada) {
  const certa = process.env.TELAS_SENHA || '';
  if (!certa || typeof dada !== 'string') return false;
  const h = s => createHash('sha256').update(s).digest(); // mesmo tamanho, comparação em tempo constante
  return timingSafeEqual(h(dada), h(certa));
}
const vistos = new Map();
function passouDoLimite(ip) {
  const agora = Date.now(), hora = 3600e3;
  const lista = (vistos.get(ip) || []).filter(t => agora - t < hora);
  lista.push(agora);
  vistos.set(ip, lista);
  return lista.length > POR_HORA;
}

// ---------- RESPOSTA ----------
function lerResposta(msg) {
  const ind = msg.content.find(b => b.type === 'tool_use' && b.name === 'indicar');
  if (ind && ind.input && typeof ind.input === 'object') {
    return { resposta: String(ind.input.resposta || ''), indicacoes: Array.isArray(ind.input.indicacoes) ? ind.input.indicacoes : [] };
  }
  // sem a ferramenta: devolve o texto que veio, sem indicações estruturadas
  const texto = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { resposta: texto, indicacoes: [] };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ erro: 'Use POST.' }); }
    if (!process.env.ANTHROPIC_API_KEY || !process.env.TELAS_SENHA) {
      return res.status(503).json({ erro: 'A caixa ainda não foi configurada: faltam ANTHROPIC_API_KEY e TELAS_SENHA nas variáveis do projeto na Vercel.' });
    }
    if (!senhaConfere(req.headers['x-telas-senha'])) return res.status(401).json({ erro: 'Senha da caixa errada ou ausente.' });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sem-ip';
    if (passouDoLimite(ip)) return res.status(429).json({ erro: 'Muitas perguntas nesta hora. Tente daqui a pouco.' });

    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    const pergunta = typeof corpo.pergunta === 'string' ? corpo.pergunta.trim() : '';
    if (!pergunta) return res.status(400).json({ erro: 'Escreva uma pergunta.' });
    if (pergunta.length > LIMITE_PERGUNTA) return res.status(400).json({ erro: `Pergunta longa demais (até ${LIMITE_PERGUNTA} caracteres).` });
    const contexto = JSON.stringify(corpo.contexto && typeof corpo.contexto === 'object' ? corpo.contexto : {});
    if (contexto.length > LIMITE_CONTEXTO) return res.status(400).json({ erro: 'Contexto grande demais.' });

    const tools = [INDICAR];
    if (corpo.buscar === true) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 3 });

    const client = new Anthropic();
    const messages = [{
      role: 'user',
      content: [
        // o contexto muda pouco entre perguntas seguidas: fica em cache, a pergunta vem depois
        { type: 'text', text: `Contexto da página (JSON):\n${contexto}`, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Pergunta: ${pergunta}` },
      ],
    }];

    let msg;
    for (let i = 0; i <= PAUSAS_MAX; i++) {
      msg = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: SISTEMA,
        tools,
        tool_choice: { type: 'auto' },
        messages,
      });
      if (msg.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: msg.content }); // a busca na web pausou: retoma de onde parou
    }

    if (msg.stop_reason === 'refusal') {
      return res.status(200).json({ resposta: 'A IA não respondeu a essa pergunta. Tente escrever de outro jeito.', indicacoes: [], recusou: true });
    }
    const { resposta, indicacoes } = lerResposta(msg);
    const buscas = msg.content.filter(b => b.type === 'web_search_tool_result').length;
    return res.status(200).json({ resposta, indicacoes: indicacoes.slice(0, 12), modelo: msg.model, buscas, cortada: msg.stop_reason === 'max_tokens' });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return res.status(502).json({ erro: 'A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY na Vercel.' });
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ erro: 'A Anthropic pediu uma pausa. Tente de novo em um minuto.' });
    if (e instanceof Anthropic.BadRequestError) { console.error(e.message); return res.status(502).json({ erro: 'A Anthropic recusou o pedido. Os detalhes estão no log da função.' }); }
    if (e instanceof Anthropic.APIError) { console.error(e.status, e.message); return res.status(502).json({ erro: `A Anthropic respondeu com erro ${e.status ?? ''}. Tente de novo.` }); }
    console.error(e);
    return res.status(500).json({ erro: 'Erro inesperado na caixa de perguntas.' });
  }
}
