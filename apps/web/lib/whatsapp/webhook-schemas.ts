/**
 * Schemas e normalização de webhooks WhatsApp.
 *
 * O PapoPro trabalha internamente com 3 eventos canônicos:
 *  - `message.received`
 *  - `message.status`
 *  - `instance.status`
 *
 * A UAZAPI oficial v2.1.0 envia eventos como `messages`, `messages_update` e
 * `connection`, com formatos menos rígidos. `normalizeUazapiWebhook` aceita o
 * payload real e converte para o contrato interno consumido pelos handlers.
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

type JsonRecord = Record<string, unknown>;

const rawObjectSchema = z.record(z.string(), z.unknown());

function asRecord(value: unknown): JsonRecord | null {
  const parsed = rawObjectSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizePhone(value: unknown): string | undefined {
  const record = asRecord(value);
  const raw = asString(record?.user) ?? asString(value);
  if (!raw) return undefined;
  const withoutDomain = raw.split('@')[0] ?? raw;
  const digits = withoutDomain.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return undefined;
  return `+${digits}`;
}

function normalizeTimestamp(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = asString(value);
  return raw ?? Date.now();
}

function normalizeMessageType(value: unknown): 'text' | 'image' | 'audio' | 'document' {
  const raw = asString(value)?.toLowerCase() ?? 'text';
  if (raw.includes('image')) return 'image';
  if (raw.includes('audio') || raw.includes('ptt')) return 'audio';
  if (raw.includes('document') || raw.includes('file')) return 'document';
  return 'text';
}

function normalizeStatus(value: unknown): 'sent' | 'delivered' | 'read' | 'failed' {
  const raw = asString(value)?.toLowerCase() ?? 'sent';
  if (raw.includes('read')) return 'read';
  if (raw.includes('deliver')) return 'delivered';
  if (raw.includes('fail') || raw.includes('cancel') || raw.includes('error')) return 'failed';
  return 'sent';
}

function getInstanceId(raw: JsonRecord): string | undefined {
  const direct =
    asString(raw.instance_id) ??
    asString(raw.instanceId) ??
    asString(raw.instanceid) ??
    asString(raw.owner);
  if (direct) return direct;

  const instance = asRecord(raw.instance);
  return asString(instance?.id);
}

function getMessageRecord(raw: JsonRecord): JsonRecord | null {
  const candidates = [raw.message, raw.data, raw.payload, raw.body, raw];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) return record;
  }
  return null;
}

function getText(message: JsonRecord): string | undefined {
  const direct =
    asString(message.text) ??
    asString(message.body) ??
    asString(message.caption) ??
    asString(message.conversation);
  if (direct) return direct;

  const content = asRecord(message.content);
  const extended = asRecord(message.extendedTextMessage) ?? asRecord(content?.extendedTextMessage);
  return (
    asString(content?.text) ??
    asString(content?.caption) ??
    asString(content?.conversation) ??
    asString(extended?.text)
  );
}

function getMessageId(message: JsonRecord): string | undefined {
  const key = asRecord(message.key);
  return (
    asString(message.messageid) ??
    asString(message.messageId) ??
    asString(message.id) ??
    asString(message.keyId) ??
    asString(key?.id)
  );
}

function isFromMe(message: JsonRecord): boolean {
  const key = asRecord(message.key);
  return asBoolean(message.fromMe) ?? asBoolean(message.from_me) ?? asBoolean(key?.fromMe) ?? false;
}

function normalizeRealMessageEvent(raw: JsonRecord): UazapiWebhookPayload | null {
  const message = getMessageRecord(raw);
  const key = asRecord(message?.key) ?? asRecord(raw.key);
  if (!message || isFromMe({ ...message, key }) || asBoolean(message.isGroup)) return null;

  const instanceId = getInstanceId(raw) ?? asString(message.owner);
  const from = normalizePhone(
    message.sender ?? message.chatid ?? message.from ?? message.remoteJid ?? key?.remoteJid,
  );
  const id = getMessageId({ ...message, key });
  if (!instanceId || !from || !id) return null;

  const text = getText(message);
  const type = normalizeMessageType(message.messageType ?? message.type ?? message.mediaType);

  return {
    event: 'message.received',
    instance_id: instanceId,
    message: {
      id,
      from,
      to: normalizePhone(message.to),
      type,
      text: text ? { body: text } : undefined,
      timestamp: normalizeTimestamp(
        message.messageTimestamp ?? message.timestamp ?? message.created,
      ),
    },
  };
}

function normalizeRealStatusEvent(raw: JsonRecord): UazapiWebhookPayload | null {
  const message = getMessageRecord(raw);
  if (!message) return null;
  const key = asRecord(message.key) ?? asRecord(raw.key);

  const instanceId = getInstanceId(raw) ?? asString(message.owner);
  const messageId = getMessageId({ ...message, key });
  if (!instanceId || !messageId) return null;

  return {
    event: 'message.status',
    instance_id: instanceId,
    message_id: messageId,
    status: normalizeStatus(message.status),
    timestamp: normalizeTimestamp(message.messageTimestamp ?? message.timestamp ?? message.updated),
  };
}

function normalizeRealConnectionEvent(raw: JsonRecord): UazapiWebhookPayload | null {
  const instance = asRecord(raw.instance) ?? raw;
  const instanceId = getInstanceId(raw) ?? asString(instance.id);
  if (!instanceId) return null;

  const rawStatus = asString(raw.status) ?? asString(instance.status);
  let status: 'connected' | 'disconnected' | 'qr_refreshed';
  if (rawStatus === 'connected' || asBoolean(raw.connected) || asBoolean(raw.loggedIn)) {
    status = 'connected';
  } else if (rawStatus === 'connecting' || asString(instance.qrcode)) {
    status = 'qr_refreshed';
  } else {
    status = 'disconnected';
  }

  return {
    event: 'instance.status',
    instance_id: instanceId,
    status,
    phone_number: normalizePhone(asRecord(raw.status)?.jid ?? raw.jid ?? raw.phone_number),
    timestamp: normalizeTimestamp(raw.timestamp ?? instance.updated ?? instance.currentTime),
  };
}

export function normalizeUazapiWebhook(payload: unknown): UazapiWebhookPayload | null {
  const internal = uazapiWebhookSchema.safeParse(payload);
  if (internal.success) return internal.data;

  const raw = asRecord(payload);
  if (!raw) return null;

  const eventName = (
    asString(raw.event) ??
    asString(raw.type) ??
    asString(raw.Event) ??
    ''
  ).toLowerCase();

  if (eventName === 'messages' || eventName === 'message') {
    return normalizeRealMessageEvent(raw);
  }
  if (eventName === 'messages_update' || eventName === 'message_update' || eventName === 'status') {
    return normalizeRealStatusEvent(raw);
  }
  if (eventName === 'connection' || eventName === 'instance' || eventName === 'connected') {
    return normalizeRealConnectionEvent(raw);
  }

  // Fallback defensivo: payloads de teste/capturas às vezes vêm sem `event`,
  // mas com campos de Message direto na raiz.
  if (getMessageId(raw) && (raw.sender || raw.chatid || raw.from)) {
    return normalizeRealMessageEvent(raw);
  }

  return null;
}
