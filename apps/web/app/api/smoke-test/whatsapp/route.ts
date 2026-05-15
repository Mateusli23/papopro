/**
 * Smoke test M9#1 — `whatsapp-schema-m9` grupo.
 *
 * Valida o contrato do schema + adapter sem tocar rede nem banco. Roda em CI
 * + manual via `curl /api/smoke-test/whatsapp`. Resposta:
 *
 *     {
 *       "passed": 5,
 *       "failed": 0,
 *       "total": 5,
 *       "results": [{ "group": "whatsapp-schema-m9", "name": "...", "ok": true }, ...]
 *     }
 *
 * Em M9#2+ outros grupos entram aqui (`whatsapp-connection-m9`,
 * `whatsapp-webhook-m9`, `whatsapp-antiban-m9`, `whatsapp-inbox-m9`,
 * `whatsapp-heartbeat-m9`).
 */
import { NextResponse } from 'next/server';

import {
  AuditAction,
  ConversationStatus,
  HealthScore,
  MessageDirection,
  MessageKind,
} from '@papopro/db';

import { sendInternalNoteSchema, sendTextMessageSchema } from '@/features/inbox/schemas';
import {
  type SendTextResult,
  type WhatsAppAdapter,
  type WhatsAppInstanceStatus,
  type WhatsAppQrCode,
} from '@/lib/whatsapp/adapter';
import { mockAdapter } from '@/lib/whatsapp/mock-adapter';

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

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
