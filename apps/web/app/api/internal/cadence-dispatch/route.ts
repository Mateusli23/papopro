import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { type Prisma } from '@papopro/db';

import {
  computeBackoffNextRunAt,
  computeNextRunAt,
  type DayOffset,
} from '@/features/cadences/dispatch/compute-next-run-at';
import {
  isPermanentBlock,
  mapAntiBanToSkipReason,
} from '@/features/cadences/dispatch/map-antiban-reason';
import { dispatchPayloadSchema } from '@/features/cadences/dispatch/schemas';
import type {
  CadenceStepRunSkipReason,
  CadenceStepChannel,
} from '@/features/cadences/dispatch/types';
import { resolvePlaceholders } from '@/features/inbox/transforms';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import {
  applyJitter,
  assertCanSend,
  recordSent,
  type InstanceSnapshot,
} from '@/lib/whatsapp/anti-ban';
import { getWhatsAppAdapter } from '@/lib/whatsapp/factory';

/**
 * `POST /api/internal/cadence-dispatch` (M10#2) — executor de step de cadência.
 *
 * Chamada pela Edge Function `cadence-runner` (Deno) com payload contendo
 * `{workspace_id, enrollment_id, lead_id, cadence_id, step_id, step_run_id,
 * scheduled_for}`. A Edge já reivindicou o slot (INSERT
 * `cadence_step_runs ON CONFLICT DO NOTHING`); essa rota apenas executa o
 * envio (ou skip) e atualiza o estado.
 *
 * **Por que rota Next em vez de fazer tudo na Edge:** reuso direto do stack
 * TS do M9 (`assertCanSend` + `applyJitter` + `recordSent` + adapter uazapi).
 * Reimplementar em Deno duplicaria ~500 linhas que já passaram em smoke
 * com 33 checks. Edge Function = scheduler; Next route = executor.
 *
 * **Auth:** `timingSafeEqual(Bearer CADENCE_DISPATCH_SECRET)`. Sem header
 * válido → 401 imediato.
 *
 * **Lógica de branch** (ver plano M10#2 aprovado):
 *  - Channel `email` → step_run `skipped(email_stub)` + avança enrollment
 *  - Lead sem phone → step_run `skipped(no_phone)` + cancela enrollment
 *  - Anti-ban bloqueia:
 *    - `blacklisted` (permanente) → step_run skipped + cancela enrollment + audit `cadence_paused`
 *    - transiente (rate_limit/unhealthy/outside_hours/etc) → step_run
 *      skipped + backoff +30min em `enrollment.next_run_at` (mesmo step
 *      avança porque a RPC trata QUALQUER step_run como executado — retry
 *      do MESMO step ficou pra M10.x)
 *  - Adapter falha → step_run `failed` + audit `cadence_step_failed`
 *  - Sucesso → upsert Conversation + Message + Activity `whatsapp_out`
 *    + recordSent + step_run `sent` + audit `cadence_step_sent` (ou
 *    `cadence_completed` se era o último step)
 *
 * **Tabelas cadence_* via $queryRaw/$executeRaw**: M10#1 criou as 6 tabelas
 * em SQL puro, mas o schema.prisma ainda não tem os modelos (M10#3 adiciona
 * junto com as Server Actions de CRUD). M10#2 acessa tudo via raw queries;
 * Prisma client lida com Conversation/Message/Activity/AuditLog/Lead/
 * WhatsappAccount/WhatsappInstance normalmente.
 *
 * **`maxDuration = 60`** porque jitter pode dormir até 50s + adapter ~5s.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const PREVIEW_LIMIT = 280;
const VALID_DAY_OFFSETS: readonly DayOffset[] = [0, 1, 3, 7, 14, 30] as const;

function buildPreview(body: string): string {
  return body.trim().slice(0, PREVIEW_LIMIT);
}

function authorize(request: NextRequest): boolean {
  const secret = process.env.CADENCE_DISPATCH_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const actual = authHeader.trim();

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);

  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

// ─── Tipos do pre-flight (raw query results) ────────────────────────────────

interface PreflightRow {
  enrollment_status: string;
  enrolled_at: Date;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  lead_company: string | null;
  lead_deleted_at: Date | null;
  cadence_status: string;
  step_day_offset: number;
  step_channel: string;
  step_template_body: string;
  workspace_timezone: string;
  step_run_status: string;
}

interface CadenceStepsRow {
  day_offset: number;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = dispatchPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { workspace_id, enrollment_id, lead_id, cadence_id, step_id, step_run_id } = parsed.data;

  // ─── 1. Pre-flight (readonly): join enrollment + lead + step + cadence + ws
  let preflight: PreflightRow | null;
  try {
    preflight = await withWorkspace(workspace_id, async (tx) => {
      const rows = await tx.$queryRaw<PreflightRow[]>`
        SELECT
          e.status::text       AS enrollment_status,
          e.enrolled_at        AS enrolled_at,
          l.id                 AS lead_id,
          l.name               AS lead_name,
          l.phone              AS lead_phone,
          l.company            AS lead_company,
          l.deleted_at         AS lead_deleted_at,
          c.status::text       AS cadence_status,
          s.day_offset         AS step_day_offset,
          s.channel::text      AS step_channel,
          s.template_body      AS step_template_body,
          COALESCE(w.timezone, 'America/Sao_Paulo') AS workspace_timezone,
          r.status::text       AS step_run_status
        FROM public.cadence_enrollments e
        JOIN public.cadences c       ON c.id = e.cadence_id
        JOIN public.cadence_steps s  ON s.id = ${step_id}::uuid AND s.cadence_id = c.id
        JOIN public.leads l          ON l.id = e.lead_id
        JOIN public.workspaces w     ON w.id = e.workspace_id
        JOIN public.cadence_step_runs r ON r.id = ${step_run_id}::uuid AND r.enrollment_id = e.id AND r.step_id = s.id
        WHERE e.id = ${enrollment_id}::uuid
          AND e.workspace_id = ${workspace_id}::uuid
          AND e.lead_id = ${lead_id}::uuid
          AND e.cadence_id = ${cadence_id}::uuid
        LIMIT 1
      `;
      return rows[0] ?? null;
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.preflight', err, {
      workspaceId: workspace_id,
      enrollment_id,
      step_run_id,
    });
    await failStepRun(workspace_id, step_run_id, 'preflight_error');
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'preflight_error' },
      { status: 500 },
    );
  }

  if (!preflight) {
    await failStepRun(workspace_id, step_run_id, 'preflight_missing');
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'preflight_missing' },
      { status: 404 },
    );
  }

  // Pode acontecer que entre o claim da Edge e este handler, o trigger
  // `pause_cadence_on_inbound` (M10#1) tenha pausado o enrollment porque o
  // lead respondeu. Tratamos como skip transiente — runner não tentará de
  // novo (status != active), só fica registrado.
  if (preflight.enrollment_status !== 'active') {
    await skipStepRun(workspace_id, step_run_id, 'workspace_paused', 'enrollment_paused');
    return NextResponse.json(
      { ok: true, status: 'skipped', skip_reason: 'workspace_paused' },
      { status: 200 },
    );
  }
  if (preflight.cadence_status !== 'active') {
    await skipStepRun(workspace_id, step_run_id, 'workspace_paused', 'cadence_paused');
    return NextResponse.json(
      { ok: true, status: 'skipped', skip_reason: 'workspace_paused' },
      { status: 200 },
    );
  }

  // ─── 2. Lead deletado (soft-delete LGPD) → cancela enrollment ────────────
  if (preflight.lead_deleted_at !== null) {
    await skipAndCancel(workspace_id, step_run_id, enrollment_id, 'lead_deleted');
    return NextResponse.json(
      { ok: true, status: 'skipped', skip_reason: 'lead_deleted' },
      { status: 200 },
    );
  }

  const channel = preflight.step_channel as CadenceStepChannel;
  const stepDayOffset = preflight.step_day_offset as DayOffset;
  if (!VALID_DAY_OFFSETS.includes(stepDayOffset)) {
    reportNonFatal(
      'cadence.dispatch.invalid_day_offset',
      new Error(`day_offset=${preflight.step_day_offset}`),
      { workspaceId: workspace_id, step_id },
    );
    await failStepRun(workspace_id, step_run_id, 'invalid_day_offset');
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'invalid_day_offset' },
      { status: 500 },
    );
  }

  // ─── 3. Branch: email step → skip + advance ──────────────────────────────
  if (channel === 'email') {
    const advance = await advanceEnrollmentAfter(
      workspace_id,
      cadence_id,
      enrollment_id,
      preflight.enrolled_at,
      stepDayOffset,
    );
    await skipStepRun(workspace_id, step_run_id, 'email_stub', 'email_stub');
    return NextResponse.json(
      {
        ok: true,
        status: 'skipped',
        skip_reason: 'email_stub',
        enrollment_completed: advance.isComplete,
      },
      { status: 200 },
    );
  }

  // ─── 4. Branch: lead sem phone → cancela enrollment ──────────────────────
  if (!preflight.lead_phone || preflight.lead_phone.trim() === '') {
    await skipAndCancel(workspace_id, step_run_id, enrollment_id, 'no_phone');
    return NextResponse.json(
      { ok: true, status: 'skipped', skip_reason: 'no_phone' },
      { status: 200 },
    );
  }

  // ─── 5. Carrega instance + anti-ban ──────────────────────────────────────
  let instance: InstanceSnapshot & { id: string; accountId: string };
  try {
    instance = await withWorkspace(workspace_id, async (tx) => {
      const account = await tx.whatsappAccount.findUnique({
        where: { workspaceId: workspace_id },
        select: {
          id: true,
          instance: {
            select: {
              id: true,
              status: true,
              healthScore: true,
              pausedUntil: true,
              messagesSent24h: true,
              externalInstanceId: true,
            },
          },
        },
      });
      if (!account || !account.instance) throw new Error('NOT_CONNECTED');
      return {
        id: account.instance.id,
        accountId: account.id,
        status: account.instance.status,
        healthScore: account.instance.healthScore,
        pausedUntil: account.instance.pausedUntil,
        messagesSent24h: account.instance.messagesSent24h,
        externalInstanceId: account.instance.externalInstanceId,
      };
    });
  } catch (err) {
    if ((err as Error).message === 'NOT_CONNECTED') {
      // Workspace sem WhatsApp conectado → backoff (vendedor pode reconectar).
      await backoffAfterTransientBlock(
        workspace_id,
        step_run_id,
        enrollment_id,
        'workspace_paused',
      );
      return NextResponse.json(
        { ok: true, status: 'skipped', skip_reason: 'workspace_paused' },
        { status: 200 },
      );
    }
    reportNonFatal('cadence.dispatch.instance_load', err, {
      workspaceId: workspace_id,
      step_run_id,
    });
    await failStepRun(workspace_id, step_run_id, 'instance_load_error');
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'instance_load_error' },
      { status: 500 },
    );
  }

  // Anti-ban (consulta blacklist + 6 checks em ordem).
  const antiBan = await withWorkspace(workspace_id, async (tx) =>
    assertCanSend(tx, workspace_id, preflight!.workspace_timezone, preflight!.lead_phone, instance),
  );

  if (!antiBan.ok) {
    const skipReason = mapAntiBanToSkipReason(antiBan.reason);
    if (isPermanentBlock(antiBan.reason)) {
      // Blacklist = LGPD opt-out → cancela enrollment definitivamente + audit.
      await skipAndCancel(workspace_id, step_run_id, enrollment_id, skipReason, {
        reason: antiBan.reason,
        message: antiBan.message,
        leadId: preflight.lead_id,
        phone: preflight.lead_phone,
      });
      return NextResponse.json(
        { ok: true, status: 'skipped', skip_reason: skipReason },
        { status: 200 },
      );
    }
    // Transiente: backoff +30min, enrollment continua active.
    await backoffAfterTransientBlock(workspace_id, step_run_id, enrollment_id, skipReason);
    return NextResponse.json(
      { ok: true, status: 'skipped', skip_reason: skipReason },
      { status: 200 },
    );
  }

  // ─── 6. Jitter 30-50s + envio ────────────────────────────────────────────
  await applyJitter();

  const renderedBody = resolvePlaceholders(preflight.step_template_body, {
    nome: preflight.lead_name,
    empresa: preflight.lead_company ?? undefined,
    // `produto` ainda não existe em Lead — fica literal `{produto}` até M11.
  });

  if (!instance.externalInstanceId) {
    await failStepRun(workspace_id, step_run_id, 'no_external_instance');
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'no_external_instance' },
      { status: 500 },
    );
  }

  let sendResult;
  try {
    const adapter = getWhatsAppAdapter();
    sendResult = await adapter.sendText({
      workspaceId: workspace_id,
      externalInstanceId: instance.externalInstanceId,
      to: preflight.lead_phone,
      body: renderedBody,
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.adapter', err, {
      workspaceId: workspace_id,
      step_run_id,
      externalInstanceId: instance.externalInstanceId,
    });
    await failStepRun(workspace_id, step_run_id, (err as Error).message);
    await auditStepFailed(workspace_id, enrollment_id, step_id, (err as Error).message);
    return NextResponse.json(
      { ok: false, status: 'failed', error: 'adapter_failed' },
      { status: 502 },
    );
  }

  // ─── 7. Tx final: Conversation + Message + Activity + recordSent + step_run + audit + advance enrollment
  try {
    const persisted = await withWorkspace(workspace_id, async (tx) => {
      const preview = buildPreview(renderedBody);

      const conversation = await tx.conversation.upsert({
        where: {
          workspaceId_contactPhone: {
            workspaceId: workspace_id,
            contactPhone: preflight!.lead_phone,
          },
        },
        create: {
          workspaceId: workspace_id,
          leadId: preflight!.lead_id,
          vendorId: null,
          whatsappAccountId: instance.accountId,
          contactPhone: preflight!.lead_phone,
          status: 'awaiting',
          lastMessageAt: sendResult.sentAt,
          lastMessagePreview: preview,
          lastMessageDirection: 'out',
          unreadCount: 0,
        },
        update: {
          status: 'awaiting',
          lastMessageAt: sendResult.sentAt,
          lastMessagePreview: preview,
          lastMessageDirection: 'out',
          archivedAt: null,
        },
        select: { id: true },
      });

      const message = await tx.message.create({
        data: {
          workspaceId: workspace_id,
          conversationId: conversation.id,
          kind: 'text',
          direction: 'out',
          body: renderedBody,
          authorId: null, // Sistema enviou — não tem WorkspaceMember associado.
          externalMessageId: sendResult.externalMessageId,
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: preflight!.lead_id },
        data: { lastInteractionAt: sendResult.sentAt },
      });

      await tx.activity.create({
        data: {
          workspaceId: workspace_id,
          leadId: preflight!.lead_id,
          type: 'whatsapp_out',
          body: renderedBody,
          authorId: null,
          meta: {
            source: 'cadence',
            cadenceId: cadence_id,
            stepId: step_id,
            enrollmentId: enrollment_id,
            messageId: message.id,
            externalMessageId: sendResult.externalMessageId,
          } as Prisma.InputJsonValue,
        },
      });

      await recordSent(tx, instance.id, sendResult.sentAt);

      // Atualiza step_run pra 'sent' + linka message.
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status     = 'sent',
               executed_at = ${sendResult.sentAt},
               message_id  = ${message.id}::uuid,
               updated_at  = NOW()
         WHERE id = ${step_run_id}::uuid
           AND workspace_id = ${workspace_id}::uuid
      `;

      return { conversationId: conversation.id, messageId: message.id };
    });

    // Avança enrollment fora da tx anterior (próximo step ou completed).
    // Mantemos separado pra não atrasar a tx principal em caso de query lenta
    // do cadence_steps.
    const advance = await advanceEnrollmentAfter(
      workspace_id,
      cadence_id,
      enrollment_id,
      preflight.enrolled_at,
      stepDayOffset,
    );

    // Audit log final: 'cadence_completed' se acabou a cadência, senão 'cadence_step_sent'.
    await withWorkspace(workspace_id, async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId: workspace_id,
          userId: null,
          action: advance.isComplete ? 'cadence_completed' : 'cadence_step_sent',
          entityType: 'cadence_enrollment',
          entityId: enrollment_id,
          changes: {
            cadenceId: cadence_id,
            stepId: step_id,
            dayOffset: stepDayOffset,
            messageId: persisted.messageId,
            externalMessageId: sendResult.externalMessageId,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        status: 'sent',
        message_id: persisted.messageId,
        conversation_id: persisted.conversationId,
        enrollment_completed: advance.isComplete,
      },
      { status: 200 },
    );
  } catch (err) {
    // Adapter já enviou — mas falha persistir. Audit falha mas retorna sent
    // pra Edge não retentar (mensagem JÁ foi enviada; retentar = duplicar).
    reportNonFatal('cadence.dispatch.persist', err, {
      workspaceId: workspace_id,
      step_run_id,
      externalMessageId: sendResult.externalMessageId,
    });
    // Tenta marcar step_run sent mesmo assim, sem o message_id.
    await markStepRunSent(workspace_id, step_run_id, sendResult.sentAt);
    return NextResponse.json(
      { ok: true, status: 'sent_persist_failed', externalMessageId: sendResult.externalMessageId },
      { status: 200 },
    );
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}

// ─── Helpers de finalização (best-effort, isolados em try/catch) ────────────

async function failStepRun(
  workspaceId: string,
  stepRunId: string,
  errorDetail: string,
): Promise<void> {
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status       = 'failed',
               error_detail = ${errorDetail},
               executed_at  = NOW(),
               updated_at   = NOW()
         WHERE id = ${stepRunId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.failStepRun', err, { workspaceId, stepRunId });
  }
}

async function markStepRunSent(
  workspaceId: string,
  stepRunId: string,
  executedAt: Date,
): Promise<void> {
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status      = 'sent',
               executed_at = ${executedAt},
               updated_at  = NOW()
         WHERE id = ${stepRunId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.markStepRunSent', err, { workspaceId, stepRunId });
  }
}

async function skipStepRun(
  workspaceId: string,
  stepRunId: string,
  skipReason: CadenceStepRunSkipReason,
  errorDetail?: string,
): Promise<void> {
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status       = 'skipped',
               skip_reason  = ${skipReason}::public.cadence_step_run_skip_reason,
               error_detail = ${errorDetail ?? null},
               executed_at  = NOW(),
               updated_at   = NOW()
         WHERE id = ${stepRunId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.skipStepRun', err, { workspaceId, stepRunId, skipReason });
  }
}

async function skipAndCancel(
  workspaceId: string,
  stepRunId: string,
  enrollmentId: string,
  skipReason: CadenceStepRunSkipReason,
  auditChanges?: Record<string, unknown>,
): Promise<void> {
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status      = 'skipped',
               skip_reason = ${skipReason}::public.cadence_step_run_skip_reason,
               executed_at = NOW(),
               updated_at  = NOW()
         WHERE id = ${stepRunId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
      // Cancela enrollment (paused_reason fica null porque status != paused;
      // status enum 'cancelled' marca cancelamento definitivo).
      await tx.$executeRaw`
        UPDATE public.cadence_enrollments
           SET status       = 'cancelled',
               completed_at = NOW(),
               updated_at   = NOW()
         WHERE id = ${enrollmentId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
      // Audit `cadence_paused` reusando action existente (não há cadence_cancelled).
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: null,
          action: 'cadence_paused',
          entityType: 'cadence_enrollment',
          entityId: enrollmentId,
          changes: {
            reason: skipReason,
            cancelled: true,
            ...(auditChanges ?? {}),
          } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.skipAndCancel', err, {
      workspaceId,
      stepRunId,
      enrollmentId,
      skipReason,
    });
  }
}

async function backoffAfterTransientBlock(
  workspaceId: string,
  stepRunId: string,
  enrollmentId: string,
  skipReason: CadenceStepRunSkipReason,
): Promise<void> {
  const nextRunAt = computeBackoffNextRunAt(new Date(), 30);
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.cadence_step_runs
           SET status      = 'skipped',
               skip_reason = ${skipReason}::public.cadence_step_run_skip_reason,
               executed_at = NOW(),
               updated_at  = NOW()
         WHERE id = ${stepRunId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
      await tx.$executeRaw`
        UPDATE public.cadence_enrollments
           SET next_run_at = ${nextRunAt},
               updated_at  = NOW()
         WHERE id = ${enrollmentId}::uuid
           AND workspace_id = ${workspaceId}::uuid
      `;
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.backoffTransient', err, {
      workspaceId,
      stepRunId,
      enrollmentId,
      skipReason,
    });
  }
}

/**
 * Avança `enrollment.next_run_at` pro próximo `day_offset` da cadência
 * (absoluto via `enrolled_at + N days`). Sem próximo → marca `completed`.
 * Retorna `{isComplete}` pra que o caller decida o `audit_action`.
 */
