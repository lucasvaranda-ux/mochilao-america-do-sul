// =============================================================================
// Whatch — Edge Function: whatch-avisos (avisos por e-mail, uma vez por dia)
// =============================================================================
// Quem ligou o aviso em Sua conta (whatch_avisos.ligado) recebe, de manhã, a lista das séries que marcou como "Vendo"
// (telas_estado.estado.status = 'acompanhando') com episódio novo AMANHÃ (horário de Brasília), pelo TVmaze.
// Chamada pela rota agendada da Vercel (api/whatch-avisos.mjs). Sem segredo de propósito: só faz algo entre 7h e 13h de
// Brasília e cada pessoa recebe no máximo um e-mail por dia (ultimo_envio), então chamar de novo não repete nada.
// Usa o RESEND_API_KEY que o projeto já tem e o remetente avisos@mail.madeinbr.app.
// =============================================================================


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://whatch.madeinbr.app";
const MAX_PESSOAS = 300;
// sem biblioteca: PostgREST e a API de admin do Auth com a chave de serviço (o deploy com import do npm falhou em 12/10)
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
async function rest(caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`rest ${r.status} ${caminho.split("?")[0]}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function emailDe(uid: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { headers: H });
  if (!r.ok) return "";
  const u = await r.json();
  return String((u && (u.email || (u.user && u.user.email))) || "");
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const diaBR = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

type Ep = { serie: string; t: number; e: number; nome: string; quando: string; canal: string };

function emailHtml(eps: Ep[]) {
  const linhas = eps.map((x) => `<tr><td style="padding:10px 0;border-top:1px solid #26262f;"><b style="color:#fff;font-size:15px;">${esc(x.serie)}</b><br><span style="color:#b9b9c6;font-size:13px;">T${x.t}E${x.e}${x.nome ? " · " + esc(x.nome) : ""}${x.canal ? " · " + esc(x.canal) : ""}${x.quando ? " · " + esc(x.quando) : ""}</span></td></tr>`).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0b0b0f;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="460" cellpadding="0" cellspacing="0" style="width:460px;max-width:100%;background:#16161d;border-radius:18px;font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:26px 26px 10px;">
<img src="${SITE}/whatch/icone-192.png" alt="" width="40" height="40" style="display:block;border-radius:10px;margin-bottom:14px"/>
<h1 style="margin:0 0 6px;font-size:20px;color:#fff;">Amanhã tem episódio novo</h1>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#b9b9c6;">Das séries que você está vendo no Whatch:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>
<p style="margin:18px 0 22px;"><a href="${SITE}/#cal" style="display:inline-block;background:#3ddc97;color:#0b0b0f;text-decoration:none;font-weight:bold;border-radius:12px;padding:12px 18px;">Abrir a Agenda</a></p>
<p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#8a8a97;">Você recebe este e-mail porque ligou os avisos no Whatch. Para parar, desligue em Mais › Sua conta.</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const agora = new Date(), horaBR = new Date(agora.getTime() - 3 * 3600e3).getUTCHours();
  if (horaBR < 7 || horaBR > 13) return json({ ok: true, pulou: "fora do horário (7h às 13h de Brasília)" });
  if (!RESEND_API_KEY) return json({ ok: false, erro: "sem RESEND_API_KEY" }, 503);
  const hoje = diaBR(agora), amanha = diaBR(new Date(agora.getTime() + 24 * 3600e3));
  try {
    const avs = await rest("whatch_avisos?select=user_id,ultimo_envio&ligado=eq.true");
    const pend = (avs || []).filter((a: { ultimo_envio: string | null }) => a.ultimo_envio !== hoje).slice(0, MAX_PESSOAS);
    if (!pend.length) return json({ ok: true, pessoas: 0 });

    // id do título -> IMDb e nome (só séries), do que a página publica
    const [dados, cat] = await Promise.all([fetch(SITE + "/telas/dados.json").then((r) => r.json()), fetch(SITE + "/telas/catalogo.json").then((r) => r.json())]);
    const serie = new Map<string, { imdb: string; titulo: string }>();
    const poe = (it: any) => { if (it && it.id && /^tt\d{5,10}$/.test(String(it.imdb_id || ""))) serie.set(it.id, { imdb: it.imdb_id, titulo: it.titulo || it.id }); };
    (dados.series || []).forEach(poe);
    (dados.extras || []).filter((x: any) => x && x.tipo === "serie").forEach(poe);
    (cat.itens || []).filter((x: any) => x && x.tipo === "serie").forEach(poe);

    // próximo episódio por IMDb, uma consulta por série no TVmaze (com pausa: o limite é 20 a cada 10 s)
    const cache = new Map<string, Ep | null>();
    async function proximo(imdb: string, titulo: string): Promise<Ep | null> {
      if (cache.has(imdb)) return cache.get(imdb)!;
      let ep: Ep | null = null;
      try {
        await espera(600);
        const s = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdb}`);
        if (s.ok) {
          const sh = await s.json();
          await espera(600);
          const r = await fetch(`https://api.tvmaze.com/shows/${sh.id}?embed=nextepisode`);
          const j = r.ok ? await r.json() : null;
          const n = j && j._embedded && j._embedded.nextepisode;
          if (n) {
            const d = n.airstamp ? diaBR(new Date(n.airstamp)) : n.airdate;
            if (d === amanha) {
              const hr = n.airstamp ? new Date(new Date(n.airstamp).getTime() - 3 * 3600e3).toISOString().slice(11, 16) : "";
              ep = { serie: titulo, t: n.season, e: n.number, nome: n.name || "", quando: hr && hr !== "00:00" ? hr + " (Brasília)" : "", canal: (j.webChannel && j.webChannel.name) || (j.network && j.network.name) || "" };
            }
          }
        }
      } catch (_) { ep = null; }
      cache.set(imdb, ep);
      return ep;
    }

    let enviados = 0, semNada = 0, falhas = 0;
    for (const p of pend) {
      try {
        const linhas = await rest(`telas_estado?select=estado&user_id=eq.${p.user_id}`);
        const est = Array.isArray(linhas) ? linhas[0] : null;
        const st = (est && est.estado && typeof est.estado.status === "object" && est.estado.status) || {};
        const ids = Object.keys(st).filter((k) => st[k] === "acompanhando" && serie.has(k)).slice(0, 60);
        const eps: Ep[] = [];
        for (const id of ids) { const s = serie.get(id)!; const ep = await proximo(s.imdb, s.titulo); if (ep) eps.push(ep); }
        if (eps.length) {
          const email = await emailDe(p.user_id);
          if (email) {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: "Whatch <avisos@mail.madeinbr.app>", to: [email], subject: eps.length === 1 ? `Amanhã: ${eps[0].serie}` : `Amanhã: ${eps.length} episódios novos`, html: emailHtml(eps) }),
            });
            if (!r.ok) throw new Error("resend " + r.status);
            enviados++;
          }
        } else semNada++;
        await rest(`whatch_avisos?user_id=eq.${p.user_id}`, { method: "PATCH", body: JSON.stringify({ ultimo_envio: hoje }), headers: { Prefer: "return=minimal" } });
      } catch (e) { falhas++; console.error("aviso", e instanceof Error ? e.message : e); }
    }
    return json({ ok: true, pessoas: pend.length, enviados, semNada, falhas });
  } catch (e) {
    console.error("whatch-avisos", e instanceof Error ? e.message : e);
    return json({ ok: false, erro: "falhou" }, 500);
  }
});
