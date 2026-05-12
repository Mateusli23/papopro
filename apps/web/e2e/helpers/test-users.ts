import { createE2EAdminClient } from './supabase-admin';

/**
 * Helpers de manipulação direta de users de teste no Supabase E2E (M7#6).
 *
 * **Cenário típico nos specs:**
 *  1. `createTestUser(...)` antes do spec rodar (skip o ciclo de email).
 *  2. Spec faz signup/login via UI.
 *  3. `cleanupTestUser(email)` no `afterEach` — deleta user + cascata.
 *
 * **Não usar com o projeto de prod.** O `createE2EAdminClient` já trava
 * isso via guard explícito; este módulo confia nessa garantia.
 */

export interface CreateTestUserInput {
  email: string;
  password: string;
  /** Quando true (default), marca `email_confirmed_at` no momento do create. */
  autoConfirm?: boolean;
  /** Metadata opcional gravada em `auth.users.user_metadata`. */
  metadata?: Record<string, unknown>;
}

export interface CreateTestUserResult {
  userId: string;
  email: string;
}

/**
 * `createTestUser` — cria user via admin API. `autoConfirm: true` pula
 * o fluxo de confirmação por email (Playwright não tem inbox; Resend
 * outbox cobre só fluxo de convite, não confirmation de signup).
 *
 * **Comportamento se email já existe:** Supabase responde 422
 * "User already registered". Tratamos como sucesso silente (idempotent)
 * — caller pode chamar pra "garantir que existe" sem precisar pré-check.
 */
export async function createTestUser(input: CreateTestUserInput): Promise<CreateTestUserResult> {
  const admin = createE2EAdminClient();
  const { autoConfirm = true, metadata = {} } = input;

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: autoConfirm,
    user_metadata: metadata,
  });

  if (error) {
    // 422 "already registered" → busca pelo email e retorna idempotente.
    if (error.status === 422 || /already registered/i.test(error.message)) {
      const existing = await findUserByEmail(input.email);
      if (existing) return existing;
    }
    throw new Error(`createTestUser failed: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('createTestUser: Supabase não retornou user.');
  }

  return { userId: data.user.id, email: input.email };
}

/**
 * `confirmTestUser` — força `email_confirmed_at` em user já existente.
 * Usado quando o spec quer simular "user clicou no link de confirmação"
 * sem depender de inbox.
 *
 * Útil pro spec 02 (invite flow): usuário B cria conta via signup, recebe
 * email de confirmação, e o spec força confirmação via essa função pra
 * destravar o fluxo de aceite.
 */
export async function confirmTestUser(email: string): Promise<void> {
  const admin = createE2EAdminClient();
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`confirmTestUser: user ${email} não encontrado.`);

  const { error } = await admin.auth.admin.updateUserById(user.userId, {
    email_confirm: true,
  });
  if (error) throw new Error(`confirmTestUser failed: ${error.message}`);
}

/**
 * `cleanupTestUser` — deleta user via admin API. Cascata FK varre
 * `workspace_members`, `audit_logs` (FK Restrict — NÃO cai), `invitations`.
 *
 * **Decisão sobre audit_logs:** o FK em `audit_logs.user_id` é
 * `ON DELETE SET NULL` (M7#2 hardening) — user deletado deixa o audit
 * orfanado mas legível. Em ambiente de teste isso é aceitável; em prod
 * jamais deletaríamos um user (LGPD §17 — direito ao apagamento usa
 * soft-delete + anonimização).
 */
export async function cleanupTestUser(email: string): Promise<void> {
  const admin = createE2EAdminClient();
  const user = await findUserByEmail(email);
  if (!user) return; // idempotent — já não existe

  const { error } = await admin.auth.admin.deleteUser(user.userId);
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`cleanupTestUser failed: ${error.message}`);
  }
}

/**
 * `cleanupTestWorkspace` — deleta workspace + cascata (members, invitations,
 * audit_logs, notification_preferences). Idempotent.
 *
 * Usado pelo fixture `loggedInOwner` no teardown — workspace inteiro some
 * pra deixar o projeto E2E limpo entre runs.
 */
export async function cleanupTestWorkspace(workspaceId: string): Promise<void> {
  const admin = createE2EAdminClient();

  // Validar formato UUID antes de bater no banco (defense in depth — evita
  // SQL injection via input mal-formado).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)) {
    throw new Error(`cleanupTestWorkspace: workspaceId inválido (${workspaceId})`);
  }

  // Ordem importa por causa de FK Restrict:
  //  1. invitations (FK → workspaces, ON DELETE CASCADE — opcional)
  //  2. audit_logs (FK → workspaces, ON DELETE CASCADE)
  //  3. workspace_members (FK → workspaces, ON DELETE CASCADE)
  //  4. notification_preferences (FK → workspaces, ON DELETE CASCADE)
  //  5. workspaces (último)
  // M7#2 já configurou todas como ON DELETE CASCADE — deletar workspaces
  // remove o resto. Manter os deletes explícitos como redundância em caso
  // de a CASCADE policy quebrar no futuro.

  await admin.from('invitations').delete().eq('workspace_id', workspaceId);
  await admin.from('audit_logs').delete().eq('workspace_id', workspaceId);
  await admin.from('workspace_members').delete().eq('workspace_id', workspaceId);
  await admin.from('notification_preferences').delete().eq('workspace_id', workspaceId);
  await admin.from('workspaces').delete().eq('id', workspaceId);
}

/**
 * `findUserByEmail` — admin API não tem `getUserByEmail`. Workaround:
 * `listUsers` filtra in-memory. Limit alto pra cobrir projetos de teste
 * pequenos. Em prod com milhares de users isso seria O(n) ruim — só
 * usar pra E2E.
 */
async function findUserByEmail(email: string): Promise<CreateTestUserResult | null> {
  const admin = createE2EAdminClient();
  const target = email.toLowerCase().trim();

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`findUserByEmail failed: ${error.message}`);

  const user = data.users.find((u) => u.email?.toLowerCase() === target);
  if (!user) return null;
  return { userId: user.id, email: user.email ?? email };
}
