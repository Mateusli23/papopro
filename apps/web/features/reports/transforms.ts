/**
 * Transformações puras de Relatórios.
 *
 * Filosofia idêntica a `features/dashboard/transforms.ts`: funções puras
 * (sem React, sem side-effects) que recebem arrays de domínio e devolvem
 * estruturas derivadas. Validáveis isoladamente via smoke endpoint.
 *
 * Reusa o que já existe:
 *  - `aggregateByStage`, `sumOpenPipelineCents` de `features/deals/transforms`
 *  - `calcRotState` de `features/leads/rotting`
 *  - `DEFAULT_STAGES`, `getStageName`, `getStage` de `lib/fixtures/pipelines`
 *  - `SALES_REPS`, `getRep` de `lib/fixtures/sales-reps`
 *
 * Em M8 cada função vira core de uma Server Action `getReports()` que faz
 * queries equivalentes em Postgres. O contrato dos tipos permanece.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';

import { sumOpenPipelineCents } from '@/features/deals/transforms';
import type { Deal } from '@/features/deals/types';
import { calcRotState } from '@/features/leads/rotting';
import type { Lead } from '@/features/leads/types';
import { DEFAULT_STAGES, getStage, getStageName } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import type {
  ConversionFunnelDatum,
  CoolingLead,
  ReportsKpis,
  RepPerformance,
  StageAvgTime,
} from './types';

/**
 * Cores por etapa pra usar no `<Bar fill>` do Recharts. Inclui terminais
 * (Ganho/Perdido) porque o funil de conversão de Relatórios mostra todas
 * as 6 — diferente do FunnelChart do dashboard que só vai até Negociação.
 */
const STAGE_FILL: Record<string, string> = {
  novo: 'hsl(var(--info))',
  em_contato: 'hsl(var(--primary))',
  proposta: 'hsl(var(--accent))',
  negociacao: 'hsl(var(--warning))',
  ganho: 'hsl(var(--success))',
  perdido: 'hsl(var(--destructive))',
};

/**
 * Janela fixa de "agora" — mesma de `features/dashboard/transforms.ts`
 * pra que os números batam entre as duas telas. Fixtures foram seedadas
 * em torno de 2026-05-09.
 */
const NOW = new Date('2026-05-09T14:00:00-03:00');

// ─── 1. KPIs ──────────────────────────────────────────────────────────────

export function computeReportsKpis(leads: Lead[], deals: Deal[], now: Date = NOW): ReportsKpis {
  const closedInLastN = (d: Deal, days: number) =>
    !!d.closedAt && differenceInCalendarDays(now, parseISO(d.closedAt)) <= days;

  const wonLast30d = deals.filter((d) => d.status === 'won' && closedInLastN(d, 30)).length;
  const lostLast30d = deals.filter((d) => d.status === 'lost' && closedInLastN(d, 30)).length;
  const closedLast30d = wonLast30d + lostLast30d;

  // Ciclo médio: deals fechados nos últimos 90d (won OU lost), média de
  // dias entre createdAt e closedAt. Janela de 90d é maior que conversão
  // (30d) pra ter base estatística melhor, evitando volatilidade.
  const closedLast90d = deals.filter((d) => d.closedAt && closedInLastN(d, 90));
  const avgCycleDays =
    closedLast90d.length === 0
      ? 0
      : Math.round(
          closedLast90d.reduce(
            (acc, d) =>
              acc + differenceInCalendarDays(parseISO(d.closedAt!), parseISO(d.createdAt)),
            0,
          ) / closedLast90d.length,
        );

  const newLeadsLast7d = leads.filter(
    (l) => differenceInCalendarDays(now, parseISO(l.createdAt)) <= 7,
  ).length;

  return {
    totalLeads: leads.length,
    openPipelineCents: sumOpenPipelineCents(deals),
    conversionRatePct: closedLast30d === 0 ? 0 : Math.round((wonLast30d / closedLast30d) * 100),
    avgCycleDays,
    newLeadsLast7d,
    openDealsCount: deals.filter((d) => d.status === 'open').length,
    closedLast30d,
    wonLast30d,
  };
}

