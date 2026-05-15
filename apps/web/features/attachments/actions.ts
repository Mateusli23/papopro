'use server';

/**
 * Server Actions do feature `attachments` (M8#6 — Supabase Storage).
 *
 * Três operações cobrindo o CRUD da seção "Anexos" da ficha do lead:
 *  - `uploadAttachmentAction` — recebe FormData (`leadId` + `file`)
 *  - `deleteAttachmentAction` — soft-delete (via `deletedAt`)
 *  - `getAttachmentDownloadUrlAction` — signed URL TTL 1h
 *
 * **Padrão (espelha `features/leads/actions.ts`):**
 *  1. Zod parse (falha rápido com mensagem pt-BR)
 *  2. `requireRole([...])` — gate RBAC
 *  3. `validateAttachmentInput` — MIME + size (defense-in-depth com config do bucket)
 *  4. Upload no Storage **antes** da tx Prisma — se falhar, abort cedo
 *  5. `withWorkspace(workspaceId, async tx => …)` — RLS + defense-in-depth
 *  6. Cria `Attachment` row + activity `attachment` + audit na MESMA tx
 *  7. Em caso de erro depois do upload OK, cleanup do storage object
 *  8. `revalidatePath('/leads/[id]')`
 *
 * **RBAC:**
 *  - Upload: Owner/Admin/Manager/Vendedor
 *  - Delete: Owner/Admin/Manager **OU** o autor do upload (regra híbrida)
 *  - Download URL: qualquer membro do workspace (inclusive Viewer)
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import {
  buildStoragePath,
  createSignedDownloadUrl,
  deleteFromStorage,
  uploadToStorage,
  validateAttachmentInput,
} from '@/lib/storage/attachments';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import {
  deleteAttachmentSchema,
  signedUrlSchema,
  uploadAttachmentMetadataSchema,
  type DeleteAttachmentInput,
  type SignedUrlInput,
} from './schemas';
import { toAttachmentUI, type AttachmentUI } from './transforms';

// =============================================================================
// uploadAttachmentAction
// =============================================================================

export type UploadAttachmentResult =
  | { ok: true; attachment: AttachmentUI }
  | { ok: false; error: string };

/**
 * Upload de arquivo. Caller passa FormData com `leadId` + `file`.
 *
 * Fluxo:
 *  1. Extrai metadata do File → valida Zod + helper puro.
 *  2. Upload no Storage (UUID prefixa path pra evitar colisão).
 *  3. Tx: cria `Attachment` row + activity `attachment` + audit.
 *  4. Se algo falhar pós-upload, remove objeto do storage (compensação).
 */
