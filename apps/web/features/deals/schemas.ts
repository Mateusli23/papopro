import { z } from 'zod';

/**
 * Schema Zod do domínio Deal — alimenta o modal "Adicionar negócio" e,
 * em M8, vira input da Server Action `createDeal`.
 *
 * Mensagens em pt-BR direto e propositivas (CLAUDE.md §5 + §7.6).
 */
export const dealCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Dê um título ao negócio')
    .min(3, 'Título muito curto — descreva a oportunidade')
    .max(120, 'Título muito longo (máx. 120 caracteres)'),
  leadId: z.string().min(1, 'Vincule a um lead existente'),
  stageId: z.string().min(1, 'Escolha a etapa do funil'),
  valueCents: z
    .number({ message: 'Informe um valor numérico' })
    .int('Valor inválido')
    .nonnegative('Valor não pode ser negativo'),
  ownerId: z.string().min(1, 'Atribua a um vendedor'),
  /** ISO date (yyyy-mm-dd ou datetime). Undefined = sem prazo. */
  dueAt: z.string().optional(),
  description: z.string().max(2000, 'Descrição muito longa (máx. 2000)').optional(),
});

export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = dealCreateSchema.partial();
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;
