// Limite de uso da IA por pessoa no Whatch (o "_" no nome faz a Vercel não publicar este arquivo como função).
// A página manda o token da sessão (Authorization: Bearer ...). Aqui: quem é (/auth/v1/user), quanto já usou hoje e no
// mês (whatch_ia_uso, contado e gravado com o token da própria pessoa: o RLS só deixa ler e inserir as próprias linhas)
// e, se couber, grava este uso ANTES de chamar a IA (pedido que falha também conta: é o que segura quem insiste).
// Sem WHATCH_EXIGE_LOGIN=1 no projeto, quem não está logado segue com os freios por IP de cada função.

const SB_URL = 'https://irawlnmcinqkxzgczmrb.supabase.co';
const SB_KEY = 'sb_publishable_zZ56QYXUwK7PruwzyvESrg_Jp_qS6bG'; // chave publicável (a mesma da página): não dá acesso sem token

// limites por pessoa (ajustar aqui)
export const LIMITES = {
  pergunta: { dia: 15, mes: 150, nome: 'perguntas' },
  gosto: { dia: 8, mes: 30, nome: 'leituras do seu gosto' },
};

const h = (token, extra) => ({ apikey: SB_KEY, authorization: 'Bearer ' + token, ...(extra || {}) });

async function quantos(token, uid, tipo, desde) {
  const u = `${SB_URL}/rest/v1/whatch_ia_uso?select=id&user_id=eq.${uid}&tipo=eq.${tipo}&criado_em=gte.${encodeURIComponent(desde.toISOString())}`;
  const r = await fetch(u, { headers: h(token, { prefer: 'count=exact', range: '0-0' }) });
  if (!r.ok) throw new Error('contagem ' + r.status);
  const cr = r.headers.get('content-range') || '';
  const n = +(cr.split('/')[1] || 0);
  return isFinite(n) ? n : 0;
}

// devolve { ok: true, uid } ou { ok: false, status, erro }; sem token, { ok: true, anonimo: true } (a função decide)
export async function confereUso(req, tipo) {
  const lim = LIMITES[tipo];
  const auth = String(req.headers.authorization || '');
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1] || '';
  if (!token) {
    if (process.env.WHATCH_EXIGE_LOGIN === '1') return { ok: false, status: 401, erro: 'Entre na sua conta para usar a IA.' };
    return { ok: true, anonimo: true };
  }
  try {
    const ru = await fetch(`${SB_URL}/auth/v1/user`, { headers: h(token) });
    if (!ru.ok) return { ok: false, status: 401, erro: 'Sua sessão venceu. Entre de novo.' };
    const user = await ru.json();
    const uid = String(user && user.id || '');
    if (!/^[0-9a-f-]{36}$/.test(uid)) return { ok: false, status: 401, erro: 'Sua sessão venceu. Entre de novo.' };
    // o dono do app (app_metadata.whatch_dono, só o banco marca) não tem limite, mas o uso dele entra no custo
    const ehDono = !!(user.app_metadata && user.app_metadata.whatch_dono === true);
    // limite próprio ou bloqueio, marcado pelo dono no admin (whatch_limites; a pessoa só lê a dela)
    let lp = null;
    if (!ehDono) {
      const rl = await fetch(`${SB_URL}/rest/v1/whatch_limites?select=*&user_id=eq.${uid}`, { headers: h(token) });
      if (rl.ok) { const a = await rl.json(); lp = Array.isArray(a) && a[0] || null; }
    }
    if (lp && lp.bloqueado) return { ok: false, status: 403, erro: 'A IA está desligada para a sua conta. Fale com quem te convidou para o Whatch.' };
    const limDia = lp && lp[tipo + '_dia'] != null ? +lp[tipo + '_dia'] : lim.dia, limMes = lp && lp[tipo + '_mes'] != null ? +lp[tipo + '_mes'] : lim.mes;
    const agora = new Date();
    // dia e mês no horário de Brasília (UTC−3)
    const br = new Date(agora.getTime() - 3 * 3600e3);
    const dia = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) + 3 * 3600e3);
    const mes = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + 3 * 3600e3);
    let nDia = 0, nMes = 0;
    if (!ehDono) {
      [nDia, nMes] = await Promise.all([quantos(token, uid, tipo, dia), quantos(token, uid, tipo, mes)]);
      if (nMes >= limMes) return { ok: false, status: 429, erro: `Você usou as ${limMes} ${lim.nome} deste mês. Elas voltam no dia 1º.` };
      if (nDia >= limDia) return { ok: false, status: 429, erro: `Você usou as ${limDia} ${lim.nome} de hoje. Amanhã tem mais.` };
    }
    const ri = await fetch(`${SB_URL}/rest/v1/whatch_ia_uso?select=id`, {
      method: 'POST', headers: h(token, { 'content-type': 'application/json', prefer: 'return=representation' }), body: JSON.stringify({ tipo }),
    });
    if (!ri.ok) throw new Error('registro ' + ri.status);
    const reg = await ri.json().catch(() => null);
    const id = Array.isArray(reg) && reg[0] ? reg[0].id : null;
    return { ok: true, uid, dono: ehDono, id, token, restam: ehDono ? null : { dia: limDia - nDia - 1, mes: limMes - nMes - 1 } };
  } catch (e) {
    console.error('limite', e && e.message);
    return { ok: false, status: 503, erro: 'Não consegui conferir o seu limite agora. Tente de novo em instantes.' };
  }
}

// depois da chamada: grava os tokens no registro deste uso (uma vez; o custo em dólar é calculado no banco).
// usage pode ser um objeto da Anthropic ou uma lista deles (as retomadas da busca na web); falha aqui não atrapalha a resposta.
export async function registraTokens(uso, usage) {
  try {
    if (!uso || !uso.id || !uso.token || !usage) return;
    const l = Array.isArray(usage) ? usage : [usage];
    const soma = k => l.reduce((a, u) => a + (u && +u[k] > 0 ? Math.round(+u[k]) : 0), 0);
    await fetch(`${SB_URL}/rest/v1/whatch_ia_uso?id=eq.${uso.id}`, {
      method: 'PATCH', headers: h(uso.token, { 'content-type': 'application/json', prefer: 'return=minimal' }),
      body: JSON.stringify({ tokens_in: soma('input_tokens'), tokens_out: soma('output_tokens'), cache_lido: soma('cache_read_input_tokens'), cache_criado: soma('cache_creation_input_tokens') }),
    });
  } catch (e) { console.error('tokens', e && e.message); }
}
