/**
 * Tipos do domínio Reports (Relatórios).
 *
 * Diferente do `features/dashboard/`, que mostra "o que está acontecendo
 * agora" (KPIs de momento + prazos urgentes + atividade), Reports é
 * **analytics**: como o time vem performando ao longo do tempo, taxas de
 * conversão entre etapas, leaderboard de vendedores, leads esfriando.
 *
 * Em M8 vira contrato de uma Server Action `getReports({ period, repId })`
 * — os tipos abaixo permanecem (transforms migram pra queries Postgres).
 */
import type { RotState } from '@/features/leads/rotting';
import type { Lead } from '@/features/leads/types';

/**
 * Os 4 KPIs do topo de Relatórios. Diferente do dashboard, foco em
 * tempo/performance:
 *  - Total de leads (no workspace)
 *  - Pipeline aberto (R$)
 *  - Taxa de conversão dos últimos 30 dias
 *  - Ciclo médio: dias entre `createdAt` e `closedAt` dos deals fechados
 *    nos últimos 90 dias
 */
export interface ReportsKpis {
  totalLeads: number;
  openPipelineCents: number;
  /** `won_30d / (won_30d + lost_30d)` × 100. 0 se nada fechado. */
  conversionRatePct: number;
  /**
   * Média de dias entre `createdAt` e `closedAt` dos deals fechados nos
   * últimos 90d (qualquer status terminal). 0 se nenhum deal fechou.
   * É um proxy do "tempo de ciclo de vendas".
   */
  avgCycleDays: number;
  // ─── Hints derivados (mostrados embaixo do número) ──────────────────────
  /** Leads criados nos últimos 7 dias. */
  newLeadsLast7d: number;
  /** Conta de deals abertos. */
  openDealsCount: number;
  /** `wonLast30d + lostLast30d`. */
  closedLast30d: number;
  /** Deals com `status='won'` fechados nos últimos 30d. */
  wonLast30d: number;
}

/**
 * Linha do BarChart de funil de conversão. Diferente do FunnelChart
 * trapezoidal do dashboard (snapshot de abertos por etapa), o gráfico de
 * Relatórios mostra o **acumulado**: deals que estão na etapa OU que já
 * passaram por ela.
 *
 * Aproximação aceitável pra UI mockada — sem histórico real de
 * `stage_change` activities, assumimos:
 *  - Deals em etapa N passaram por etapas 1..N
 *  - Deals fechados (won/lost) passaram por todas
 *
 * Em M8 com `activities.stage_change` no Postgres, o cálculo vira preciso
 * sem mudar a shape do tipo.
 */
export interface ConversionFunnelDatum {
  stageId: string;
  /** "Novo", "Em contato", ... */
  name: string;
  /** Deals que estão na etapa OU passaram por ela (acumulado). */
  cumulative: number;
  /** Soma de valor agregado dos deals atualmente na etapa (não acumulado). */
  totalCents: number;
  /**
   * Taxa de avanço pra próxima etapa do pipeline:
   * `cumulative_próxima / cumulative_atual × 100`. Última etapa = null.
   */
  advanceRatePct: number | null;
  /** CSS color string (`hsl(var(--token))`) consumido pelo `<Bar fill>`. */
  fill: string;
}

/**
 * Linha da tabela "Performance por vendedor". Calculada por `repId`.
 *
 * `accent` é mantido como string livre porque vem do `SalesRep.accent`
 * que tem união específica em `@papopro/ui` — relaxar a tipagem aqui
 * evita acoplar Reports ao type lá. RepAvatar lida com isso.
 */
export interface RepPerformance {
  repId: string;
  repName: string;
  initials: string;
  accent: string;
  /** Deals com `status='open'` atribuídos ao rep. */
  activeDeals: number;
  /** Deals do rep com `status='won'` fechados nos últimos 30d. */
  wonLast30d: number;
  /** Soma de valor dos `wonLast30d`. */
  wonValueCents: number;
  /** Taxa de fechamento do rep nos 30d. 0 se nada fechado. */
  conversionRatePct: number;
}

/**
 * Tempo médio (em dias) que deals atualmente abertos numa etapa estão
 * "parados" lá. Sem histórico real de transições, usamos `(NOW - createdAt)`
 * como proxy — é o tempo desde a criação do deal, não o tempo na etapa
 * atual. Documentado claramente no card pra não enganar.
 *
 * `status` semáforo:
 *  - `healthy`: avg <= rotDays/2
 *  - `warning`: avg > rotDays/2 mas <= rotDays
 *  - `critical`: avg > rotDays
 */
export interface StageAvgTime {
  stageId: string;
  name: string;
  /** Média em dias (arredondada). 0 se etapa vazia. */
  avgDays: number;
  /** Threshold da etapa do `pipelines.ts` (`rotDays`). */
  rotDays: number;
  status: 'healthy' | 'warning' | 'critical';
  /** Conta de deals abertos na etapa que entraram no cálculo. */
  count: number;
}

/**
 * Item do card "Leads esfriando". Reusa `calcRotState()` de
 * `features/leads/rotting.ts` pra classificar.
 */
export interface CoolingLead {
  lead: Lead;
  /** Dias desde `lastInteractionAt`. Se ausente, conta como "muito tempo". */
  daysSinceLastInteraction: number;
  rotState: Extract<RotState, 'warning' | 'rotten'>;
  stageName: string;
}
