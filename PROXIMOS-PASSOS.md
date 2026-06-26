# Próximos passos — deploy mochilao.madeinbr.app

> Nota pro Claude da próxima sessão: este arquivo é um handoff. Leia e continue.

## Objetivo
Publicar o site no domínio **mochilao.madeinbr.app** (DNS na Cloudflare).

## Já feito
- Abas novas (Diário, Guia, Mural) commitadas e **mergeadas na `main`** → Netlify
  já republicou em https://mochilao.netlify.app
- **Mural** ligado ao Supabase (projeto `madeinbr`, ref `irawlnmcinqkxzgczmrb`,
  tabela isolada `public.mochilao_mural` com RLS: select+insert público, sem
  update/delete). A chave anon pública está no `index.html`. **Não preciso de
  key do Supabase** — uso o conector MCP.
- `vercel.json` adicionado (static, headers do manifest).
- Ambiente configurado: network policy **Custom** liberando `api.cloudflare.com`
  (e `api.vercel.com`), e a variável **`CLOUDFLARE_API_TOKEN`** (escopo
  Zone:DNS:Edit só do `madeinbr.app`). `VERCEL_TOKEN` é opcional.

## A fazer nesta sessão (rede já liberada + token deve estar presente agora)
1. Conferir o token (sem imprimir o valor):
   `curl -s https://api.cloudflare.com/client/v4/user/tokens/verify -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"`
   → esperar `"status":"active"`.
2. Pegar o `zone_id` do `madeinbr.app`:
   `curl -s "https://api.cloudflare.com/client/v4/zones?name=madeinbr.app" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"`
3. Criar o registro **CNAME** (DNS only → `proxied:false`):
   `POST https://api.cloudflare.com/client/v4/zones/<zone_id>/dns_records`
   body: `{"type":"CNAME","name":"mochilao","content":"cname.vercel-dns.com","proxied":false,"ttl":1}`
   (se já existir, usar PUT/PATCH no record id)
4. Confirmar o registro criado.

## Lado Vercel (pra o domínio realmente servir o site)
- A 1ª ligação do repo ao Vercel (OAuth GitHub) é mais fácil pelo painel:
  vercel.com → Add New → Project → import `lucasvaranda-ux/mochilao-america-do-sul`
  → Framework: Other → Deploy.
- Depois, em Settings → Domains, adicionar `mochilao.madeinbr.app`.
- Se `VERCEL_TOKEN` estiver no ambiente, dá pra anexar o domínio por API:
  `POST https://api.vercel.com/v10/projects/<projectId>/domains` `{"name":"mochilao.madeinbr.app"}`.

## Segurança
- Lembrar o Lucas de revogar o token antigo do Netlify (handoff anterior).
- Token Cloudflare é escopo mínimo (1 zona, só DNS). Pode revogar quando quiser.