// ─── 2. Funil de conversão ────────────────────────────────────────────────

/**
 * Ordem do pipeline default — define a noção de "passou pela etapa" usada
 * no cálculo acumulado. Tomamos do `DEFAULT_STAGES` ordenado por `.order`.
 */
const STAGE_ORDER: string[] = [...DEFAULT_STAGES]
  .sort((a, b) => a.order - b.order)
  .map((s) => s.id);

function stageIndex(id: string): number {
  return STAGE_ORDER.indexOf(id);
}

export function buildConversionFunnel(deals: Deal[]): ConversionFunnelDatum[] {
  // Pra cada etapa, conta deals que estão NELA, OU em etapas posteriores
  // do funil, OU em estado terminal (won/lost passaram por todas).
  const cumulativeByStage = new Map<string, number>();
  const totalCentsByStage = new Map<string, number>();

  for (const d of deals) {
    // Soma de valor é só dos deals atualmente na etapa (não acumulado),
    // pra mostrar "valor parado aqui agora".
    totalCentsByStage.set(d.stageId, (totalCentsByStage.get(d.stageId) ?? 0) + d.valueCents);
  }

  for (const stage of STAGE_ORDER) {
    const idx = stageIndex(stage);
    const cumulative = deals.filter((d) => {
      // Terminais (Ganho/Perdido) — passaram por todas as etapas ativas
      // até o ponto de fechamento. Conservadoramente, só incluímos no
      // cumulativo da própria etapa terminal e não nas anteriores —
      // senão lost inflaria injustamente as etapas iniciais.
      // Exceção: pra etapas ativas, won conta porque obviamente passou.
      const isTerminal = d.status === 'won' || d.status === 'lost';
      const stageObj = getStage(stage);
      const isStageTerminal = stageObj?.terminal ?? false;

      if (isTerminal) {
        if (isStageTerminal) {
          return d.stageId === stage; // só conta no próprio bucket terminal
        }
        // Pra etapas ativas, won acumula (passou de fato);
        // lost também (chegou até alguma etapa antes de perder).
        return true;
      }
      // Deal aberto: conta pra etapas <= sua posição atual
      return stageIndex(d.stageId) >= idx;
    }).length;

    cumulativeByStage.set(stage, cumulative);
  }

  return STAGE_ORDER.map((stageId, i) => {
    const next = STAGE_ORDER[i + 1];
    const stageObj = getStage(stageId);
    const cumulative = cumulativeByStage.get(stageId) ?? 0;
    const nextCumulative = next ? (cumulativeByStage.get(next) ?? 0) : 0;
    // Taxa de avanço só faz sentido entre etapas ativas (Novo → ... → Negociação).
    // Da Negociação pra Ganho/Perdido a "taxa" é mais "taxa de fechamento" —
    // pra simplificar, calculamos só pra etapas ativas com próxima também ativa.
    const isLastActive = stageObj?.terminal || (next && getStage(next)?.terminal);
    const advanceRatePct =
      !next || isLastActive || cumulative === 0
        ? null
        : Math.round((nextCumulative / cumulative) * 100);

    return {
      stageId,
      name: getStageName(stageId),
      cumulative,
      totalCents: totalCentsByStage.get(stageId) ?? 0,
      advanceRatePct,
      fill: STAGE_FILL[stageId] ?? 'hsl(var(--muted-foreground))',
    };
  });
}

// ─── 3. Performance por vendedor ──────────────────────────────────────────

