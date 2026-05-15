'use server';

/**
 * Server Actions do feature `activities` (M8#4).
 *
 * Apenas **1 action** porque a maioria das activities é gerada
 * automaticamente por outras Server Actions (lead_created, stage_change,
 * task created/completed). Notas manuais são o único evento que o vendedor
 * digita do zero pra registrar contexto.
 *
 * **Schema:** tabela `activities` é append-only (RLS permite só SELECT +
 * INSERT). Não há `updateNoteAction` / `deleteNoteAction` — corrige-se
 * adicionando nota nova.
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import { createNoteSchema, type CreateNoteInput } from './schemas';

export type ActivityActionResult = { ok: true; activityId: string } | { ok: false; error: string };

export async function createNoteActivityAction(
  input: CreateNoteInput,
): Promise<ActivityActionResult> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para adicionar notas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const activityId = await withWorkspace<string>(workspaceId, async (tx) => {
      // Defense-in-depth: confirma que o lead pertence ao workspace.
      const lead = await tx.lead.findFirst({
        where: { id: parsed.data.leadId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      // Resolve workspace_member do caller — activity.authorId é workspace_member.id,
      // não user.id (FK pra `workspace_members`).
      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      });
      if (!member) throw new Error('MEMBER_NOT_FOUND');

      const activity = await tx.activity.create({
        data: {
          workspaceId,
          leadId: parsed.data.leadId,
          type: 'note',
          body: parsed.data.body.trim(),
          authorId: member.id,
        },
        select: { id: true },
      });

      // Atualiza `lastInteractionAt` — nota é registro de toque com o lead.
      await tx.lead.update({
        where: { id: parsed.data.leadId },
        data: { lastInteractionAt: new Date() },
      });

      // Audit log. Reaproveita `lead_updated` (não temos `note_added`).
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'lead_updated',
          entityType: 'lead',
          entityId: parsed.data.leadId,
          changes: {
            eventKind: 'note_added',
            activityId: activity.id,
            bodyPreview: parsed.data.body.slice(0, 120),
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return activity.id;
    });

    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, activityId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') return { ok: false, error: 'Lead não encontrado.' };
      if (err.message === 'MEMBER_NOT_FOUND')
        return { ok: false, error: 'Membership não encontrado. Recarregue a página.' };
    }
    reportNonFatal('activities.createNote.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível adicionar a nota agora.' };
  }
}
