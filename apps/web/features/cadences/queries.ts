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
import { computeResponseRate } from './reports.helpers';
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

// ============================================================================
// Reports — agregações cross-cadência (M10#5)
// ============================================================================

/** Tom semântico da etapa — espelho do enum SQL `stage_tone`. */
export type StageTone = 'default' | 'success' | 'destructive';

/** KPI strip do bloco "Cadências" em `/reports`. Janela fixa de 30 dias. */
export interface CadenceReportsSummary {
  activeCadencesCount: number;
  activeEnrollmentsCount: number;
  dispatched30d: number;
  /** Intervalo [0,1] — formate com `formatRate` antes de exibir. */
  responseRate30d: number;
}

/** Linha da tabela "Performance por cadência" em `/reports`. */
export interface CadenceReportRow {
  id: string;
  name: string;
  status: 'active' | 'paused';
  stageId: string;
  stageName: string;
  stageTone: StageTone;
  activeEnrollments: number;
  dispatched30d: number;
  /** Intervalo [0,1]. */
  responseRate30d: number;
  /** Step runs `skipped` por rate_limit/unhealthy/outside_business_hours nos últimos 30d. */
  skippedAntiBan30d: number;
}

/** Linha do BarChart "Leads frios por etapa" em `/reports`. */
export interface ColdByStageRow {
  stageId: string;
  stageName: string;
  stageTone: StageTone;
  stageOrder: number;
  coldCount: number;
}

/**
 * 4 KPIs agregados do motor de cadência no workspace. 1 round-trip via
 * subqueries escalares (não há JOIN — cada subquery toca 1 tabela).
 *
 * **Janela de 30d** baseada em `executed_at` (step_runs), `enrolled_at` /
 * `updated_at` (enrollments). Cadências/inscrições "ativas" são instantâneas
 * (sem janela). `responseRate30d` cai pra 0 quando não houve enrollment no
 * período (evita `NaN`).
 */
export async function getCadenceReportsSummary(
  workspaceId: string,
): Promise<CadenceReportsSummary> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        active_cadences: bigint;
        active_enrollments: bigint;
        dispatched_30d: bigint;
        replied_30d: bigint;
        enrolled_30d: bigint;
      }>
    >`
      SELECT
        (SELECT COUNT(*) FROM public.cadences
          WHERE workspace_id = ${workspaceId}::uuid AND status = 'active')::bigint AS active_cadences,
        (SELECT COUNT(*) FROM public.cadence_enrollments
          WHERE workspace_id = ${workspaceId}::uuid AND status = 'active')::bigint AS active_enrollments,
        (SELECT COUNT(*) FROM public.cadence_step_runs
          WHERE workspace_id = ${workspaceId}::uuid
            AND status = 'sent'
            AND executed_at >= NOW() - INTERVAL '30 days')::bigint AS dispatched_30d,
        (SELECT COUNT(*) FILTER (
            WHERE paused_reason = 'lead_replied'
              AND updated_at >= NOW() - INTERVAL '30 days')
          FROM public.cadence_enrollments
          WHERE workspace_id = ${workspaceId}::uuid)::bigint AS replied_30d,
        (SELECT COUNT(*) FILTER (WHERE enrolled_at >= NOW() - INTERVAL '30 days')
          FROM public.cadence_enrollments
          WHERE workspace_id = ${workspaceId}::uuid)::bigint AS enrolled_30d
    `;
    const r = rows[0];
    if (!r) {
      return {
        activeCadencesCount: 0,
        activeEnrollmentsCount: 0,
        dispatched30d: 0,
        responseRate30d: 0,
      };
    }
    return {
      activeCadencesCount: Number(r.active_cadences),
      activeEnrollmentsCount: Number(r.active_enrollments),
      dispatched30d: Number(r.dispatched_30d),
      responseRate30d: computeResponseRate(Number(r.replied_30d), Number(r.enrolled_30d)),
    };
  });
}

/**
 * Lista por cadência (cross-cadência agregado) com métricas dos últimos 30
 * dias. LATERAL JOIN evita multiplicação de linhas com cadence_step_runs.
 *
 * Cadências `archived` ficam de fora (mesma regra de `listCadences`). Ordem:
 * `dispatched_30d DESC, name ASC` — quem disparou mais aparece no topo.
 */
