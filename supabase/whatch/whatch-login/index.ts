// =============================================================================
// Whatch — Edge Function: whatch-login (irmã do enviar-login do SV, com a cara do Whatch)
// =============================================================================
// Manda por e-mail o CÓDIGO de acesso (email_otp) do Whatch, sem o mailer global do Supabase (projeto compartilhado).
// A página confere o código em /auth/v1/verify e, na primeira vez, cria a senha.
// Público (verify_jwt=false), com freios gravados em login_pedidos (e-mail e IP só como HMAC):
// 3 por e-mail a cada 15 min e 10 por dia; 10 por IP por hora; 300 por hora no total.
// Não diz se a conta existe (a resposta é a mesma para e-mail novo e conhecido); os detalhes dos erros ficam só no log.
// Só aceita chamadas das páginas do Whatch (Origin). NUNCA apaga nem recria auth.users: só cria se o e-mail for novo.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const HMAC_KEY = Deno.env.get("LOGIN_HMAC_KEY") || SERVICE; // segredo próprio, se existir
const MAIL_FROM = "avisos@mail.madeinbr.app";
const SITE = "https://whatch.madeinbr.app";
const ORIGENS = [/^https:\/\/whatch\.madeinbr\.app$/, /^https:\/\/(whatch|whattowatch)[a-z0-9-]*\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
async function hmac(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(HMAC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function emailHtml(code: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark light"/></head>
<body style="margin:0;padding:0;background:#0b0b0f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:100%;background:#16161d;border-radius:18px;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="padding:28px 28px 6px;">
<img src="${SITE}/whatch/icone-192.png" alt="" width="44" height="44" style="display:block;border-radius:11px;margin-bottom:16px"/>
<h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">Seu código do Whatch</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#b9b9c6;">Digite este código na tela de entrada do Whatch. Ele vale por alguns minutos.</p>
<div style="margin:4px 0 22px;text-align:center;"><span style="display:inline-block;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0b0b0f;background:#3ddc97;border-radius:12px;padding:14px 22px;">${code}</span></div>
<p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#8a8a97;">Você recebeu este e-mail porque alguém pediu para entrar no Whatch com este endereço. Se não foi você, ignore: nada acontece sem o código.</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#6b6b77;font-family:Arial,Helvetica,sans-serif;">Whatch · whatch.madeinbr.app</p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const ok = ORIGENS.some((r) => r.test(origin));
  const h = cors(ok ? origin : SITE);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!ok) return json({ ok: false }, 403);
  if (!RESEND_API_KEY) { console.error("sem RESEND_API_KEY"); return json({ ok: false, erro: "O login por e-mail ainda não está ligado." }, 503); }

  let body: { email?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, erro: "Pedido inválido." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, erro: "Confira o e-mail." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sem-ip";
  const [eh, ih] = await Promise.all([hmac("e:" + email), hmac("i:" + ip)]);
  const desde = (ms: number) => new Date(Date.now() - ms).toISOString();
  const conta = async (col: string | null, v: string | null, ms: number) => {
    let q = admin.from("login_pedidos").select("id", { count: "exact", head: true }).gte("criado_em", desde(ms));
    if (col && v) q = q.eq(col, v);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  };
  try {
    const [e15, eDia, iHora, tHora] = await Promise.all([
      conta("email_hash", eh, 15 * 60e3), conta("email_hash", eh, 24 * 3600e3), conta("ip_hash", ih, 3600e3), conta(null, null, 3600e3),
    ]);
    if (e15 >= 3 || eDia >= 10 || iHora >= 10) return json({ ok: false, erro: "Muitos pedidos de código. Espere um pouco e tente de novo." }, 429);
    if (tHora >= 300) { console.error("disjuntor: 300 pedidos na última hora"); return json({ ok: false, erro: "O envio de códigos está pausado. Tente daqui a pouco." }, 429); }
    await admin.from("login_pedidos").insert({ app: "whatch", email_hash: eh, ip_hash: ih });

    const gerar = () => admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: SITE + "/" } });
    let { data, error } = await gerar();
    if (error || !data?.properties?.email_otp) {
      const cr = await admin.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
      if (cr.error && !/already|exist/i.test(cr.error.message)) throw cr.error;
      ({ data, error } = await gerar());
      if (error || !data?.properties?.email_otp) throw error || new Error("sem código");
    }
    const code = data.properties.email_otp;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Whatch <${MAIL_FROM}>`, to: [email], reply_to: MAIL_FROM, subject: `Seu código do Whatch: ${code}`, html: emailHtml(code) }),
    });
    if (!r.ok) throw new Error("resend " + r.status);
    return json({ ok: true });
  } catch (e) {
    console.error("whatch-login", e instanceof Error ? e.message : e);
    return json({ ok: false, erro: "Não consegui mandar o código agora. Tente de novo em instantes." }, 500);
  }
});
