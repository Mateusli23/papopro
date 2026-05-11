'use client';

import * as React from 'react';

import { ACTIVE_WORKSPACE_ID, FAKE_WORKSPACES, type Workspace } from '@/lib/fixtures/workspaces';

/**
 * `WorkspaceMockProvider` — **placeholder temporário** até M7#4.
 *
 * Em M7#3 a auth de usuário virou real (Supabase), mas workspaces continuam
 * fixtures porque a criação real depende do wizard de onboarding ser ligado
 * (M7#4: signup → criar workspace de verdade → primeiro member com role
 * Owner). Pra não pisar nas telas que dependem de `activeWorkspace` e
 * `wizardCompleted`, mantemos esse provider com a mesma forma de API que o
 * `AuthMockProvider` tinha pra workspace.
 *
 * **Sai inteiro em M7#4**, junto com `lib/fixtures/workspaces.ts`. O nome do
 * arquivo, do hook (`useWorkspaceMock`) e dos cookies (`papopro_workspace_mock_*`)
 * carrega o "Mock" propositalmente pra deixar óbvio na DevTools que é
 * placeholder.
 *
 * Cookies próprios (separados do que o `AuthMockProvider` usava) para não
 * deixar resíduo do mock antigo bagunçando o estado durante o refactor.
 */

const WORKSPACE_MOCK_COOKIES = {
  active: 'papopro_workspace_mock_active',
  wizardCompleted: 'papopro_workspace_mock_wizard_completed',
} as const;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

interface WorkspaceMockState {
  loading: boolean;
  activeWorkspace: Workspace | null;
  wizardCompleted: boolean;
}

interface WorkspaceMockContextValue extends WorkspaceMockState {
  setActiveWorkspace: (workspaceId: string) => void;
  markWizardCompleted: () => void;
}

const WorkspaceMockContext = React.createContext<WorkspaceMockContextValue | null>(null);

export function WorkspaceMockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WorkspaceMockState>({
    loading: true,
    activeWorkspace: null,
    wizardCompleted: false,
  });

  React.useEffect(() => {
    const workspaceId = readCookieClient(WORKSPACE_MOCK_COOKIES.active) ?? ACTIVE_WORKSPACE_ID;
    const completed = readCookieClient(WORKSPACE_MOCK_COOKIES.wizardCompleted) === '1';

    setState({
      loading: false,
      activeWorkspace: FAKE_WORKSPACES.find((w) => w.id === workspaceId) ?? FAKE_WORKSPACES[0]!,
      wizardCompleted: completed,
    });
  }, []);

  const setActiveWorkspace = React.useCallback((workspaceId: string) => {
    const ws = FAKE_WORKSPACES.find((w) => w.id === workspaceId);
    if (!ws) return;
    writeCookieClient(WORKSPACE_MOCK_COOKIES.active, ws.id);
    setState((s) => ({ ...s, activeWorkspace: ws }));
  }, []);

  const markWizardCompleted = React.useCallback(() => {
    writeCookieClient(WORKSPACE_MOCK_COOKIES.wizardCompleted, '1');
    setState((s) => ({ ...s, wizardCompleted: true }));
  }, []);

  const value = React.useMemo<WorkspaceMockContextValue>(
    () => ({ ...state, setActiveWorkspace, markWizardCompleted }),
    [state, setActiveWorkspace, markWizardCompleted],
  );

  return <WorkspaceMockContext.Provider value={value}>{children}</WorkspaceMockContext.Provider>;
}

export function useWorkspaceMock(): WorkspaceMockContextValue {
  const ctx = React.useContext(WorkspaceMockContext);
  if (!ctx) {
    throw new Error('useWorkspaceMock precisa estar dentro de <WorkspaceMockProvider>');
  }
  return ctx;
}

function readCookieClient(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeCookieClient(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const isHttps = window.location.protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secureFlag}`;
}
