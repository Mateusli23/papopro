'use server';

/**
 * Server Actions do feature `team` (M7#5).
 *
 * Três operações cobrindo a tela `/settings/team`:
 *  - `changeRoleAction` — Owner/Admin muda papel de outro membro
 *  - `removeMemberAction` — Owner/Admin remove membro
 *  - `resendInviteAction` — Owner/Admin reenvia email de convite pending
 *
 * **RBAC.** Todas usam o helper canônico `requireRole(['Owner','Admin'], …)`
 * (M7#5 — [lib/auth/require-role.ts]). Sem RBAC inline duplicado.
 *
 * **Multi-tenant.** Toda escrita roda dentro de `withWorkspace(workspaceId, …)`
 * (CRÍTICO #2 do review do PR #39 — M7#5 fechou pra todas as actions de
 * domínio com workspace ativo).
 *
 * **Audit log.** `member_role_changed` e `member_removed` registram dentro da
 * mesma tx do UPDATE/DELETE — semântica "se mudou, ficou no log; se rollou,
 * sumiu". `resendInviteAction` não registra audit (re-envio é UX repetível,
 * não muda estado de autorização — só atualiza `expires_at`).
 *
 * **Transferência de propriedade.** Mudar membro existente para Owner é
 * proibido aqui (`changeRoleAction` retorna erro pedindo o fluxo dedicado).
 * Rebaixar Owner também — precisa transferir antes. O fluxo de transferência
 * é separado (com confirmação dupla, M7#5+/M8).
 */

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole, type Role } from '@/lib/auth/require-role';
import { sendEmail } from '@/lib/email/resend';
import { renderInviteEmail } from '@/lib/email/templates/invite';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import {
  changeRoleSchema,
  removeMemberSchema,
  resendInviteSchema,
  type ChangeRoleInput,
  type RemoveMemberInput,
  type ResendInviteInput,
} from './schemas';

export type TeamActionResult = { ok: true } | { ok: false; error: string };

const INVITATION_TTL_DAYS = 7;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function ttlDate(days = INVITATION_TTL_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// =============================================================================
// changeRoleAction
// =============================================================================

type ChangeRoleTxResult =
  | { ok: true; from: Role; to: Role; targetUserId: string }
  | {
      ok: false;
      code: 'not_found' | 'self_change' | 'cant_promote_owner' | 'cant_demote_owner' | 'same_role';
    };

/**
 * `changeRoleAction` — Owner/Admin muda o papel de outro membro.
 *
 * Bloqueios (em ordem de check):
 *  - membro não encontrado no workspace ativo
 *  - caller tentando mudar o próprio papel (silenciosamente bloqueado — Owner
 *    se rebaixando "por engano" perderia acesso administrativo)
 *  - papel já é o atual (no-op silente, retorna sucesso)
 *  - promover a Owner → "Use Transferir propriedade"
 *  - rebaixar Owner → "Transfira a propriedade antes"
 */
export async function changeRoleAction(input: ChangeRoleInput): Promise<TeamActionResult> {
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem mudar papéis.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId: callerId, workspaceId } = auth.ctx;

  const { ipAddress, userAgent } = getRequestAuditContext();

  const result = await withWorkspace<ChangeRoleTxResult>(
    workspaceId,
    async (tx: Prisma.TransactionClient) => {
      // Defense-in-depth: filtra por (id + workspaceId) — id de outro
      // workspace passaria pela RLS porque app.workspace_id está setado pro
      // workspace atual, mas o filtro no `where` garante.
      const target = await tx.workspaceMember.findFirst({
        where: { id: parsed.data.memberId, workspaceId },
        select: { id: true, userId: true, role: true },
      });
      if (!target) return { ok: false, code: 'not_found' };

      const targetRole = target.role as Role;
      if (target.userId === callerId) return { ok: false, code: 'self_change' };
      if (targetRole === parsed.data.role) return { ok: false, code: 'same_role' };
      if (parsed.data.role === 'Owner') return { ok: false, code: 'cant_promote_owner' };
      if (targetRole === 'Owner') return { ok: false, code: 'cant_demote_owner' };

      await tx.workspaceMember.update({
        where: { id: target.id },
        data: { role: parsed.data.role },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: callerId,
          action: 'member_role_changed',
          entityType: 'workspace_member',
          entityId: target.id,
          changes: {
            from: targetRole,
            to: parsed.data.role,
            targetUserId: target.userId,
          },
          ipAddress,
          userAgent,
        },
      });

      return { ok: true, from: targetRole, to: parsed.data.role, targetUserId: target.userId };
    },
  );

  if (!result.ok) {
    // Same-role é no-op silente — UX "mudou" pra um membro pingar sem efeito,
    // o caller já está na lista vendo o estado novo (= mesmo que antigo).
    if (result.code === 'same_role') return { ok: true };
    const messages: Record<Exclude<typeof result.code, 'same_role'>, string> = {
      not_found: 'Membro não encontrado.',
      self_change: 'Você não pode mudar o próprio papel.',
      cant_promote_owner: 'Use "Transferir propriedade" para mudar o Owner.',
      cant_demote_owner: 'Transfira a propriedade antes de rebaixar o Owner.',
    };
    return { ok: false, error: messages[result.code] };
  }

  return { ok: true };
}

