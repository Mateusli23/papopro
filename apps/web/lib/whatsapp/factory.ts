/**
 * Adapter factory (M9#2).
 *
 * Escolhe o adapter em runtime baseado em env. Se `UAZAPI_BASE_URL` +
 * `UAZAPI_INSTANCE_TOKEN` estiverem definidos → `uazapiAdapter`. Senão →
 * `mockAdapter` (dev local sem credenciais + smoke tests).
 *
 * **Resolução lazy.** A factory lê `process.env` em cada chamada — não cacheia
 * — pra que mudanças de env em dev (HMR) ou em testes (que sobrescrevem env)
 * sejam refletidas. Custo é trivial (string compare).
 *
 * **Server-only.** Mesmo o mock adapter usa `randomBytes`, e a uazapi precisa
 * de segredos. Nunca importar em `'use client'`.
 */
import 'server-only';

import type { WhatsAppAdapter } from './adapter';
import { mockAdapter } from './mock-adapter';
import { uazapiAdapter } from './uazapi';

function hasUazapiEnv(): boolean {
  const baseUrl = process.env.UAZAPI_BASE_URL?.trim();
  const instanceToken = process.env.UAZAPI_INSTANCE_TOKEN?.trim();
  return Boolean(baseUrl && instanceToken);
}

/**
 * Retorna o adapter ativo. Chamar sempre que precisar enviar/conectar —
 * NÃO armazenar em variável de módulo (env pode mudar entre chamadas em dev).
 *
 * **M9 escopo:** sempre 1 número/workspace, então a factory não precisa
 * receber `workspaceId`. Em V2 (multi-número), `getWhatsAppAdapter({ workspaceId })`
 * pode escolher Cloud API Meta vs uazapi por workspace.
 */
export function getWhatsAppAdapter(): WhatsAppAdapter {
  return hasUazapiEnv() ? uazapiAdapter : mockAdapter;
}

/**
 * Versão pura usada em testes (sem ler env). Smoke `whatsapp-connection-m9`
 * cobre os dois ramos passando o sinal explicitamente.
 */
export function selectAdapter(hasEnv: boolean): WhatsAppAdapter {
  return hasEnv ? uazapiAdapter : mockAdapter;
}
