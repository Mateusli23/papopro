import 'server-only';

import { prisma } from '@papopro/db';

import type {
  NotificationChannel,
  NotificationEventDef,
  NotificationEventKey,
  NotificationPrefs,
} from '@/features/settings/types';
import { sendEmail } from '@/lib/email/resend';
import { renderNotificationEmail } from '@/lib/email/templates/notification';
import { NOTIFICATION_EVENTS } from '@/lib/fixtures/notification-prefs';
import { reportNonFatal } from '@/lib/observability/report';

import { type WebPushSubscription, isWebPushConfigured, sendWebPush } from './web-push';

/**
 * Dispatcher central de notificações (M13#2) — fonte única do fanout da
 * matriz PRD §3.2. Todo evento que notifica um usuário passa por aqui.
 *
 * **Fanout por canal**, respeitando `notification_preferences`:
 *  - `inapp`  → INSERT em `notifications` (lido pelo sino do topbar)
 *  - `push`   → Web Push criptografado pra cada `push_subscriptions` do user
 *  - `email`  → Resend com o template genérico de notificação
 *
 * **Contexto de execução = admin/sistema.** Chamado por cron, webhook e a
 * rota interna `/api/internal/notify` — nunca "usuário clicou no dashboard".
 * Por isso usa `prisma` direto (sem `withWorkspace`), igual ao job
 * `cron/trial-warnings`, sempre filtrando `workspaceId`/`userId` no `where`
 * (defense-in-depth, CLAUDE.md §7.2).
 *
 * **Nunca lança.** Cada canal é isolado em try/catch + `reportNonFatal` — uma
 * falha de push não pode derrubar o webhook ou o cron que disparou o evento.
 *
 * **Preferências:** default = ligado pros canais que a matriz permite (espelha
 * `FAKE_NOTIFICATION_PREFS`). Eventos administrativos ignoram a preferência
 * (PRD §3.2 "não podem ser desligados").
 */

const EVENT_BY_KEY = new Map<NotificationEventKey, NotificationEventDef>(
  NOTIFICATION_EVENTS.map((e) => [e.key, e]),
);

export interface DispatchNotificationInput {
  workspaceId: string;
  event: NotificationEventKey;
  /** Usuários que devem receber. Deduplicado internamente. */
  recipientUserIds: string[];
  title: string;
  body: string;
  /** Deep-link (relativo, ex: `/leads/abc`). Vira link no sino, push e email. */
  url?: string;
  /**
   * Restringe os canais considerados (interseção com a matriz + as
   * preferências). Default: todos. Ex: o cron de trial já manda o email
   * dedicado, então passa `['inapp', 'push']` pra não duplicar.
   */
  channels?: NotificationChannel[];
  /** Base absoluta pra montar o link do email. Default: `NEXT_PUBLIC_APP_URL`. */
  appBaseUrl?: string;
}

export interface DispatchResult {
  inappCreated: number;
  pushSent: number;
  pushExpired: number;
  emailSent: number;
  errors: number;
}

/**
 * Resolve se um canal está ligado pro evento, dadas as preferências do user.
 * Canal fora da matriz do evento → sempre `false`. Evento administrativo →
 * sempre `true`. Sem preferência salva → default ligado.
 */
function isChannelEnabled(
  eventDef: NotificationEventDef,
  channel: NotificationChannel,
  userPrefs: NotificationPrefs | null,
): boolean {
  if (!eventDef.channels.includes(channel)) return false;
  if (eventDef.isAdministrative) return true;
  const eventPrefs = userPrefs?.[eventDef.key];
  return eventPrefs?.[channel] ?? true;
}

