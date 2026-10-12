// Whatch: em whatch.madeinbr.app (e nos endereços de teste do projeto na Vercel), a raiz abre o app (telas.html).
// A regra de reescrita do vercel.json não basta: na raiz, o index.html do mochilão vence. Aqui roda antes dos arquivos.
// O HTML sai com o título, a descrição e a imagem do Whatch já no código, para a prévia do link (WhatsApp, iMessage),
// que não roda o JavaScript da página. Nos outros endereços (mochilao.madeinbr.app), não faz nada.
export const config = { matcher: ['/'] };

const TITULO = 'Whatch · filmes e séries do seu jeito';
const DESC = 'Diga do que você gosta (ou cole o que a sua IA já sabe) e o Whatch monta a sua lista de filmes e séries, com onde assistir no Brasil.';

export default async function middleware(request) {
  const url = new URL(request.url);
  if (!/^(whatch|whattowatch)/.test(url.hostname)) return new Response(null, { headers: { 'x-middleware-next': '1' } });
  const app = new URL('/telas', url.origin);
  try {
    const r = await fetch(app, { headers: { accept: 'text/html' } });
    if (!r.ok) throw new Error(String(r.status));
    const img = url.origin + '/whatch/icone-512.png';
    const meta = `<meta property="og:title" content="${TITULO}"><meta property="og:description" content="${DESC}"><meta property="og:image" content="${img}">` +
      `<meta property="og:type" content="website"><meta property="og:url" content="${url.origin}/"><meta name="twitter:card" content="summary">` +
      `<meta name="description" content="${DESC}">`;
    const html = (await r.text())
      .replace(/<title>[^<]*<\/title>/, `<title>${TITULO}</title>${meta}`)
      .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="/whatch/icone.svg">')
      .replace('<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '<link rel="apple-touch-icon" href="/whatch/icone-180.png">');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
  } catch {
    // se a busca falhar, o app abre do mesmo jeito (sem a prévia certa)
    return new Response(null, { headers: { 'x-middleware-rewrite': app.toString() } });
  }
}
