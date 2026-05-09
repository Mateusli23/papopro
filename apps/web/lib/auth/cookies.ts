/**
 * Helpers de cookies do AuthMock — fonte única dos NOMES e leitura/escrita
 * tanto no client (`document.cookie`) quanto no Edge runtime do middleware
 * (`request.cookies`).
 *
 * Por que cookies e não localStorage:
 *  - O `middleware.ts` roda em Edge — não tem acesso a localStorage.
 *  - Cookies trafegam em toda request, então o gate de auth funciona no SSR.
 *
 * Por que não httpOnly:
 *  - É AUTH MOCK. Em M7 isso vira sessão Supabase real (httpOnly + signed),
 *    e o `AuthMockProvider` é apagado. Manter visível ao JS aqui evita ter
 *    que duplicar a lógica entre Server Action e provider client-side.
 *
 * Mantemos os nomes prefixados com `papopro_auth_mock_` justamente pra
 * deixar óbvio na DevTools que é placeholder, não produção.
 */

export const AUTH_MOCK_COOKIES = {
  /** Email do "usuário logado". Presença = autenticado. */
  user: 'papopro_auth_mock_user',
  /** ID do workspace ativo. Espelha `FAKE_WORKSPACES[].id`. */
  workspace: 'papopro_auth_mock_workspace',
  /** `'1'` quando o welcome wizard foi concluído ou pulado. */
  wizardCompleted: 'papopro_auth_mock_wizard_completed',
} as const;

/** 30 dias — suficiente pra dev local e previews; expira sozinho se ficar parado. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Lê um cookie no client. Retorna `null` se ausente ou se rodando no server
 * (caller deve tratar). Não usar isso em Server Components — lá use
 * `cookies()` do `next/headers`.
 */
export function readCookieClient(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

/**
 * Escreve um cookie no client com defaults seguros pro mock:
 *  - `path=/` pra valer em qualquer rota
 *  - `SameSite=Lax` (default sano para navegação)
 *  - `Secure` quando estamos em HTTPS (Vercel preview/prod), nunca em dev
 *  - `Max-Age` 30 dias
 *
 * Passar `value=null` apaga o cookie.
 */
export function writeCookieClient(name: string, value: string | null): void {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  if (value === null) {
    document.cookie = `${name}=; path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
}
