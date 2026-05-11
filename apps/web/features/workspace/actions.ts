'use server';

/**
 * Server Actions do feature `workspace` (M7#4).
 *
 * `createWorkspaceAction` — primeira criação real, chamada pelo `/onboarding`
 * e pelo step 1 do welcome wizard. Cria a row em `workspaces` + `workspace_members`
 * (role Owner) + `notification_preferences` em **uma única transação**, registra
 * `audit_logs` e seta o cookie httpOnly `papopro_workspace_id` lido pelo
 * middleware e por `with-workspace.ts`.
 *
 * **Por que não usa `withWorkspace`:** a gente está criando o workspace —
 * o setting `app.workspace_id` ainda não tem valor. A action roda como a
 * conexão Prisma default (postgres) que bypassa RLS por design. Defense-
 * in-depth: filtramos por `userId` em toda query (CLAUDE.md §7.2).
 *
 * **Padrão de retorno:** `WorkspaceActionResult` espelha o `AuthActionResult`
 * (M7#3) — `{ok:true, redirectTo}` ou `{ok:false, error}`. Cliente decide o
 * `router.push`. `redirect()` direto throws `NEXT_REDIRECT`, polui o handler
 * de erro do RHF.
 */

import { prisma, type Prisma } from '@papopro/db';

import { getCurrentUser } from '@/lib/auth/get-user';
import {
  clearWorkspaceCookie,
  setWizardCookie,
  setWorkspaceCookie,
} from '@/lib/auth/workspace-cookie';
import { ensureUniqueSlug, slugify } from '@/lib/workspace/slugify';

import { workspaceCreateSchema, type WorkspaceCreateInput } from './schemas';

export type WorkspaceActionResult =
  | { ok: true; workspaceId: string; redirectTo: string }
  | { ok: false; error: string };

/**
 * `createWorkspaceAction` — cria o primeiro workspace do usuário e o vincula
 * como Owner.
 *
 * Fluxo:
 *  1. Valida Zod (defense-in-depth — cliente já validou).
 *  2. Lê sessão Supabase. Sem user → erro genérico (middleware já guardou).
 *  3. **Idempotência:** se o user já tem 1+ workspaces, escolhemos o primeiro
 *     e setamos o cookie pra ele — não criamos duplicata silenciosa. Cobre
 *     dupliclick e refresh da página /onboarding.
 *  4. Gera slug único (`slugify` + `ensureUniqueSlug` iterando com sufixo).
 *  5. `$transaction`: insere Workspace + WorkspaceMember(Owner) +
 *     NotificationPreference + AuditLog. Tudo ou nada.
 *  6. Seta cookie httpOnly `papopro_workspace_id` na resposta.
 *
 * O cliente recebe `{ ok: true, redirectTo: '/dashboard' }` e navega — o
 * middleware vai ver o cookie populado e liberar a rota.
 */
export async function createWorkspaceAction(
  input: WorkspaceCreateInput,
): Promise<WorkspaceActionResult> {
  const parsed = workspaceCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'Sessão expirada — faça login novamente.' };
  }
  if (!user.email_confirmed_at) {
    return { ok: false, error: 'Confirme seu email antes de criar o workspace.' };
  }

  // (3) Idempotência: usuário já tem workspace? Reaproveita.
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    setWorkspaceCookie(existing.workspaceId);
    return { ok: true, workspaceId: existing.workspaceId, redirectTo: '/dashboard' };
  }

  // (4) Slug único. `isTaken` consulta o índice `workspaces.slug` (`@unique`).
  const baseSlug = slugify(parsed.data.name);
  let slug: string;
  try {
    slug = await ensureUniqueSlug(baseSlug || 'workspace', async (candidate) => {
      const found = await prisma.workspace.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return found !== null;
    });
  } catch (err) {
    console.error('[createWorkspaceAction] slug exhausted', err);
    return {
      ok: false,
      error: 'Não foi possível gerar o endereço do workspace. Tente outro nome.',
    };
  }

  // (5) Transação: workspace + member + prefs + audit. Defense-in-depth: o
  // member fixa `userId = user.id` (não confia em nada do input).
  //
  // **Sobre `tx: Prisma.TransactionClient`:** com `prisma generate` ainda não
  // executado neste ambiente (TLS strict bloqueando `binaries.prisma.sh`, ver
  // M7#1), o tipo gerado é `any`. No CI/Vercel onde generate roda, vira o
  // shape real com `tx.workspace`, `tx.workspaceMember`, etc.
  let workspaceId: string;
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // O trigger `on_auth_user_created` espelha `auth.users` → `public.users`
      // no signup. Em raros casos (corrupção, replay manual) a row pode não
      // existir — garantimos com upsert defensivo antes da FK do member.
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email ?? '',
          name: (user.user_metadata as Record<string, unknown>)?.name as string | undefined,
          emailVerifiedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
        },
        update: {},
      });

      const workspace = await tx.workspace.create({
        data: {
          name: parsed.data.name.trim(),
          slug,
          segment: parsed.data.segment ?? null,
        },
        select: { id: true },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'Owner',
          joinedAt: new Date(),
        },
      });

      // Preferências de notificação vazias — a matriz PRD §3.2 (10 eventos ×
      // 3 canais) entra em M7#5 junto com a tela `/settings/notifications`
      // real. Linha aqui garante a unique `(workspace_id, user_id)`.
      await tx.notificationPreference.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          prefs: {},
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          action: 'workspace_created',
          entityType: 'workspace',
          entityId: workspace.id,
          changes: { name: parsed.data.name.trim(), slug },
        },
      });

      return workspace;
    });

    workspaceId = result.id;
  } catch (err) {
    // Slug colisão rara passou pelo guard? Constraint UNIQUE pegou.
    // **Duck-type check** ao invés de `instanceof PrismaClientKnownRequestError`
    // porque a classe não está exportada no client placeholder do M7#1 (sem
    // `prisma generate`). `err.code === 'P2002'` é estável em todas as versões
    // do Prisma — é o que a constraint UNIQUE produz.
    if (isPrismaErrorCode(err, 'P2002')) {
      console.error('[createWorkspaceAction] unique violation', err);
      return { ok: false, error: 'Esse nome de workspace já existe. Tente outro.' };
    }
    console.error('[createWorkspaceAction] transaction failed', err);
    return { ok: false, error: 'Não foi possível criar o workspace agora. Tente em instantes.' };
  }

  // (6) Cookie. Setamos *fora* da transação porque `cookies().set` toca a
  // resposta HTTP e não tem garantia transacional com o Postgres — se a
  // transação falhasse, não queremos cookie órfão.
  setWorkspaceCookie(workspaceId);

  return { ok: true, workspaceId, redirectTo: '/dashboard' };
}