/** Monta o link absoluto pro email a partir de uma URL possivelmente relativa. */
function toAbsoluteUrl(url: string | undefined, appBaseUrl: string | undefined): string {
  const base = (appBaseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  if (!url) return base || '/';
  if (/^https?:\/\//.test(url)) return url;
  return base ? `${base}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    inappCreated: 0,
    pushSent: 0,
    pushExpired: 0,
    emailSent: 0,
    errors: 0,
  };

  const eventDef = EVENT_BY_KEY.get(input.event);
  if (!eventDef) {
    reportNonFatal('notifications.dispatch.unknown_event', new Error(input.event), {
      workspaceId: input.workspaceId,
    });
    return result;
  }

  const recipientIds = [...new Set(input.recipientUserIds)].filter(Boolean);
  if (recipientIds.length === 0) return result;

  const allowed = input.channels ?? ['inapp', 'push', 'email'];
  const wants = (channel: NotificationChannel) => allowed.includes(channel);

  // ─── Preferências dos destinatários (1 query) ──────────────────────────────
  let prefsByUser = new Map<string, NotificationPrefs | null>();
  try {
    const rows = await prisma.notificationPreference.findMany({
      where: { workspaceId: input.workspaceId, userId: { in: recipientIds } },
      select: { userId: true, prefs: true },
    });
    prefsByUser = new Map(rows.map((r) => [r.userId, r.prefs as NotificationPrefs | null]));
  } catch (err) {
    // Sem preferências → todos os usuários caem no default (tudo ligado).
    reportNonFatal('notifications.dispatch.prefs', err, { workspaceId: input.workspaceId });
  }

  const inappUsers = recipientIds.filter(
    (id) => wants('inapp') && isChannelEnabled(eventDef, 'inapp', prefsByUser.get(id) ?? null),
  );
  const pushUsers = recipientIds.filter(
    (id) => wants('push') && isChannelEnabled(eventDef, 'push', prefsByUser.get(id) ?? null),
  );
  const emailUsers = recipientIds.filter(
    (id) => wants('email') && isChannelEnabled(eventDef, 'email', prefsByUser.get(id) ?? null),
  );

  // ─── Canal in-app: INSERT em notifications ─────────────────────────────────
  if (inappUsers.length > 0) {
    try {
      const created = await prisma.notification.createMany({
        data: inappUsers.map((userId) => ({
          workspaceId: input.workspaceId,
          userId,
          event: input.event,
          title: input.title,
          body: input.body,
          url: input.url ?? null,
        })),
      });
      result.inappCreated = created.count;
    } catch (err) {
      result.errors += 1;
      reportNonFatal('notifications.dispatch.inapp', err, { workspaceId: input.workspaceId });
    }
  }

  // ─── Canal push: Web Push criptografado por dispositivo ────────────────────
  if (pushUsers.length > 0 && isWebPushConfigured()) {
    try {
      const subs = await prisma.pushSubscription.findMany({
        where: { workspaceId: input.workspaceId, userId: { in: pushUsers } },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });

      const expiredIds: string[] = [];
      const outcomes = await Promise.allSettled(
        subs.map(async (sub) => {
          const subscription: WebPushSubscription = {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          };
          const r = await sendWebPush(subscription, {
            title: input.title,
            body: input.body,
            url: input.url,
            tag: input.event,
          });
          if (!r.ok && r.expired) expiredIds.push(sub.id);
          return r.ok;
        }),
      );
      result.pushSent = outcomes.filter((o) => o.status === 'fulfilled' && o.value).length;
      result.pushExpired = expiredIds.length;

      // Limpa subscriptions mortas (404/410) — o browser desinstalou ou
      // revogou a permissão.
      if (expiredIds.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { workspaceId: input.workspaceId, id: { in: expiredIds } },
        });
      }
    } catch (err) {
      result.errors += 1;
      reportNonFatal('notifications.dispatch.push', err, { workspaceId: input.workspaceId });
    }
  }

  // ─── Canal email: Resend com template genérico ─────────────────────────────
  if (emailUsers.length > 0) {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: emailUsers } },
        select: { id: true, email: true },
      });
      const email = renderNotificationEmail({
        title: input.title,
        body: input.body,
        actionUrl: toAbsoluteUrl(input.url, input.appBaseUrl),
      });
      const sent = await Promise.allSettled(
        users
          .filter((u) => u.email)
          .map((u) =>
            sendEmail({ to: u.email, subject: email.subject, html: email.html, text: email.text }),
          ),
      );
      result.emailSent = sent.filter((s) => s.status === 'fulfilled' && s.value.ok).length;
    } catch (err) {
      result.errors += 1;
      reportNonFatal('notifications.dispatch.email', err, { workspaceId: input.workspaceId });
    }
  }

  return result;
}
