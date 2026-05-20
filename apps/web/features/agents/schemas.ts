/**
 * Schemas Zod do domínio Agentes IA.
 *
 * Aplicado em formulários de UI (AgentCreateDialog, prompt editor, route inputs)
 * hoje; em M11 vira input validation de Server Actions sem mudança de shape.
 * Validar na borda, confiar no tipo internamente (CLAUDE.md §5).
 *
 * Mensagens de erro em pt-BR direto, propositivas (CLAUDE.md §7.6).
 */
import { z } from 'zod';

import { AGENT_TEMPLATE_KEYS } from '@/lib/fixtures/agent-templates';

const TONE_VALUES = ['consultivo', 'amigavel', 'direto', 'formal'] as const;
const STATUS_VALUES = ['active', 'paused', 'testing'] as const;
const ROUTE_KIND_VALUES = ['stage', 'tag', 'whatsapp_number', 'keyword'] as const;
const HANDOFF_KIND_VALUES = [
  'manual',
  'keyword',
  'commercial_intent',
  'stage_negotiation',
  'outside_business_hours',
  'agent_to_agent',
] as const;
const KB_FILE_KIND_VALUES = ['pdf', 'doc', 'txt'] as const;

/** 10 MB — espelha o microcopy do EmptyState do Cérebro. */
export const KB_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const agentCreateSchema = z.object({
  /** Nome curto exibido na lista. Mínimo 2 evita "a" como nome (paridade cadências). */
  name: z.string().min(2, 'Nome muito curto').max(60, 'Nome muito longo (máx 60)'),
  /** Avatar emoji opcional — UI sugere o default do template. */
  avatarEmoji: z.string().max(8, 'Use um único emoji').optional(),
  /** Template de origem — controla qual trio (prompt/persona/tone) é seedado. */
  templateKey: z.enum(AGENT_TEMPLATE_KEYS, {
    error: 'Escolha um template ou comece em branco',
  }),
});
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;

/**
 * Update do trio versionado (prompt/persona/tone) + metadata leve (name/avatar).
 * Mudanças em routes/handoff/kb passam por mutações dedicadas e não usam este schema.
 */
export const agentUpdateSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(60, 'Nome muito longo (máx 60)').optional(),
  avatarEmoji: z.string().max(8, 'Use um único emoji').optional(),
  /**
   * Mínimo 20 chars no prompt — abaixo disso o agente vira "responde qualquer
   * coisa" e quebra a expectativa do PRD (§3.9). Máx 4000 cobre prompts ricos
   * com exemplos sem custar tokens absurdos no Claude (M11).
   */
  prompt: z
    .string()
    .min(20, 'Prompt muito curto (mín 20 caracteres)')
    .max(4000, 'Prompt muito longo (máx 4000)')
    .optional(),
  persona: z.string().max(240, 'Persona muito longa (máx 240)').optional(),
  tone: z.enum(TONE_VALUES, { error: 'Escolha um tom de voz' }).optional(),
  status: z.enum(STATUS_VALUES).optional(),
});
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;

export const routeCreateSchema = z.object({
  kind: z.enum(ROUTE_KIND_VALUES, { error: 'Tipo de regra inválido' }),
  /**
   * Valor da regra. Min 1 char rejeita string vazia; semântica do `value`
   * varia por `kind` mas Zod não tem como saber sem `discriminatedUnion`.
   * Em M11 viramos discriminated union se precisar — hoje a UI já faz o
   * Select correto por kind.
   */
  value: z.string().trim().min(1, 'Informe o valor da regra').max(80, 'Valor muito longo'),
});
export type RouteCreateInput = z.infer<typeof routeCreateSchema>;

export const routeUpdateSchema = routeCreateSchema.partial();
export type RouteUpdateInput = z.infer<typeof routeUpdateSchema>;

export const handoffTriggerUpdateSchema = z.object({
  kind: z.enum(HANDOFF_KIND_VALUES),
  enabled: z.boolean(),
  config: z
    .object({
      keywords: z.array(z.string().trim().min(1)).max(20, 'No máximo 20 palavras-chave').optional(),
      /** Agente de destino do gatilho `agent_to_agent`. */
      targetAgentId: z.string().uuid('Agente de destino inválido').optional(),
      /** Etapa que dispara o gatilho `stage_negotiation` (M11#6). */
      stageId: z.string().uuid('Etapa inválida').optional(),
    })
    .optional(),
});
export type HandoffTriggerUpdateInput = z.infer<typeof handoffTriggerUpdateSchema>;

export const kbUpdateSchema = z.object({
  /**
   * Cada seção pode ficar vazia — workspace começa com tudo vazio e enche
   * com calma. Limite 4000 chars cobre texto Notion-like sem virar livro.
   */
  about: z.string().max(4000, 'Seção muito longa (máx 4000)').optional(),
  products: z.string().max(8000, 'Seção muito longa (máx 8000)').optional(),
  faq: z.string().max(8000, 'Seção muito longa (máx 8000)').optional(),
  scripts: z.string().max(4000, 'Seção muito longa (máx 4000)').optional(),
  policy: z.string().max(4000, 'Seção muito longa (máx 4000)').optional(),
});
export type KbUpdateInput = z.infer<typeof kbUpdateSchema>;

/**
 * Upload mock — UI valida o `File` antes de chamar a mutação. Esquema
 * trabalha com `name`/`size`/`kind` direto; **nunca** lemos conteúdo
 * (`FileReader`/`Blob.text()` ficam fora do mock).
 */
export const kbFileUploadSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome inválido')
    .max(120, 'Nome muito longo')
    /**
     * Bloqueia caracteres usados em path traversal e nomes inválidos no
     * Postgres `bytea`/`storage` que vão entrar em M11. Lista mínima — não
     * cobre tudo, mas evita os casos mais óbvios.
     */
    .refine((s) => !/[\\/<>:"|?*]/.test(s), 'Nome contém caracteres inválidos'),
  sizeBytes: z
    .number()
    .int()
    .positive('Arquivo inválido')
    .max(KB_FILE_MAX_BYTES, 'Arquivo muito grande (máx 10 MB)'),
  kind: z.enum(KB_FILE_KIND_VALUES, { error: 'Tipo não suportado (aceita PDF, DOC, TXT)' }),
});
export type KbFileUploadInput = z.infer<typeof kbFileUploadSchema>;

export const versionCreateSchema = z.object({
  /** Nota opcional explicando a mudança. Limite curto pra não virar release notes. */
  notes: z.string().max(240, 'Nota muito longa (máx 240)').optional(),
});
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;

// Re-exports usados em selects e loops da UI.
export const AGENT_TONES = TONE_VALUES;
export const AGENT_STATUSES = STATUS_VALUES;
export const ROUTE_KINDS = ROUTE_KIND_VALUES;
export const HANDOFF_TRIGGER_KINDS = HANDOFF_KIND_VALUES;
export const KB_FILE_KINDS = KB_FILE_KIND_VALUES;
