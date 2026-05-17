/**
 * Schemas Zod do domínio Cadências.
 *
 * Aplicado em formulários de UI (CadenceCreateDialog, StepEditDialog) hoje;
 * em M8 vira input validation de Server Actions sem mudança de shape.
 * Validar na borda, confiar no tipo internamente (CLAUDE.md §5).
 *
 * Mensagens de erro em pt-BR direto, propositivas (CLAUDE.md §7.6).
 */
import { z } from 'zod';

const DAY_OFFSET_VALUES = [0, 1, 3, 7, 14, 30] as const;
const CHANNEL_VALUES = ['whatsapp', 'email'] as const;
const STATUS_VALUES = ['active', 'paused'] as const;
const TEMPLATE_KEY_VALUES = ['imobiliario', 'b2b', 'alto-ticket', 'blank'] as const;

export const cadenceCreateSchema = z.object({
  /** Nome curto exibido na lista. Único é checado em runtime, não no schema. */
  name: z.string().min(2, 'Nome muito curto').max(80, 'Nome muito longo (máx 80)'),
  /** Descrição opcional, ajuda o vendedor a lembrar pra que serve. */
  description: z.string().max(240, 'Descrição muito longa (máx 240)').optional(),
  /**
   * UUID de `pipeline_stages.id` no workspace do caller. A checagem de
   * ownership + recusa de etapa terminal (`ganho`/`perdido`) é feita no Server
   * Action (`createCadenceAction` / `updateCadenceAction`) com query no banco
   * — não dá pra validar no schema porque o conjunto de stages varia por
   * workspace e não está disponível no client.
   */
  stageId: z.string().uuid('Selecione uma etapa válida do funil'),
  /** Template de origem — controla qual esqueleto de steps é seedado. */
  templateKey: z.enum(TEMPLATE_KEY_VALUES, {
    error: 'Escolha um template ou comece em branco',
  }),
});
export type CadenceCreateInput = z.infer<typeof cadenceCreateSchema>;

export const cadenceUpdateSchema = cadenceCreateSchema.partial().extend({
  status: z.enum(STATUS_VALUES).optional(),
});
export type CadenceUpdateInput = z.infer<typeof cadenceUpdateSchema>;

export const stepCreateSchema = z.object({
  dayOffset: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(3),
    z.literal(7),
    z.literal(14),
    z.literal(30),
  ]),
  channel: z.enum(CHANNEL_VALUES),
  /**
   * Texto da mensagem com placeholders. Mínimo 10 caracteres pra evitar
   * "oi" como mensagem (anti-ban: variação rasa = sinaliza bot).
   * Máximo 2000 cobre WhatsApp (limite ~4096) com folga de placeholders.
   */
  templateBody: z
    .string()
    .min(10, 'Mensagem muito curta (mín 10 caracteres)')
    .max(2000, 'Mensagem muito longa (máx 2000)'),
});
export type StepCreateInput = z.infer<typeof stepCreateSchema>;

export const stepUpdateSchema = stepCreateSchema.partial();
export type StepUpdateInput = z.infer<typeof stepUpdateSchema>;

// Re-exports usados em selects e loops da UI.
export const DAY_OFFSETS = DAY_OFFSET_VALUES;
export const CADENCE_CHANNELS = CHANNEL_VALUES;
export const CADENCE_STATUSES = STATUS_VALUES;
export const CADENCE_TEMPLATE_KEYS = TEMPLATE_KEY_VALUES;
