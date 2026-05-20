'use server';

/**
 * Server Actions de handoff manual (M11#6):
 *  - `assumeConversationAction`     — vendedor clica "Assumir conversa": a IA
 *    para de atender, o vendedor vira dono. Gatilho `manual` do PRD §3.9.
 *  - `resumeAiOnConversationAction` — "Devolver pra IA": reativa o agente na
 *    conversa (próximo inbound volta pro roteador).
 *
 * **Padrão (M8/M9):** Zod → requireRole → withWorkspace tx → defense-in-depth
 * `where: { workspaceId }` → audit MESMA tx → revalidatePath.
 *
 * O grosso do handoff agente→humano (encerrar sessões, `ai_enabled=false`,
 * Activity, audit) vive em `handoff-runtime.ts:applyHumanHandoffTx`, reusado
 * aqui e pelo runtime/job.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import { applyHumanHandoffTx } from './handoff-runtime';

const conversationIdSchema = z.object({
  conversationId: z.string().uuid({ message: 'Conversa inválida.' }),
});

export type HandoffActionResult = { ok: true } | { ok: false; error: string };

// ─── assumeConversationAction ───────────────────────────────────────────────

/**
 * Handoff manual agente→humano. O vendedor que clica vira dono da conversa
 * (`vendorId`), a IA é desligada (`ai_enabled=false`) e qualquer sessão de
 * agente aberta é encerrada.
 */
export async function assumeConversationAction(input: {
  conversationId: string;
}): Promise<HandoffActionResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para assumir conversas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, leadId: true },
      });
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');

      // Membro do clicador — vira o `vendorId` da conversa.
      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      });

      // Agente que estava atendendo (se houver) — só pro audit/activity meta.
      const openSession = await tx.agentSession.findFirst({
        where: {
          workspaceId,
          conversationId: conversation.id,
          kind: 'production',
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
        select: { agentId: true },
      });

      await applyHumanHandoffTx(tx, {
        workspaceId,
        conversationId: conversation.id,
        leadId: conversation.leadId,
        reason: 'manual',
        agentId: openSession?.agentId ?? null,
        userId,
      });

      // Quem assumiu vira o dono da conversa.
      if (member) {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { vendorId: member.id },
        });
      }
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'CONVERSATION_NOT_FOUND') {
      return { ok: false, error: 'Conversa não encontrada.' };
    }
    reportNonFatal('agents.handoff.assume.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível assumir a conversa agora.' };
  }
}

// ─── resumeAiOnConversationAction ───────────────────────────────────────────

/**
 * Reativa a IA numa conversa que estava em mãos humanas. O próximo inbound
 * volta a passar pelo roteador (M11#5) e abre uma sessão production nova.
 */
export async function resumeAiOnConversationAction(input: {
  conversationId: string;
}): Promise<HandoffActionResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para reativar a IA.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, leadId: true, aiEnabled: true },
      });
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (conversation.aiEnabled) return; // já ativa — idempotente

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { aiEnabled: true },
      });

      await tx.activity.create({
        data: {
          workspaceId,
          leadId: conversation.leadId,
          type: 'note',
          authorId: null,
          body: 'IA reativada nesta conversa — o agente volta a atender.',
          meta: {
            handoff: true,
            direction: 'ai_resumed',
            conversationId: conversation.id,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'handoff_reverted',
          entityType: 'conversation',
          entityId: conversation.id,
          changes: { leadId: conversation.leadId } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'CONVERSATION_NOT_FOUND') {
      return { ok: false, error: 'Conversa não encontrada.' };
    }
    reportNonFatal('agents.handoff.resume.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível reativar a IA agora.' };
  }
}
