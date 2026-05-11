'use server';

/**
 * Server Actions de convites (M7#4 Onda 2).
 *
 * Três operações: convidar (Owner/Admin), aceitar (qualquer user logado com
 * email batendo) e revogar (Owner/Admin). RBAC enforce é inline aqui — o
 * helper genérico `requireRole(ctx, ['Owner','Admin'])` entra em M7#5 quando
 * domain actions começarem a aparecer em volume.
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
import { setWorkspaceCookie, readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { sendEmail } from '@/lib/email/resend';
import { renderInviteEmail } from '@/lib/email/templates/invite';

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
const ADMIN_ROLES = new Set(['Owner', 'Admin']);

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
 *  1. Valida Zod + sessão + workspace ativo (cookie).
 *  2. RBAC: caller tem que ser Owner/Admin do workspace.
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

  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: 'Sessão expirada — faça login novamente.' };
  }

  const workspaceId = readWorkspaceCookie();
  if (!workspaceId) {
    return { ok: false, error: 'Nenhum workspace ativo. Recarregue a página.' };
  }

  // RBAC inline (helper genérico em M7#5).
  const caller = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  if (!caller || !ADMIN_ROLES.has(caller.role)) {
    return { ok: false, error: 'Apenas Owner e Admin podem convidar membros.' };
  }

  const targetEmail = parsed.data.email.toLowerCase().trim();
  const callerEmail = user.email.toLowerCase().trim();

  if (targetEmail === callerEmail) {
    return { ok: false, error: 'Você já está no workspace — não dá pra se autoconvidar.' };
  }

  // Se o email já tem conta E já é membro, evita criar convite "fantasma".
  // Lookup user → membership. Defense-in-depth: filtros explícitos.
  const existingUser = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true },
  });
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      select: { id: true },
    });
    if (existingMember) {
      return { ok: false, error: 'Esse email já é membro do workspace.' };
    }
  }

  // Upsert do convite (idempotente por `(workspace_id, email)`). Reusa token
  // existente se houver — link enviado antes continua funcionando. Atualiza
  // role/expires_at/status pra "pending" (caso estivesse "revoked" ou
  // "expired") pra um reconvite limpo.
  const invitation = await prisma.invitation.upsert({
    where: { workspaceId_email: { workspaceId, email: targetEmail } },
    create: {
      workspaceId,
      email: targetEmail,
      role: parsed.data.role,
      expiresAt: ttlDate(),
      status: 'pending',
      createdById: user.id,
    },
    update: {
      role: parsed.data.role,
      expiresAt: ttlDate(),
      status: 'pending',
      acceptedAt: null,
      createdById: user.id,
    },
    select: { id: true, token: true, workspace: { select: { name: true } } },
  });

  // Audit log fora da upsert (não precisa ser transacional com ela — perder
  // a row de audit em raríssimo crash é aceitável; perder o convite não).
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: user.id,
        action: 'member_invited',
        entityType: 'invitation',
        entityId: invitation.id,
        changes: { email: targetEmail, role: parsed.data.role },
      },
    });
  } catch (err) {
    console.error('[inviteMemberAction] audit log failed (non-fatal)', err);
  }

  // Email. Resolução do nome do convidador: prefere `users.name` (espelhado
  // do auth metadata); cai pro email se vazio.
  const inviterRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  });
  const inviterName = inviterRecord?.name?.trim() || inviterRecord?.email || 'Um membro do time';

  const { subject, html, text } = renderInviteEmail({
    workspaceName: invitation.workspace.name,
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
    console.error('[inviteMemberAction] email send failed', emailResult.error);
    return {
      ok: false,
      error:
        'Convite criado, mas o email não pôde ser enviado. Tente reenviar pelas configurações do time.',
    };
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

  const invitation = await prisma.invitation.findUnique({
    where: { token: parsed.data.token },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      workspace: { select: { name: true } },
    },
  });

  if (!invitation) {
    return { ok: false, error: 'Convite inválido ou já usado.' };
  }

  // Validações na ordem que dá UX mais informativa:
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

  // Idempotência: já é membro? Marca convite como aceito e segue.
  const existingMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
    select: { id: true },
  });

  if (existingMember) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    setWorkspaceCookie(invitation.workspaceId);
    return { ok: true, workspaceId: invitation.workspaceId, redirectTo: '/dashboard' };
  }

  // Transação: cria member + marca convite + audit. Inclui upsert defensivo
  // de users — mesmo argumento da Onda 1 (raro caso de trigger falhando).
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email!,
          name: (user.user_metadata as Record<string, unknown>)?.name as string | undefined,
          emailVerifiedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
        },
        update: {},
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
          invitedAt: new Date(),
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
          changes: { email: user.email, role: invitation.role },
        },
      });
    });
  } catch (err) {
    console.error('[acceptInvitationAction] transaction failed', err);
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

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'Sessão expirada — faça login novamente.' };
  }

  const workspaceId = readWorkspaceCookie();
  if (!workspaceId) {
    return { ok: false, error: 'Nenhum workspace ativo. Recarregue a página.' };
  }

  const caller = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  if (!caller || !ADMIN_ROLES.has(caller.role)) {
    return { ok: false, error: 'Apenas Owner e Admin podem cancelar convites.' };
  }

  // updateMany com filtro defense-in-depth: id + workspaceId + status pending.
  // Se nada bater (já aceito, de outro workspace, inexistente), `count = 0`.
  const result = await prisma.invitation.updateMany({
    where: {
      id: parsed.data.invitationId,
      workspaceId,
      status: 'pending',
    },
    data: { status: 'revoked' },
  });

  if (result.count === 0) {
    return { ok: false, error: 'Convite não encontrado ou já foi processado.' };
  }

  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: user.id,
        action: 'invitation_revoked',
        entityType: 'invitation',
        entityId: parsed.data.invitationId,
      },
    });
  } catch (err) {
    console.error('[revokeInvitationAction] audit log failed (non-fatal)', err);
  }

  return { ok: true };
}
