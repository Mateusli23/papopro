import 'server-only';

import { cache } from 'react';

import {
  type ColdAlertUI,
  countActiveColdAlerts,
  listActiveColdAlerts,
} from '@/features/cadences/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import type { Role } from '@/lib/auth/require-role';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

/**
 * Conta cold alerts não-acknowledged pro caller no workspace ativo (M10#4).
 *
 * Server-side, cached por request via React `cache()` — mesmo round-trip
 * compartilhado entre Sidebar (desktop) e Topbar→MobileNav (sempre montados).
 *
 * Retorna 0 em qualquer falha (sem sessão, sem workspace ativo, sem
 * membership, erro de query) — UI degrada graciosamente sem badge em vez de
 * derrubar o layout inteiro.
 */
export const loadColdAlertsCount = cache(async (): Promise<number> => {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx) return 0;

    const workspaceId = readWorkspaceCookie();
    if (!workspaceId) return 0;

    const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) return 0;

    // Viewer não recebe badge — UI não expõe ações sobre cold alerts pra ele.
    const role = membership.role as Role;
    if (role === 'Viewer') return 0;

    return await countActiveColdAlerts(workspaceId, ctx.user.id, role);
  } catch {
    return 0;
  }
});

/**
 * Lista cold alerts ativos pro caller (M10#4). Cached por request — mesmo
 * round-trip do NotificationsButton (Server wrapper).
 *
 * Retorna `[]` em qualquer falha — UI degrada graciosamente sem cold alerts
 * no drawer em vez de quebrar o sino inteiro.
 */
export const loadActiveColdAlerts = cache(async (): Promise<ColdAlertUI[]> => {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx) return [];

    const workspaceId = readWorkspaceCookie();
    if (!workspaceId) return [];

    const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) return [];

    const role = membership.role as Role;
    if (role === 'Viewer') return [];

    return await listActiveColdAlerts(workspaceId, ctx.user.id, role);
  } catch {
    return [];
  }
});
