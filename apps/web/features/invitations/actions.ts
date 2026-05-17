'use server';

/**
 * Server Actions de convites (M7#4 Onda 2 + M7#5 refactor).
 *
 * Três operações: convidar (Owner/Admin), aceitar (qualquer user logado com
 * email batendo) e revogar (Owner/Admin). RBAC via helper canônico
 * `requireRole` ([lib/auth/require-role.ts]) — substituiu os 4 blocos inline
 * duplicados de M7#4 em M7#5.
 *
 * **Por que `admin client` na leitura por token:** o token É a autorização.
 * O caller pode estar logado como qualquer email, e a policy RLS de
 * `invitations` filtra por `current_workspace_id()` — que só é setado quando
 * o usuário JÁ é membro do workspace. Chicken-and-egg óbvio. Bypass por
 * service role + filtro explícito por token (que é UUID single-use, ataque
 * por enumeração é impraticável).
 *
 * **Idempotência:**
 *  - `inviteMemberAction`: se já existe convite pending pro mesmo (workspace,
 *    email), reaproveita e re-envia email (atualiza `expires_at`). Cobre o
 *    caso UX "convidei e o email não chegou — convidar de novo".
 *  - `acceptInvitationAction`: se user já é membro, retorna sucesso silente
 *    e marca convite como aceito. Não duplica membership.
 */

import { prisma, type Prisma } from '@papopro/db';

import { getCurrentUser } from '@/lib/auth/get-user';
import { requireRole } from '@/lib/auth/require-role';
import { setWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { sendEmail } from '@/lib/email/resend';
import { renderInviteEmail } from '@/lib/email/templates/invite';
import { canAddMember, limitReachedMessage } from '@/lib/limits';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isPrismaErrorCode } from '@/lib/utils/prisma-errors';

import {
  invitationAcceptSchema,
  invitationCreateSchema,
  invitationRevokeSchema,
  type InvitationAcceptInput,
  type InvitationCreateInput,
  type InvitationRevokeInput,
} from './schemas';

export type InvitationActionResult =
  | { ok: true; invitationId: string }
  | { ok: false; error: string };

export type InvitationAcceptResult =
  | { ok: true; workspaceId: string; redirectTo: string }
  | { ok: false; error: string };

export type InvitationRevokeResult = { ok: true } | { ok: false; error: string };

