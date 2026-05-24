import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@papopro/db';

import {
  AUDIT_RETENTION_MONTHS,
  NOTIFICATION_RETENTION_DAYS,
  computeAuditCutoff,
  computeNotificationCutoff,
} from '@/lib/lgpd/retention';
import { reportNonFatal } from '@/lib/observability/report';

/**
 * `POST /api/cron/purge-logs` (M13#3) — aplica a retenção de logs da LGPD:
 * apaga `audit_logs` com mais de 12 meses e `notifications` com mais de 30
 * dias (CLAUDE.md §7.5, PRD §3.2).
 *
 * **Disparado por:** GitHub Action mensal (`.github/workflows/cron-purge-logs.yml`)
 * com `Authorization: Bearer ${CRON_SECRET}`. Invocável via `curl`.
 *
 * **Por que Next route em vez de pg_cron + Edge Function:** mesmo motivo do
 * `cron/cleanup-attachments` e `cron/trial-warnings` — Edge Functions estão
 * bloqueadas no dev local desta máquina (antivírus + TLS). Next route +
 * GitHub Action é portável e testável local.
 *
 * **Sem RLS:** varre todos os workspaces (job admin) — `prisma` direto. O
 * corte é por `created_at`, não por tenant.
 *
 * **Retenção é global em 12m:** o tier Enterprise (24m) ainda não existe no
 * enum `SubscriptionPlan`. Quando entrar, o purge de auditoria precisa virar
 * per-workspace — ver `lib/lgpd/retention.ts`.
 *
 * **`deleteMany` direto, sem batch:** volume MVP (poucos workspaces beta) não
 * justifica o select-ids-then-delete do `cleanup-attachments`. Se a auditoria
 * crescer, migrar pra delete batched.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

interface PurgeResult {
  auditLogsDeleted: number;
  notificationsDeleted: number;
}

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = `Bearer ${secret}`;
  const actual = (request.headers.get('authorization') ?? '').trim();

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const auditCutoff = computeAuditCutoff(now);
  const notificationCutoff = computeNotificationCutoff(now);

  try {
    const [auditDeleted, notificationsDeleted] = await Promise.all([
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
      prisma.notification.deleteMany({ where: { createdAt: { lt: notificationCutoff } } }),
    ]);

    return NextResponse.json({
      ok: true,
      at: now.toISOString(),
      retention: {
        auditMonths: AUDIT_RETENTION_MONTHS,
        notificationDays: NOTIFICATION_RETENTION_DAYS,
      },
      cutoff: {
        audit: auditCutoff.toISOString(),
        notifications: notificationCutoff.toISOString(),
      },
      result: {
        auditLogsDeleted: auditDeleted.count,
        notificationsDeleted: notificationsDeleted.count,
      } satisfies PurgeResult,
    });
  } catch (err) {
    reportNonFatal('cron.purge-logs.fatal', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

/**
 * GET retorna 405 explícito — só aceita POST.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
