/**
 * Transformações puras do Dashboard.
 *
 * Toda função aqui é **pura**: recebe arrays + opções, devolve estruturas
 * derivadas. Sem side-effects, sem React. Isso permite testar via smoke
 * endpoint (`/api/smoke-test/dashboard`) sem montar componentes.
 *
 * Reusamos `aggregateByStage` e `sumOpenPipelineCents` de
 * `features/deals/transforms` — fonte canônica das contas de pipeline.
 *
 * Em M8, essas funções viram core de uma Server Action `getDashboard()`
 * que persiste workspace_id no scope e usa os mesmos cálculos.
 */
import { differenceInCalendarDays, format as fmtDate, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { aggregateByStage, sumOpenPipelineCents } from '@/features/deals/transforms';
import type { Deal } from '@/features/deals/types';
import type { Lead } from '@/features/leads/types';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { formatCentsCompact } from '@/lib/utils/format';

import type { DashboardKpis, FunnelDatum, TrendDatum, UpcomingDeal } from './types';

/**
 * Mapa etapa → cor do trapézio do FunnelChart.
 *
 * Usamos `hsl(var(--token))` em vez de classes Tailwind porque o atributo
 * `fill` do `<Funnel>` (Recharts) aceita só CSS color string, não
 * className. Quando o usuário troca dark/light, a CSS var muda valor e o
 * SVG re-renderiza sem JS — espelha o comportamento das colunas do Kanban
 * que já usam os mesmos tokens via Tailwind classes (`bg-info`,
 * `bg-primary`, `bg-accent`, `bg-warning`).
 */
const STAGE_FILL: Record<string, string> = {
  novo: 'hsl(var(--info))',
  em_contato: 'hsl(var(--primary))',
  proposta: 'hsl(var(--accent))',
  negociacao: 'hsl(var(--warning))',
};

/**
 * Janela fixa de "agora" usada pra calcular taxa de conversão e KPIs
 * sensíveis a tempo. Mantemos congruente com `pipeline-stats.tsx` —
 * ambos usam a mesma data porque as fixtures foram seedadas em torno
 * desse momento.
 */
const NOW = new Date('2026-05-09T14:00:00-03:00');

/**
 * Calcula os 4 KPIs do header do dashboard + os hints derivados.
 *
 * **Definição de "Taxa de Conversão"**: dos deals **fechados nos últimos
 * 30 dias** (won + lost), qual fração foi ganha. Reativo — quando o
 * usuário arrasta um card pra Ganho/Perdido o número muda. Comparável mês
 * a mês. Padrão HubSpot/Pipedrive. Caso `closedLast30d === 0`, retorna 0
 * (não NaN — defensivo contra workspaces vazios).
 */
export function computeDashboardKpis(leads: Lead[], deals: Deal[], now: Date = NOW): DashboardKpis {
  const closedInLast30 = (d: Deal) =>
    !!d.closedAt && differenceInCalendarDays(now, parseISO(d.closedAt)) <= 30;

  const wonLast30d = deals.filter((d) => d.status === 'won' && closedInLast30(d)).length;
  const lostLast30d = deals.filter((d) => d.status === 'lost' && closedInLast30(d)).length;
  const closedLast30d = wonLast30d + lostLast30d;

  return {
    totalLeads: leads.length,
    openDealsCount: deals.filter((d) => d.status === 'open').length,
    openPipelineCents: sumOpenPipelineCents(deals),
    conversionRatePct: closedLast30d === 0 ? 0 : Math.round((wonLast30d / closedLast30d) * 100),
    hotLeadsCount: leads.filter((l) => l.temperature === 'hot').length,
    closedLast30d,
    wonLast30d,
    lostLast30d,
  };
}

/**
 * Gera os dados do FunnelChart Recharts.
 *
 * Inclui apenas as **4 etapas ativas** (Novo → Negociação) — Ganho e
 * Perdido são *resultados* do funil, não etapas dele. Essa info já vive
 * no KPI #4 ("Taxa de conversão"), repetir aqui polui visualmente.
 *
 * Recharts requer ordem decrescente de `value` — quem tiver mais deals
 * fica no topo (trapézio mais largo). Sortamos defensivamente mesmo
 * sabendo que o pipeline real costuma ter Novo > Em contato > Proposta
 * > Negociação (lei do funil).
 */
export function buildFunnelData(deals: Deal[]): FunnelDatum[] {
  const stageIds = ACTIVE_STAGES.map((s) => s.id);
  const aggs = aggregateByStage(
    deals.filter((d) => d.status === 'open'),
    stageIds,
  );
  return ACTIVE_STAGES.map((stage) => {
    const agg = aggs.find((a) => a.stageId === stage.id) ?? {
      stageId: stage.id,
      count: 0,
      totalCents: 0,
    };
    return {
      stageId: stage.id,
      name: stage.name,
      value: agg.count,
      totalCents: agg.totalCents,
      fill: STAGE_FILL[stage.id] ?? 'hsl(var(--muted-foreground))',
      labelRight: `${agg.count} · ${formatCentsCompact(agg.totalCents)}`,
      // Label central só se a fatia for grande o suficiente — etapas com
      // 0 deals não merecem texto (o trapézio nem aparece).
      labelCenter: agg.count > 0 ? stage.name : '',
    };
  }).sort((a, b) => b.value - a.value);
}

/**
 * Top N deals abertos com prazo, ordenados por `dueAt` ascendente.
 *
 * **Por que sem split entre "atrasados primeiro" e "futuros depois"**:
 * datas ISO ordenam cronologicamente sozinhas — datas no passado
 * (atrasados) ficam acima das futuras naturalmente. O `<DueDatePill>`
 * comunica visualmente o estado (overdue/today/soon/future) — o vendedor
 * varre a lista de cima pra baixo na ordem natural de urgência.
 *
 * Deals sem `dueAt` são excluídos — sem prazo, não fazem sentido nessa
 * tela ("o que precisa do seu olhar agora").
 */
export function getUpcomingDeals(deals: Deal[], leads: Lead[], limit: number = 8): UpcomingDeal[] {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  return deals
    .filter((d) => d.status === 'open' && d.dueAt)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, limit)
    .map((deal) => ({ deal, lead: leadById.get(deal.leadId) }));
}