const INVITATION_TTL_DAYS = 7;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function ttlDate(days = INVITATION_TTL_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * `inviteMemberAction` — Owner/Admin convida alguém pra workspace ativo.
 *
 * Fluxo:
 *  1. Valida Zod.
 *  2. `requireRole(['Owner','Admin'])` — sessão + email + cookie UUID + role
 *     (M7#5: substituiu 4 blocos inline do M7#4 — ver [lib/auth/require-role.ts]).
 *  3. Bloqueia auto-convite (caller convidando o próprio email).
 *  4. Verifica se já é membro (idempotente: retorna sucesso silente).
 *  5. Idempotência de convite: upsert por `(workspaceId, email)` pending —
 *     se existe, atualiza role/expires_at; se não, cria.
 *  6. Dispara email via Resend.
 *  7. Audit log (`member_invited`).
 */
export async function inviteMemberAction(
  input: InvitationCreateInput,
): Promise<InvitationActionResult> {
  const parsed = invitationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem convidar membros.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, userEmail, workspaceId } = auth.ctx;

  const targetEmail = parsed.data.email.toLowerCase().trim();
  const callerEmail = userEmail.toLowerCase().trim();

  if (targetEmail === callerEmail) {
    return { ok: false, error: 'Você já está no workspace — não dá pra se autoconvidar.' };
  }

  // **Fix do review M7#4 CRÍTICO #2 (M7#5):** wrap em `withWorkspace` pra
  // aplicar `SET LOCAL app.workspace_id` antes das operações. Hoje funcionaria
  // sem isso porque Prisma roda como `postgres` superuser que bypassa RLS;
  // em produção com role restrito a policy bloquearia o INSERT/UPDATE sem o
  // contexto setado.
  //
  // **Por que tudo numa tx só:** existingMember check + invitation upsert
  // precisam ser atômicos pra evitar race entre "verifico que não é membro" e
  // "crio convite". inviterRecord vai junto porque é leitura barata.
  //
  // **Discriminated union no retorno** em vez de throw sentinel: TypeScript
  // narrowing funciona limpo (`if (!result.ok) return ...`).
  type InviteWorkspaceResult =
    | {
        ok: true;
        invitation: {
          id: string;
          token: string;
          workspaceName: string;
        };
        inviterName: string;
      }
    | { ok: false; code: 'already_member' }
    | { ok: false; code: 'plan_limit_reached'; message: string };

  const wsResult = await withWorkspace<InviteWorkspaceResult>(workspaceId, async (tx) => {
    // Defense-in-depth + anti-enumeration (M7#4 CRÍTICO #3): 1 query via
    // relation filter (não 2 separadas), pra path indistinguível entre
    // "email tem conta global" e "não tem".
    const existingMember = await tx.workspaceMember.findFirst({
      where: { workspaceId, user: { email: targetEmail } },
      select: { id: true },
    });
    if (existingMember) {
      return { ok: false, code: 'already_member' };
    }

    // Upsert do convite (idempotente por `(workspace_id, email)`).
    //
    // **Fix do review M7#4 MEDIUM #14:** quando o status anterior era `revoked`
    // ou `expired`, gera token novo pra invalidar links antigos que possam ter
    // vazado em logs/forwards. Em `create` o default do DB
    // (`gen_random_uuid()`) atribui token.
    const existingByEmail = await tx.invitation.findUnique({
      where: { workspaceId_email: { workspaceId, email: targetEmail } },
      select: { id: true, status: true, token: true },
    });
    const shouldRotateToken =
      existingByEmail &&
      (existingByEmail.status === 'revoked' || existingByEmail.status === 'expired');

    // M12#4 — enforcement de limite por plano. Conta WorkspaceMember + Invitation
    // pending. Pula a checagem se o convite a ser reaproveitado JÁ é pending
    // (slot já está contabilizado — re-send não consome novo slot). Reativar
    // convite revoked/expired/accepted = +1 slot, então passa pela checagem.
    const skipLimitCheck = existingByEmail?.status === 'pending';
    if (!skipLimitCheck) {
      const limit = await canAddMember(workspaceId, { tx });
      if (!limit.ok) {
        return {
          ok: false,
          code: 'plan_limit_reached',
          message: limitReachedMessage('members', limit.state),
        };
      }
    }

    const invitation = await tx.invitation.upsert({
      where: { workspaceId_email: { workspaceId, email: targetEmail } },
      create: {
        workspaceId,
        email: targetEmail,
        role: parsed.data.role,
        expiresAt: ttlDate(),
        status: 'pending',
        createdById: userId,
      },
      update: {
        role: parsed.data.role,
        expiresAt: ttlDate(),
        status: 'pending',
        acceptedAt: null,
        createdById: userId,
        ...(shouldRotateToken ? { token: crypto.randomUUID() } : {}),
      },
      select: {
        id: true,
        token: true,
        createdAt: true,
        workspace: { select: { name: true } },
      },
    });

    // Resolução do nome do convidador na mesma tx — `users` não tem
    // workspace_id, mas o SET LOCAL não afeta queries em tabelas sem policy
    // de tenant (a row do user já existe — espelhada pelo trigger).
    const inviterRecord = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const inviterName = inviterRecord?.name?.trim() || inviterRecord?.email || 'Um membro do time';

    return {
      ok: true,
      invitation: {
        id: invitation.id,
        token: invitation.token,
        workspaceName: invitation.workspace.name,
      },
      inviterName,
    };
  });

  if (!wsResult.ok) {
    if (wsResult.code === 'plan_limit_reached') {
      return { ok: false, error: wsResult.message };
    }
    return { ok: false, error: 'Esse email já é membro do workspace.' };
  }
  const { invitation, inviterName } = wsResult;

  const { subject, html, text } = renderInviteEmail({
    workspaceName: invitation.workspaceName,
    inviterName,
    role: parsed.data.role,
    acceptUrl: `${appUrl()}/invite/accept?token=${invitation.token}`,
    expiresInDays: INVITATION_TTL_DAYS,
  });

  const emailResult = await sendEmail({
    to: targetEmail,
    subject,
    html,
    text,
  });

  if (!emailResult.ok) {
    // O convite EXISTE no banco — não deletamos. UX: "convite criado mas
    // email falhou; tente reenviar". Em M7#5 a tela /settings/team mostra
    // pending invites com botão "Reenviar email".
    reportNonFatal('invitations.invite.email-send', new Error(emailResult.error), {
      workspaceId,
      status: emailResult.status,
    });
    return {
      ok: false,
      error:
        'Convite criado, mas o email não pôde ser enviado. Tente reenviar pelas configurações do time.',
    };
  }

  // **Audit log DEPOIS do envio do email (fix do review M7#4 HIGH #10):**
  // antes registrávamos audit antes — se email falhasse, ficava "fantasma"
  // dizendo "convite enviado" no log mas o convidado nunca recebia. Agora
  // só audita quando o convite efetivamente saiu do servidor. Em tx
  // separada com `withWorkspace` (M7#5 CRÍTICO #2), non-fatal.
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'member_invited',
          entityType: 'invitation',
          entityId: invitation.id,
          changes: { email: targetEmail, role: parsed.data.role },
        },
      });
    });
  } catch (err) {
    reportNonFatal('invitations.invite.audit', err, { workspaceId, userId });
  }

  return { ok: true, invitationId: invitation.id };
}

