'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { ACTIVE_WORKSPACE_ID, FAKE_WORKSPACES, type Workspace } from '@/lib/fixtures/workspaces';

import { AUTH_MOCK_COOKIES, readCookieClient, writeCookieClient } from './cookies';

/**
 * AuthMockProvider — placeholder de sessão até M7.
 *
 * Comportamento:
 *  - Lê cookies no mount pra hidratar o estado (`user`, `activeWorkspace`,
 *    `wizardCompleted`).
 *  - Persiste qualquer mudança imediatamente nos cookies (sincroniza com o
 *    middleware, que lê os mesmos cookies no Edge runtime).
 *  - Expõe `signIn`, `signOut`, `setActiveWorkspace`, `markWizardCompleted`
 *    via `useAuthMock()`.
 *
 * Em M7 esse arquivo inteiro é deletado e substituído por `useUser()` do
 * Supabase Auth + Server Actions de signIn/signOut. Os COMPONENTES que
 * consomem este hook só precisam trocar o import — a forma da API
 * (`{ user, activeWorkspace, signOut }`) já casa com o que `@supabase/ssr`
 * oferece.
 *
 * Nota sobre hidratação:
 *  - No SSR retornamos `loading: true` e o estado vazio. O middleware já
 *    fez o gate antes do render, então não há vazamento de UI; é só pra
 *    UI client-side reagir corretamente após hydrate.
 */

interface AuthMockUser {
  email: string;
  /** Nome derivado do email pra UI (parte antes do @). */
  name: string;
}

interface AuthMockState {
  loading: boolean;
  user: AuthMockUser | null;
  activeWorkspace: Workspace | null;
  wizardCompleted: boolean;
}

interface AuthMockContextValue extends AuthMockState {
  signIn: (email: string) => void;
  signOut: () => void;
  setActiveWorkspace: (workspaceId: string) => void;
  markWizardCompleted: () => void;
}

const AuthMockContext = React.createContext<AuthMockContextValue | null>(null);

/**
 * Provider raiz. Coloque no root layout (`apps/web/app/layout.tsx`) — assim
 * tanto telas de auth quanto dashboard compartilham o mesmo estado.
 */
export function AuthMockProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState<AuthMockState>({
    loading: true,
    user: null,
    activeWorkspace: null,
    wizardCompleted: false,
  });

  // Hidrata do cookie no mount. Sem effect de polling — qualquer mudança
  // passa pelos handlers abaixo, que atualizam state E cookie ao mesmo tempo.
  React.useEffect(() => {
    const email = readCookieClient(AUTH_MOCK_COOKIES.user);
    const workspaceId = readCookieClient(AUTH_MOCK_COOKIES.workspace) ?? ACTIVE_WORKSPACE_ID;
    const completed = readCookieClient(AUTH_MOCK_COOKIES.wizardCompleted) === '1';

    setState({
      loading: false,
      user: email ? { email, name: nameFromEmail(email) } : null,
      activeWorkspace: FAKE_WORKSPACES.find((w) => w.id === workspaceId) ?? FAKE_WORKSPACES[0]!,
      wizardCompleted: completed,
    });
  }, []);

  const signIn = React.useCallback((email: string) => {
    writeCookieClient(AUTH_MOCK_COOKIES.user, email);
    // Workspace ativo default = primeiro da lista, a não ser que já exista.
    const existing = readCookieClient(AUTH_MOCK_COOKIES.workspace) ?? ACTIVE_WORKSPACE_ID;
    writeCookieClient(AUTH_MOCK_COOKIES.workspace, existing);
    setState((s) => ({
      ...s,
      loading: false,
      user: { email, name: nameFromEmail(email) },
      activeWorkspace: FAKE_WORKSPACES.find((w) => w.id === existing) ?? FAKE_WORKSPACES[0]!,
    }));
  }, []);

  const signOut = React.useCallback(() => {
    writeCookieClient(AUTH_MOCK_COOKIES.user, null);
    writeCookieClient(AUTH_MOCK_COOKIES.workspace, null);
    writeCookieClient(AUTH_MOCK_COOKIES.wizardCompleted, null);
    setState({
      loading: false,
      user: null,
      activeWorkspace: null,
      wizardCompleted: false,
    });
    router.push('/login');
  }, [router]);

  const setActiveWorkspace = React.useCallback((workspaceId: string) => {
    const ws = FAKE_WORKSPACES.find((w) => w.id === workspaceId);
    if (!ws) return;
    writeCookieClient(AUTH_MOCK_COOKIES.workspace, ws.id);
    setState((s) => ({ ...s, activeWorkspace: ws }));
  }, []);

  const markWizardCompleted = React.useCallback(() => {
    writeCookieClient(AUTH_MOCK_COOKIES.wizardCompleted, '1');
    setState((s) => ({ ...s, wizardCompleted: true }));
  }, []);

  // Memo do `value` evita re-render em consumidores quando `state` não mudou.
  const value = React.useMemo<AuthMockContextValue>(
    () => ({ ...state, signIn, signOut, setActiveWorkspace, markWizardCompleted }),
    [state, signIn, signOut, setActiveWorkspace, markWizardCompleted],
  );

  return <AuthMockContext.Provider value={value}>{children}</AuthMockContext.Provider>;
}

export function useAuthMock(): AuthMockContextValue {
  const ctx = React.useContext(AuthMockContext);
  if (!ctx) {
    throw new Error('useAuthMock precisa estar dentro de <AuthMockProvider>');
  }
  return ctx;
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  // Capitaliza segmentos separados por `.` ou `_` ou `-`.
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
