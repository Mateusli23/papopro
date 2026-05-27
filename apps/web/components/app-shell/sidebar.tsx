import { toSwitcherItem } from '@/features/workspace/presentation';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { loadColdAlertsCount } from '@/lib/cold-alerts/load-count';

import { SidebarState } from './sidebar-state';
import type { WorkspaceSwitcherItem } from './workspace-switcher';

/**
 * Sidebar fixa de 240px (CLAUDE.md §8). Visível em ≥1024px; abaixo disso vira
 * drawer no `MobileNav`.
 *
 * **Server Component** — fetch de `getCurrentUserContext` (cached por
 * request via `cache()`) + leitura do cookie `papopro_workspace_id` aqui pra
 * popular o switcher real. `WorkspaceSwitcher` continua client por causa do
 * dropdown + transição otimista.
 *
 * Estrutura: marca → workspace switcher → navegação → rodapé com status.
 */
export async function Sidebar() {
  // Carrega switcher + cold count em paralelo. `loadColdAlertsCount` é cached
  // por request (M10#4) — `Topbar`/`MobileNav` reusam o mesmo round-trip sem
  // dupla query.
  const [{ workspaces, activeWorkspaceId }, coldAlertsCount] = await Promise.all([
    loadSwitcherData(),
    loadColdAlertsCount(),
  ]);

  return (
    <SidebarState
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      coldAlertsCount={coldAlertsCount}
    />
  );
}

/**
 * Helper exportado pra reuso pelo `MobileNav` server wrapper. Centraliza a
 * busca pra evitar 2 round-trips na mesma request — `getCurrentUserContext`
 * é cached por request via React `cache()`, então a chamada dupla é grátis.
 */
export async function loadSwitcherData(): Promise<{
  workspaces: WorkspaceSwitcherItem[];
  activeWorkspaceId: string | null;
}> {
  const context = await getCurrentUserContext();
  const memberships = context?.memberships ?? [];
  const workspaces = memberships.map((m, i) => toSwitcherItem(m, i));
  const cookieValue = readWorkspaceCookie();
  const activeWorkspaceId =
    cookieValue && workspaces.some((w) => w.workspaceId === cookieValue)
      ? cookieValue
      : (workspaces[0]?.workspaceId ?? null);
  return { workspaces, activeWorkspaceId };
}