export async function listCadenceReportsByCadence(
  workspaceId: string,
): Promise<CadenceReportRow[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        name: string;
        status: string;
        stage_id: string;
        stage_name: string;
        stage_tone: string;
        active_enrollments: bigint;
        replied_30d: bigint;
        enrolled_30d: bigint;
        dispatched_30d: bigint;
        skipped_anti_ban_30d: bigint;
      }>
    >`
      SELECT
        c.id::text                            AS id,
        c.name                                AS name,
        c.status::text                        AS status,
        c.stage_id::text                      AS stage_id,
        COALESCE(s.name, 'Sem etapa')         AS stage_name,
        COALESCE(s.tone::text, 'default')     AS stage_tone,
        COALESCE(e.active_enrollments, 0)::bigint    AS active_enrollments,
        COALESCE(e.replied_30d, 0)::bigint           AS replied_30d,
        COALESCE(e.enrolled_30d, 0)::bigint          AS enrolled_30d,
        COALESCE(r.dispatched_30d, 0)::bigint        AS dispatched_30d,
        COALESCE(r.skipped_anti_ban_30d, 0)::bigint  AS skipped_anti_ban_30d
      FROM public.cadences c
      LEFT JOIN public.pipeline_stages s ON s.id = c.stage_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')                                            AS active_enrollments,
          COUNT(*) FILTER (WHERE paused_reason = 'lead_replied'
                              AND updated_at >= NOW() - INTERVAL '30 days')                  AS replied_30d,
          COUNT(*) FILTER (WHERE enrolled_at >= NOW() - INTERVAL '30 days')                  AS enrolled_30d
        FROM public.cadence_enrollments
        WHERE workspace_id = ${workspaceId}::uuid AND cadence_id = c.id
      ) e ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE sr.status = 'sent'
                              AND sr.executed_at >= NOW() - INTERVAL '30 days')              AS dispatched_30d,
          COUNT(*) FILTER (WHERE sr.status = 'skipped'
                              AND sr.skip_reason IN ('rate_limit','unhealthy','outside_business_hours')
                              AND sr.executed_at >= NOW() - INTERVAL '30 days')              AS skipped_anti_ban_30d
        FROM public.cadence_step_runs sr
        WHERE sr.workspace_id = ${workspaceId}::uuid
          AND sr.enrollment_id IN (
            SELECT id FROM public.cadence_enrollments
            WHERE workspace_id = ${workspaceId}::uuid AND cadence_id = c.id
          )
      ) r ON TRUE
      WHERE c.workspace_id = ${workspaceId}::uuid
        AND c.status <> 'archived'
      ORDER BY dispatched_30d DESC, c.name ASC
    `;

    return rows.map<CadenceReportRow>((row) => {
      const replied = Number(row.replied_30d);
      const enrolled = Number(row.enrolled_30d);
      const status: 'active' | 'paused' = row.status === 'active' ? 'active' : 'paused';
      const tone = (['default', 'success', 'destructive'] as const).includes(
        row.stage_tone as StageTone,
      )
        ? (row.stage_tone as StageTone)
        : 'default';
      return {
        id: row.id,
        name: row.name,
        status,
        stageId: row.stage_id,
        stageName: row.stage_name,
        stageTone: tone,
        activeEnrollments: Number(row.active_enrollments),
        dispatched30d: Number(row.dispatched_30d),
        responseRate30d: computeResponseRate(replied, enrolled),
        skippedAntiBan30d: Number(row.skipped_anti_ban_30d),
      };
    });
  });
}

/**
 * Conta cold alerts ativos (não-acknowledged) agrupados por etapa do funil
 * default do workspace. Aplica RBAC fino: Vendedor só vê alerts dos próprios
 * leads (reusa `ackColdAlertWhereForRole`).
 *
 * Sempre retorna 1 linha por etapa ativa (não-terminal), inclusive zeradas
 * — o filtro de `coldCount === 0` fica no transform `filterColdRowsForChart`
 * pra a UI decidir entre "render bar" e "EmptyState".
 */
export async function listColdAlertsByStage(
  workspaceId: string,
  userId: string,
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer',
): Promise<ColdByStageRow[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const baseWhere = ackColdAlertWhereForRole(workspaceId, userId, role);

    const [alerts, stages] = await Promise.all([
      tx.coldLeadAlert.findMany({
        where: baseWhere,
        select: { lead: { select: { stageId: true } } },
      }),
      tx.pipelineStage.findMany({
        where: { pipeline: { workspaceId, isDefault: true }, terminal: false },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, tone: true, order: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const a of alerts) {
      const sid = a.lead.stageId;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }

    return stages.map<ColdByStageRow>((s) => ({
      stageId: s.id,
      stageName: s.name,
      stageTone: s.tone as StageTone,
      stageOrder: s.order,
      coldCount: counts.get(s.id) ?? 0,
    }));
  });
}
