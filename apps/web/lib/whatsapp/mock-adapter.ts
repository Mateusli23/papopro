/**
 * Mock do `WhatsAppAdapter` (M9#1).
 *
 * Implementação determinística que não toca rede — usada em:
 *   - Smoke tests (`/api/smoke-test/whatsapp`) pra validar o contrato sem
 *     depender de credenciais uazapi
 *   - Dev local quando `UAZAPI_BASE_URL` está ausente (factory em M9#2 escolhe
 *     este adapter no fallback)
 *   - Testes E2E futuros (Playwright em M9+) que precisam de respostas
 *     previsíveis
 *
 * Comportamento:
 *   - `connectInstance` retorna QR base64 fake com expiração em 60s
 *   - `getInstanceStatus` retorna `connected` (assume sessão sempre OK)
 *   - `sendText` retorna `externalMessageId = 'mock-<random>'` + `sentAt = NOW()`
 *   - `disconnectInstance` é no-op
 *
 * **NÃO usar em produção** — factory de M9#2 vai checar env e retornar
 * `uazapiAdapter` quando `UAZAPI_BASE_URL` estiver presente.
 */
import 'server-only';

import { randomBytes } from 'node:crypto';

import type {
  SendTextResult,
  WhatsAppAdapter,
  WhatsAppInstanceStatus,
  WhatsAppQrCode,
} from './adapter';

// Pequeno PNG 1x1 transparente em base64 — content válido pra o `<img>` da UI
// renderizar sem warning, mesmo sendo "fake". Não tentamos gerar QR real aqui
// porque o ponto é o contrato, não a interação.
const FAKE_QR_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const QR_TTL_MS = 60_000;

export const mockAdapter: WhatsAppAdapter = {
  async connectInstance(_input): Promise<WhatsAppQrCode> {
    return {
      externalInstanceId: `mock-instance-${randomBytes(8).toString('hex')}`,
      qrBase64: FAKE_QR_BASE64,
      expiresAt: new Date(Date.now() + QR_TTL_MS),
    };
  },

  async getInstanceStatus(_input): Promise<WhatsAppInstanceStatus> {
    return {
      status: 'connected',
      phoneNumber: '+5511999990000',
      lastSeenAt: new Date(),
    };
  },

  async disconnectInstance(_input): Promise<void> {
    // no-op
  },

  async sendText(_input): Promise<SendTextResult> {
    return {
      externalMessageId: `mock-${randomBytes(12).toString('hex')}`,
      sentAt: new Date(),
    };
  },
};
