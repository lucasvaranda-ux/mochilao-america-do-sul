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
    // o dono do app (app_metadata.whatch_dono, só o banco marca) não tem limite; o uso dele não é contado
    if (user.app_metadata && user.app_metadata.whatch_dono === true) return { ok: true, uid, dono: true };
    const agora = new Date();
    // dia e mês no horário de Brasília (UTC−3)
    const br = new Date(agora.getTime() - 3 * 3600e3);
    const dia = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) + 3 * 3600e3);
    const mes = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + 3 * 3600e3);
    const [nDia, nMes] = await Promise.all([quantos(token, uid, tipo, dia), quantos(token, uid, tipo, mes)]);
    if (nMes >= lim.mes) return { ok: false, status: 429, erro: `Você usou as ${lim.mes} ${lim.nome} deste mês. Elas voltam no dia 1º.` };
    if (nDia >= lim.dia) return { ok: false, status: 429, erro: `Você usou as ${lim.dia} ${lim.nome} de hoje. Amanhã tem mais.` };
    const ri = await fetch(`${SB_URL}/rest/v1/whatch_ia_uso`, {
      method: 'POST', headers: h(token, { 'content-type': 'application/json', prefer: 'return=minimal' }), body: JSON.stringify({ tipo }),
    });
    if (!ri.ok) throw new Error('registro ' + ri.status);
    return { ok: true, uid, restam: { dia: lim.dia - nDia - 1, mes: lim.mes - nMes - 1 } };
  } catch (e) {
    console.error('limite', e && e.message);
    return { ok: false, status: 503, erro: 'Não consegui conferir o seu limite agora. Tente de novo em instantes.' };
  }
}
