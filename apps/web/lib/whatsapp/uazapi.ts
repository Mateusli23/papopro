/**
 * uazapi HTTP client (M9#2).
 *
 * Implementação do `WhatsAppAdapter` contra a uazapi (Whatsmeow-based, plano
 * Standard). Endpoints e payloads seguem o formato comum da uazapi v2 —
 * cada workspace tem uma instância dedicada identificada por `externalInstanceId`
 * (gerado pela uazapi no `connect`).
 *
 * **Auth:** `Authorization: Bearer <UAZAPI_API_KEY>` em todas as chamadas.
 *           Admin key — mesma pra todos os workspaces; isolamento é por
 *           `externalInstanceId`.
 *
 * **Retries:** 3 tentativas com backoff 250ms/500ms/1000ms para erros 5xx
 * e network errors (fetch lança). 4xx propaga direto (input ruim, sem retry).
 *
 * **Timeout:** 10s por tentativa via `AbortController`. uazapi connect pode
 * demorar (~3-5s) então 10s cobre folga.
 *
 * **`reportNonFatal`** em todos os catches — preserva erro pro caller mas
 * grava trace no Sentry com scope `whatsapp.uazapi.<method>` e contexto
 * `{ workspaceId, externalInstanceId? }`.
 *
 * **Server-only:** usa segredos do env, nunca importar em `'use client'`.
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

interface UazapiClientConfig {
  baseUrl: string;
  apiKey: string;
}

interface UazapiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface UazapiConnectResponse {
  instance_id: string;
  qr_base64: string;
  qr_expires_at: string; // ISO
}

interface UazapiStatusResponse {
  status: 'connected' | 'connecting' | 'disconnected';
  phone_number?: string;
  last_seen_at?: string; // ISO
}

interface UazapiSendTextResponse {
  message_id: string;
  sent_at: string; // ISO
}

function readUazapiConfig(): UazapiClientConfig {
  const baseUrl = process.env.UAZAPI_BASE_URL;
  const apiKey = process.env.UAZAPI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('uazapi: UAZAPI_BASE_URL e UAZAPI_API_KEY são obrigatórios');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

async function uazapiFetch<T>(
  config: UazapiClientConfig,
  path: string,
  init: RequestInit,
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
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      clearTimeout(timer);

      if (response.status >= 500) {
        lastError = new Error(`uazapi ${path}: HTTP ${response.status}`);
        // 5xx é retry-able — segue pro próximo loop após delay
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        reportNonFatal(scope, lastError, context);
        throw lastError;
      }

      if (!response.ok) {
        // 4xx propaga sem retry — payload/auth ruim
        const text = await response.text().catch(() => '');
        const err = new Error(`uazapi ${path}: HTTP ${response.status} ${text}`);
        reportNonFatal(scope, err, context);
        throw err;
      }

      const payload = (await response.json()) as UazapiResponse<T>;
      if (!payload.ok || payload.data === undefined) {
        const err = new Error(`uazapi ${path}: ${payload.error ?? 'resposta sem data'}`);
        reportNonFatal(scope, err, context);
        throw err;
      }
      return payload.data;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;
      // AbortError + network error: tenta de novo se ainda dá
      const isAbort = lastError.name === 'AbortError';
      const isLast = attempt >= MAX_RETRIES - 1;
      if (isLast) {
        reportNonFatal(scope, lastError, { ...context, attempt });
        throw lastError;
      }
      if (!isAbort && !lastError.message.includes('HTTP 5')) {
        // erro não-retry-able (4xx já foi throw direto acima)
        reportNonFatal(scope, lastError, { ...context, attempt });
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  // Inalcançável — loop sempre retorna ou throw
  throw lastError ?? new Error(`uazapi ${path}: esgotou ${MAX_RETRIES} tentativas`);
}

export const uazapiAdapter: WhatsAppAdapter = {
  async connectInstance({ workspaceId }): Promise<WhatsAppQrCode> {
    const config = readUazapiConfig();
    const data = await uazapiFetch<UazapiConnectResponse>(
      config,
      '/instance/connect',
      {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      },
      'whatsapp.uazapi.connectInstance',
      { workspaceId },
    );
    return {
      externalInstanceId: data.instance_id,
      qrBase64: data.qr_base64,
      expiresAt: new Date(data.qr_expires_at),
    };
  },

  async getInstanceStatus({ workspaceId, externalInstanceId }): Promise<WhatsAppInstanceStatus> {
    const config = readUazapiConfig();
    const data = await uazapiFetch<UazapiStatusResponse>(
      config,
      `/instance/${encodeURIComponent(externalInstanceId)}/status`,
      { method: 'GET' },
      'whatsapp.uazapi.getInstanceStatus',
      { workspaceId, externalInstanceId },
    );
    return {
      status: data.status,
      phoneNumber: data.phone_number,
      lastSeenAt: data.last_seen_at ? new Date(data.last_seen_at) : undefined,
    };
  },

  async disconnectInstance({ workspaceId, externalInstanceId }): Promise<void> {
    const config = readUazapiConfig();
    await uazapiFetch<{ disconnected: true }>(
      config,
      `/instance/${encodeURIComponent(externalInstanceId)}/disconnect`,
      { method: 'POST' },
      'whatsapp.uazapi.disconnectInstance',
      { workspaceId, externalInstanceId },
    );
  },

  async sendText({ workspaceId, externalInstanceId, to, body }): Promise<SendTextResult> {
    const config = readUazapiConfig();
    const data = await uazapiFetch<UazapiSendTextResponse>(
      config,
      `/instance/${encodeURIComponent(externalInstanceId)}/sendText`,
      {
        method: 'POST',
        body: JSON.stringify({ to, body }),
      },
      'whatsapp.uazapi.sendText',
      { workspaceId, externalInstanceId, to },
    );
    return {
      externalMessageId: data.message_id,
      sentAt: new Date(data.sent_at),
    };
  },
};
