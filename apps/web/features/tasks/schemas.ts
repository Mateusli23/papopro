/**
 * Schemas Zod do domínio Tasks.
 *
 * Aplica em formulários (TaskCreateDialog) e — em M8 — vai virar input
 * validation de Server Actions. Validar na borda, confiar no tipo
 * internamente (CLAUDE.md §5).
 */
import { z } from 'zod';

const TASK_KIND_VALUES = ['call', 'whatsapp', 'email', 'meeting', 'follow_up', 'other'] as const;
const TASK_STATUS_VALUES = ['pending', 'done', 'snoozed'] as const;

export const taskCreateSchema = z.object({
  /** ID do lead a que a task pertence. Combobox no UI. */
  leadId: z.string().min(1, 'Selecione um lead'),
  /** Tipo da task (controla ícone + cor). */
  kind: z.enum(TASK_KIND_VALUES),
  /**
   * Título visível na lista. Não obrigatório porque pode ser inferido do
   * tipo (ex: "Ligar pra X"), mas se preenchido tem que ter conteúdo real.
   */
  title: z
    .string()
    .min(2, 'Título precisa de pelo menos 2 caracteres')
    .max(120, 'Título muito longo (máx 120)'),
  /** Notas livres — markdown leve. Opcional. */
  notes: z.string().max(2000, 'Notas muito longas (máx 2000)').optional(),
  /** Vendedor responsável. Default: usuário logado. */
  assignedTo: z.string().min(1, 'Atribua a alguém'),
  /**
   * Prazo (datetime ISO). Pra UI mockada aceita date-only que vira
   * 23:59 do dia (deadline padrão "fim do dia"). Em M8 vira datetime full
   * com timezone-aware via Server Action.
   */
  dueAt: z
    .string()
    .min(1, 'Defina um prazo')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida'),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(TASK_STATUS_VALUES).optional(),
  doneAt: z.string().optional(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const TASK_KINDS = TASK_KIND_VALUES;
export const TASK_STATUSES = TASK_STATUS_VALUES;
