'use client';

import * as React from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * `useUser` — hook client-side do usuário autenticado.
 *
 * Substitui a parte de `user`/`loading` do antigo `useAuthMock`. **Shape
 * compatível**: `{ loading, user, displayName }` — consumidores trocam só o
 * import.
 *
 * **Como funciona.** No mount cria um `createSupabaseBrowserClient()` (que
 * lê os cookies httpOnly via `@supabase/ssr`), pede `auth.getUser()` e fica
 * inscrito em `onAuthStateChange` pra reagir a login/logout disparados em
 * outras abas ou via Server Action + `revalidatePath`. O effect só roda
 * uma vez por consumidor — o cliente do SDK é leve e a sessão é shared via
 * cookie httpOnly.
 *
 * **`displayName`.** Supabase guarda o nome em `user_metadata.name` (escrito
 * pelo `signupAction` no signUp options.data). Quando estiver vazio (signups
 * antigos ou via OAuth sem nome), caímos pra derivar do email (`foo.bar@x` →
 * `Foo Bar`) — mesma heurística que o mock usava, pra preservar a UX da
 * topbar.
 */
export interface UseUserResult {
  loading: boolean;
  user: User | null;
  displayName: string | null;
}

export function useUser(): UseUserResult {
  const [state, setState] = React.useState<UseUserResult>({
    loading: true,
    user: null,
    displayName: null,
  });

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setState({
        loading: false,
        user: data.user,
        displayName: data.user ? resolveDisplayName(data.user) : null,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      setState({
        loading: false,
        user,
        displayName: user ? resolveDisplayName(user) : null,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

function resolveDisplayName(user: User): string {
  const metaName = (user.user_metadata?.name as string | undefined) ?? '';
  if (metaName.trim()) return metaName.trim();
  return nameFromEmail(user.email ?? '');
}

function nameFromEmail(email: string): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
