import 'server-only';

import * as Sentry from '@sentry/nextjs';

/**
 * `reportNonFatal` — drop-in replacement pros `console.error('[scope] msg', err)`
 * espalhados pelas Server Actions (M7#6 frente B).
 *
 * **Por que existe:** os catch blocks de Server Actions trataram erros
 * non-fatal (audit log fail, email fail, slug exhaust em createWorkspaceAction)
 * com `console.error`. Em dev isso aparece no terminal; em prod cai no
 * Vercel log e some — operador precisaria varrer logs manualmente pra ver.
 *
 * `reportNonFatal` preserva o `console.error` (dev local sem DSN continua
 * vendo tudo no terminal) E envia pro Sentry quando DSN está configurado.
 * Tagged com `scope` pra Sentry agrupar/filtrar errors similares.
 *
 * **Não substitui throw em caminhos fatais.** Aqui é só pra `console.error`
 * que segue retornando ok-ish ao usuário — audit failure não deve bloquear
 * login, email failure não deve bloquear `revokeInvitation`, etc.
 *
 * **Convenção de scope:** `<feature>.<action>.<step>`. Exemplos:
 *  - `auth.login.audit` — audit log falhou após login OK
 *  - `auth.login.workspace-lookup` — busca de firstMembership falhou
 *  - `invitations.accept.tx` — transaction de aceite falhou
 *  - `workspace.create.slug-exhausted` — gerador de slug não achou único
 *
 * Plano de M8+: stream desses scopes vai pra dashboard de health do
 * workspace (taxa de audit failure, taxa de email bounce). Sentry hoje é
 * triagem reativa.
 */

export interface ReportContext {
  /** ID do workspace afetado. NÃO é PII — UUID anônimo. */
  workspaceId?: string | null;
  /** ID do user afetado. NÃO é PII — UUID anônimo. */
  userId?: string | null;
  /** Campos adicionais. **Não passe email/password/token aqui** — o scrubber
   *  remove eles em `beforeSend`, mas defense in depth: omita na origem. */
  [key: string]: unknown;
}

export function reportNonFatal(scope: string, err: unknown, context?: ReportContext): void {
  // Preservar console.error pra dev local sem DSN — comportamento idêntico
  // ao código pré-M7#6.
  console.error(`[${scope}]`, err);

  // No-op se DSN não setado (Sentry.init nem rodou em sentry.server.config.ts).
  Sentry.captureException(err, {
    tags: { scope, severity: 'non-fatal' },
    extra: context,
  });
}

/**
 * `reportFatal` — variante semântica pra catch blocks que VÃO retornar
 * erro ao usuário (não engolem). Marca severity=fatal pra Sentry agrupar
 * separadamente. Útil pra "transação falhou e tudo abortou".
 */
export function reportFatal(scope: string, err: unknown, context?: ReportContext): void {
  console.error(`[${scope}]`, err);
  Sentry.captureException(err, {
    tags: { scope, severity: 'fatal' },
    extra: context,
  });
}
