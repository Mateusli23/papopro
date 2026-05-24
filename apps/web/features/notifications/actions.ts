'use server';

import { type Prisma, prisma } from '@papopro/db';

import type { NotificationPrefs } from '@/features/settings/types';
import { ALL_ROLES, requireRole } from '@/lib/auth/require-role';
import { NOTIFICATION_EVENTS } from '@/lib/fixtures/notification-prefs';
import { sendWebPush } from '@/lib/notifications/web-push';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import {
  type NotificationPrefInput,
  type PushSubscriptionInput,
  notificationPrefInputSchema,
  pushSubscriptionInputSchema,
} from './schemas';
import type { NotificationActionResult } from './types';

/**
 * Server Actions do domínio Notificações (M13#2).
 *
 * **Push subscriptions usam `prisma` direto (sem `withWorkspace`).** O
 * `endpoint` é UNIQUE global: quando outro usuário loga no mesmo browser e
 * assina, a linha precisa ser *reatribuída* (workspace + user). A policy RLS
 * de UPDATE checa o workspace da linha *antiga* e bloquearia a reatribuição.
 * Como os valores escritos vêm sempre do contexto autenticado (`requireRole`),
 * não há risco de spoof — defense-in-depth mantido pelo `where`/valores.
 *
 * **Preferências e leitura de notificações usam `withWorkspace`** — escrita
 * limpa dentro do próprio workspace, RLS aplicada.
 */

// ─── Push subscriptions ─────────────────────────────────────────────────────

/**
 * Persiste (ou re-sincroniza) a assinatura push deste dispositivo. UPSERT por
 * `endpoint` — re-assinar o mesmo browser atualiza chaves + `lastSeenAt`.
 */
export async function savePushSubscriptionAction(
  input: PushSubscriptionInput,
): Promise<NotificationActionResult> {
  const parsed = pushSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Dados da assinatura push inválidos.' };
  }

  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { workspaceId, userId } = auth.ctx;
  const { endpoint, p256dh, auth: authKey, userAgent } = parsed.data;

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        workspaceId,
        userId,
        endpoint,
        p256dh,
        auth: authKey,
        userAgent: userAgent ?? null,
      },
      update: {
        workspaceId,
        userId,
        p256dh,
        auth: authKey,
        userAgent: userAgent ?? null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.savePushSubscription', err, { workspaceId });
    return { ok: false, error: 'Não foi possível salvar a assinatura push.' };
  }
}

/** Remove a assinatura push deste dispositivo (usuário desativou o push). */
export async function removePushSubscriptionAction(
  endpoint: string,
): Promise<NotificationActionResult> {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
    return { ok: false, error: 'Endpoint inválido.' };
  }

  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, workspaceId: auth.ctx.workspaceId, userId: auth.ctx.userId },
    });
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.removePushSubscription', err, {
      workspaceId: auth.ctx.workspaceId,
    });
    return { ok: false, error: 'Não foi possível remover a assinatura push.' };
  }
}

/** Dispara um push de teste pra todos os dispositivos do próprio caller. */
export async function sendTestPushAction(): Promise<NotificationActionResult> {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { workspaceId, userId } = auth.ctx;

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { workspaceId, userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subs.length === 0) {
      return { ok: false, error: 'Nenhum dispositivo assinado — ative o push primeiro.' };
    }

    const results = await Promise.allSettled(
      subs.map((s) =>
        sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          {
            title: 'PapoPro — push de teste',
            body: 'Funcionou! As notificações push estão ativas neste dispositivo.',
            url: '/settings/notifications',
            tag: 'test-push',
          },
        ),
      ),
    );

    // Limpa subscriptions mortas (404/410) detectadas no teste.
    const expiredIds = results.flatMap((r, i) =>
      r.status === 'fulfilled' && !r.value.ok && r.value.expired ? [subs[i]!.id] : [],
    );
    if (expiredIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: expiredIds }, workspaceId },
      });
    }

    const delivered = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
    if (delivered === 0) {
      return {
        ok: false,
        error: 'Não foi possível entregar o push de teste — verifique a configuração do servidor.',
      };
    }
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.sendTestPush', err, { workspaceId });
    return { ok: false, error: 'Não foi possível enviar o push de teste.' };
  }
}

// ─── Preferências (matriz PRD §3.2) ─────────────────────────────────────────

/**
 * Liga/desliga um par evento × canal na matriz de preferências. Merge no
 * JSONB `notification_preferences.prefs`. Eventos administrativos não podem
 * ser desligados (PRD §3.2) — rejeitado mesmo se a UI tentar.
 */
export async function updateNotificationPrefAction(
  input: NotificationPrefInput,
): Promise<NotificationActionResult> {
  const parsed = notificationPrefInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Preferência inválida.' };
  }

  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { event, channel, enabled } = parsed.data;
  const eventDef = NOTIFICATION_EVENTS.find((e) => e.key === event);
  if (!eventDef) return { ok: false, error: 'Evento desconhecido.' };
  if (eventDef.isAdministrative) {
    return { ok: false, error: 'Evento administrativo — não pode ser desligado.' };
  }
  if (!eventDef.channels.includes(channel)) {
    return { ok: false, error: 'Este evento não usa esse canal.' };
  }

  const { workspaceId, userId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const existing = await tx.notificationPreference.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { prefs: true },
      });
      const prefs = ((existing?.prefs as NotificationPrefs | null) ?? {}) as NotificationPrefs;
      const nextPrefs = {
        ...prefs,
        [event]: { ...(prefs[event] ?? {}), [channel]: enabled },
      } as Prisma.InputJsonValue;

      await tx.notificationPreference.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        create: { workspaceId, userId, prefs: nextPrefs },
        update: { prefs: nextPrefs },
      });
    });
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.updatePref', err, { workspaceId });
    return { ok: false, error: 'Não foi possível salvar a preferência.' };
  }
}

// ─── Sino in-app ────────────────────────────────────────────────────────────

/** Marca uma notificação como lida. */
export async function markNotificationReadAction(id: string): Promise<NotificationActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'ID inválido.' };

  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { workspaceId, userId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, (tx) =>
      tx.notification.updateMany({
        where: { id, workspaceId, userId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.markRead', err, { workspaceId });
    return { ok: false, error: 'Não foi possível marcar como lida.' };
  }
}

/** Marca todas as notificações não-lidas do caller como lidas. */
export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { workspaceId, userId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, (tx) =>
      tx.notification.updateMany({
        where: { workspaceId, userId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
    return { ok: true };
  } catch (err) {
    reportNonFatal('notifications.markAllRead', err, { workspaceId });
    return { ok: false, error: 'Não foi possível marcar todas como lidas.' };
  }
}
