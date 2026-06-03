/**
 * uazapi HTTP client alinhado à documentação oficial v2.1.0.
 *
 * Escopo desta entrega: WhatsApp MVP em staging — conexão/QR, status,
 * webhook opcional e envio manual de texto. Não implementa agente IA.
 *
 * Auth oficial:
 *  - chamadas administrativas: header `admintoken`
 *  - chamadas da instância: header `token`
 *
 * Para evitar migration agora, o token da instância vem de env:
 * `UAZAPI_INSTANCE_TOKEN`. O adapter NÃO usa token como identificador público
 * persistido. Se a UAZAPI não retornar `instance.id`, configure também
 * `UAZAPI_INSTANCE_ID` com o identificador não secreto que o webhook envia.
 */
import 'server-only';

import { reportNonFatal } from '@/lib/observability/report';

import type {
  SendTextResult,
  WhatsAppAdapter,
  WhatsAppInstanceStatus,
  WhatsAppQrCode,
} from './adapter';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [250, 500, 1_000] as const;
const QR_TTL_MS = 120_000;

interface UazapiClientConfig {
  baseUrl: string;
  instanceToken?: string;
  instanceId?: string;
  webhookUrl?: string;
}

interface UazapiInstance {
  id?: string;
  status?: string;
  qrcode?: string;
  qrCode?: string;
  paircode?: string;
  profileName?: string;
}

interface UazapiConnectResponse {
  connected?: boolean;
  loggedIn?: boolean;
  instance?: UazapiInstance;
}

interface UazapiStatusResponse {
  instance?: UazapiInstance;
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: { user?: string } | null;
  };
}

interface UazapiSendTextResponse {
  id?: string;
  messageid?: string;
  messageId?: string;
  response?: { status?: string; message?: string };
}

type UazapiAuth = { kind: 'admin'; token: string } | { kind: 'instance'; token: string };

function readUazapiConfig(): UazapiClientConfig {
  const baseUrl = process.env.UAZAPI_BASE_URL;
  const instanceToken = process.env.UAZAPI_INSTANCE_TOKEN;
  const instanceId = process.env.UAZAPI_INSTANCE_ID;
  const webhookUrl = resolveWebhookUrl(
    process.env.UAZAPI_WEBHOOK_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  );

  if (!baseUrl) {
    throw new Error('uazapi: UAZAPI_BASE_URL é obrigatório');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    instanceToken: instanceToken || undefined,
    instanceId: instanceId || undefined,
    webhookUrl,
  };
}

function resolveWebhookUrl(
  explicitUrl: string | undefined,
  appUrl: string | undefined,
): string | undefined {
  const explicit = explicitUrl?.trim();
  if (explicit) {
    const clean = explicit.replace(/\/$/, '');
    return clean.endsWith('/api/webhooks/whatsapp') ? clean : `${clean}/api/webhooks/whatsapp`;
  }
  const app = appUrl?.trim();
  return app ? `${app.replace(/\/$/, '')}/api/webhooks/whatsapp` : undefined;
}

function headersFor(auth: UazapiAuth): Record<string, string> {
  return {
    [auth.kind === 'admin' ? 'admintoken' : 'token']: auth.token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function uazapiFetch<T>(
  config: UazapiClientConfig,
  path: string,
  init: RequestInit,
  auth: UazapiAuth,
  scope: string,
  context: Record<string, unknown>,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.headers ?? {}),
          ...headersFor(auth),
        },
      });
      clearTimeout(timer);

      if (response.status >= 500) {
        lastError = new Error(`uazapi ${path}: HTTP ${response.status}`);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        reportNonFatal(scope, lastError, context);
        throw lastError;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = new Error(`uazapi ${path}: HTTP ${response.status} ${text}`);
        reportNonFatal(scope, err, context);
        throw err;
      }

      if (response.status === 204) {
        return undefined as T;
      }
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;
      const isAbort = lastError.name === 'AbortError';
      const isLast = attempt >= MAX_RETRIES - 1;
      if (isLast) {
        reportNonFatal(scope, lastError, { ...context, attempt });
        throw lastError;
      }
      if (!isAbort && !lastError.message.includes('HTTP 5')) {
        reportNonFatal(scope, lastError, { ...context, attempt });
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  throw lastError ?? new Error(`uazapi ${path}: esgotou ${MAX_RETRIES} tentativas`);
}

function stripDataUrl(base64OrDataUrl: string | undefined): string | null {
  if (!base64OrDataUrl) return null;
  const value = base64OrDataUrl.trim();
  if (!value) return null;
  return value.replace(/^data:image\/\w+;base64,/, '');
}

function normalizePhoneFromJid(user: string | undefined): string | undefined {
  if (!user) return undefined;
  const digits = user.replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  return `+${digits}`;
}

function normalizeStatus(response: UazapiStatusResponse): WhatsAppInstanceStatus['status'] {
  const raw = response.instance?.status;
  if (raw === 'connected' || raw === 'connecting' || raw === 'disconnected') return raw;
  if (response.status?.connected || response.status?.loggedIn) return 'connected';
  return 'connecting';
}

