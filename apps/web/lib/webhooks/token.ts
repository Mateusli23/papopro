import 'server-only';

import { randomBytes } from 'node:crypto';

/**
 * Gera um token URL-safe de 32 bytes em base64url. Resultado: ~43 chars sem
 * padding, usando apenas `[A-Za-z0-9_-]`. Seguro pra colocar em URL bruta
 * sem encode (mantém o copy-paste limpo).
 *
 * Usado em:
 *  - `createWorkspaceAction` (M8#5) — gera token na criação do workspace.
 *  - `regenerateWebhookTokenAction` (M8#5) — substitui token existente.
 */
export function generateWebhookToken(): string {
  return randomBytes(32).toString('base64url');
}
