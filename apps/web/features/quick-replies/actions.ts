'use server';

/**
 * Server Actions de QuickReply (M9#4).
 *
 * CRUD básico (create/update/delete/reorder) dos templates do composer da
 * Inbox. Placeholders `{nome}`/`{empresa}`/`{produto}` são resolvidos no
 * client; o body fica cru no banco.
 *
 * **RBAC:**
 *  - Create/Update/Delete/Reorder: Owner/Admin/Manager (gestores curam o set).
 *  - Vendedor consome mas não edita — evita inflar a barra de chips por preferência individual.
 *
 * **Padrão:** Zod → requireRole → withWorkspace tx → audit MESMA tx →
 * revalidatePath. Erros traduzidos.
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import {
  createQuickReplySchema,
  deleteQuickReplySchema,
  reorderQuickRepliesSchema,
  updateQuickReplySchema,
  type CreateQuickReplyInput,
  type DeleteQuickReplyInput,
  type ReorderQuickRepliesInput,
  type UpdateQuickReplyInput,
} from './schemas';

const MANAGER_PLUS = ['Owner', 'Admin', 'Manager'] as const;

// ─── createQuickReplyAction ─────────────────────────────────────────────────

export type CreateQuickReplyResult = { ok: true; id: string } | { ok: false; error: string };

export async function createQuickReplyAction(
  input: CreateQuickReplyInput,
): Promise<CreateQuickReplyResult> {
  const parsed = createQuickReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(MANAGER_PLUS, {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem criar respostas rápidas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const result = await withWorkspace(workspaceId, async (tx) => {
      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      });

      // `order` default = max(order) + 1 (final da lista). Caller pode passar
      // explícito.
      const nextOrder =
        parsed.data.order ??
        ((
          await tx.quickReply.aggregate({
            where: { workspaceId },
            _max: { order: true },
          })
        )._max.order ?? -1) + 1;

      const row = await tx.quickReply.create({
        data: {
          workspaceId,
          label: parsed.data.label,
          body: parsed.data.body,
          order: nextOrder,
          createdById: member?.id ?? null,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'quick_reply_created',
          entityType: 'quick_reply',
          entityId: row.id,
          changes: {
            label: parsed.data.label,
            order: nextOrder,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return row.id;
    });

    revalidatePath('/inbox');
    return { ok: true, id: result };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return { ok: false, error: 'Já existe uma resposta rápida com esse rótulo.' };
    }
    reportNonFatal('quick-replies.create.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível criar agora.' };
  }
}

// ─── updateQuickReplyAction ─────────────────────────────────────────────────

export type UpdateQuickReplyResult = { ok: true } | { ok: false; error: string };

export async function updateQuickReplyAction(
  input: UpdateQuickReplyInput,
): Promise<UpdateQuickReplyResult> {
  const parsed = updateQuickReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(MANAGER_PLUS, {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem editar respostas rápidas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const existing = await tx.quickReply.findFirst({
        where: { id: parsed.data.id, workspaceId },
        select: { id: true },
      });
      if (!existing) throw new Error('NOT_FOUND');

      await tx.quickReply.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
          ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
          ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
        },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    if ((err as Error).message === 'NOT_FOUND') {
      return { ok: false, error: 'Resposta rápida não encontrada.' };
    }
    if ((err as { code?: string }).code === 'P2002') {
      return { ok: false, error: 'Já existe uma resposta rápida com esse rótulo.' };
    }
    reportNonFatal('quick-replies.update.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível salvar agora.' };
  }
}

// ─── deleteQuickReplyAction ─────────────────────────────────────────────────

export type DeleteQuickReplyResult = { ok: true } | { ok: false; error: string };

export async function deleteQuickReplyAction(
  input: DeleteQuickReplyInput,
): Promise<DeleteQuickReplyResult> {
  const parsed = deleteQuickReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(MANAGER_PLUS, {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem deletar respostas rápidas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const existing = await tx.quickReply.findFirst({
        where: { id: parsed.data.id, workspaceId },
        select: { id: true, label: true },
      });
      if (!existing) return; // idempotente

      await tx.quickReply.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'quick_reply_deleted',
          entityType: 'quick_reply',
          entityId: existing.id,
          changes: { label: existing.label } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    reportNonFatal('quick-replies.delete.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível deletar agora.' };
  }
}

// ─── reorderQuickRepliesAction ──────────────────────────────────────────────

export type ReorderQuickRepliesResult = { ok: true } | { ok: false; error: string };

export async function reorderQuickRepliesAction(
  input: ReorderQuickRepliesInput,
): Promise<ReorderQuickRepliesResult> {
  const parsed = reorderQuickRepliesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(MANAGER_PLUS, {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem reordenar respostas rápidas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      // updates em batch via Promise.all (Prisma 5 não tem updateMany com SET FROM mapping)
      await Promise.all(
        parsed.data.items.map((item) =>
          tx.quickReply.updateMany({
            where: { id: item.id, workspaceId },
            data: { order: item.order },
          }),
        ),
      );
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    reportNonFatal('quick-replies.reorder.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível reordenar agora.' };
  }
}
