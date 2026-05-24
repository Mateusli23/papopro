import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@papopro/db';

import { pickTrialWarning } from '@/features/billing/trial';
import { sendEmail } from '@/lib/email/resend';
import { renderTrialExpiringEmail } from '@/lib/email/templates/trial-expiring';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { reportNonFatal } from '@/lib/observability/report';

/**
 * `POST /api/cron/trial-warnings` (M12#2) — avisa por email os Owners de
 * workspaces cujo trial de 7 dias está a ≤2d / ≤1d do fim.
 *
 * **Disparado por:** GitHub Action diário (`.github/workflows/cron-trial-warnings.yml`)
 * com `Authorization: Bearer ${CRON_SECRET}`. Também invocável via `curl`.
 *
 * **Por que Next route em vez de pg_cron + Edge Function:** mesmo motivo do
 * `cron/cleanup-attachments` — Edge Functions estão bloqueadas no dev local
 * dessa máquina (antivírus + TLS) e o route reusa `lib/email/` direto, sem
 * reimplementar o envio em Deno.
 *
 * **Idempotência:** `pickTrialWarning` + as colunas `trial_warn_d2_sent_at` /
 * `trial_warn_d1_sent_at` garantem 1 email por janela por workspace, mesmo
 * que o job rode duas vezes ou atrase um dia.
 *
 * **Sem RLS:** varre todos os workspaces (job admin) — `prisma` direto, como
 * o `cleanup-attachments`. Filtro é por `trial_ends_at`, não por tenant.
 *
 * **Expiração ≠ aviso:** este job NÃO faz downgrade. O trial expira lazy
 * (`getActivePlan` compara `now < trial_ends_at`); aqui só mandamos email.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

const BATCH_LIMIT = 200;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

interface TrialWarningsResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
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
  const billingUrl = new URL('/settings/billing', request.nextUrl.origin).toString();

  try {
    // Candidatos: trial ativo (`> now`), dentro da janela D-2 (`<= now + 2d`),
    // sem assinatura paga, e com ao menos um aviso ainda não enviado.
    const candidates = await prisma.workspace.findMany({
      where: {
        deletedAt: null,
        trialEndsAt: { gt: now, lte: new Date(now.getTime() + TWO_DAYS_MS) },
        subscriptions: { none: { status: { in: ['active', 'past_due'] } } },
        OR: [{ trialWarnD2SentAt: null }, { trialWarnD1SentAt: null }],
      },
      select: {
        id: true,
        name: true,
        trialEndsAt: true,
        trialWarnD2SentAt: true,
        trialWarnD1SentAt: true,
        members: {
          where: { role: 'Owner' },
          select: { user: { select: { id: true, email: true } } },
          take: 1,
        },
      },
      orderBy: { trialEndsAt: 'asc' },
      take: BATCH_LIMIT,
    });

    const result: TrialWarningsResult = { processed: 0, sent: 0, skipped: 0, errors: 0 };

    for (const ws of candidates) {
      result.processed += 1;
      if (!ws.trialEndsAt) continue; // narrow — `where` já garante não-null

      const warning = pickTrialWarning({
        trialEndsAt: ws.trialEndsAt,
        now,
        d2SentAt: ws.trialWarnD2SentAt,
        d1SentAt: ws.trialWarnD1SentAt,
      });
      if (!warning) {
        result.skipped += 1;
        continue;
      }

      const ownerEmail = ws.members[0]?.user?.email;
      if (!ownerEmail) {
        result.errors += 1;
        reportNonFatal('trial.warnings.no-owner-email', new Error('workspace sem Owner'), {
          workspaceId: ws.id,
        });
        continue;
      }

      const daysLeft = warning === 'd1' ? 1 : 2;
      const email = renderTrialExpiringEmail({ workspaceName: ws.name, daysLeft, billingUrl });
      const sent = await sendEmail({
        to: ownerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (!sent.ok) {
        result.errors += 1;
        reportNonFatal('trial.warnings.send', new Error(sent.error), {
          workspaceId: ws.id,
          warning,
        });
        continue;
      }

      // Marca o aviso como enviado — idempotência da próxima execução.
      await prisma.workspace.update({
        where: { id: ws.id },
        data: warning === 'd1' ? { trialWarnD1SentAt: now } : { trialWarnD2SentAt: now },
      });
      result.sent += 1;

      // Fanout in-app + push (M13#2). O email já saiu acima com o template
      // dedicado, então restringe os canais — sem `dispatchNotification`
      // mandaria um segundo email genérico. Best-effort: nunca lança.
      const ownerUserId = ws.members[0]?.user?.id;
      if (ownerUserId) {
        await dispatchNotification({
          workspaceId: ws.id,
          event: 'trial_expiring',
          recipientUserIds: [ownerUserId],
          title: 'Seu teste grátis está acabando',
          body:
            daysLeft === 1
              ? 'O teste do PapoPro termina amanhã — assine o Pro para não perder acesso.'
              : `Faltam ${daysLeft} dias do seu teste do PapoPro — assine o Pro para não perder acesso.`,
          url: '/settings/billing',
          channels: ['inapp', 'push'],
          appBaseUrl: request.nextUrl.origin,
        });
      }
    }

    return NextResponse.json({ ok: true, at: now.toISOString(), result });
  } catch (err) {
    reportNonFatal('trial.warnings.fatal', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

/**
 * GET retorna 405 explícito — só aceita POST.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