export function computeRepPerformance(deals: Deal[], now: Date = NOW): RepPerformance[] {
  const closedInLast30 = (d: Deal) =>
    !!d.closedAt && differenceInCalendarDays(now, parseISO(d.closedAt)) <= 30;

  return SALES_REPS.map((rep) => {
    const repDeals = deals.filter((d) => d.ownerId === rep.id);
    const wonLast30dDeals = repDeals.filter((d) => d.status === 'won' && closedInLast30(d));
    const lostLast30dCount = repDeals.filter(
      (d) => d.status === 'lost' && closedInLast30(d),
    ).length;
    const closed = wonLast30dDeals.length + lostLast30dCount;

    return {
      repId: rep.id,
      repName: rep.name,
      initials: rep.initials,
      accent: rep.accent,
      activeDeals: repDeals.filter((d) => d.status === 'open').length,
      wonLast30d: wonLast30dDeals.length,
      wonValueCents: wonLast30dDeals.reduce((acc, d) => acc + d.valueCents, 0),
      conversionRatePct: closed === 0 ? 0 : Math.round((wonLast30dDeals.length / closed) * 100),
    };
  }).sort((a, b) => {
    // Ordena por valor ganho desc; reps zerados vão pro fim.
    if (a.wonValueCents === 0 && b.wonValueCents === 0) {
      return b.activeDeals - a.activeDeals; // tiebreak por ativos
    }
    return b.wonValueCents - a.wonValueCents;
  });
}

// ─── 4. Tempo médio por etapa ─────────────────────────────────────────────

/**
 * Status semáforo baseado em `avgDays` vs `rotDays`:
 *  - `avgDays === 0` (etapa vazia) → `healthy` defensivo
 *  - `<= rotDays/2` → `healthy` (verde)
 *  - `<= rotDays` → `warning` (amarelo)
 *  - `> rotDays` → `critical` (vermelho)
 */
function timeStatus(avgDays: number, rotDays: number): StageAvgTime['status'] {
  if (avgDays === 0) return 'healthy';
  const half = rotDays / 2;
  if (avgDays <= half) return 'healthy';
  if (avgDays <= rotDays) return 'warning';
  return 'critical';
}

export function computeStageAvgTime(deals: Deal[], now: Date = NOW): StageAvgTime[] {
  const activeStages = DEFAULT_STAGES.filter((s) => !s.terminal);

  return activeStages.map((stage) => {
    const stageDeals = deals.filter((d) => d.status === 'open' && d.stageId === stage.id);
    const avgDays =
      stageDeals.length === 0
        ? 0
        : Math.round(
            stageDeals.reduce(
              (acc, d) => acc + differenceInCalendarDays(now, parseISO(d.createdAt)),
              0,
            ) / stageDeals.length,
          );

    return {
      stageId: stage.id,
      name: stage.name,
      avgDays,
      rotDays: stage.rotDays,
      status: timeStatus(avgDays, stage.rotDays),
      count: stageDeals.length,
    };
  });
}

// ─── 5. Leads esfriando ───────────────────────────────────────────────────

export function getCoolingLeads(leads: Lead[], limit: number = 6, now: Date = NOW): CoolingLead[] {
  const cooling: CoolingLead[] = [];

  for (const lead of leads) {
    const rotState = calcRotState(lead);
    if (rotState !== 'warning' && rotState !== 'rotten') continue;

    const daysSinceLastInteraction = lead.lastInteractionAt
      ? differenceInCalendarDays(now, parseISO(lead.lastInteractionAt))
      : 999; // sem interação registrada → tratar como muito tempo

    cooling.push({
      lead,
      daysSinceLastInteraction,
      rotState,
      stageName: getStageName(lead.stageId),
    });
  }

  // Mais críticos primeiro: rotten antes de warning, depois mais dias parado.
  return cooling
    .sort((a, b) => {
      if (a.rotState !== b.rotState) {
        return a.rotState === 'rotten' ? -1 : 1;
      }
      return b.daysSinceLastInteraction - a.daysSinceLastInteraction;
    })
    .slice(0, limit);
}
