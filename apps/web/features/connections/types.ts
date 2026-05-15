/**
 * Tipos do feature Connections (M9#2 — WhatsApp uazapi + status server-fed).
 *
 * Shape de retorno consumido pelo `WhatsAppConnectionCard`. Renomeei `status`
 * pra alinhar com o que `WhatsappInstance.status` (Prisma) guarda: string
 * (`disconnected`/`connecting`/`connected`) — não confundir com o `WhatsAppStatus`
 * antigo do mock M5 (que era `'connected' | 'connecting' | 'disconnected'`).
 *
 * `health` segue o enum `HealthScore` do schema (M9#1) mas serializado como
 * string pra que o componente client não precise importar Prisma.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type ConnectionHealth = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Shape consumido pelo `WhatsAppConnectionCard`. Inclui campos pra:
 *   - render do estado atual (status/health/phoneNumber/displayName)
 *   - QR code quando `status === 'connecting'` + `qrBase64`/`qrExpiresAt`
 *   - métricas (messagesSent24h, lastSeenAt, connectedAt)
 */
export interface ConnectionUI {
  /** Existe registro de WhatsappAccount pro workspace. */
  accountExists: boolean;
  /** Status persistido em `WhatsappInstance.status`. */
  status: ConnectionStatus;
  /** Health score derivado pelo heartbeat (M9#5). Default `healthy`. */
  health: ConnectionHealth;
  /** ID que o provedor atribuiu — necessário pras chamadas subsequentes. */
  externalInstanceId: string | null;
  /** Número conectado — formato BR `+55 11 99999-9999`. */
  phoneNumber: string | null;
  displayName: string | null;
  /** QR base64 — só presente quando `status === 'connecting'`. */
  qrBase64: string | null;
  /** Expiração do QR em ISO. Cliente compara com NOW pra renovar. */
  qrExpiresAt: string | null;
  /** ISO da última conexão confirmada (M9#3 webhook seta). */
  connectedAt: string | null;
  /** ISO da última desconexão. */
  disconnectedAt: string | null;
  /** ISO do último heartbeat OK. Atualizado pelo M9#5. */
  lastSeenAt: string | null;
  /** Janela rotativa de 24h. Atualizado pelo anti-ban (M9#3). */
  messagesSent24h: number;
  /** Anti-ban pausa: se setado e futuro, envios bloqueados até essa hora. */
  pausedUntil: string | null;
}
