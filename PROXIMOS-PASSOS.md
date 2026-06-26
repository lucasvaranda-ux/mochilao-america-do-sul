# Deploy mochilao.madeinbr.app — CONCLUÍDO ✅

> Handoff atualizado: o site está no ar em **https://mochilao.madeinbr.app**.

## Resultado (jun/2026)
- **DNS (Cloudflare):** CNAME `mochilao → cname.vercel-dns.com` (DNS only,
  `proxied:false`) criado na zona `madeinbr.app` (`ee30e437a4b382c89de70dc9f0b856ce`).
  Registro id `0e9bb462ca8e614ba4ef202426b18641`.
- **Vercel:** projeto `mochilao-america-do-sul` (`prj_gwNXD66C2teuBXsx8FilI7sacpBz`)
  ligado ao repo `lucasvaranda-ux/mochilao-america-do-sul`, branch de produção `main`.
- **Domínio:** `mochilao.madeinbr.app` anexado ao projeto, **verified** e **não
  misconfigured** (o CNAME resolve direitinho).
- **Deploy de produção:** READY (commit `27e9c4e`), com `mochilao.madeinbr.app` nos
  aliases ativos.

## Deploys futuros
- O repo está ligado ao Vercel: **todo `push` na `main` redeploya sozinho**. Não
  precisa de nada manual.

## Segurança (revisar)
- 🔑 **Revogar o token antigo do Netlify** (pendência do handoff anterior).
- 🔑 Os tokens `mochilao-madeinbr` (Vercel) e Cloudflare (Zone:DNS:Edit, 1 zona) já
  cumpriram o papel. Pode **revogar** se não quiser deploys por API no futuro; ou
  manter, se quiser. Ambos estavam como "Never expires".
- A chave **anon** do Supabase no `index.html` é pública por design (RLS protege a
  tabela `public.mochilao_mural`: select+insert público, sem update/delete). OK expor.

## Histórico (o que era "a fazer" e virou feito)
1. ✅ Conferir token Cloudflare no ambiente — presente e funcional. (O endpoint
   `/user/tokens/verify` retorna "Invalid API Token" porque é do namespace `/user/`
   e o token tem escopo só-DNS; a validade foi provada pelas chamadas de zona/DNS.)
2. ✅ Pegar o `zone_id` do `madeinbr.app`.
3. ✅ Criar o CNAME `mochilao`.
4. ✅ Ligar o repo ao Vercel + anexar o domínio + deploy de produção (tudo via API).
