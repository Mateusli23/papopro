/**
 * Queries server-only de Cadências (M10#3).
 *
 * Substituem o `FAKE_CADENCES` que `apps/web/features/cadences/store.ts`
 * carregava em M5. Retornam os mesmos shapes de `features/cadences/types.ts`
 * (contrato fechado em M5) — `<CadencesView>` e `<CadenceEditorView>` não
 * mudam, só muda a origem dos dados.
 *
 * **Server-only.** Roda em Server Components (`/cadences/page.tsx`,
 * `/cadences/[id]/page.tsx`) e em Server Actions. `withWorkspace` aplica
 * RLS — defense-in-depth filtra `workspaceId` explicitamente (CLAUDE.md §7.2).
 *
 * **Métricas reais** (substituem o mock `cadence.metrics`): agregadas via
 * subqueries no Postgres em uma única ida ao banco por cadência ou em batch
 * (`listCadences` agrega todas de uma vez via GROUP BY no `$queryRaw`).
 *
 * **Templates não-UI**: `templateKey='custom'` no Postgres mapeia pra
 * `undefined` no `Cadence.templateKey` (contrato UI suporta só os 4
 * templates "reais"). `status='archived'` filtramos da listagem (V2).
 */
import 'server-only';

import { CadenceStatus, CadenceTemplateKey } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import { ackColdAlertWhereForRole } from './cold-alerts.helpers';
import type {
  Cadence,
  CadenceMetrics,
  CadenceStep,
  CadenceTemplateKey as CadenceTemplateKeyUI,
} from './types';

// ─── Tipos auxiliares pra UI da seção "Cadências do Lead" e Settings ───────

export interface LeadEnrollmentUI {
  id: string;
  cadenceId: string;
  cadenceName: string;
  cadenceStageId: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  pausedReason: string | null;
  enrolledAt: string;
  nextRunAt: string;
  completedAt: string | null;
  stepsSent: number;
  stepsTotal: number;
}

export interface ColdThresholdUI {
  id: string;
  stageId: string | null;
  stageName: string | null;
  daysInactive: number;
  enabled: boolean;
}

/**
 * Shape de cold alert ativo (não-acknowledged) consumido pela UI:
 *  - banner no `/leads/[id]`
 *  - row no NotificationsButton drawer
 *  - row no badge sidebar (só count é usado lá)
 */
export interface ColdAlertUI {
  id: string;
  leadId: string;
  leadName: string;
  stageId: string;
  stageName: string;
  daysInactive: number;
  triggeredAt: string;
  /** `lastInteractionAt` do lead no momento da query — usado pra mostrar "Sem interação há X dias". */
  lastInteractionAt: string | null;
}

// ─── Transform Prisma row → Cadence UI shape ────────────────────────────────

/**
 * Mapeia `CadenceTemplateKey` do Prisma (5 valores) → contrato UI (4 valores
 * + undefined). `'custom'` significa "criada do zero" e vira undefined pra
 * que o `<CadenceCard>` não renderize badge de template.
 */
function templateKeyForUI(key: CadenceTemplateKey): CadenceTemplateKeyUI | undefined {
  if (key === CadenceTemplateKey.custom) return undefined;
  if (key === CadenceTemplateKey.imobiliario) return 'imobiliario';
  if (key === CadenceTemplateKey.b2b) return 'b2b';
  if (key === CadenceTemplateKey.alto_ticket) return 'alto-ticket';
  if (key === CadenceTemplateKey.blank) return 'blank';
  return undefined;
}

/**
 * Mapeia `CadenceStatus` do Prisma (3 valores) → contrato UI (2 valores).
 * `'archived'` é tratado como `'paused'` no front (V2 traz UI dedicada).
 */
function statusForUI(status: CadenceStatus): 'active' | 'paused' {
  return status === CadenceStatus.active ? 'active' : 'paused';
}

