import { formatFileSize } from '@/lib/storage/attachments';

/**
 * Transformações puras do feature `attachments` (M8#6).
 *
 * `toAttachmentUI` converte row Prisma + nome do uploader em UI-friendly
 * shape. Datas viram ISO string (consistente com Lead/Task/Activity).
 */

export interface PrismaAttachmentRow {
  id: string;
  workspaceId: string;
  leadId: string;
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: Date;
  deletedAt: Date | null;
  uploadedBy?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

export interface AttachmentUI {
  id: string;
  leadId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  uploadedById: string;
  uploadedByName: string | null;
  createdAt: string;
}

export function toAttachmentUI(row: PrismaAttachmentRow): AttachmentUI {
  return {
    id: row.id,
    leadId: row.leadId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sizeLabel: formatFileSize(row.sizeBytes),
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedBy?.name ?? row.uploadedBy?.email?.split('@')[0] ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
