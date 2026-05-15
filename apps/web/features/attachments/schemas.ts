import { z } from 'zod';

/**
 * Schemas Zod do feature `attachments` (M8#6 — Supabase Storage).
 *
 * **Borda:** validação acontece em Server Actions. Falha → `{ ok: false,
 * error }`. CLAUDE.md §5: confiar no tipo internamente após parse.
 *
 * **Upload schema é pra metadata only.** O File real chega via FormData.append
 * — Zod não valida bytes; isso fica pro helper `validateAttachmentInput` em
 * `lib/storage/attachments.ts`.
 */

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const uploadAttachmentMetadataSchema = z.object({
  leadId: z.string().uuid('Lead inválido — recarregue a página.'),
  fileName: z
    .string()
    .min(1, 'Nome de arquivo obrigatório.')
    .max(255, 'Nome de arquivo muito longo (máx. 255).'),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: 'Tipo de arquivo não suportado.',
  }),
  sizeBytes: z
    .number()
    .int('Tamanho inválido.')
    .positive('Arquivo vazio.')
    .max(10 * 1024 * 1024, 'Arquivo muito grande (máx. 10 MB).'),
});

export type UploadAttachmentMetadata = z.infer<typeof uploadAttachmentMetadataSchema>;

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid('Anexo inválido.'),
});
export type DeleteAttachmentInput = z.infer<typeof deleteAttachmentSchema>;

export const signedUrlSchema = z.object({
  attachmentId: z.string().uuid('Anexo inválido.'),
});
export type SignedUrlInput = z.infer<typeof signedUrlSchema>;
