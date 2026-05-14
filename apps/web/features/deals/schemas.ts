import { z } from 'zod';

/**
 * Schema Zod do domínio Deal — alimenta o modal "Adicionar negócio" e
 * as Server Actions de drag-and-drop do Kanban (M8#3).
 *
 * Mensagens em pt-BR direto e propositivas (CLAUDE.md §5 + §7.6).
 *
 * **M8#3:** `leadId`/`stageId`/`ownerId` viraram `.uuid()` (eram `.min(1)` em
 * M4 por causa dos slugs de fixture). Volume real do produto trabalha com
 * UUIDs do Postgres; validação na borda evita query crashar com `P2003`
 * em FK e produz mensagem útil.
 */
export const dealCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Dê um título ao negócio')
    .min(3, 'Título muito curto — descreva a oportunidade')
    .max(120, 'Título muito longo (máx. 120 caracteres)'),
  leadId: z.string().uuid('Lead inválido — recarregue a página'),
  stageId: z.string().uuid('Etapa inválida — recarregue a página'),
  valueCents: z
    .number({ message: 'Informe um valor numérico' })
    .int('Valor inválido')
    .nonnegative('Valor não pode ser negativo'),
  ownerId: z.string().uuid('Vendedor inválido — recarregue a página'),
  /** ISO date (yyyy-mm-dd ou datetime). Undefined = sem prazo. */
  dueAt: z.string().optional(),
  description: z.string().max(2000, 'Descrição muito longa (máx. 2000)').optional(),
});

export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = dealCreateSchema.partial();
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

/**
 * Update parcial de um deal já criado (M8#3p). Caller passa `dealId` +
 * patch dos campos editáveis. Excluímos `stageId` daqui porque mudança de
 * etapa tem fluxo próprio (drag-and-drop → `moveDealStageAction`).
 */
export const updateDealSchema = z.object({
  dealId: z.string().uuid('Negócio inválido'),
  title: z
    .string()
    .min(3, 'Título muito curto — descreva a oportunidade')
    .max(120, 'Título muito longo (máx. 120 caracteres)')
    .optional(),
  valueCents: z
    .number({ message: 'Informe um valor numérico' })
    .int('Valor inválido')
    .nonnegative('Valor não pode ser negativo')
    .optional(),
  ownerId: z.string().uuid('Vendedor inválido').optional(),
  probability: z
    .number({ message: 'Informe um número' })
    .int('Probabilidade deve ser inteira')
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .optional(),
  /** ISO date (yyyy-mm-dd ou datetime); string vazia → null (limpa o prazo). */
  dueAt: z.string().optional(),
  description: z.string().max(2000, 'Descrição muito longa (máx. 2000)').optional(),
  lostReason: z.string().max(500, 'Motivo muito longo (máx. 500)').optional(),
});
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

// ─── Server Actions do M8#3 ────────────────────────────────────────────────

/**
 * Mover deal entre etapas via drag-and-drop. `beforeId`/`afterId` apontam
 * pros vizinhos no destino — o servidor calcula `orderInStage` a partir
 * deles (midpoint, ou append no final/início). Drop em coluna vazia: ambos
 * undefined → orderInStage = 0.
 */
export const moveDealStageSchema = z.object({
  dealId: z.string().uuid('Negócio inválido'),
  stageId: z.string().uuid('Etapa inválida'),
  /** Deal logo acima do drop (menor `orderInStage` que o novo). */
  beforeId: z.string().uuid().optional(),
  /** Deal logo abaixo do drop (maior `orderInStage` que o novo). */
  afterId: z.string().uuid().optional(),
});
export type MoveDealStageInput = z.infer<typeof moveDealStageSchema>;

/**
 * Reordenar deal dentro da mesma coluna. Mesmo input shape de
 * `moveDealStageSchema` mas sem `stageId` (a etapa não muda).
 */
export const updateDealOrderSchema = z.object({
  dealId: z.string().uuid('Negócio inválido'),
  beforeId: z.string().uuid().optional(),
  afterId: z.string().uuid().optional(),
});
export type UpdateDealOrderInput = z.infer<typeof updateDealOrderSchema>;
