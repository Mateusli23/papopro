'use server';

/**
 * Server Actions complementares de Conversation (M9#4):
 *  - `archiveConversationAction` — soft-archive
 *  - `unarchiveConversationAction` — desfaz archive
 *  - `transferConversationAction` — troca vendor responsável
 *  - `markConversationReadAction` — zera unreadCount + marca inbound como read
 *
 * **Padrão (M8/M9):** Zod → requireRole → withWorkspace tx → defense-in-depth
 * `where: { workspaceId }` → audit MESMA tx → revalidatePath.
 *
 * Separado de `features/inbox/actions.ts` (que cobre `sendTextMessage` +
 * `sendInternalNote` do M9#3) pra evitar inflar 1 arquivo com 6+ actions.
 * Naming: `*-actions.ts` pra arquivos de actions complementares; o principal
 * fica `actions.ts`.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

// ─── Schemas ────────────────────────────────────────────────────────────────

const conversationIdSchema = z.object({
  conversationId: z.string().uuid({ message: 'Conversa inválida.' }),
});

const transferSchema = z.object({
  conversationId: z.string().uuid({ message: 'Conversa inválida.' }),
  vendorId: z.string().uuid({ message: 'Vendedor inválido.' }),
});

// ─── archiveConversationAction ──────────────────────────────────────────────

export type ArchiveConversationResult = { ok: true } | { ok: false; error: string };

export async function archiveConversationAction(input: {
  conversationId: string;
}): Promise<ArchiveConversationResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para arquivar conversas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, leadId: true, archivedAt: true },
      });
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (conversation.archivedAt) return; // já arquivada — idempotente

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { status: 'archived', archivedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'conversation_archived',
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
    const message = (err as Error).message;
    if (message === 'CONVERSATION_NOT_FOUND') {
      return { ok: false, error: 'Conversa não encontrada.' };
    }
    reportNonFatal('inbox.archive.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível arquivar agora.' };
  }
}

// ─── unarchiveConversationAction ────────────────────────────────────────────

export async function unarchiveConversationAction(input: {
  conversationId: string;
}): Promise<ArchiveConversationResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para desarquivar conversas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, archivedAt: true, lastMessageDirection: true },
      });
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (!conversation.archivedAt) return; // já ativa — idempotente

      // Status volta a awaiting/responded com base na última direção. Sem
      // última mensagem (raro), default awaiting.
      const newStatus = conversation.lastMessageDirection === 'in' ? 'responded' : 'awaiting';

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { status: newStatus, archivedAt: null },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'conversation_archived', // reusa enum existente (M9#1 não tem unarchive separado)
          entityType: 'conversation',
          entityId: conversation.id,
          changes: { unarchive: true, newStatus } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CONVERSATION_NOT_FOUND') {
      return { ok: false, error: 'Conversa não encontrada.' };
    }
    reportNonFatal('inbox.unarchive.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível desarquivar agora.' };
  }
}

// ─── transferConversationAction ─────────────────────────────────────────────

export type TransferConversationResult = { ok: true } | { ok: false; error: string };

export async function transferConversationAction(input: {
  conversationId: string;
  vendorId: string;
}): Promise<TransferConversationResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Owner/Admin/Manager podem transferir qualquer conversa. Vendedor não
  // (evita reassignment self-serve criar caos).
  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem transferir conversas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, leadId: true, vendorId: true },
      });
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');

      const newVendor = await tx.workspaceMember.findFirst({
        where: { id: parsed.data.vendorId, workspaceId },
        select: { id: true, role: true },
      });
      if (!newVendor) throw new Error('VENDOR_NOT_FOUND');

      if (conversation.vendorId === newVendor.id) return; // no-op

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { vendorId: newVendor.id },
      });

      // Também atualiza assignedTo do lead — vendedor da conversa = vendedor
      // do lead (consistência com o que /leads mostra).
      await tx.lead.update({
        where: { id: conversation.leadId },
        data: { assignedToId: newVendor.id },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'conversation_transferred',
          entityType: 'conversation',
          entityId: conversation.id,
          changes: {
            leadId: conversation.leadId,
            previousVendorId: conversation.vendorId,
            newVendorId: newVendor.id,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CONVERSATION_NOT_FOUND') {
      return { ok: false, error: 'Conversa não encontrada.' };
    }
    if (message === 'VENDOR_NOT_FOUND') {
      return { ok: false, error: 'Vendedor não pertence ao workspace.' };
    }
    reportNonFatal('inbox.transfer.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível transferir agora.' };
  }
}

// ─── markConversationReadAction ─────────────────────────────────────────────

export async function markConversationReadAction(input: {
  conversationId: string;
}): Promise<ArchiveConversationResult> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Qualquer membro pode marcar como lida (leitura). Viewer também — só vê.
  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor', 'Viewer'], {
    forbiddenMessage: 'Você não tem acesso a esta conversa.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: parsed.data.conversationId, workspaceId },
        select: { id: true, unreadCount: true },
      });
      if (!conversation) return; // silencioso — UI optimistic seguir mesmo se sumiu
      if (conversation.unreadCount === 0) return; // idempotente

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0 },
      });

      // Marcar inbound não-lidas como readAt=now (UI ainda renderiza o body,
      // mas badge desaparece). Append-only do `messages` permite UPDATE em
      // readAt/deliveredAt via policy condicional (M9#1).
      await tx.message.updateMany({
        where: {
          workspaceId,
          conversationId: conversation.id,
          direction: 'in',
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) {
    reportNonFatal('inbox.mark-read.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível marcar como lida agora.' };
  }
}
