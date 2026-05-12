import 'server-only';

import type { User } from '@supabase/supabase-js';

import { prisma } from '@papopro/db';

import { getCurrentUser } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { isUuid } from '@/lib/utils/uuid';

/**
 * `requireRole` — gate canônico de Server Actions sobre o workspace ativo (M7#5).
 *
 * **Por que existe.** M7#4 deixou o RBAC inline duplicado em
 * `inviteMemberAction` e `revokeInvitationAction` — 4 blocos idênticos
 * (`getCurrentUser` + email guard + `readWorkspaceCookie` + `isUuid` +
 * `prisma.workspaceMember.findUnique` + role check). Conforme M8 multiplica
 * actions de domínio (deals, leads, cadências), o padrão duplicado vira
 * bug-magnet — alguém esquece o `isUuid` num callsite e o filtro Prisma vaza
 * id-like strings inválidos pra query path. Helper único = um lugar só pra
 * corrigir bug.
 *
 * **Contrato.** Retorna `{ ok: true, ctx }` em sucesso ou `{ ok: false, error,
 * code }` em qualquer falha — mesmo padrão de `AuthActionResult` (M7#3). Não
 * joga `redirect()` nem throw: o caller decide UX. Cada `code` mapeia 1:1 com
 * uma mensagem default em pt-BR; `forbiddenMessage` permite microcopy
 * contextual ("Apenas Owner e Admin podem convidar membros") sem o caller
 * precisar duplicar o restante das mensagens.
 *
 * **Escopo: workspace ATIVO (cookie httpOnly).** O caso 95%+ de actions —
 * "user clicou em algo no dashboard do workspace que ele está vendo". Para o
 * cenário diferente (`setActiveWorkspaceAction` recebe workspaceId no
 * argumento porque ainda não é o ativo), o RBAC fica inline naquela action —
 * 4 linhas, sem economia em extrair.
 *
 * **Defense-in-depth.** Mesmo com RLS habilitada nas tabelas, validamos
 * `isUuid` no cookie + filtramos `workspaceId` no `where` da query — CLAUDE.md
 * §7.2. Cookie corrompido ou bug de policy não vaza tenant cross-workspace.
 */

export const ALL_ROLES = ['Owner', 'Admin', 'Manager', 'Vendedor', 'Viewer'] as const;
export type Role = (typeof ALL_ROLES)[number];

export type RBACErrorCode = 'no_session' | 'no_workspace' | 'not_member' | 'forbidden';

export interface AuthorizedContext {
  /** User do Supabase Auth — `email` garantido não-nulo pelo helper. */
  user: User;
  /** Email do user já normalizado e disponível direto (sem `user.email!`). */
  userEmail: string;
  /** UUID do user (`auth.users.id` === `public.users.id`). */
  userId: string;
  /** UUID do workspace ativo (cookie httpOnly, validado por regex). */
  workspaceId: string;
  /** Papel do caller no workspace ativo. */
  role: Role;
}

export interface RequireRoleOptions {
  /**
   * Substitui a mensagem default ("Você não tem permissão pra esta ação.")
   * quando o caller bate em `forbidden`. Usar para microcopy contextual:
   * "Apenas Owner e Admin podem convidar membros."
   */
  forbiddenMessage?: string;
}

export type RequireRoleResult =
  | { ok: true; ctx: AuthorizedContext }
  | { ok: false; error: string; code: RBACErrorCode };

/**
 * Valida que o caller (a) está autenticado, (b) tem workspace ativo no cookie,
 * (c) é membro desse workspace, (d) tem um dos `allowed` papéis. Para uso em
 * Server Actions e Route Handlers do produto.
 *
 * Exemplo:
 * ```ts
 * const auth = await requireRole(['Owner', 'Admin'], {
 *   forbiddenMessage: 'Apenas Owner e Admin podem convidar membros.',
 * });
 * if (!auth.ok) return { ok: false, error: auth.error };
 * const { workspaceId, userId, userEmail } = auth.ctx;
 * ```
 */
export async function requireRole(
  allowed: readonly Role[],
  options: RequireRoleOptions = {},
): Promise<RequireRoleResult> {
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return {
      ok: false,
      error: 'Sessão expirada — faça login novamente.',
      code: 'no_session',
    };
  }

  const workspaceId = readWorkspaceCookie();
  if (!workspaceId || !isUuid(workspaceId)) {
    return {
      ok: false,
      error: 'Nenhum workspace ativo. Recarregue a página.',
      code: 'no_workspace',
    };
  }

  // Defense-in-depth: filtra explicitamente por workspaceId + userId no
  // `where` da query (CLAUDE.md §7.2). Mesmo com RLS habilitada, a unique
  // composta `(workspaceId, userId)` garante 1 row ou nada.
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });

  if (!membership) {
    return {
      ok: false,
      error: 'Você não tem acesso a esse workspace.',
      code: 'not_member',
    };
  }

  // O Prisma client retorna `role` como o tipo gerado do enum `Role` quando
  // `prisma generate` rodou. No environment placeholder (M7#1 comment em
  // [packages/db/src/index.ts]) o tipo é `string`. Cast estreita pro union
  // que controlamos aqui.
  const role = membership.role as Role;
  if (!allowed.includes(role)) {
    return {
      ok: false,
      error: options.forbiddenMessage ?? 'Você não tem permissão pra esta ação.',
      code: 'forbidden',
    };
  }

  return {
    ok: true,
    ctx: {
      user,
      userEmail: user.email,
      userId: user.id,
      workspaceId,
      role,
    },
  };
}
