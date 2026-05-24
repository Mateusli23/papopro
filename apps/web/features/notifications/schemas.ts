import { z } from 'zod';

import type { NotificationEventKey } from '@/features/settings/types';
import { NOTIFICATION_EVENT_KEYS } from '@/lib/fixtures/notification-prefs';

/**
 * Schemas Zod do domínio Notificações (M13#2). Valida o input externo das
 * Server Actions de assinatura push e de preferências — CLAUDE.md §5
 * ("Zod em 100% do input externo").
 */

/**
 * `PushSubscription` serializada pelo browser. `endpoint` é uma URL https do
 * push service; `p256dh`/`auth` são chaves base64url.
 */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(256),
  userAgent: z.string().max(512).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

/** Toggle de um par evento × canal na matriz de preferências (PRD §3.2). */
export const notificationPrefInputSchema = z.object({
  event: z.enum(NOTIFICATION_EVENT_KEYS as [NotificationEventKey, ...NotificationEventKey[]]),
  channel: z.enum(['inapp', 'push', 'email']),
  enabled: z.boolean(),
});

export type NotificationPrefInput = z.infer<typeof notificationPrefInputSchema>;
