/**
 * Schemas Zod de QuickReply (M9#4).
 *
 * Validação inline nas Server Actions de `features/quick-replies/actions.ts`.
 * `label` é o chip exibido no composer (máx 80 chars — tem que caber numa
 * pílula); `body` é o texto colado (máx 4096 — mesmo limite WhatsApp,
 * placeholders `{nome}` etc resolvidos no client).
 */
import { z } from 'zod';

const labelSchema = z
  .string()
  .trim()
  .min(1, 'Dê um nome curto à resposta rápida')
  .max(80, 'Rótulo muito longo (máx 80 caracteres)');

const bodySchema = z
  .string()
  .trim()
  .min(1, 'Escreva o conteúdo da resposta rápida')
  .max(4096, 'Conteúdo muito longo (máx 4096 caracteres)');

export const createQuickReplySchema = z.object({
  label: labelSchema,
  body: bodySchema,
  order: z.number().int().min(0).max(9999).optional(),
});
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;

export const updateQuickReplySchema = z
  .object({
    id: z.string().uuid({ message: 'Resposta rápida inválida.' }),
    label: labelSchema.optional(),
    body: bodySchema.optional(),
    order: z.number().int().min(0).max(9999).optional(),
  })
  .refine(
    (v) => v.label !== undefined || v.body !== undefined || v.order !== undefined,
    'Informe ao menos um campo para atualizar.',
  );
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;

export const deleteQuickReplySchema = z.object({
  id: z.string().uuid({ message: 'Resposta rápida inválida.' }),
});
export type DeleteQuickReplyInput = z.infer<typeof deleteQuickReplySchema>;

export const reorderQuickRepliesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid({ message: 'Resposta rápida inválida.' }),
        order: z.number().int().min(0).max(9999),
      }),
    )
    .min(1, 'Informe pelo menos um item para reordenar')
    .max(100, 'Reordene em lotes menores (máx 100)'),
});
export type ReorderQuickRepliesInput = z.infer<typeof reorderQuickRepliesSchema>;
