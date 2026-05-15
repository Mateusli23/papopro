import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toAttachmentUI, type AttachmentUI } from './transforms';

/**
 * Queries server-only do feature `attachments` (M8#6).
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** `withWorkspace` (RLS) +
 * `where: { workspaceId }` explícito + filtro `deletedAt: null`.
 *
 * **Sort canônico:** `createdAt DESC` (mais recente primeiro).
 */

export async function listAttachmentsForLead(
  workspaceId: string,
  leadId: string,
): Promise<AttachmentUI[]> {
  if (!isUuid(workspaceId) || !isUuid(leadId)) {
    console.error('[listAttachmentsForLead] invalid ids', { workspaceId, leadId });
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.attachment.findMany({
      where: { workspaceId, leadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((row) => toAttachmentUI(row));
  });
}