/**
 * `acceptInvitationAction` — user logado aceita convite por token.
 *
 * **Não exige RBAC do caller** — o token é a autorização. Mas exige:
 *  - sessão ativa (caller logado)
 *  - email do caller bate com o do convite (case-insensitive)
 *  - convite pending + não expirado
 *
 * Idempotente: se o user já é membro do workspace do convite (raça, replay
 * do link), marca convite como aceito e retorna sucesso — não duplica.
 */
export async function acceptInvitationAction(
  input: InvitationAcceptInput,
): Promise<InvitationAcceptResult> {
  const parsed = invitationAcceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Token inválido.' };
  }

  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: 'Você precisa estar logado pra aceitar o convite.' };
  }
  if (!user.email_confirmed_at) {
    return { ok: false, error: 'Confirme seu email antes de aceitar o convite.' };
  }
  // Const local pra preservar narrowing dentro da `$transaction` callback
  // (fix do review M7#4 MEDIUM #16: substituiu o `user.email!` que mascarava
  // o narrowing perdido na closure async — falha barulhento pelo guard acima
  // se trigger handle_new_auth_user não populou email).
  const userEmail = user.email;

  // **Chicken-and-egg da leitura do convite (documentado no header):** o
  // caller AINDA não é membro do workspace; a policy RLS de `invitations`
  // filtra por `current_workspace_id()` setado por `withWorkspace`. Pra essa
  // leitura inicial ainda usamos `prisma.` direto — em produção com role
  // restrito (M9+) isso vai precisar do admin client (mesmo padrão de
  // `features/invitations/queries.ts:getInvitationByToken`). Hoje funciona
  // porque Prisma roda como superuser que bypassa RLS.
  const invitation = await prisma.invitation.findUnique({
    where: { token: parsed.data.token },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      // **Fix do review M7#4 HIGH #8:** `WorkspaceMember.invitedAt` deve ser
      // o momento da emissão do convite (não do aceite — `joinedAt` cobre
      // isso). Carregamos pra setar corretamente no `create` mais abaixo.
      createdAt: true,
      workspace: { select: { name: true } },
    },
  });

  if (!invitation) {
    return { ok: false, error: 'Convite inválido ou já usado.' };
  }

  // Validações na ordem que dá UX mais informativa (não dependem do DB):
  if (invitation.status === 'accepted') {
    return { ok: false, error: 'Esse convite já foi aceito.' };
  }
  if (invitation.status === 'revoked') {
    return { ok: false, error: 'Esse convite foi cancelado. Peça um novo ao Owner do workspace.' };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Esse convite expirou. Peça um novo ao Owner do workspace.' };
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      error: 'O convite foi enviado pra outro email. Saia e entre com o email convidado.',
    };
  }

  // **Fix do review M7#4 CRÍTICO #2 (M7#5):** tudo daqui pra baixo passa por
  // `withWorkspace(invitation.workspaceId, …)` — aplica `SET LOCAL
  // app.workspace_id` antes de cada INSERT/UPDATE. O caller ainda não é
  // membro, mas o `SET LOCAL` é apenas setting de transação, não exige
  // membership. As policies RLS de `workspace_members` e `audit_logs`
  // permitem `INSERT WITH CHECK (current_workspace_id() = workspace_id)` —
  // o member é criado dentro do contexto certo.
  //
  // **Fix do review M7#4 HIGH #6 (duplo-clique race):** mesma semântica de
  // antes — P2002 fora da tx é tratado como sucesso silente.
  try {
    await withWorkspace(invitation.workspaceId, async (tx: Prisma.TransactionClient) => {
      // Idempotência intra-tx: já é membro? Marca convite como aceito e sai
      // sem criar duplicata (cobre replay do link na mesma sessão).
      const existingMember = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        select: { id: true },
      });

      if (existingMember) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        return;
      }

      // Não é membro ainda — cria tudo (upsert user defensivo + member +
      // invitation update + notification pref + audit).
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: userEmail,
          name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined,
          emailVerifiedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
        },
        update: {},
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
          // Semântica correta (M7#4 HIGH #8): `invitedAt` é quando o convite
          // foi emitido, `joinedAt` quando aceito. Diferença alimenta métrica
          // "tempo até aceite" no painel de admin em M7#5.
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      // Garante NotificationPreference (unique (workspaceId, userId)).
      await tx.notificationPreference.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        create: { workspaceId: invitation.workspaceId, userId: user.id, prefs: {} },
        update: {},
      });

      await tx.auditLog.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          action: 'member_joined',
          entityType: 'invitation',
          entityId: invitation.id,
          changes: { email: userEmail, role: invitation.role },
        },
      });
    });
  } catch (err) {
    // P2002 = unique constraint. Cenário: duplo-clique perdeu a corrida.
    // O member já foi criado pela outra request; UX correta = sucesso silente.
    if (isPrismaErrorCode(err, 'P2002')) {
      console.warn('[acceptInvitationAction] race detected (P2002) — already a member');
      setWorkspaceCookie(invitation.workspaceId);
      return { ok: true, workspaceId: invitation.workspaceId, redirectTo: '/dashboard' };
    }
    reportNonFatal('invitations.accept.tx', err, { workspaceId: invitation.workspaceId });
    return { ok: false, error: 'Não foi possível aceitar o convite agora. Tente em instantes.' };
  }

  setWorkspaceCookie(invitation.workspaceId);
  return { ok: true, workspaceId: invitation.workspaceId, redirectTo: '/dashboard' };
}

