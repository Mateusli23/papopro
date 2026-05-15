/**
 * Transforms puros do feature Connections (M9#2).
 *
 * `toConnectionUI` aceita o par `(WhatsappAccount, WhatsappInstance?)` lido
 * via Prisma e retorna o shape `ConnectionUI` consumido pelo card client.
 * Date → ISO string (componente client serializa via JSON sem Date support).
 * `null` → `null` (campos opcionais virados explícitos no schema TS).
 *
 * Testado puro no smoke `whatsapp-connection-m9` — não toca rede nem banco.
 */
import type { ConnectionHealth, ConnectionStatus, ConnectionUI } from './types';

export interface WhatsappAccountRow {
  id: string;
  phoneNumber: string;
  displayName: string | null;
}

export interface WhatsappInstanceRow {
  id: string;
  externalInstanceId: string | null;
  status: string;
  healthScore: 'healthy' | 'degraded' | 'unhealthy';
  qrCode: string | null;
  qrExpiresAt: Date | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastSeenAt: Date | null;
  messagesSent24h: number;
  pausedUntil: Date | null;
}

const VALID_STATUSES = new Set<ConnectionStatus>(['connected', 'connecting', 'disconnected']);

function normalizeStatus(raw: string): ConnectionStatus {
  return VALID_STATUSES.has(raw as ConnectionStatus) ? (raw as ConnectionStatus) : 'disconnected';
}

export function toConnectionUI(
  account: WhatsappAccountRow | null,
  instance: WhatsappInstanceRow | null,
): ConnectionUI {
  if (!account) {
    return {
      accountExists: false,
      status: 'disconnected',
      health: 'healthy',
      externalInstanceId: null,
      phoneNumber: null,
      displayName: null,
      qrBase64: null,
      qrExpiresAt: null,
      connectedAt: null,
      disconnectedAt: null,
      lastSeenAt: null,
      messagesSent24h: 0,
      pausedUntil: null,
    };
  }

  if (!instance) {
    return {
      accountExists: true,
      status: 'disconnected',
      health: 'healthy',
      externalInstanceId: null,
      phoneNumber: account.phoneNumber || null,
      displayName: account.displayName,
      qrBase64: null,
      qrExpiresAt: null,
      connectedAt: null,
      disconnectedAt: null,
      lastSeenAt: null,
      messagesSent24h: 0,
      pausedUntil: null,
    };
  }

  return {
    accountExists: true,
    status: normalizeStatus(instance.status),
    health: instance.healthScore satisfies ConnectionHealth,
    externalInstanceId: instance.externalInstanceId,
    phoneNumber: account.phoneNumber || null,
    displayName: account.displayName,
    qrBase64: instance.qrCode,
    qrExpiresAt: instance.qrExpiresAt?.toISOString() ?? null,
    connectedAt: instance.connectedAt?.toISOString() ?? null,
    disconnectedAt: instance.disconnectedAt?.toISOString() ?? null,
    lastSeenAt: instance.lastSeenAt?.toISOString() ?? null,
    messagesSent24h: instance.messagesSent24h,
    pausedUntil: instance.pausedUntil?.toISOString() ?? null,
  };
}

/**
 * QR ainda válido? Comparação client-side pra decidir se renova polling.
 * `expiresAt` em ISO; comparamos com `nowMs` injetável pra teste determinista.
 */
export function isQrCodeFresh(qrExpiresAt: string | null, nowMs: number): boolean {
  if (!qrExpiresAt) return false;
  const exp = Date.parse(qrExpiresAt);
  return Number.isFinite(exp) && exp > nowMs;
}
