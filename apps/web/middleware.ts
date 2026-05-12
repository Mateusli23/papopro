import { NextResponse, type NextRequest } from 'next/server';

import { getMembershipCountForUser, isUserMemberOfWorkspace } from '@/features/workspace/queries';
import { safeNextParam } from '@/lib/auth/safe-next-param';
import {
  clearWorkspaceCookieOnResponse,
  readWorkspaceCookieFromRequest,
  setWorkspaceCookieOnResponse,
} from '@/lib/auth/workspace-cookie';
import { updateSession } from '@/lib/supabase/middleware';
import { isUuid } from '@/lib/utils/uuid';

/**
 * Middleware de auth — Supabase real + multi-tenant gate (M7#3 + M7#4 Onda 1).
 *
 * **Regras (em ordem):**
 *
 *  1. `/auth/callback` (handler PKCE): passa sem checagem — quem aterrissa
 *     aqui ainda não tem sessão, é justamente onde a sessão é criada.
 *
 *  2. `/` (raiz): redireciona pro destino certo. Sem user → `/login`. Com
 *     user mas sem email confirmado → `/verify-email`. Com user confirmado
 *     → `/onboarding` se ainda não tem workspace, `/dashboard` se já tem.
 *
 *  3. Rotas de auth (`/login`, `/signup`, `/forgot`): se já logado,
 *     redireciona pra `/dashboard`/`/onboarding` ou `/verify-email`.
 *
 *  4. `/verify-email`: exige logado. Já confirmado → `/dashboard`/`/onboarding`.
 *
 *  5. `/onboarding`: exige logado + email confirmado. Se já tem workspace,
 *     **redireciona pra `/dashboard`** — não deixar criar dois "primeiros"
 *     workspaces sem intenção. Sem workspace, libera (é a tela de criação).
 *
 *  6. Demais rotas (dashboard, configurações etc.): exigem logado + email
 *     confirmado + 1+ workspaces. Sem workspace → `/onboarding`.
 *
 * **Determinação de "tem workspace":**
 *
 *  - **Fast path:** cookie `papopro_workspace_id` (httpOnly, setado pela
 *    `createWorkspaceAction`). Presente → tem workspace, sem query.
 *  - **Slow path (cache miss):** cookie ausente + user logado → 1 query
 *    via `getMembershipCountForUser` (admin client, fetch-based, Edge-safe).
 *    Resultado popula o cookie na resposta — próximos requests da sessão
 *    voltam pro fast path.
 *
 * **Trade-off vs. checar em cada request:** o cookie pode ficar stale (user
 * foi removido de todos os workspaces enquanto navegava). Aceitável até
 * M7#5 trazer revogação; pior caso é o usuário ver tela 403 da action em
 * vez do bounce automático.
 *
 * CLAUDE.md §7.8: verificação de email obrigatória antes do primeiro acesso.
 * CLAUDE.md §7.2: defense-in-depth — middleware é só gate, RLS + filtro no
 * código continuam sendo a fonte de verdade.
 */

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot']);
const VERIFY_ROUTE = '/verify-email';
const ONBOARDING_ROUTE = '/onboarding';
const INVITE_ACCEPT_ROUTE = '/invite/accept';
const DEFAULT_LOGGED_OUT = '/login';
const DEFAULT_LOGGED_IN = '/dashboard';

/**
 * Resolve "tem workspace?" usando o cookie como cache e fallback pra query.
 *
 * **Fast path (M7#5 fix MEDIUM #17):** cookie presente é validado contra
 * membership real — protege contra cookie stale (Owner removeu o user; user
 * logou com outra conta no mesmo browser; cookie TTL de 30d > sessão
 * Supabase). `isUserMemberOfWorkspace` é cacheado 60s no Edge worker, então
 * o custo é diluído entre requests da mesma janela. Se mismatch, limpa
 * cookie e cai pro slow path.
 *
 * **Slow path (cache miss):** lookup `getMembershipCountForUser` (também
 * cacheado 60s). Popula o cookie com o `firstWorkspaceId` pra próximos
 * requests da sessão.
 *
 * Side effect: tanto fast (mismatch) quanto slow (sucesso) escrevem cookies
 * na `response` passada — caller deve devolver essa response pro browser
 * persistir.
 */
