/**
 * Smoke test WhatsApp — grupos M9#1+M9#2+M9#3+M9#4.
 *
 * Valida sem tocar rede nem banco: schema + adapter + factory + transforms +
 * verificação HMAC + Zod webhook + anti-ban + schemas Inbox/QuickReply do
 * M9#4. Roda em CI + manual via `curl /api/smoke-test/whatsapp`.
 *
 * Em M9#5 entra `whatsapp-heartbeat-m9`.
 */
import { createHmac } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  AuditAction,
  ConversationStatus,
  HealthScore,
  MessageDirection,
  MessageKind,
} from '@papopro/db';

import {
  connectInstanceSchema,
  disconnectInstanceSchema,
  getConnectionStatusSchema,
} from '@/features/connections/schemas';
import {
  isQrCodeFresh,
  toConnectionUI,
  type WhatsappAccountRow,
  type WhatsappInstanceRow,
} from '@/features/connections/transforms';
import { fallbackPreview } from '@/features/inbox/queries';
import { sendInternalNoteSchema, sendTextMessageSchema } from '@/features/inbox/schemas';
import {
  createQuickReplySchema,
  deleteQuickReplySchema,
  reorderQuickRepliesSchema,
  updateQuickReplySchema,
} from '@/features/quick-replies/schemas';
import {
  type SendTextResult,
  type WhatsAppAdapter,
  type WhatsAppInstanceStatus,
  type WhatsAppQrCode,
} from '@/lib/whatsapp/adapter';
import {
  applyJitter,
  assertCanSendPure,
  BURST_PAUSE_THRESHOLD,
  isWithinBusinessHours,
  JITTER_MAX_MS,
  JITTER_MIN_MS,
  OUTBOUND_LIMIT_24H,
  type InstanceSnapshot,
} from '@/lib/whatsapp/anti-ban';
import { selectAdapter } from '@/lib/whatsapp/factory';
import { mockAdapter } from '@/lib/whatsapp/mock-adapter';
import { uazapiAdapter } from '@/lib/whatsapp/uazapi';
import {
  instanceStatusSchema,
  messageReceivedSchema,
  messageStatusSchema,
} from '@/lib/whatsapp/webhook-schemas';
import { verifyUazapiSignaturePure } from '@/lib/whatsapp/webhook-verify';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => Promise<boolean | string> | boolean | string) => {
    return Promise.resolve()
      .then(() => fn())
      .then((r) => {
        if (r === true) results.push({ group, name, ok: true });
        else
          results.push({
            group,
            name,
            ok: false,
            detail: typeof r === 'string' ? r : 'returned false',
          });
      })
      .catch((err: unknown) => {
        results.push({ group, name, ok: false, detail: (err as Error).message });
      });
  };
}

const TEST_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const TEST_INSTANCE_ID = 'mock-instance-1';

