// Whatch: em whatch.madeinbr.app (e nos endereços de teste do projeto na Vercel), a raiz abre o app (telas.html).
// A regra de reescrita do vercel.json não basta: na raiz, o index.html do mochilão vence. Aqui roda antes dos arquivos.
// Nos outros endereços (mochilao.madeinbr.app), não faz nada.
export const config = { matcher: ['/'] };

export default function middleware(request) {
  const url = new URL(request.url);
  if (/^(whatch|whattowatch)/.test(url.hostname)) {
    url.pathname = '/telas';
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  }
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
