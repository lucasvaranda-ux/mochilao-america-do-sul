// Apps com endereço próprio saídos deste repositório: na raiz do endereço, abre a página do app.
// Whatch (whatch.madeinbr.app e os endereços de teste) → /telas; Inv (inv.madeinbr.app) → /inv.
// A regra de reescrita do vercel.json não basta: na raiz, o index.html do mochilão vence. Aqui roda antes dos arquivos.
// O HTML sai com o título, a descrição e a imagem do app já no código, para a prévia do link (WhatsApp, iMessage),
// que não roda o JavaScript da página. Nos outros endereços (mochilao.madeinbr.app), não faz nada.
export const config = { matcher: ['/'] };

const APPS = [
  {
    re: /^(whatch|whattowatch)/, path: '/telas', interno: 'x-whatch-interno',
    titulo: 'Whatch · filmes e séries do seu jeito',
    desc: 'Diga do que você gosta (ou cole o que a sua IA já sabe) e o Whatch monta a sua lista de filmes e séries, com onde assistir no Brasil.',
    icone: '/whatch/icone.svg', apple: '/whatch/icone-180.png', og: '/whatch/icone-512.png'
  },
  {
    re: /^inv(\.|-|$)/, path: '/inv', interno: 'x-inv-interno',
    titulo: 'Inv · indicadores e ações',
    desc: 'IPCA, Selic, CDI e as maiores empresas de cada bolsa, com metas, projeções e gráficos para escolher o que ver.',
    icone: '/inv/icone.svg', apple: '/inv/icone-180.png', og: '/inv/icone-512.png'
  }
];

export default async function middleware(request) {
  const url = new URL(request.url);
  const A = APPS.find(a => a.re.test(url.hostname));
  if (!A) return new Response(null, { headers: { 'x-middleware-next': '1' } });
  const app = new URL(A.path, url.origin);
  try {
    // o cabeçalho pula o redirecionamento da página para / (senão a busca voltava para cá, em laço)
    const r = await fetch(app, { headers: { accept: 'text/html', [A.interno]: '1' }, redirect: 'manual' });
    if (!r.ok) throw new Error(String(r.status));
    const img = url.origin + A.og;
    const meta = `<meta property="og:title" content="${A.titulo}"><meta property="og:description" content="${A.desc}"><meta property="og:image" content="${img}">` +
      `<meta property="og:type" content="website"><meta property="og:url" content="${url.origin}/"><meta name="twitter:card" content="summary">` +
      `<meta name="description" content="${A.desc}">`;
    const html = (await r.text())
      .replace(/<meta name="description"[^>]*>/, '')
      .replace(/<title>[^<]*<\/title>/, `<title>${A.titulo}</title>${meta}`)
      .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="${A.icone}">`)
      .replace(/<link rel="apple-touch-icon" href="[^"]*">/, `<link rel="apple-touch-icon" href="${A.apple}">`);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
  } catch {
    // se a busca falhar, o app abre do mesmo jeito (sem a prévia certa)
    return new Response(null, { headers: { 'x-middleware-rewrite': app.toString() } });
  }
}
