/**
 * Schemas Zod do domínio Tasks (M8#4 — server-fed).
 *
 * **M8#4:** `leadId` e `assignedToId` viraram `.uuid()` (eram `.min(1)`
 * por causa de slugs em fixture M4-M7). Mantém compat de chamadas via
 * Server Action — schema valida na borda e mensagens são pt-BR.
 */
import { z } from 'zod';

const TASK_KIND_VALUES = ['call', 'whatsapp', 'email', 'meeting', 'follow_up', 'other'] as const;
const TASK_STATUS_VALUES = ['pending', 'done', 'snoozed'] as const;

export const taskCreateSchema = z.object({
  /** Lead a que a task pertence (UUID em M8#4). */
  leadId: z.string().uuid('Lead inválido — recarregue a página'),
  /** Tipo da task (controla ícone + cor). */
  kind: z.enum(TASK_KIND_VALUES),
  /**
   * Título visível na lista. Deve ter conteúdo real — se não, sugerir via
   * `kind` no client antes de submeter.
   */
  title: z
    .string()
    .min(2, 'Título precisa de pelo menos 2 caracteres')
    .max(160, 'Título muito longo (máx 160)'),
  /** Notas livres — markdown leve. Opcional. */
  notes: z.string().max(2000, 'Notas muito longas (máx 2000)').optional(),
  /**
   * Vendedor responsável (workspace_members.id — UUID em M8#4).
   * Nome `assignedTo` preservado por compatibilidade com fixture/store legados
   * que ainda alimentam dashboard/reports. Server Action mapeia pra
   * `assignedToId` do Prisma.
   */
  assignedTo: z.string().uuid('Vendedor inválido — recarregue a página'),
  /** Prazo (datetime ISO). */
  dueAt: z
    .string()
    .min(1, 'Defina um prazo')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida'),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

// ─── Server Actions M8#4 ────────────────────────────────────────────────

/**
 * Update parcial de uma task. Caller passa `taskId` + patch dos campos
 * editáveis. NÃO inclui `leadId` (mover task entre leads não faz sentido —
 * cria task nova no lead destino).
 */
export const updateTaskSchema = z.object({
  taskId: z.string().uuid('Tarefa inválida'),
  kind: z.enum(TASK_KIND_VALUES).optional(),
  title: z
    .string()
    .min(2, 'Título precisa de pelo menos 2 caracteres')
    .max(160, 'Título muito longo (máx 160)')
    .optional(),
  notes: z.string().max(2000, 'Notas muito longas (máx 2000)').optional(),
  assignedToId: z.string().uuid('Vendedor inválido').optional(),
  dueAt: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida')
    .optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const completeTaskSchema = z.object({
  taskId: z.string().uuid('Tarefa inválida'),
});
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export const reopenTaskSchema = z.object({
  taskId: z.string().uuid('Tarefa inválida'),
});
export type ReopenTaskInput = z.infer<typeof reopenTaskSchema>;

export const deleteTaskSchema = z.object({
  taskId: z.string().uuid('Tarefa inválida'),
});
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;

// ─── Legado (mantido pra compatibilidade do store mock em /tasks views) ──

/**
 * @deprecated M8#4 — usar `updateTaskSchema` com `taskId` em Server Actions.
 * Mantido pra compatibilidade do `store.ts` que ainda existe pra outros
 * features mock (dashboard, reports).
 */
export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(TASK_STATUS_VALUES).optional(),
  doneAt: z.string().optional(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const TASK_KINDS = TASK_KIND_VALUES;
export const TASK_STATUSES = TASK_STATUS_VALUES;
