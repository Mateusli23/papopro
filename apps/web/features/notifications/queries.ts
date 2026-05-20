import 'server-only';

import { cache } from 'react';

import type { NotificationPrefs } from '@/features/settings/types';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import type { NotificationItem } from './types';

/**
 * Queries server-side do domínio Notificações (M13#2).
 *
 * `cache()` por request — o sino (`NotificationsButton`) e a tela de
 * preferências compartilham o mesmo round-trip. Toda função degrada pra
 * vazio/null em falha: notificação nunca pode derrubar o layout.
 */

const NOTIFICATIONS_WINDOW_DAYS = 30; // PRD §3.2 — sino guarda 30 dias.
const NOTIFICATIONS_LIMIT = 50;

/**
 * Resolve o contexto do caller (user + workspace ativo + membership). Retorna
 * `null` em qualquer lacuna — sem sessão, sem workspace, sem membership.
 */
async function resolveCallerContext(): Promise<{ workspaceId: string; userId: string } | null> {
  const ctx = await getCurrentUserContext();
  if (!ctx) return null;

  const workspaceId = readWorkspaceCookie();
  if (!workspaceId) return null;

  const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!membership) return null;

  return { workspaceId, userId: ctx.user.id };
}

/**
 * Feed de notificações in-app do caller — últimas 50 dos últimos 30 dias,
 * mais recentes primeiro. Alimenta o sino do topbar.
 */
export const loadRecentNotifications = cache(async (): Promise<NotificationItem[]> => {
  try {
    const caller = await resolveCallerContext();
    if (!caller) return [];

    const since = new Date(Date.now() - NOTIFICATIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await withWorkspace(caller.workspaceId, (tx) =>
      tx.notification.findMany({
        where: {
          workspaceId: caller.workspaceId,
          userId: caller.userId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          event: true,
          title: true,
          body: true,
          url: true,
          readAt: true,
          createdAt: true,
        },
      }),
    );

    return rows.map<NotificationItem>((r) => ({
      id: r.id,
      event: r.event,
      title: r.title,
      body: r.body,
      url: r.url,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    reportNonFatal('notifications.loadRecent', err);
    return [];
  }
});

/**
 * Preferências de notificação do caller (`notification_preferences.prefs`).
 * Retorna `null` quando não há linha salva — a UI cai no default (tudo
 * ligado, espelhando `FAKE_NOTIFICATION_PREFS`).
 */
export const loadNotificationPrefs = cache(async (): Promise<NotificationPrefs | null> => {
  try {
    const caller = await resolveCallerContext();
    if (!caller) return null;

    const row = await withWorkspace(caller.workspaceId, (tx) =>
      tx.notificationPreference.findUnique({
        where: {
          workspaceId_userId: { workspaceId: caller.workspaceId, userId: caller.userId },
        },
        select: { prefs: true },
      }),
    );

    return (row?.prefs as NotificationPrefs | null) ?? null;
  } catch (err) {
    reportNonFatal('notifications.loadPrefs', err);
    return null;
  }
});