/**
 * Série temporal dos últimos N dias (default 30) com count de deals
 * **criados** vs **ganhos** por dia. Alimenta o `<TrendChart>` (Recharts
 * LineChart) — vendedor lê de relance se a entrada e o fechamento estão
 * acompanhando.
 *
 * Decisões:
 *  - **Inclui hoje**: janela `[now - (days-1), now]`. 30 pontos pra 30 dias.
 *  - **Dias sem atividade**: aparecem com `created: 0, won: 0` (linha
 *    encosta no eixo X) — não pula buracos, senão a leitura mente.
 *  - **Lost não entra**: o gráfico mostra "saúde positiva" (entrada + ganho).
 *    Lost já está no KPI #4 (Taxa de conversão). Adicionar 3ª linha polui.
 *  - **Chave de agrupamento**: `yyyy-MM-dd` em UTC (consistente com
 *    `format(date, 'yyyy-MM-dd')`). Pra fixtures + Postgres em M8 vai
 *    precisar normalizar pra timezone do workspace.
 */
export function buildTrendData(deals: Deal[], now: Date = NOW, days: number = 30): TrendDatum[] {
  // Pré-computa contagens por dia em maps (1 pass por created, 1 pass por won)
  const createdByDay = new Map<string, number>();
  const wonByDay = new Map<string, number>();

  for (const d of deals) {
    const ck = fmtDate(parseISO(d.createdAt), 'yyyy-MM-dd');
    createdByDay.set(ck, (createdByDay.get(ck) ?? 0) + 1);

    if (d.status === 'won' && d.closedAt) {
      const wk = fmtDate(parseISO(d.closedAt), 'yyyy-MM-dd');
      wonByDay.set(wk, (wonByDay.get(wk) ?? 0) + 1);
    }
  }

  // Gera os últimos N dias em ordem cronológica (mais antigo → hoje).
  // Inclui dias zerados pra linha não pular buracos.
  const out: TrendDatum[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = subDays(now, i);
    const date = fmtDate(dt, 'yyyy-MM-dd');
    out.push({
      date,
      label: fmtDate(dt, 'dd MMM', { locale: ptBR }),
      created: createdByDay.get(date) ?? 0,
      won: wonByDay.get(date) ?? 0,
    });
  }
  return out;
}
