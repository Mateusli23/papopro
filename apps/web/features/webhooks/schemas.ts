import { z } from 'zod';

/**
 * Schemas Zod do feature `webhooks` (M8#5 — captura inbound de leads).
 *
 * **Payload genérico:** desenhado pra ser fácil de mapear do Zapier, Make,
 * N8N e formulários custom. Meta Lead Ads / RD Station / Hotmart nativos
 * ficam pra V2 (integração OAuth direta — adapters específicos).
 *
 * **Borda:** validação acontece em `POST /api/webhooks/leads/[token]`.
 * Falha → 422 + JSON propositivo em pt-BR. CLAUDE.md §5: confiar no tipo
 * internamente após parse.
 */

/** Origens reconhecidas no campo `source`. Outros valores caem em `webhook_generico`. */
export const WEBHOOK_KNOWN_SOURCES = [
  'meta_ads',
  'google_ads',
  'rd_station',
  'hotmart',
  'site',
  'indicacao',
] as const;

export type WebhookKnownSource = (typeof WEBHOOK_KNOWN_SOURCES)[number];

export const webhookLeadPayloadSchema = z.object({
  name: z
    .string()
    .min(1, 'O campo `name` é obrigatório.')
    .max(120, 'O `name` deve ter no máximo 120 caracteres.'),
  /**
   * `phone` é obrigatório porque é o canal principal de PapoPro (WhatsApp).
   * Lead sem phone fica num limbo operacional — não dá pra cadenciar. Email
   * fica opcional pra origens que não capturam (Meta Lead Forms minimal).
   */
  phone: z
    .string()
    .min(1, 'O campo `phone` é obrigatório.')
    .max(40, 'O `phone` deve ter no máximo 40 caracteres.'),
  email: z
    .string()
    .email('O `email` está em formato inválido.')
    .max(180, 'O `email` deve ter no máximo 180 caracteres.')
    .optional(),
  source: z.enum(WEBHOOK_KNOWN_SOURCES).optional(),
  utm_campaign: z.string().max(180).optional(),
  utm_source: z.string().max(80).optional(),
  utm_medium: z.string().max(80).optional(),
  custom_fields: z.record(z.string(), z.string().max(500)).optional(),
  tags: z.array(z.string().min(1).max(40)).max(8, 'Máximo de 8 tags.').optional(),
});

export type WebhookLeadPayload = z.infer<typeof webhookLeadPayloadSchema>;
