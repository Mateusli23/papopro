import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client para o **Edge runtime do middleware**.
 *
 * Por que separado de `server.ts` (que usa `cookies()` de `next/headers`):
 * o middleware roda antes de qualquer rota e recebe `req`/`res` diretamente.
 * `next/headers` não está disponível ali — usamos `req.cookies` e
 * `response.cookies` pra ler/escrever.
 *
 * **Refresh implícito da sessão.** `getUser()` checa o JWT no Supabase; se
 * vencido, o SDK renova e o callback `setAll` aqui propaga os novos cookies
 * pra `req` (pras Server Components lerem o token novo) e pra `response`
 * (pro browser persistir). Sem esse passo, a sessão "morre silenciosamente"
 * 1h após o login, jogando o user pro /login no meio do uso.
 *
 * Retorna `{ response, user, emailConfirmedAt }` pro middleware decidir o
 * redirect. `response` precisa ser o NextResponse devolvido — qualquer outro
 * que você devolver perde os cookies renovados.
 */
export async function updateSession(req: NextRequest): Promise<{
  response: NextResponse;
  user: Awaited<
    ReturnType<ReturnType<typeof createServerClient>['auth']['getUser']>
  >['data']['user'];
}> {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propaga pros dois lados: req (Server Components dessa request)
          // e response (browser nas próximas requests).
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` em vez de `getSession()`: faz round-trip no Supabase pra
  // validar o JWT, evitando confiar em cookie potencialmente forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