async function resolveHasWorkspace(
  req: NextRequest,
  response: NextResponse,
  userId: string,
): Promise<boolean> {
  const cookieValue = readWorkspaceCookieFromRequest(req);
  if (cookieValue && isUuid(cookieValue)) {
    const isMember = await isUserMemberOfWorkspace(userId, cookieValue);
    if (isMember) return true;
    // Cookie stale — limpa pra evitar que rotas downstream batam em 403.
    clearWorkspaceCookieOnResponse(response);
  }

  const { count, firstWorkspaceId } = await getMembershipCountForUser(userId);
  if (count > 0 && firstWorkspaceId) {
    setWorkspaceCookieOnResponse(response, firstWorkspaceId);
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Callback PKCE é público — quem chega aqui está prestes a logar.
  if (pathname.startsWith('/auth/callback')) {
    const { response } = await updateSession(req);
    return response;
  }

  const { response, user } = await updateSession(req);
  const emailVerified = user?.email_confirmed_at != null;

  // 1b. `/invite/accept` é **semi-público** (M7#4 Onda 2).
  //   - Logado OU não logado: a página decide a variante (LoggedOutState
  //     mostra CTA pra signup/login com `?next=` propagado; AcceptForm
  //     mostra o aceite).
  //   - **Mas** se logado + email NÃO confirmado: força /verify-email.
  //     Aceitar sem email confirmado quebra o invariante "todo membro
  //     tem email verificado" que outras telas assumem.
  //
  // **Fix M7#5 MEDIUM #15:** antes deletávamos o `?token=` no redirect — o
  // user confirmava email e voltava pro `/onboarding` (ou `/dashboard`) sem
  // o convite, perdendo o fluxo. Agora preservamos `path + search` no
  // `?next=` da `/verify-email`; o handler do `/verify-email` (logo abaixo)
  // honra `next` ao detectar email confirmado.
  if (pathname.startsWith(INVITE_ACCEPT_ROUTE)) {
    if (user && !emailVerified) {
      const url = req.nextUrl.clone();
      const originalDestination = pathname + req.nextUrl.search;
      url.pathname = VERIFY_ROUTE;
      url.search = '';
      url.searchParams.set('next', originalDestination);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 2. Raiz: encaminha conforme estado.
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    if (!user) {
      url.pathname = DEFAULT_LOGGED_OUT;
    } else if (!emailVerified) {
      url.pathname = VERIFY_ROUTE;
    } else {
      const hasWorkspace = await resolveHasWorkspace(req, response, user.id);
      url.pathname = hasWorkspace ? DEFAULT_LOGGED_IN : ONBOARDING_ROUTE;
    }
    // Reaproveita a response (com cookies renovados pelo updateSession e
    // potencialmente o cookie de workspace populado em resolveHasWorkspace).
    return NextResponse.redirect(url, { headers: response.headers });
  }

  // 3. Rotas de auth.
  if (AUTH_ROUTES.has(pathname)) {
    if (user) {
      const url = req.nextUrl.clone();
      if (!emailVerified) {
        url.pathname = VERIFY_ROUTE;
        url.search = '';
      } else {
        // `?next=` é honrado pra quem JÁ está logado bater no link certo
        // depois (caso típico Onda 2: /signup?next=/invite/accept?token=…
        // pra um user que já tinha conta).
        const next = safeNextParam(req.nextUrl.searchParams.get('next'));
        if (next) {
          const target = new URL(next, req.url);
          return NextResponse.redirect(target, { headers: response.headers });
        }
        const hasWorkspace = await resolveHasWorkspace(req, response, user.id);
        url.pathname = hasWorkspace ? DEFAULT_LOGGED_IN : ONBOARDING_ROUTE;
        url.search = '';
      }
      return NextResponse.redirect(url, { headers: response.headers });
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
      // **Fix M7#5 MEDIUM #15:** honra `?next=` se foi preservado pelo
      // redirect de `/invite/accept` (caso do user que clicou no convite
      // antes de confirmar email — retomar o aceite pós-confirmação).
      const next = safeNextParam(req.nextUrl.searchParams.get('next'));
      if (next) {
        const target = new URL(next, req.url);
        return NextResponse.redirect(target, { headers: response.headers });
      }
      const url = req.nextUrl.clone();
      const hasWorkspace = await resolveHasWorkspace(req, response, user.id);
      url.pathname = hasWorkspace ? DEFAULT_LOGGED_IN : ONBOARDING_ROUTE;
      url.search = '';
      return NextResponse.redirect(url, { headers: response.headers });
    }
    return response;
  }

  // 5/6. Demais rotas exigem logado + email confirmado primeiro.
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = DEFAULT_LOGGED_OUT;
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (!emailVerified) {
    const url = req.nextUrl.clone();
    url.pathname = VERIFY_ROUTE;
    return NextResponse.redirect(url);
  }

  // 5. `/onboarding` é o único caminho que aceita "sem workspace". Se já
  // tem, manda pro dashboard (não criar duplicata por refresh).
  if (pathname === ONBOARDING_ROUTE) {
    const hasWorkspace = await resolveHasWorkspace(req, response, user.id);
    if (hasWorkspace) {
      const url = req.nextUrl.clone();
      url.pathname = DEFAULT_LOGGED_IN;
      return NextResponse.redirect(url, { headers: response.headers });
    }
    return response;
  }

  // 6. Demais rotas protegidas: precisa ter workspace.
  const hasWorkspace = await resolveHasWorkspace(req, response, user.id);
  if (!hasWorkspace) {
    const url = req.nextUrl.clone();
    url.pathname = ONBOARDING_ROUTE;
    return NextResponse.redirect(url, { headers: response.headers });
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