// AuditAction valores que M9#1 adiciona — ao mexer no enum, atualizar aqui.
const NEW_AUDIT_ACTIONS = [
  'whatsapp_connected',
  'whatsapp_disconnected',
  'whatsapp_message_sent',
  'whatsapp_blocked_optout',
  'quick_reply_created',
  'quick_reply_deleted',
  'conversation_archived',
  'conversation_transferred',
] as const;

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: CheckResult[] = [];
  const t = run('whatsapp-schema-m9', results);

  // 1. Enums resolvem nos valores esperados (Prisma client gerado).
  await t('enumsResolve', () => {
    const checks: Array<[string, string]> = [
      [MessageDirection.in, 'in'],
      [MessageDirection.out, 'out'],
      [MessageKind.text, 'text'],
      [MessageKind.internal_note, 'internal_note'],
      [ConversationStatus.awaiting, 'awaiting'],
      [ConversationStatus.responded, 'responded'],
      [ConversationStatus.archived, 'archived'],
      [HealthScore.healthy, 'healthy'],
      [HealthScore.degraded, 'degraded'],
      [HealthScore.unhealthy, 'unhealthy'],
    ];
    const bad = checks.find(([actual, expected]) => actual !== expected);
    return bad ? `${bad[0]} !== ${bad[1]}` : true;
  });

  // 2. AuditAction tem todos os 8 valores novos do M9.
  await t('auditActionExtension', () => {
    const present = Object.values(AuditAction);
    const missing = NEW_AUDIT_ACTIONS.filter((v) => !present.includes(v as AuditAction));
    return missing.length === 0 || `faltam: ${missing.join(', ')}`;
  });

  // 3. mockAdapter satisfaz WhatsAppAdapter (type-level via satisfies + runtime).
  await t('mockAdapterContract', async () => {
    const _typecheck: WhatsAppAdapter = mockAdapter;
    void _typecheck;
    const result: SendTextResult = await mockAdapter.sendText({
      workspaceId: TEST_WORKSPACE_ID,
      externalInstanceId: TEST_INSTANCE_ID,
      to: '+5511999998888',
      body: 'smoke',
    });
    const okId =
      typeof result.externalMessageId === 'string' && result.externalMessageId.length > 0;
    const okSentAt = result.sentAt instanceof Date && !Number.isNaN(result.sentAt.getTime());
    return (
      (okId && okSentAt) || `externalMessageId=${result.externalMessageId} sentAt=${result.sentAt}`
    );
  });

  // 4. connectInstance retorna QR base64 + expiração futura.
  await t('qrCodeShape', async () => {
    const qr: WhatsAppQrCode = await mockAdapter.connectInstance({
      workspaceId: TEST_WORKSPACE_ID,
    });
    const okBase64 = typeof qr.qrBase64 === 'string' && qr.qrBase64.length > 16;
    const okFutureExpiry = qr.expiresAt instanceof Date && qr.expiresAt.getTime() > Date.now();
    return (
      (okBase64 && okFutureExpiry) || `qrBase64=${qr.qrBase64?.slice(0, 8)} exp=${qr.expiresAt}`
    );
  });

  // 5. Schemas Zod do composer (M5/M9 contrato) continuam intactos.
  await t('zodSchemasIntact', () => {
    const okText = sendTextMessageSchema.safeParse({ body: 'oi' }).success;
    const okNote = sendInternalNoteSchema.safeParse({ body: 'nota interna' }).success;
    const rejectsEmpty = !sendTextMessageSchema.safeParse({ body: '' }).success;
    return (okText && okNote && rejectsEmpty) || 'text/note/empty inconsistente';
  });

  // 6. getInstanceStatus do mock retorna shape esperado (sanidade do contrato).
  await t('instanceStatusShape', async () => {
    const status: WhatsAppInstanceStatus = await mockAdapter.getInstanceStatus({
      workspaceId: TEST_WORKSPACE_ID,
      externalInstanceId: TEST_INSTANCE_ID,
    });
    const okStatus = ['connected', 'connecting', 'disconnected'].includes(status.status);
    return okStatus || `status=${status.status}`;
  });

  // ─── Grupo whatsapp-connection-m9 (M9#2) ─────────────────────────────────
  const c = run('whatsapp-connection-m9', results);

  // 7. Factory escolhe mockAdapter quando env ausente, uazapi quando presente.
  await c('factoryReturnsMockWithoutEnv', () => {
    const adapter = selectAdapter(false);
    return adapter === mockAdapter || 'esperava mockAdapter quando env ausente';
  });
  await c('factoryReturnsUazapiWithEnv', () => {
    const adapter = selectAdapter(true);
    return adapter === uazapiAdapter || 'esperava uazapiAdapter quando env presente';
  });

  // 8. Adapter mock inclui externalInstanceId no QR (necessário pra M9#2 persist).
  await c('connectInstanceReturnsExternalId', async () => {
    const qr = await mockAdapter.connectInstance({ workspaceId: TEST_WORKSPACE_ID });
    return (
      (typeof qr.externalInstanceId === 'string' && qr.externalInstanceId.length > 0) ||
      `externalInstanceId=${qr.externalInstanceId}`
    );
  });

  // 9. toConnectionUI puro — account null → accountExists=false, status=disconnected.
  await c('toConnectionUIWithoutAccount', () => {
    const ui = toConnectionUI(null, null);
    return (
      (!ui.accountExists &&
        ui.status === 'disconnected' &&
        ui.qrBase64 === null &&
        ui.messagesSent24h === 0) ||
      `accountExists=${ui.accountExists} status=${ui.status}`
    );
  });

  // 10. toConnectionUI com instance connecting + qrCode → carrega QR shape.
  await c('toConnectionUIConnecting', () => {
    const account: WhatsappAccountRow = {
      id: 'acc-1',
      phoneNumber: '',
      displayName: null,
    };
    const future = new Date(Date.now() + 60_000);
    const instance: WhatsappInstanceRow = {
      id: 'inst-1',
      externalInstanceId: 'ext-abc',
      status: 'connecting',
      healthScore: 'healthy',
      qrCode: 'qr-base64-fake',
      qrExpiresAt: future,
      connectedAt: null,
      disconnectedAt: null,
      lastSeenAt: null,
      messagesSent24h: 0,
      pausedUntil: null,
    };
    const ui = toConnectionUI(account, instance);
    return (
      (ui.accountExists &&
        ui.status === 'connecting' &&
        ui.qrBase64 === 'qr-base64-fake' &&
        ui.externalInstanceId === 'ext-abc' &&
        ui.qrExpiresAt === future.toISOString()) ||
      `status=${ui.status} qrBase64=${ui.qrBase64}`
    );
  });

  // 11. toConnectionUI normaliza status desconhecido em 'disconnected'
  //     (defense-in-depth — schema `varchar(24)` aceita qualquer string).
  await c('toConnectionUINormalizesUnknownStatus', () => {
    const account: WhatsappAccountRow = { id: 'acc-1', phoneNumber: '+5511', displayName: null };
    const instance: WhatsappInstanceRow = {
      id: 'inst-1',
      externalInstanceId: null,
      status: 'banned' /* valor desconhecido */,
      healthScore: 'degraded',
      qrCode: null,
      qrExpiresAt: null,
      connectedAt: null,
      disconnectedAt: null,
      lastSeenAt: null,
      messagesSent24h: 0,
      pausedUntil: null,
    };
    const ui = toConnectionUI(account, instance);
    return ui.status === 'disconnected' || `status=${ui.status}`;
  });

  // 12. isQrCodeFresh: true pra ISO no futuro, false pra null / passado.
  await c('isQrCodeFreshLogic', () => {
    const now = 1_700_000_000_000;
    const future = new Date(now + 30_000).toISOString();
    const past = new Date(now - 30_000).toISOString();
    return (
      (isQrCodeFresh(future, now) === true &&
        isQrCodeFresh(past, now) === false &&
        isQrCodeFresh(null, now) === false) ||
      'isQrCodeFresh inconsistente'
    );
  });

  // 13. Schemas Zod das actions aceitam input vazio e rejeitam props extras.
  await c('connectionSchemasStrict', () => {
    const emptyOk =
      connectInstanceSchema.safeParse({}).success &&
      disconnectInstanceSchema.safeParse({}).success &&
      getConnectionStatusSchema.safeParse({}).success;
    const extraRejected = !connectInstanceSchema.safeParse({ foo: 'bar' }).success;
    return (emptyOk && extraRejected) || 'connection schemas inconsistentes';
  });

  // ─── Grupo whatsapp-webhook-m9 (M9#3) ────────────────────────────────────
  const w = run('whatsapp-webhook-m9', results);

  const TEST_SECRET = 'test-secret-abc123';
  const TEST_BODY = '{"event":"instance.status","instance_id":"ext-1","status":"connected"}';
  const validHmac = createHmac('sha256', TEST_SECRET).update(TEST_BODY).digest('hex');

  // 14. HMAC válido com prefixo sha256= aceita
  await w('verifySignatureAcceptsValid', () => {
    const result = verifyUazapiSignaturePure(TEST_SECRET, TEST_BODY, `sha256=${validHmac}`);
    return result.ok === true || `reason=${'reason' in result ? result.reason : 'unknown'}`;
  });

  // 15. HMAC válido sem prefixo também aceita
  await w('verifySignatureAcceptsNoPrefix', () => {
    const result = verifyUazapiSignaturePure(TEST_SECRET, TEST_BODY, validHmac);
    return result.ok === true || 'expected ok=true sem prefixo';
  });

  // 16. HMAC inválido rejeita
  await w('verifySignatureRejectsInvalid', () => {
    const wrong = '0'.repeat(64);
    const result = verifyUazapiSignaturePure(TEST_SECRET, TEST_BODY, `sha256=${wrong}`);
    return (!result.ok && result.reason === 'signature_invalid') || 'expected signature_invalid';
  });

  // 17. HMAC malformado (não hex) rejeita
  await w('verifySignatureRejectsMalformed', () => {
    const result = verifyUazapiSignaturePure(TEST_SECRET, TEST_BODY, 'sha256=not-hex-xyz');
    return (
      (!result.ok && result.reason === 'signature_malformed') || 'expected signature_malformed'
    );
  });

  // 18. Secret vazio = dev skip
  await w('verifySignatureSkipsEmptySecret', () => {
    const result = verifyUazapiSignaturePure('', TEST_BODY, null);
    return (result.ok === true && result.skipped === true) || 'expected ok=true skipped=true';
  });

  // 19. Header ausente com secret presente = signature_missing
  await w('verifySignatureRequiresHeader', () => {
    const result = verifyUazapiSignaturePure(TEST_SECRET, TEST_BODY, null);
    return (!result.ok && result.reason === 'signature_missing') || 'expected signature_missing';
  });

  // 20. messageReceivedSchema aceita payload válido
  await w('messageReceivedSchemaValid', () => {
    return (
      messageReceivedSchema.safeParse({
        event: 'message.received',
        instance_id: 'inst-1',
        message: {
          id: 'msg-1',
          from: '+5511999998888',
          type: 'text',
          text: { body: 'oi' },
          timestamp: '2026-05-15T10:00:00Z',
        },
      }).success || 'expected valid'
    );
  });

  // 21. messageStatusSchema rejeita status fora do enum
  await w('messageStatusSchemaRejectsInvalidStatus', () => {
    return (
      !messageStatusSchema.safeParse({
        event: 'message.status',
        instance_id: 'inst-1',
        message_id: 'msg-1',
        status: 'sent_but_invalid',
      }).success || 'expected rejection'
    );
  });

  // 22. instanceStatusSchema aceita connected + phone E.164
  await w('instanceStatusSchemaConnected', () => {
    return (
      instanceStatusSchema.safeParse({
        event: 'instance.status',
        instance_id: 'inst-1',
        status: 'connected',
        phone_number: '+5511999998888',
      }).success || 'expected valid'
    );
  });

  // 23. Phone E.164 inválido rejeitado (faltando +)
  await w('phoneE164Validation', () => {
    return (
      !messageReceivedSchema.safeParse({
        event: 'message.received',
        instance_id: 'inst-1',
        message: {
          id: 'msg-1',
          from: '5511999998888', // sem +
          type: 'text',
          timestamp: '2026-05-15T10:00:00Z',
        },
      }).success || 'expected rejection'
    );
  });

  // ─── Grupo whatsapp-antiban-m9 (M9#3) ────────────────────────────────────
  const a = run('whatsapp-antiban-m9', results);

  // Helper pra construir InstanceSnapshot
  const healthyInstance: InstanceSnapshot = {
    status: 'connected',
    healthScore: 'healthy',
    pausedUntil: null,
    messagesSent24h: 0,
    externalInstanceId: 'ext-1',
  };
  const noon = new Date('2026-05-15T15:00:00Z'); // 12h em SP (UTC-3)
  const earlyMorning = new Date('2026-05-15T06:00:00Z'); // 3h em SP

  // 24. Happy path
  await a('assertCanSendHappyPath', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: healthyInstance,
      blacklisted: false,
      now: noon,
    });
    return r.ok === true || `unexpected reason=${'reason' in r ? r.reason : 'none'}`;
  });

  // 25. Blacklisted bloqueia
  await a('assertCanSendBlacklisted', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: healthyInstance,
      blacklisted: true,
      now: noon,
    });
    return (!r.ok && r.reason === 'blacklisted') || 'expected blacklisted';
  });

  // 26. Instance disconnected bloqueia
  await a('assertCanSendDisconnected', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: { ...healthyInstance, status: 'disconnected' },
      blacklisted: false,
      now: noon,
    });
    return (!r.ok && r.reason === 'instance_disconnected') || 'expected instance_disconnected';
  });

  // 27. Instance unhealthy bloqueia
  await a('assertCanSendUnhealthy', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: { ...healthyInstance, healthScore: 'unhealthy' },
      blacklisted: false,
      now: noon,
    });
    return (!r.ok && r.reason === 'instance_unhealthy') || 'expected instance_unhealthy';
  });

  // 28. Instance pausedUntil futuro bloqueia
  await a('assertCanSendPaused', () => {
    const future = new Date(noon.getTime() + 10 * 60 * 1_000);
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: { ...healthyInstance, pausedUntil: future },
      blacklisted: false,
      now: noon,
    });
    return (!r.ok && r.reason === 'instance_paused') || 'expected instance_paused';
  });

  // 29. Fora horário comercial (3h da manhã em SP) bloqueia
  await a('assertCanSendOutsideHours', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: healthyInstance,
      blacklisted: false,
      now: earlyMorning,
    });
    return (!r.ok && r.reason === 'outside_business_hours') || 'expected outside_business_hours';
  });

  // 30. Rate limit 24h atingido bloqueia
  await a('assertCanSendRateLimit', () => {
    const r = assertCanSendPure({
      workspaceTimezone: 'America/Sao_Paulo',
      toPhone: '+5511999998888',
      instance: { ...healthyInstance, messagesSent24h: OUTBOUND_LIMIT_24H },
      blacklisted: false,
      now: noon,
    });
    return (!r.ok && r.reason === 'rate_limit_24h') || 'expected rate_limit_24h';
  });

  // 31. Janela horária respeita timezone (12h SP = OK; 22h SP = fora)
  await a('businessHoursTimezone', () => {
    const dayInSp = new Date('2026-05-15T15:00:00Z'); // 12h SP
    const nightInSp = new Date('2026-05-16T01:00:00Z'); // 22h SP
    const dayOk = isWithinBusinessHours(dayInSp, 'America/Sao_Paulo');
    const nightBlocked = !isWithinBusinessHours(nightInSp, 'America/Sao_Paulo');
    return (dayOk && nightBlocked) || `dayOk=${dayOk} nightBlocked=${nightBlocked}`;
  });

  // 32. Constantes corretas
  await a('antiBanConstants', () => {
    return (
      (OUTBOUND_LIMIT_24H === 1000 &&
        JITTER_MIN_MS === 30_000 &&
        JITTER_MAX_MS === 50_000 &&
        BURST_PAUSE_THRESHOLD === 50) ||
      `OUTBOUND=${OUTBOUND_LIMIT_24H} MIN=${JITTER_MIN_MS} MAX=${JITTER_MAX_MS} BURST=${BURST_PAUSE_THRESHOLD}`
    );
  });

  // 33. applyJitter respeita min com random=0 e max com random=0.9999
  await a('applyJitterRandomMin', async () => {
    let slept = 0;
    const sleepFn = async (ms: number) => {
      slept = ms;
    };
    await applyJitter(() => 0, sleepFn);
    return slept === JITTER_MIN_MS || `slept=${slept}`;
  });

  await a('applyJitterRandomMax', async () => {
    let slept = 0;
    const sleepFn = async (ms: number) => {
      slept = ms;
    };
    await applyJitter(() => 0.9999, sleepFn);
    // Max ≈ JITTER_MAX_MS - 1 (Math.floor(0.9999 * range))
    return slept >= JITTER_MAX_MS - 10 && slept < JITTER_MAX_MS
      ? true
      : `slept=${slept} esperado ~${JITTER_MAX_MS}`;
  });

  // ─── Grupo whatsapp-inbox-m9 (M9#4) ──────────────────────────────────────
  const i = run('whatsapp-inbox-m9', results);

  // 34. fallbackPreview cobre mídia sem caption
  await i('fallbackPreviewMedia', () => {
    return (
      (fallbackPreview('image', null) === '[Imagem]' &&
        fallbackPreview('audio', null) === '[Áudio]' &&
        fallbackPreview('document', null) === '[Documento]' &&
        fallbackPreview('internal_note', null) === '[Nota interna]') ||
      'fallback inconsistente'
    );
  });

  // 35. fallbackPreview prioriza body quando presente
  await i('fallbackPreviewBodyPriority', () => {
    return (
      (fallbackPreview('image', 'Olha essa foto') === 'Olha essa foto' &&
        fallbackPreview('text', 'oi') === 'oi') ||
      'body deveria ter prioridade'
    );
  });

  // 36. createQuickReplySchema aceita input mínimo válido
  await i('createQuickReplyValid', () => {
    return (
      createQuickReplySchema.safeParse({
        label: 'Bom dia',
        body: 'Bom dia, {nome}! Como posso ajudar?',
      }).success || 'expected valid'
    );
  });

  // 37. createQuickReplySchema rejeita label vazio
  await i('createQuickReplyRejectsEmpty', () => {
    return (
      !createQuickReplySchema.safeParse({ label: '   ', body: 'X' }).success || 'expected rejection'
    );
  });

  // 38. createQuickReplySchema rejeita body acima de 4096
  await i('createQuickReplyRejectsLongBody', () => {
    return (
      !createQuickReplySchema.safeParse({
        label: 'X',
        body: 'a'.repeat(5000),
      }).success || 'expected rejection'
    );
  });

  // 39. updateQuickReplySchema exige ao menos 1 campo além do id
  await i('updateQuickReplyRequiresAtLeastOneField', () => {
    return (
      !updateQuickReplySchema.safeParse({
        id: '11111111-1111-4111-9111-111111111111',
      }).success || 'expected rejection sem fields'
    );
  });

  // 40. deleteQuickReplySchema rejeita id não-UUID
  await i('deleteQuickReplyRejectsNonUuid', () => {
    return !deleteQuickReplySchema.safeParse({ id: 'qr_001' }).success || 'expected rejection';
  });

  // 41. reorderQuickRepliesSchema rejeita lista vazia
  await i('reorderQuickRepliesRejectsEmpty', () => {
    return !reorderQuickRepliesSchema.safeParse({ items: [] }).success || 'expected rejection';
  });

  // 42. reorderQuickRepliesSchema rejeita order negativo
  await i('reorderQuickRepliesRejectsNegativeOrder', () => {
    return (
      !reorderQuickRepliesSchema.safeParse({
        items: [{ id: '11111111-1111-4111-9111-111111111111', order: -1 }],
      }).success || 'expected rejection'
    );
  });

  // 43. reorderQuickRepliesSchema aceita 1 item válido
  await i('reorderQuickRepliesAcceptsValid', () => {
    return (
      reorderQuickRepliesSchema.safeParse({
        items: [{ id: '11111111-1111-4111-9111-111111111111', order: 0 }],
      }).success || 'expected valid'
    );
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
