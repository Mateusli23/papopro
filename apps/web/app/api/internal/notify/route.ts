import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { prisma } from '@papopro/db';

import { dispatchNotification } from '@/lib/notifications/dispatch';
import { reportNonFatal } from '@/lib/observability/report';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';

/**
 * `POST /api/internal/notify` (M13#2) — ponte entre os gatilhos no Postgres
 * e o dispatcher de notificações.
 *
 * **Quem chama:** os triggers `notify_on_cold_lead_alert` e
 * `notify_on_whatsapp_unhealthy` (migration `m13_2_push`), via `pg_net`. São
 * os eventos cujo gatilho NÃO está no app Next — `lead_cooling` (cold lead
 * detector) e `whatsapp_connection_down` (heartbeat). Eventos com gatilho no
 * Next (`trial_expiring`, `whatsapp_message_received`) chamam
 * `dispatchNotification` direto, sem passar por aqui.
 *
 * **O que faz:** resolve os destinatários (vendedor do lead / Owner-Admin-
 * Manager do workspace) e a copy, e delega pro `dispatchNotification`. Manter
 * a resolução de destinatários no Next — TS, testável, ciente de RBAC —
 * mantém os triggers SQL burros (só POSTam `{event, workspaceId, leadId}`).
 *
 * **Auth:** `Authorization: Bearer ${NOTIFY_DISPATCH_SECRET}`, comparado em
 * tempo constante. Sem header válido → 401.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const ADMIN_ROLES = ['Owner', 'Admin', 'Manager'] as const;

const notifyPayloadSchema = z.object({
  event: z.enum(['lead_cooling', 'whatsapp_connection_down']),
  workspaceId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
});

function authorize(request: NextRequest): boolean {
  const secret = process.env.NOTIFY_DISPATCH_SECRET;
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

  const raw = await request.json().catch(() => null);
  const parsed = notifyPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { event, workspaceId, leadId } = parsed.data;
  const appBaseUrl = request.nextUrl.origin;

  // Rate-limit per (workspace, event) — protege contra spam caso o secret vaze
  // (CI log, copy/paste em issue). Bound bem acima do volume orgânico esperado:
  // lead_cooling dispara hourly; whatsapp_connection_down em downtime real é
  // ~1/min. 60/min é folga 60x.
  const rl = checkRateLimit(`notify:${workspaceId}:${event}`, 60, 60_000);
  if (!rl.ok) {
    const response = NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    response.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    return response;
  }

  try {
    if (event === 'lead_cooling') {
      if (!leadId) {
        return NextResponse.json({ ok: false, error: 'lead_id_required' }, { status: 400 });
      }
      // O assignee é obrigatório no schema (LeadAssignee onDelete: Restrict).
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, workspaceId },
        select: { name: true, assignedTo: { select: { userId: true } } },
      });
      if (!lead) {
        return NextResponse.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
      }

      const result = await dispatchNotification({
        workspaceId,
        event: 'lead_cooling',
        recipientUserIds: [lead.assignedTo.userId],
        title: 'Lead esfriando',
        body: `${lead.name} passou do prazo da etapa atual — retome o contato.`,
        url: `/leads/${leadId}`,
        appBaseUrl,
      });
      return NextResponse.json({ ok: true, dispatch: result });
    }

    // whatsapp_connection_down — avisa quem opera a conexão.
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, role: { in: [...ADMIN_ROLES] } },
      select: { userId: true },
    });

    const result = await dispatchNotification({
      workspaceId,
      event: 'whatsapp_connection_down',
      recipientUserIds: members.map((m) => m.userId),
      title: 'WhatsApp desconectado',
      body: 'O número do workspace caiu — as cadências em fila foram pausadas. Reconecte para retomar.',
      url: '/settings/connections',
      appBaseUrl,
    });
    return NextResponse.json({ ok: true, dispatch: result });
  } catch (err) {
    reportNonFatal('notify.route', err, { workspaceId, event });
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
