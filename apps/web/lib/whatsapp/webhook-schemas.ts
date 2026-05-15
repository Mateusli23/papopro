/**
 * Schemas Zod dos 3 eventos uazapi (M9#3).
 *
 * Formato inferido das interfaces internas em `apps/web/lib/whatsapp/uazapi.ts`
 * (M9#2) + padrão Whatsmeow que a uazapi encapsula. Quando integrarmos com a
 * uazapi de verdade no pré-launch, pode precisar ajuste — schemas centralizados
 * aqui pra que mudança fique em 1 arquivo.
 *
 * **Discriminated union** por `event` — Zod escolhe o schema certo automaticamente
 * e o TypeScript inferir o tipo correto em cada branch do `switch`.
 *
 * **Telefones em E.164** (`+5511999998888`) — uazapi normaliza antes de enviar.
 * Regex `^\+\d{10,15}$` cobre formato mínimo (mobile BR 13 chars) até máx
 * internacional (E.164 limita a 15 dígitos depois do +).
 */
import { z } from 'zod';

const phoneE164 = z.string().regex(/^\+\d{10,15}$/, 'phone E.164 inválido');

const timestampLoose = z.union([z.string().min(1).max(64), z.number()]);

export const messageReceivedSchema = z.object({
  event: z.literal('message.received'),
  instance_id: z.string().min(1).max(128),
  message: z.object({
    id: z.string().min(1).max(128),
    from: phoneE164,
    to: phoneE164.optional(),
    type: z.enum(['text', 'image', 'audio', 'document']),
    text: z.object({ body: z.string().max(4096) }).optional(),
    timestamp: timestampLoose,
  }),
});

export const messageStatusSchema = z.object({
  event: z.literal('message.status'),
  instance_id: z.string().min(1).max(128),
  message_id: z.string().min(1).max(128),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: timestampLoose.optional(),
});

export const instanceStatusSchema = z.object({
  event: z.literal('instance.status'),
  instance_id: z.string().min(1).max(128),
  status: z.enum(['connected', 'disconnected', 'qr_refreshed']),
  phone_number: phoneE164.optional(),
  timestamp: timestampLoose.optional(),
});

export const uazapiWebhookSchema = z.discriminatedUnion('event', [
  messageReceivedSchema,
  messageStatusSchema,
  instanceStatusSchema,
]);

export type UazapiWebhookPayload = z.infer<typeof uazapiWebhookSchema>;
export type MessageReceivedPayload = z.infer<typeof messageReceivedSchema>;
export type MessageStatusPayload = z.infer<typeof messageStatusSchema>;
export type InstanceStatusPayload = z.infer<typeof instanceStatusSchema>;
