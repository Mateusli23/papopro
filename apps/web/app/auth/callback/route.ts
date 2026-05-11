/**
 * `/auth/callback` — handler do PKCE flow do Supabase Auth.
 *
 * **Quem aterriza aqui:**
 *  - Email "Confirme sua conta" (signup) → `?code=…&next=/onboarding`
 *  - Email "Redefinir senha" (forgot) → `?code=…&next=/settings/security`
 *  - Magic link de convite (M7#4) → `?code=…&next=/invitations/accept/<token>`
 *
 * **O que faz:** troca o `code` (token efêmero, 10 min de TTL) por uma sessão
 * httpOnly persistida nos cookies via `@supabase/ssr`. Depois redireciona pro
 * `next` validado (mitiga open-redirect — só aceita paths relativos).
 *
 * Padrão oficial do Supabase pra Next 14 App Router. Documentação:
 * https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Allowlist de paths pós-callback. Qualquer outro vira `/dashboard`. */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Open-redirect guard — só path relativo, sem `//`, sem scheme.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // Email link expirado ou rota acessada sem code? Manda pro login com hint.
  if (!code) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(url);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Erros típicos: code expirado (10 min), code já trocado, JWT inválido.
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'callback_failed');
    // Não vazamos o detalhe do erro na URL — fica nos logs do server.
    console.error('[auth/callback] exchangeCodeForSession falhou', error.message);
    return NextResponse.redirect(url);
  }

  // Sucesso — cookies httpOnly de sessão foram setados pelo @supabase/ssr.
  return NextResponse.redirect(new URL(next, origin));
}