// =============================================================================
// removeMemberAction
// =============================================================================

type RemoveMemberTxResult =
  | { ok: true; targetUserId: string; role: Role }
  | { ok: false; code: 'not_found' | 'cant_remove_owner' | 'self_remove' };

/**
 * `removeMemberAction` — Owner/Admin remove membro do workspace.
 *
 * Bloqueios:
 *  - membro não encontrado
 *  - tentar remover Owner ("Transfira a propriedade antes")
 *  - tentar remover a si mesmo (pra evitar Owner ficar sem workspace por
 *    engano; o fluxo "sair do workspace" deveria ser uma ação separada do
 *    próprio user, M7#5+)
 *
 * **Onde o user remoto vai parar:** a row em `users` permanece (FK
 * `onDelete: Restrict` em `WorkspaceMember.user`). Só o membership some.
 * Se ele tinha outros workspaces, segue normal nos outros.
 */
export async function removeMemberAction(input: RemoveMemberInput): Promise<TeamActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem remover membros.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId: callerId, workspaceId } = auth.ctx;

  const { ipAddress, userAgent } = getRequestAuditContext();

  const result = await withWorkspace<RemoveMemberTxResult>(
    workspaceId,
    async (tx: Prisma.TransactionClient) => {
      const target = await tx.workspaceMember.findFirst({
        where: { id: parsed.data.memberId, workspaceId },
        select: { id: true, userId: true, role: true },
      });
      if (!target) return { ok: false, code: 'not_found' };

      const targetRole = target.role as Role;
      if (targetRole === 'Owner') return { ok: false, code: 'cant_remove_owner' };
      if (target.userId === callerId) return { ok: false, code: 'self_remove' };

      await tx.workspaceMember.delete({ where: { id: target.id } });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: callerId,
          action: 'member_removed',
          entityType: 'workspace_member',
          entityId: target.id,
          changes: { targetUserId: target.userId, role: targetRole },
          ipAddress,
          userAgent,
        },
      });

      return { ok: true, targetUserId: target.userId, role: targetRole };
    },
  );

  if (!result.ok) {
    const messages: Record<typeof result.code, string> = {
      not_found: 'Membro não encontrado.',
      cant_remove_owner: 'Transfira a propriedade antes de remover o Owner.',
      self_remove:
        'Você não pode remover a si mesmo. Peça pra outro Admin remover ou transfira a propriedade.',
    };
    return { ok: false, error: messages[result.code] };
  }

  return { ok: true };
}

// =============================================================================
// resendInviteAction
// =============================================================================

type ResendInviteTxResult =
  | {
      ok: true;
      email: string;
      role: Role;
      token: string;
      workspaceName: string;
      inviterName: string;
    }
  | { ok: false; code: 'not_found' | 'cooldown'; cooldownSeconds?: number };

