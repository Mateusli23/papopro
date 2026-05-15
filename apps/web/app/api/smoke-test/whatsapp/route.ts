/**
 * Smoke test WhatsApp — grupos `whatsapp-schema-m9` (M9#1) +
 * `whatsapp-connection-m9` (M9#2).
 *
 * Valida o contrato do schema + adapter + factory + transforms sem tocar
 * rede nem banco. Roda em CI + manual via `curl /api/smoke-test/whatsapp`.
 *
 * Em M9#3+ outros grupos entram aqui (`whatsapp-webhook-m9`,
 * `whatsapp-antiban-m9`, `whatsapp-inbox-m9`, `whatsapp-heartbeat-m9`).
 */
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
import { sendInternalNoteSchema, sendTextMessageSchema } from '@/features/inbox/schemas';
import {
  type SendTextResult,
  type WhatsAppAdapter,
  type WhatsAppInstanceStatus,
  type WhatsAppQrCode,
} from '@/lib/whatsapp/adapter';
import { selectAdapter } from '@/lib/whatsapp/factory';
import { mockAdapter } from '@/lib/whatsapp/mock-adapter';
import { uazapiAdapter } from '@/lib/whatsapp/uazapi';

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

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
