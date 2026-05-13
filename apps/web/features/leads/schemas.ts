import { z } from 'zod';

import type { LeadOrigin } from './types';

/**
 * Schemas Zod do domínio Leads.
 *
 * Mantemos o mesmo princípio do `features/auth/schemas.ts`: validação na
 * borda (CLAUDE.md §5), mensagens em pt-BR direto e propositivas (§7.6).
 *
 * Em M8 esses schemas viram input de Server Actions reais (ex:
 * `createLead({ input: leadCreateSchema.parse(formData) })`); por enquanto
 * alimentam só os modais e a importação CSV.
 */

const PHONE_REGEX = /^[\d\s()+-]{8,}$/;

export const LEAD_ORIGINS: { value: LeadOrigin; label: string }[] = [
  { value: 'manual', label: 'Cadastro manual' },
  { value: 'site', label: 'Site' },
  { value: 'meta_ads', label: 'Meta Ads (Facebook/Instagram)' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'whatsapp_inbound', label: 'WhatsApp (entrada)' },
  { value: 'csv_import', label: 'Importação CSV' },
  { value: 'rd_station', label: 'RD Station' },
  { value: 'hotmart', label: 'Hotmart' },
];

export const leadCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome do lead')
    .min(2, 'Nome muito curto')
    .max(80, 'Nome muito longo (máx. 80 caracteres)'),
  phone: z
    .string()
    .min(1, 'Informe o telefone (com DDD)')
    .regex(PHONE_REGEX, 'Telefone inválido — use só números, espaço, parênteses ou hífen'),
  email: z
    .string()
    .email('Email inválido — confira o formato')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  company: z.string().max(120, 'Empresa muito longa').optional(),
  position: z.string().max(80, 'Cargo muito longo').optional(),
  stageId: z.string().uuid('Etapa inválida — recarregue a página'),
  assignedTo: z.string().uuid('Vendedor inválido — recarregue a página'),
  origin: z.enum([
    'site',
    'meta_ads',
    'google_ads',
    'indicacao',
    'whatsapp_inbound',
    'csv_import',
    'manual',
    'rd_station',
    'hotmart',
  ]),
  // `valueCents` e `tags` ficam obrigatórios no schema (sem `.default()`
  // pra evitar incompatibilidade z.input × z.output que confunde o RHF
  // resolver). O componente pai já passa default 0/[].
  valueCents: z.number().int('Valor inválido').nonnegative('Valor não pode ser negativo'),
  tags: z.array(z.string().min(1).max(32)).max(8, 'Máximo de 8 tags por lead'),
  notes: z.string().max(2000, 'Observação muito longa (máx. 2000)').optional(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

/**
 * Update parcial de campos da ficha do lead. Usado pelo editor inline da
 * página de detalhe (clique → input → blur salva). Em M8#2 alimenta a
 * Server Action `updateLeadAction` — caller passa `leadId` separado +
 * patch parcial dos campos editáveis.
 */
export const leadUpdateSchema = leadCreateSchema.partial();

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

// ─── Server Actions de M8#2 ────────────────────────────────────────────────

/** Mudar etapa do lead (botão "Mover etapa" no detalhe + futuro drag-and-drop M8#3). */
export const moveStageSchema = z.object({
  leadId: z.string().uuid('Lead inválido'),
  stageId: z.string().uuid('Etapa inválida'),
});
export type MoveStageInput = z.infer<typeof moveStageSchema>;

/** Reassignar lead a outro vendedor (Owner/Admin/Manager). */
export const assignLeadSchema = z.object({
  leadId: z.string().uuid('Lead inválido'),
  assignedToId: z.string().uuid('Vendedor inválido'),
});
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

/** Arquivar lead (soft-archive via `status='arquivado'`; soft-delete `deletedAt` é separado, fica pra polimento LGPD). */
export const archiveLeadSchema = z.object({
  leadId: z.string().uuid('Lead inválido'),
});
export type ArchiveLeadInput = z.infer<typeof archiveLeadSchema>;

/** Atualização inline de campos da ficha. `leadId` + patch parcial (mesmos campos do create). */
export const updateLeadSchema = leadUpdateSchema.extend({
  leadId: z.string().uuid('Lead inválido'),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// ─── CSV Import ────────────────────────────────────────────────────────────

/**
 * Linha mínima esperada do CSV após mapeamento de colunas. O usuário escolhe
 * visualmente quais colunas do arquivo correspondem a quais campos; nós
 * validamos linha-a-linha aqui antes de criar o lead.
 */
export const csvRowSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().regex(PHONE_REGEX, 'Telefone inválido'),
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  company: z.string().max(120).optional(),
  origin: z.string().max(40).optional(),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

/** Campos do lead que podem ser mapeados a partir de uma coluna CSV. */
export const CSV_FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'phone', label: 'Telefone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'company', label: 'Empresa', required: false },
  { key: 'origin', label: 'Origem', required: false },
] as const;

export type CsvFieldKey = (typeof CSV_FIELDS)[number]['key'];