/**
 * Duck-type check pra códigos de erro do Prisma (P2002 unique, P2003 FK, ...).
 *
 * Evita `instanceof Prisma.PrismaClientKnownRequestError` porque a classe não
 * está exportada no client placeholder gerado sem `prisma generate` (cenário
 * documentado em M7#1). Os códigos `Pxxxx` são parte do contrato público do
 * Prisma — checagem por código é estável.
 */
function isPrismaErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === code
  );
}

// =============================================================================
// Onda 3 — switcher real + flag de wizard
// =============================================================================

const WORKSPACE_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetActiveWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

/**
 * `setActiveWorkspaceAction` — switcher real (M7#4 Onda 3).
 *
 * Recebe o `workspaceId` selecionado, **valida que o caller é membro** do
 * workspace (defense-in-depth — não confia no input, mesmo com RLS), e seta
 * o cookie httpOnly `papopro_workspace_id` lido pelo middleware/with-workspace.
 *
 * Sem essa validação, qualquer client poderia "se logar" em qualquer workspace
 * trocando o cookie no devtools — a RLS bloqueia leituras mas o gate de
 * middleware libera a rota, levando a uma tela 403 confusa em vez de redirect
 * imediato.
 *
 * Retorna `{ok:true}` em sucesso; client chama `router.refresh()` em seguida
 * pra Server Components re-renderizarem com o workspace novo.
 */
export async function setActiveWorkspaceAction(
  workspaceId: string,
): Promise<SetActiveWorkspaceResult> {
  if (typeof workspaceId !== 'string' || !WORKSPACE_ID_REGEX.test(workspaceId)) {
    return { ok: false, error: 'Workspace inválido.' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'Sessão expirada — faça login novamente.' };
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { id: true },
  });

  if (!member) {
    return { ok: false, error: 'Você não tem acesso a esse workspace.' };
  }

  setWorkspaceCookie(workspaceId);
  return { ok: true, workspaceId };
}

/**
 * `clearActiveWorkspaceAction` — usado no logout (M7#3 não limpava esse
 * cookie). Sem isso o user faz logout, loga com outra conta no mesmo
 * navegador, e o middleware tenta usar o cookie do tenant anterior — RLS
 * bloqueia mas a UX fica confusa. Limpar explicitamente.
 */
export async function clearActiveWorkspaceAction(): Promise<{ ok: true }> {
  clearWorkspaceCookie();
  return { ok: true };
}

export type WizardActionResult = { ok: true };

/**
 * `markWizardCompletedAction` — marca cookie `papopro_wizard_completed=1`
 * (httpOnly, 1 ano). Substitui `markWizardCompleted` do `WorkspaceMockProvider`.
 *
 * **Por que cookie e não coluna no banco:** o flag é "primeira visita ao
 * dashboard deste browser/perfil" — semântica local. Usuário pode usar
 * dispositivo novo e ver wizard de novo (aceitável; é guia, não onboarding
 * obrigatório). Adicionar `users.first_run_completed_at` força sync entre
 * dispositivos e introduz uma migration — não vale o ganho.
 */
export async function markWizardCompletedAction(): Promise<WizardActionResult> {
  setWizardCookie();
  return { ok: true };
}
