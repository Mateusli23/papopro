/**
 * Schemas Zod do domínio Activities (M8#4 — apenas para mutações de nota
 * manual; demais activities são geradas automaticamente por outras
 * Server Actions — lead_created, stage_change, task_created/completed).
 *
 * `note` é a única activity criada via input do usuário. Demais entradas
 * na timeline são derivadas de outras mutações.
 */
import { z } from 'zod';

export const createNoteSchema = z.object({
  leadId: z.string().uuid('Lead inválido — recarregue a página'),
  body: z.string().min(1, 'Escreva sua nota').max(2000, 'Nota muito longa (máx 2000 caracteres)'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