async function advanceEnrollmentAfter(
  workspaceId: string,
  cadenceId: string,
  enrollmentId: string,
  enrolledAt: Date,
  currentStepDayOffset: DayOffset,
): Promise<{ isComplete: boolean; nextRunAt: Date | null }> {
  try {
    const result = await withWorkspace(workspaceId, async (tx) => {
      const stepsRows = await tx.$queryRaw<CadenceStepsRow[]>`
        SELECT day_offset
        FROM public.cadence_steps
        WHERE cadence_id = ${cadenceId}::uuid
        ORDER BY day_offset, order_index
      `;
      const dayOffsets = stepsRows.map((r) => r.day_offset);
      const advance = computeNextRunAt(enrolledAt, currentStepDayOffset, dayOffsets);

      if (advance.isComplete) {
        await tx.$executeRaw`
          UPDATE public.cadence_enrollments
             SET status       = 'completed',
                 completed_at = NOW(),
                 updated_at   = NOW()
           WHERE id = ${enrollmentId}::uuid
             AND workspace_id = ${workspaceId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE public.cadence_enrollments
             SET next_run_at = ${advance.nextRunAt},
                 updated_at  = NOW()
           WHERE id = ${enrollmentId}::uuid
             AND workspace_id = ${workspaceId}::uuid
        `;
      }

      return advance;
    });
    return result;
  } catch (err) {
    reportNonFatal('cadence.dispatch.advanceEnrollment', err, {
      workspaceId,
      enrollmentId,
      cadenceId,
    });
    return { isComplete: false, nextRunAt: null };
  }
}

async function auditStepFailed(
  workspaceId: string,
  enrollmentId: string,
  stepId: string,
  error: string,
): Promise<void> {
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: null,
          action: 'cadence_step_failed',
          entityType: 'cadence_enrollment',
          entityId: enrollmentId,
          changes: { stepId, error } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    reportNonFatal('cadence.dispatch.auditStepFailed', err, {
      workspaceId,
      enrollmentId,
      stepId,
    });
  }
}
