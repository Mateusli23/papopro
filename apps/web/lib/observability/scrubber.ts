import 'server-only';

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * PII scrubber — M7#6, alinhado ao CLAUDE.md §7.5 (LGPD).
 *
 * **Função:** receber um evento Sentry antes do envio e remover/mascarar
 * campos sensíveis em todos os lugares onde eles possam vazar (request
 * data, breadcrumbs, extra, contexts, tags).
 *
 * **Por que strip e não mask:** mask (ex: "pa***ord") ainda permite
 * cross-reference de eventos similares ("usuário X usou senha similar
 * em Y"). Strip = `[REDACTED]` é mais honesto pra observabilidade.
 *
 * **O que é considerado sensível:**
 *  - Credenciais: `password`, `secret`, `api_key`, `apiKey`, `auth`,
 *    `authorization`, `service_role_key`, `serviceRoleKey`.
 *  - Tokens: `token`, `inviteToken`, `accessToken`, `refreshToken`,
 *    `code` (Supabase Auth PKCE code).
 *  - PII LGPD: `email`, `phone`, `telefone`, `cpf`, `cnpj`, `rg`.
 *
 * **Defense in depth:** o scrubber roda em `beforeSend`. Mesmo se algum
 * `console.error` ou breadcrumb capturar um payload Supabase com email
 * inteiro, ele é removido aqui antes de sair.
 *
 * **NÃO removemos `user.id` (UUID anônimo) nem `workspace_id`:** são
 * essenciais pra debug e não são PII por si só (não identificam pessoa
 * sem cross-reference com o banco).
 */

const SENSITIVE_KEYS = new Set([
  // Credenciais
  'password',
  'secret',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'service_role_key',
  'servicerolekey',
  'resend_api_key',
  'supabase_service_role_key',
  // Tokens
  'token',
  'invitetoken',
  'accesstoken',
  'refreshtoken',
  'code',
  // PII LGPD
  'email',
  'phone',
  'telefone',
  'cpf',
  'cnpj',
  'rg',
]);

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

/**
 * `redactObject` — varre uma estrutura aninhada e substitui valores de
 * chaves sensíveis por `[REDACTED]`. Mutates in-place; usado só em event
 * objects que vão pro Sentry (não em payloads do app).
 *
 * **Não recursa em ciclos:** WeakSet rastreia objetos visitados pra evitar
 * stack overflow em event.contexts circulares.
 */
function redactObject(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj as object)) return obj;
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = redactObject(obj[i], seen);
    }
    return obj;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (isSensitiveKey(key)) {
      record[key] = REDACTED;
    } else {
      record[key] = redactObject(record[key], seen);
    }
  }
  return record;
}

/**
 * `scrubPiiFromEvent` — passa como `beforeSend` em `Sentry.init`. Retorna
 * o evento modificado ou `null` pra suprimir o envio.
 *
 * Atualmente nunca suprime — só redact. Em runs futuras, dá pra suprimir
 * eventos com certas mensagens (ex: erros de health check que poluem).
 */
export function scrubPiiFromEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Mutar em vez de clonar — eventos Sentry não são reusados após beforeSend.
  redactObject(event.request);
  redactObject(event.extra);
  redactObject(event.contexts);
  redactObject(event.tags);
  redactObject(event.breadcrumbs);

  // user.email é o campo mais comum de leak — Sentry SDK seta automaticamente
  // se algum `setUser({ email })` vier de upstream. Forçamos remover aqui.
  if (event.user && typeof event.user === 'object') {
    if ('email' in event.user) {
      event.user.email = REDACTED;
    }
  }

  return event;
}