/**
 * `revokeInvitationAction` — Owner/Admin cancela convite pending.
 *
 * Restrições:
 *  - convite tem que pertencer ao workspace ativo (defense-in-depth — não
 *    confiamos só na policy RLS).
 *  - só convites com status `pending` podem ser revogados (revogar um
 *    aceito é "remover membro", fluxo diferente — M7#5).
 */
export async function revokeInvitationAction(
  input: InvitationRevokeInput,
): Promise<InvitationRevokeResult> {
  const parsed = invitationRevokeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem cancelar convites.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  // **Fix do review M7#4 CRÍTICO #2 (M7#5):** wrap em `withWorkspace` pra
  // aplicar `SET LOCAL app.workspace_id` antes da operação. Hoje funcionaria
  // sem isso porque Prisma roda como `postgres` superuser que bypassa RLS;
  // em produção com role restrito (planejado pra M9+) a policy bloquearia
  // o UPDATE sem o contexto setado.
  //
  // updateMany com filtro defense-in-depth: id + workspaceId + status pending.
  // Se nada bater (já aceito, de outro workspace, inexistente), `count = 0`.
  const updateCount = await withWorkspace(workspaceId, async (tx) => {
    const result = await tx.invitation.updateMany({
      where: {
        id: parsed.data.invitationId,
        workspaceId,
        status: 'pending',
      },
      data: { status: 'revoked' },
    });
    return result.count;
  });

  if (updateCount === 0) {
    return { ok: false, error: 'Convite não encontrado ou já foi processado.' };
  }

  // Audit em tx separada (non-fatal): falha de audit não rollbacka o revoke.
  // UX importa mais que o guardrail aqui — convite cancelado é o objetivo.
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'invitation_revoked',
          entityType: 'invitation',
          entityId: parsed.data.invitationId,
        },
      });
    });
  } catch (err) {
    reportNonFatal('invitations.revoke.audit', err, {
      workspaceId,
      userId,
      invitationId: parsed.data.invitationId,
    });
  }

  return { ok: true };
}
