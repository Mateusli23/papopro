import { type NextRequest, NextResponse } from 'next/server';

import { AUTH_MOCK_COOKIES } from '@/lib/auth/cookies';

/**
 * Middleware de auth — placeholder M3.
 *
 * Lê o cookie `papopro_auth_mock_user` (escrito pelo `AuthMockProvider`) e
 * decide se redireciona ou deixa passar.
 *
 * Regras:
 *  - `/` → /dashboard (logado) ou /login (não logado)
 *  - rotas `(auth)` (login, signup, forgot, verify-email) — se já logado,
 *    redireciona pra /dashboard. Caso contrário, libera.
 *  - `/onboarding` — exige logado. Sem login → /login.
 *  - rotas `(dashboard)` (qualquer coisa que não seja auth/legal/dev) —
 *    exige logado. Sem login → /login.
 *
 * NÃO toca: /legal/*, /dev/*, /_next/*, /api/*, /favicon.ico, manifest.
 *
 * Em M7 esse arquivo continua existindo (gate de auth é igual), mas o cookie
 * lido vira a sessão Supabase httpOnly e a verificação fica `await
 * createServerClient(req).auth.getUser()`. A forma do middleware não muda.
 */

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot', '/verify-email']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthed = Boolean(req.cookies.get(AUTH_MOCK_COOKIES.user)?.value);

  // 1. Raiz: encaminha pro destino certo conforme estado de auth.
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = isAuthed ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  // 2. Rotas de auth: se já logado, manda pro dashboard. Caso contrário libera.
  if (AUTH_ROUTES.has(pathname)) {
    if (isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 3. Demais rotas (dashboard, onboarding): exigem login.
  //    O `matcher` abaixo já exclui /legal, /dev, /_next, /api e estáticos.
  if (!isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Preserva o destino original como query pra UX futura ("acesse seu
    // workspace e te levamos de volta"). Hoje o login não consome ainda.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Matcher exclui:
   *  - /api (webhooks Stripe/WhatsApp/leads não devem passar pelo gate)
   *  - /_next (chunks/imagens — qualquer redirect aqui quebra o app)
   *  - /favicon.ico, /manifest.json, /sw.js (PWA assets)
   *  - /legal, /dev (públicos por design)
   *  - arquivos com extensão (imagens, fontes que não estão sob /_next)
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|legal|dev|.*\\..*).*)',
  ],
};