/** Day offset do schema (Int sem CHECK no Prisma) → DayOffset narrow UI. */
function dayOffsetForUI(d: number): 0 | 1 | 3 | 7 | 14 | 30 {
  if ([0, 1, 3, 7, 14, 30].includes(d)) return d as 0 | 1 | 3 | 7 | 14 | 30;
  // SQL CHECK constraint impede outros valores — defesa contra drift de schema.
  return 0;
}

// ============================================================================
// listCadences
// ============================================================================

/**
 * Lista todas as cadências do workspace (exclui `archived`). Inclui steps
 * ordenados + métricas agregadas em uma única transação.
 */
export async function listCadences(workspaceId: string): Promise<Cadence[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.cadence.findMany({
      where: { workspaceId, status: { not: CadenceStatus.archived } },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        steps: { orderBy: [{ dayOffset: 'asc' }, { orderIndex: 'asc' }] },
      },
    });

    if (rows.length === 0) return [];

    // Agrega métricas de TODAS as cadências em uma única query.
    // GROUP BY cadence_id pra evitar N+1.
    const metricsRows = await tx.$queryRaw<
      Array<{
        cadence_id: string;
        active_enrollments: bigint;
        total_dispatched: bigint;
        replied_enrollments: bigint;
        total_enrollments: bigint;
      }>
    >`
      SELECT
        e.cadence_id,
        COUNT(*) FILTER (WHERE e.status = 'active')             AS active_enrollments,
        COUNT(r.id) FILTER (WHERE r.status = 'sent')            AS total_dispatched,
        COUNT(*) FILTER (WHERE e.paused_reason = 'lead_replied') AS replied_enrollments,
        COUNT(*)                                                AS total_enrollments
      FROM public.cadence_enrollments e
      LEFT JOIN public.cadence_step_runs r ON r.enrollment_id = e.id
      WHERE e.workspace_id = ${workspaceId}::uuid
        AND e.cadence_id = ANY(${rows.map((c) => c.id)}::uuid[])
      GROUP BY e.cadence_id
    `;

    const metricsByCadence = new Map<string, CadenceMetrics>();
    for (const m of metricsRows) {
      const total = Number(m.total_enrollments);
      metricsByCadence.set(m.cadence_id, {
        activeEnrollments: Number(m.active_enrollments),
        totalDispatched: Number(m.total_dispatched),
        responseRate: total > 0 ? Number(m.replied_enrollments) / total : 0,
        // stageAdvanceRate fica em 0 no MVP — exige tracking de stage_change
        // pós-enrollment (deal.stageId snapshot) que entra em M10#5/reports.
        stageAdvanceRate: 0,
      });
    }

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description ?? undefined,
      stageId: row.stageId,
      status: statusForUI(row.status),
      templateKey: templateKeyForUI(row.templateKey),
      steps: row.steps.map<CadenceStep>((s) => ({
        id: s.id,
        cadenceId: s.cadenceId,
        dayOffset: dayOffsetForUI(s.dayOffset),
        channel: s.channel,
        templateBody: s.templateBody,
        order: s.orderIndex,
        createdAt: s.createdAt.toISOString(),
      })),
      metrics: metricsByCadence.get(row.id) ?? {
        activeEnrollments: 0,
        totalDispatched: 0,
        responseRate: 0,
        stageAdvanceRate: 0,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

// ============================================================================
// getCadence
// ============================================================================

/**
 * Carrega uma cadência completa (steps + métricas) pelo ID.
 * Retorna `null` se não pertence ao workspace ou não existe.
 */
export async function getCadence(workspaceId: string, id: string): Promise<Cadence | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const row = await tx.cadence.findFirst({
      where: { id, workspaceId },
      include: {
        steps: { orderBy: [{ dayOffset: 'asc' }, { orderIndex: 'asc' }] },
      },
    });
    if (!row) return null;

    const metrics = await fetchCadenceMetrics(tx, workspaceId, id);

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description ?? undefined,
      stageId: row.stageId,
      status: statusForUI(row.status),
      templateKey: templateKeyForUI(row.templateKey),
      steps: row.steps.map<CadenceStep>((s) => ({
        id: s.id,
        cadenceId: s.cadenceId,
        dayOffset: dayOffsetForUI(s.dayOffset),
        channel: s.channel,
        templateBody: s.templateBody,
        order: s.orderIndex,
        createdAt: s.createdAt.toISOString(),
      })),
      metrics,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

// ============================================================================
// getCadenceMetrics
// ============================================================================

/**
 * Métricas isoladas de uma cadência. Usado pelo `CadenceMetricsPanel` pra
 * refresh independente após mutações de enrollment.
 */
export async function getCadenceMetrics(
  workspaceId: string,
  cadenceId: string,
): Promise<CadenceMetrics> {
  return withWorkspace(workspaceId, async (tx) => fetchCadenceMetrics(tx, workspaceId, cadenceId));
}

async function fetchCadenceMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  workspaceId: string,
  cadenceId: string,
): Promise<CadenceMetrics> {
  const rows = await tx.$queryRaw<
    Array<{
      active_enrollments: bigint;
      total_dispatched: bigint;
      replied_enrollments: bigint;
      total_enrollments: bigint;
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE e.status = 'active')             AS active_enrollments,
      COUNT(r.id) FILTER (WHERE r.status = 'sent')            AS total_dispatched,
      COUNT(*) FILTER (WHERE e.paused_reason = 'lead_replied') AS replied_enrollments,
      COUNT(*)                                                AS total_enrollments
    FROM public.cadence_enrollments e
    LEFT JOIN public.cadence_step_runs r ON r.enrollment_id = e.id
    WHERE e.workspace_id = ${workspaceId}::uuid
      AND e.cadence_id   = ${cadenceId}::uuid
  `;

  const m = rows[0];
  if (!m) {
    return { activeEnrollments: 0, totalDispatched: 0, responseRate: 0, stageAdvanceRate: 0 };
  }
  const total = Number(m.total_enrollments);
  return {
    activeEnrollments: Number(m.active_enrollments),
    totalDispatched: Number(m.total_dispatched),
    responseRate: total > 0 ? Number(m.replied_enrollments) / total : 0,
    stageAdvanceRate: 0,
  };
}

// ============================================================================
// listLeadEnrollments
// ============================================================================

/**
 * Lista enrollments de um lead (todas as cadências em que está inscrito).
 * Inclui nome da cadência + sent count + total de steps pra UI mostrar
 * "X de Y disparados". Ordenado por mais recentes primeiro.
 */
export async function listLeadEnrollments(
  workspaceId: string,
  leadId: string,
): Promise<LeadEnrollmentUI[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.cadenceEnrollment.findMany({
      where: { workspaceId, leadId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        cadence: {
          select: {
            name: true,
            stageId: true,
            _count: { select: { steps: true } },
          },
        },
        stepRuns: {
          where: { status: 'sent' },
          select: { id: true },
        },
      },
    });

    return rows.map<LeadEnrollmentUI>((row) => ({
      id: row.id,
      cadenceId: row.cadenceId,
      cadenceName: row.cadence.name,
      cadenceStageId: row.cadence.stageId,
      status: row.status,
      pausedReason: row.pausedReason,
      enrolledAt: row.enrolledAt.toISOString(),
      nextRunAt: row.nextRunAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      stepsSent: row.stepRuns.length,
      stepsTotal: row.cadence._count.steps,
    }));
  });
}

// ============================================================================
// listAvailableCadencesForLead
// ============================================================================

/**
 * Lista cadências `active` do workspace pra exibir no dialog de inscrição.
 * Retorna shape leve (id + name) — o filtro de "já inscrito" acontece no
 * client a partir de `initialEnrollments`.
 *
 * **Filtro por stage do lead** ficou de fora propositalmente: o usuário pode
 * inscrever em qualquer cadência ativa (cross-stage). PRD §2.2 prefere
 * flexibilidade aqui — a sugestão de "etapa atual" é dada pelo UI ordenando.
 */
export async function listAvailableCadencesForLead(
  workspaceId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.cadence.findMany({
      where: { workspaceId, status: CadenceStatus.active },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return rows;
  });
}

// ============================================================================
// listColdThresholds
// ============================================================================

/**
 * Lista cold thresholds do workspace (5 seedados por M10#1 + extras manuais).
 * Inclui nome da etapa via JOIN — `stageId=null` é fallback global.
 */
export async function listColdThresholds(workspaceId: string): Promise<ColdThresholdUI[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.coldLeadThreshold.findMany({
      where: { workspaceId },
      orderBy: [{ stageId: { sort: 'asc', nulls: 'last' } }],
      include: {
        stage: { select: { name: true } },
      },
    });

    return rows.map<ColdThresholdUI>((row) => ({
      id: row.id,
      stageId: row.stageId,
      stageName: row.stage?.name ?? null,
      daysInactive: row.daysInactive,
      enabled: row.enabled,
    }));
  });
}

// ============================================================================
// Cold alerts — count, list, get-by-lead
// ============================================================================

/**
 * Conta cold alerts ativos (não-acknowledged) visíveis pro caller, conforme
 * RBAC fino. Usado pra badge sidebar `/leads`.
 */
export async function countActiveColdAlerts(
  workspaceId: string,
  userId: string,
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer',
): Promise<number> {
  return withWorkspace(workspaceId, async (tx) => {
    return tx.coldLeadAlert.count({
      where: ackColdAlertWhereForRole(workspaceId, userId, role),
    });
  });
}

/**
 * Lista cold alerts ativos visíveis pro caller, com nome do lead/etapa
 * resolvido via JOIN. Ordenado `triggered_at DESC` (mais recente primeiro).
 *
 * Usado pelo NotificationsButton drawer. Limit default 30 (mesma janela que
 * o drawer já usa pra fixtures).
 */
export async function listActiveColdAlerts(
  workspaceId: string,
  userId: string,
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer',
  opts: { limit?: number } = {},
): Promise<ColdAlertUI[]> {
  const limit = opts.limit ?? 30;
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.coldLeadAlert.findMany({
      where: ackColdAlertWhereForRole(workspaceId, userId, role),
      orderBy: { triggeredAt: 'desc' },
      take: limit,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            lastInteractionAt: true,
            stage: { select: { id: true, name: true } },
          },
        },
        threshold: { select: { daysInactive: true } },
      },
    });

    return rows.map<ColdAlertUI>((row) => ({
      id: row.id,
      leadId: row.leadId,
      leadName: row.lead.name,
      stageId: row.lead.stage.id,
      stageName: row.lead.stage.name,
      daysInactive: row.threshold.daysInactive,
      triggeredAt: row.triggeredAt.toISOString(),
      lastInteractionAt: row.lead.lastInteractionAt?.toISOString() ?? null,
    }));
  });
}

/**
 * Retorna o cold alert ativo de UM lead específico (se houver), respeitando
 * RBAC fino. Usado pelo banner no `/leads/[id]`. Retorna `null` quando o lead
 * não tem alert pendente OU quando Vendedor pede de um lead que não é dele
 * (defesa-em-profundidade — UI já não mostra o link, mas alguém pode forçar
 * URL).
 */
export async function getActiveColdAlertForLead(
  workspaceId: string,
  leadId: string,
  userId: string,
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer',
): Promise<ColdAlertUI | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const baseWhere = ackColdAlertWhereForRole(workspaceId, userId, role);
    const row = await tx.coldLeadAlert.findFirst({
      where: { ...baseWhere, leadId },
      orderBy: { triggeredAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            lastInteractionAt: true,
            stage: { select: { id: true, name: true } },
          },
        },
        threshold: { select: { daysInactive: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      leadId: row.leadId,
      leadName: row.lead.name,
      stageId: row.lead.stage.id,
      stageName: row.lead.stage.name,
      daysInactive: row.threshold.daysInactive,
      triggeredAt: row.triggeredAt.toISOString(),
      lastInteractionAt: row.lead.lastInteractionAt?.toISOString() ?? null,
    };
  });
}