function resolveInstanceToken(config: UazapiClientConfig): string {
  if (config.instanceToken) {
    return config.instanceToken;
  }
  throw new Error('uazapi: UAZAPI_INSTANCE_TOKEN é obrigatório para o MVP atual');
}

function resolveExternalInstanceId(
  config: UazapiClientConfig,
  data?: UazapiConnectResponse,
): string {
  const externalInstanceId = data?.instance?.id ?? config.instanceId;
  if (!externalInstanceId) {
    throw new Error(
      'uazapi: configure UAZAPI_INSTANCE_ID ou use uma instância que retorne instance.id',
    );
  }
  return externalInstanceId;
}

async function configureWebhookIfPossible(
  config: UazapiClientConfig,
  token: string,
  context: Record<string, unknown>,
): Promise<void> {
  if (!config.webhookUrl) return;

  try {
    await uazapiFetch<unknown>(
      config,
      '/webhook',
      {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          url: config.webhookUrl,
          events: ['messages', 'messages_update', 'connection'],
          excludeMessages: ['isGroupYes'],
          addUrlEvents: false,
          addUrlTypesMessages: false,
          action: 'add',
        }),
      },
      { kind: 'instance', token },
      'whatsapp.uazapi.configureWebhook',
      context,
    );
  } catch (err) {
    // Webhook não deve impedir o QR; reporta e deixa o usuário conectar.
    reportNonFatal('whatsapp.uazapi.configureWebhook.nonfatal', err, context);
  }
}

export const uazapiAdapter: WhatsAppAdapter = {
  async connectInstance({ workspaceId }): Promise<WhatsAppQrCode> {
    const config = readUazapiConfig();
    const instanceToken = resolveInstanceToken(config);

    const data = await uazapiFetch<UazapiConnectResponse>(
      config,
      '/instance/connect',
      {
        method: 'POST',
        body: JSON.stringify({ browser: 'auto' }),
      },
      { kind: 'instance', token: instanceToken },
      'whatsapp.uazapi.connectInstance',
      { workspaceId, externalInstanceId: config.instanceId },
    );

    const externalInstanceId = resolveExternalInstanceId(config, data);

    await configureWebhookIfPossible(config, instanceToken, {
      workspaceId,
      externalInstanceId,
    });

    const qrBase64 = stripDataUrl(data.instance?.qrcode ?? data.instance?.qrCode);
    if (!qrBase64 && !data.connected && !data.loggedIn) {
      throw new Error('uazapi: /instance/connect não retornou QR Code');
    }

    return {
      externalInstanceId,
      qrBase64: qrBase64 ?? '',
      expiresAt: new Date(Date.now() + QR_TTL_MS),
    };
  },

  async getInstanceStatus({ workspaceId, externalInstanceId }): Promise<WhatsAppInstanceStatus> {
    const config = readUazapiConfig();
    if (!config.instanceToken) {
      throw new Error('uazapi: UAZAPI_INSTANCE_TOKEN é obrigatório para consultar status');
    }

    const data = await uazapiFetch<UazapiStatusResponse>(
      config,
      '/instance/status',
      { method: 'GET' },
      { kind: 'instance', token: config.instanceToken },
      'whatsapp.uazapi.getInstanceStatus',
      { workspaceId, externalInstanceId },
    );

    const phoneNumber = normalizePhoneFromJid(data.status?.jid?.user);

    return {
      status: normalizeStatus(data),
      phoneNumber,
      lastSeenAt: new Date(),
    };
  },

  async disconnectInstance({ workspaceId, externalInstanceId }): Promise<void> {
    const config = readUazapiConfig();
    if (!config.instanceToken) {
      throw new Error('uazapi: UAZAPI_INSTANCE_TOKEN é obrigatório para desconectar');
    }

    await uazapiFetch<unknown>(
      config,
      '/instance/disconnect',
      { method: 'POST' },
      { kind: 'instance', token: config.instanceToken },
      'whatsapp.uazapi.disconnectInstance',
      { workspaceId, externalInstanceId },
    );
  },

  async sendText({ workspaceId, externalInstanceId, to, body }): Promise<SendTextResult> {
    const config = readUazapiConfig();
    if (!config.instanceToken) {
      throw new Error('uazapi: UAZAPI_INSTANCE_TOKEN é obrigatório para enviar mensagem');
    }

    const number = to.replace(/\D/g, '');
    const data = await uazapiFetch<UazapiSendTextResponse>(
      config,
      '/send/text',
      {
        method: 'POST',
        body: JSON.stringify({ number, text: body, readchat: true }),
      },
      { kind: 'instance', token: config.instanceToken },
      'whatsapp.uazapi.sendText',
      { workspaceId, externalInstanceId, to },
    );

    return {
      externalMessageId: data.messageid ?? data.messageId ?? data.id ?? crypto.randomUUID(),
      sentAt: new Date(),
    };
  },
};