/** Tempo mínimo entre dois reenvios do MESMO convite (HIGH #2 do review M7#5). */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * `resendInviteAction` — Owner/Admin reenvia email do convite pending.
 *
 * **Token NÃO rotaciona.** Diferente do flow `revoked|expired` em
 * `inviteMemberAction` (que gera token novo pra invalidar links vazados), aqui
 * o link continua o mesmo — UX "o email não chegou, manda de novo o mesmo
 * link". Só atualiza `expires_at` pra estender o TTL.
 *
 * **Rate-limit (fix do review M7#5 HIGH #2):** cooldown server-side de 60s
 * entre reenvios do MESMO convite. Sem isso, Owner click-spam dispara N
 * emails via Resend — spam pro convidado + consumo de cota Resend
 * cross-tenant (a API key Resend é compartilhada entre todos os workspaces
 * do projeto).
 *
 * **Proxy do "lastSentAt" via `expiresAt`:** o schema atual não tem coluna
 * `last_sent_at` (evitamos migration neste PR). Como `expiresAt = lastSentAt
 * + INVITATION_TTL_DAYS` em todo `upsert`/`update` que envia email, o
 * `lastSentAt` é derivável retroativamente. Em M8+ quando uma coluna
 * dedicada entrar, trocar a aritmética por leitura direta.
 *
 * **Sem audit log.** Re-envio é UX repetível, não altera estado de
 * autorização. O envio original já foi logado como `member_invited`.
 */
export async function resendInviteAction(input: ResendInviteInput): Promise<TeamActionResult> {
  const parsed = resendInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem reenviar convites.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  const result = await withWorkspace<ResendInviteTxResult>(
    workspaceId,
    async (tx: Prisma.TransactionClient) => {
      const invite = await tx.invitation.findFirst({
        where: { id: parsed.data.invitationId, workspaceId, status: 'pending' },
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
          expiresAt: true,
          workspace: { select: { name: true } },
        },
      });
      if (!invite) return { ok: false, code: 'not_found' };

      // Cooldown check (HIGH #2): "última vez que foi enviado" = `expiresAt`
      // (que sempre é setado em `now + TTL` no envio) menos TTL. Janela
      // de 60s impede click-spam server-side.
      const lastSentAt = invite.expiresAt.getTime() - INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
      const secondsSinceLastSent = Math.floor((Date.now() - lastSentAt) / 1000);
      if (secondsSinceLastSent < RESEND_COOLDOWN_SECONDS) {
        return {
          ok: false,
          code: 'cooldown',
          cooldownSeconds: RESEND_COOLDOWN_SECONDS - secondsSinceLastSent,
        };
      }

      await tx.invitation.update({
        where: { id: invite.id },
        data: { expiresAt: ttlDate() },
      });

      const inviterRecord = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const inviterName =
        inviterRecord?.name?.trim() || inviterRecord?.email || 'Um membro do time';

      return {
        ok: true,
        email: invite.email,
        role: invite.role as Role,
        token: invite.token,
        workspaceName: invite.workspace.name,
        inviterName,
      };
    },
  );

  if (!result.ok) {
    if (result.code === 'cooldown') {
      const sec = result.cooldownSeconds ?? RESEND_COOLDOWN_SECONDS;
      return {
        ok: false,
        error: `Aguarde ${sec}s antes de reenviar esse convite.`,
      };
    }
    return { ok: false, error: 'Convite não encontrado ou já foi processado.' };
  }

  const { subject, html, text } = renderInviteEmail({
    workspaceName: result.workspaceName,
    inviterName: result.inviterName,
    role: result.role,
    acceptUrl: `${appUrl()}/invite/accept?token=${result.token}`,
    expiresInDays: INVITATION_TTL_DAYS,
  });

  const emailResult = await sendEmail({
    to: result.email,
    subject,
    html,
    text,
  });

  if (!emailResult.ok) {
    console.error('[resendInviteAction] email send failed', emailResult.error);
    return {
      ok: false,
      error: 'Não foi possível reenviar o email agora. Tente em instantes.',
    };
  }

  return { ok: true };
}
