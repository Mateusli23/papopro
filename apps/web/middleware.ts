import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware de auth — Supabase real (M7#3).
 *
 * Substitui o cookie mock por `supabase.auth.getUser()` via `updateSession`,
 * que também renova o JWT silenciosamente se vencido. O matcher já filtra
 * rotas estáticas/API; aqui só decide quem pode ver o quê.
 *
 * **Regras (em ordem):**
 *
 *  1. `/auth/callback` (handler PKCE): passa sem checagem — quem está
 *     aterrissando aqui ainda não tem sessão, é justamente onde a sessão é
 *     criada.
 *
 *  2. `/` (raiz): redireciona pro destino certo. Sem user → `/login`. Com
 *     user mas sem email confirmado → `/verify-email`. Com user confirmado
 *     → `/dashboard` (o layout dashboard valida se tem workspace e
 *     redireciona pra `/onboarding` se não — M7#4 faz workspace real).
 *
 *  3. Rotas de auth (`/login`, `/signup`, `/forgot`): se já logado,
 *     redireciona pra `/dashboard` ou `/verify-email`. Caso contrário,
 *     libera.
 *
 *  4. `/verify-email`: exige logado. Já confirmado → `/dashboard`.
 *
 *  5. Demais rotas (dashboard, onboarding, configurações etc.): exigem
 *     logado **E** email confirmado. Falta sessão → `/login?next=…`.
 *     Falta confirmação → `/verify-email`.
 *
 * CLAUDE.md §7.8: verificação de email obrigatória antes do primeiro
 * acesso ao produto — regra 5 implementa.
 */

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot']);
const VERIFY_ROUTE = '/verify-email';
const DEFAULT_LOGGED_OUT = '/login';
const DEFAULT_LOGGED_IN = '/dashboard';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Callback PKCE é público — quem chega aqui está prestes a logar.
  if (pathname.startsWith('/auth/callback')) {
    // Mesmo assim, passa pelo updateSession pra cookies vencidos serem
    // renovados na resposta (caso o user esteja já logado e clique outro link).
    const { response } = await updateSession(req);
    return response;
  }

  const { response, user } = await updateSession(req);
  const emailVerified = user?.email_confirmed_at != null;

  // 2. Raiz: encaminha conforme estado.
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    if (!user) {
      url.pathname = DEFAULT_LOGGED_OUT;
    } else if (!emailVerified) {
      url.pathname = VERIFY_ROUTE;
    } else {
      url.pathname = DEFAULT_LOGGED_IN;
    }
    return NextResponse.redirect(url);
  }

  // 3. Rotas de auth.
  if (AUTH_ROUTES.has(pathname)) {
    if (user) {
      const url = req.nextUrl.clone();
      url.pathname = emailVerified ? DEFAULT_LOGGED_IN : VERIFY_ROUTE;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 4. Tela de verificação de email.
  if (pathname === VERIFY_ROUTE) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LOGGED_OUT;
      return NextResponse.redirect(url);
    }
    if (emailVerified) {
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LOGGED_IN;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 5. Demais rotas (dashboard, onboarding, etc): logado + email confirmado.
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = DEFAULT_LOGGED_OUT;
    // Preserva destino original — "acesse seu workspace e te levamos de volta"
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (!emailVerified) {
    const url = req.nextUrl.clone();
    url.pathname = VERIFY_ROUTE;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /*
   * Matcher exclui:
   *  - /api (webhooks Stripe/WhatsApp/leads não devem passar pelo gate)
   *  - /_next (chunks/imagens — qualquer redirect aqui quebra o app)
   *  - /favicon.ico, /manifest.json, /sw.js (PWA assets)
   *  - /legal, /dev (públicos por design)
   *  - arquivos com extensão (imagens, fontes que não estão sob /_next)
   *
   * `/auth/callback` PASSA pelo matcher porque precisa do updateSession
   * pra setar os cookies da sessão recém-criada — a regra 1 trata.
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|legal|dev|.*\\..*).*)',
  ],
};
