/**
 * Tipos do domínio Notificações (M13#2).
 *
 * O contrato server↔client do sino in-app + dos resultados de Server Action.
 * A matriz de eventos × canais (PRD §3.2) vive em
 * `@/lib/fixtures/notification-prefs` e os tipos da matriz em
 * `@/features/settings/types` — não duplicar aqui.
 */

/** Uma linha do feed do sino (espelha a tabela `notifications`). */
export interface NotificationItem {
  id: string;
  /** Chave da matriz PRD §3.2 (`lead_cooling`, `trial_expiring`, ...). */
  event: string;
  title: string;
  body: string;
  /** Deep-link clicável, ou `null`. */
  url: string | null;
  /** ISO — `null` enquanto não lida. */
  readAt: string | null;
  /** ISO. */
  createdAt: string;
}

/** Resultado padrão das Server Actions de notificação. */
export type NotificationActionResult = { ok: true } | { ok: false; error: string };
