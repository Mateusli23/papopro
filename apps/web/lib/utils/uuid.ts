/**
 * Helper compartilhado para validar UUIDs no caminho de Server Actions e
 * queries server-only (M7#4 — extraído após review apontar regex duplicado em
 * `features/workspace/actions.ts` e `features/invitations/queries.ts`).
 *
 * Aceita qualquer versão UUID válida (v1/v4/v7). Case-insensitive — Postgres
 * normaliza pra lowercase no INSERT, mas inputs vindos de URL ou cookie podem
 * vir mixed-case.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