export async function uploadAttachmentAction(formData: FormData): Promise<UploadAttachmentResult> {
  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para anexar arquivos.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const leadIdRaw = formData.get('leadId');
  const file = formData.get('file');
  const leadId = typeof leadIdRaw === 'string' ? leadIdRaw : '';

  if (!isUuid(leadId)) {
    return { ok: false, error: 'Lead inválido — recarregue a página.' };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: 'Arquivo não recebido.' };
  }

  const metadata = {
    leadId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
  const parsed = uploadAttachmentMetadataSchema.safeParse(metadata);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Metadata inválida.' };
  }

  const validation = validateAttachmentInput({
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    fileName: metadata.fileName,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }

  // Defense-in-depth: confirma lead pertence ao workspace ANTES do upload.
  try {
    const leadExists = await withWorkspace<boolean>(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      return Boolean(lead);
    });
    if (!leadExists) {
      return { ok: false, error: 'Lead não encontrado.' };
    }
  } catch (err) {
    reportNonFatal('attachments.upload.lead-lookup', err, { workspaceId, leadId });
    return { ok: false, error: 'Não foi possível validar o lead agora.' };
  }

  // Upload no Storage.
  const path = buildStoragePath(workspaceId, leadId, metadata.fileName);
  const arrayBuffer = await file.arrayBuffer();
  const upload = await uploadToStorage(path, Buffer.from(arrayBuffer), metadata.mimeType);
  if (!upload.ok) {
    reportNonFatal('attachments.upload.storage', new Error(upload.message), {
      workspaceId,
      leadId,
      userId,
    });
    return { ok: false, error: 'Não foi possível enviar o arquivo. Tente novamente.' };
  }

  // Tx: cria row + activity + audit.
  try {
    const attachment = await withWorkspace(workspaceId, async (tx) => {
      const row = await tx.attachment.create({
        data: {
          workspaceId,
          leadId,
          bucket: 'attachments',
          path: upload.path,
          fileName: metadata.fileName,
          mimeType: metadata.mimeType,
          sizeBytes: metadata.sizeBytes,
          uploadedById: userId,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Activity `attachment` na timeline. `meta.fileSizeKb` mantém compat
      // com a renderização que LeadTimeline já fazia em M4 (mock).
      await tx.activity.create({
        data: {
          workspaceId,
          leadId,
          type: 'attachment',
          authorId: null,
          meta: {
            attachmentId: row.id,
            fileName: metadata.fileName,
            fileSizeKb: Math.round(metadata.sizeBytes / 1024),
            mimeType: metadata.mimeType,
          } as Prisma.InputJsonValue,
        },
      });

      // Atualiza lastInteractionAt — anexo subido conta como interação.
      await tx.lead.update({
        where: { id: leadId },
        data: { lastInteractionAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'attachment_uploaded',
          entityType: 'attachment',
          entityId: row.id,
          changes: {
            leadId,
            fileName: metadata.fileName,
            sizeBytes: metadata.sizeBytes,
            mimeType: metadata.mimeType,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return toAttachmentUI(row);
    });

    revalidatePath(`/leads/${leadId}`);
    return { ok: true, attachment };
  } catch (err) {
    // Compensação: remove storage object pra não deixar órfão.
    reportNonFatal('attachments.upload.tx', err, { workspaceId, leadId, userId });
    await deleteFromStorage([path]).catch(() => undefined);
    return { ok: false, error: 'Não foi possível registrar o anexo agora.' };
  }
}

// =============================================================================
// deleteAttachmentAction (soft-delete)
// =============================================================================

export type DeleteAttachmentResult = { ok: true } | { ok: false; error: string };

/**
 * Soft-delete do anexo. `deletedAt` é setado imediatamente; storage object
 * só é removido pelo cleanup job +30d (CLAUDE.md §6, `/api/cron/cleanup-attachments`).
 *
 * **RBAC híbrido:**
 *  - Owner/Admin/Manager: pode deletar qualquer anexo do workspace.
 *  - Vendedor: só pode deletar o que ele próprio subiu.
 */
export async function deleteAttachmentAction(
  input: DeleteAttachmentInput,
): Promise<DeleteAttachmentResult> {
  const parsed = deleteAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para deletar anexos.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId, role } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();
  const { attachmentId } = parsed.data;

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      const existing = await tx.attachment.findFirst({
        where: { id: attachmentId, workspaceId, deletedAt: null },
        select: {
          id: true,
          leadId: true,
          uploadedById: true,
          fileName: true,
        },
      });
      if (!existing) throw new Error('ATTACHMENT_NOT_FOUND');

      // RBAC híbrido. Manager+ podem tudo; Vendedor só seu próprio upload.
      const isManagerOrAbove = role === 'Owner' || role === 'Admin' || role === 'Manager';
      const isAuthor = existing.uploadedById === userId;
      if (!isManagerOrAbove && !isAuthor) {
        throw new Error('NOT_AUTHOR');
      }

      await tx.attachment.update({
        where: { id: attachmentId },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'attachment_deleted',
          entityType: 'attachment',
          entityId: attachmentId,
          changes: {
            leadId: existing.leadId,
            fileName: existing.fileName,
            softDelete: true,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return existing.leadId;
    });

    revalidatePath(`/leads/${leadId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'ATTACHMENT_NOT_FOUND') {
        return { ok: false, error: 'Anexo não encontrado.' };
      }
      if (err.message === 'NOT_AUTHOR') {
        return {
          ok: false,
          error: 'Você só pode deletar os anexos que enviou.',
        };
      }
    }
    reportNonFatal('attachments.delete.tx', err, { workspaceId, userId, attachmentId });
    return { ok: false, error: 'Não foi possível deletar o anexo agora.' };
  }
}

// =============================================================================
// getAttachmentDownloadUrlAction
// =============================================================================

export type DownloadUrlResult =
  | { ok: true; url: string; expiresAt: string; fileName: string }
  | { ok: false; error: string };

/**
 * Gera signed URL com TTL 1h pra download. Qualquer membro do workspace
 * (inclusive Viewer) pode baixar — não há gate adicional além do "ser membro".
 *
 * **Defense-in-depth:** filtra `workspaceId` no lookup. Mesmo que alguém chute
 * `attachmentId` aleatório, só baixa se for do workspace ativo dele.
 */
export async function getAttachmentDownloadUrlAction(
  input: SignedUrlInput,
): Promise<DownloadUrlResult> {
  const parsed = signedUrlSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor', 'Viewer'], {
    forbiddenMessage: 'Você não tem acesso a este anexo.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId } = auth.ctx;
  const { attachmentId } = parsed.data;

  try {
    const attachment = await withWorkspace(workspaceId, async (tx) => {
      return await tx.attachment.findFirst({
        where: { id: attachmentId, workspaceId, deletedAt: null },
        select: { path: true, fileName: true },
      });
    });
    if (!attachment) {
      return { ok: false, error: 'Anexo não encontrado.' };
    }

    const signed = await createSignedDownloadUrl(attachment.path, 3600);
    if (!signed.ok) {
      return { ok: false, error: 'Não foi possível gerar a URL agora.' };
    }

    return {
      ok: true,
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
      fileName: attachment.fileName,
    };
  } catch (err) {
    reportNonFatal('attachments.signed-url.tx', err, { workspaceId, attachmentId });
    return { ok: false, error: 'Não foi possível gerar a URL agora.' };
  }
}
