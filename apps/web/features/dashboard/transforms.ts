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
import { format as fmtDate, isWithinInterval, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { sumOpenPipelineCents } from '@/features/deals/transforms';
import type { Deal } from '@/features/deals/types';
import type { Lead, LeadOrigin, Task } from '@/features/leads/types';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';

import { DASHBOARD_NOW } from './range';
import type {
  ActivityItem,
  DashboardKpis,
  HorizontalFunnelDatum,
  HotLead,
  KpiTrend,
  OriginBucket,
  OriginDatum,
  RangeBounds,
  TrendDatum,
  UpcomingDeal,
} from './types';

/**
 * Tailwind classes por etapa — pro `<FunnelHorizontalChart>` desenhar
 * barras com `<div>` ao invés de SVG. Tokens semânticos (`bg-info`,
 * `bg-success`) propagam dark/light automaticamente.
 */
const STAGE_BAR_CLASS: Record<string, string> = {
  novo: 'bg-info',
  em_contato: 'bg-primary',
  proposta: 'bg-accent',
  negociacao: 'bg-warning',
  ganho: 'bg-success',
  perdido: 'bg-destructive',
};

/**
 * Janela fixa de "agora" usada pra calcular taxa de conversão e KPIs
 * sensíveis a tempo. Mantemos congruente com `pipeline-stats.tsx` —
 * ambos usam a mesma data porque as fixtures foram seedadas em torno
 * desse momento. Re-exporta da `range.ts` pra um único ponto da verdade.
 */
const NOW = DASHBOARD_NOW;

// ─── Helper de trend ───────────────────────────────────────────────────────

/**
 * Calcula variação relativa `current` vs `previous`, mapeando pra `KpiTrend`.
 *
 * Regras (review M5#6 lessons learned):
 *  - `previous` undefined → `flat 0` (range='all' ou primeira execução).
 *  - `previous === 0 && current === 0` → `flat 0`.
 *  - `previous === 0 && current > 0` → `up 100` (cap em 100 evita Infinity).
 *  - `|pct| <= 1` → `flat 0` (variação irrelevante).
 *  - `pct > 1` → `up`, arredondado pra inteiro.
 *  - `pct < -1` → `down`, arredondado pra inteiro.
 */
export function computeTrend(current: number, previous: number | undefined): KpiTrend {
  if (previous === undefined) return { direction: 'flat', pct: 0 };
  if (previous === 0) {
    if (current === 0) return { direction: 'flat', pct: 0 };
    return { direction: 'up', pct: 100 };
  }
  const rawPct = ((current - previous) / Math.abs(previous)) * 100;
  const pct = Math.round(rawPct);
  if (pct > 1) return { direction: 'up', pct };
  if (pct < -1) return { direction: 'down', pct };
  return { direction: 'flat', pct: 0 };
}

// ─── Predicates de range ──────────────────────────────────────────────────

/**
 * `true` se o ISO datetime cai dentro do range (start–end inclusive).
 * Considera `range='all'` quando `previousStart` é undefined E o range
 * passado tem `start === new Date(0)` — nesse caso aceita tudo.
 */
function isInRange(iso: string | undefined, bounds: Pick<RangeBounds, 'start' | 'end'>): boolean {
  if (!iso) return false;
  const date = parseISO(iso);
  return isWithinInterval(date, { start: bounds.start, end: bounds.end });
}

// ─── KPIs (com filtro de range + trend) ───────────────────────────────────

/**
 * Calcula os 5 KPIs do header do dashboard + trends + métricas auxiliares.
 *
 * **Definição de "Taxa de Conversão"**: dos deals **fechados no range**
 * (won + lost com `closedAt` dentro de start–end), qual fração foi ganha.
 * Anteriormente fixa em 30d, agora respeita o filtro do usuário.
 *
 * **KPI #1 ("Leads novos")**: leads com `createdAt` no range.
 * **KPI #2 ("Tarefas pendentes")**: tasks com `status === 'pending'` (snapshot,
 * sem filtro de range — backlog atual sempre).
 * **KPI #3 ("Pipeline")**: snapshot atual (sem filtro de range — pipeline é
 * estado do momento, não acumulado).
 * **KPI #5 ("Propostas")**: soma de `valueCents` de deals abertos no estágio
 * `proposta`. Snapshot atual.
 *
 * Trends comparam o range corrente com a janela igual imediatamente
 * anterior (ver `range.ts`).
 */
export function computeDashboardKpis(
  leads: Lead[],
  deals: Deal[],
  tasks: Task[],
  bounds: RangeBounds,
): DashboardKpis {
  const inRangeCreated = (iso: string) => isInRange(iso, bounds);

  // KPIs principais
  const newLeadsCount = leads.filter((l) => inRangeCreated(l.createdAt)).length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;
  const openPipelineCents = sumOpenPipelineCents(deals);
  const proposalsCents = deals
    .filter((d) => d.status === 'open' && d.stageId === 'proposta')
    .reduce((sum, d) => sum + d.valueCents, 0);

  // Conversão no range
  const closedInRange = deals.filter(
    (d) => (d.status === 'won' || d.status === 'lost') && d.closedAt && inRangeCreated(d.closedAt),
  );
  const wonInRange = closedInRange.filter((d) => d.status === 'won').length;
  const lostInRange = closedInRange.filter((d) => d.status === 'lost').length;
  const conversionRatePct =
    closedInRange.length === 0 ? 0 : Math.round((wonInRange / closedInRange.length) * 100);

  // Período anterior (pra trend). Note que `proposals` ficou de fora —
  // é snapshot puro do pipeline atual, sem histórico de stage em M5,
  // então comparar com janela anterior é teatro (review M5p#2 CRÍTICO #1).
  // Em M8+ quando `deal.stageHistory[]` existir, o trend volta.
  let previousNewLeadsCount: number | undefined;
  let previousConversionRatePct: number | undefined;
  if (bounds.previousStart && bounds.previousEnd) {
    const prevBounds = { start: bounds.previousStart, end: bounds.previousEnd };
    previousNewLeadsCount = leads.filter((l) => isInRange(l.createdAt, prevBounds)).length;
    const prevClosed = deals.filter(
      (d) =>
        (d.status === 'won' || d.status === 'lost') &&
        d.closedAt &&
        isInRange(d.closedAt, prevBounds),
    );
    const prevWon = prevClosed.filter((d) => d.status === 'won').length;
    previousConversionRatePct =
      prevClosed.length === 0 ? 0 : Math.round((prevWon / prevClosed.length) * 100);
  }

  return {
    newLeadsCount,
    pendingTasksCount,
    openPipelineCents,
    conversionRatePct,
    proposalsCents,

    hotLeadsCount: leads.filter((l) => l.temperature === 'hot').length,
    openDealsCount: deals.filter((d) => d.status === 'open').length,
    closedInRange: closedInRange.length,
    wonInRange,
    lostInRange,

    newLeadsTrend: computeTrend(newLeadsCount, previousNewLeadsCount),
    conversionTrend: computeTrend(conversionRatePct, previousConversionRatePct),

    previousNewLeadsCount,
    previousConversionRatePct,
  };
}

// ─── Origem (donut) ───────────────────────────────────────────────────────

/**
 * Mapa LeadOrigin → bucket visual do donut. Mantido como const-record pra
 * a UI poder navegar de bucket → origens reais (deep-link `/leads?origin=`).
 */
const ORIGIN_BUCKETS: Record<OriginBucket, { label: string; fill: string; origins: LeadOrigin[] }> =
  {
    paid: {
      label: 'Patrocinado',
      fill: 'hsl(var(--accent))',
      origins: ['meta_ads', 'google_ads'],
    },
    whatsapp: {
      label: 'WhatsApp',
      fill: 'hsl(var(--success))',
      origins: ['whatsapp_inbound'],
    },
    referral: {
      label: 'Indicação',
      fill: 'hsl(var(--info))',
      origins: ['indicacao'],
    },
    site: {
      label: 'Site',
      fill: 'hsl(var(--primary))',
      origins: ['site'],
    },
    other: {
      label: 'Outro',
      fill: 'hsl(var(--muted-foreground))',
      origins: ['csv_import', 'manual', 'rd_station', 'hotmart'],
    },
  };

const BUCKET_OF_ORIGIN = new Map<LeadOrigin, OriginBucket>();
for (const [bucket, def] of Object.entries(ORIGIN_BUCKETS) as Array<
  [OriginBucket, (typeof ORIGIN_BUCKETS)[OriginBucket]]
>) {
  for (const origin of def.origins) {
    BUCKET_OF_ORIGIN.set(origin, bucket);
  }
}

/**
 * Agrupa leads por bucket de origem dentro do range.
 *
 * Sempre retorna os 5 buckets — mesmo zerados, pra que a legenda fique
 * estável (vendedor não vê fatias aparecendo/sumindo). O componente
 * `<OriginDonut>` esconde fatias com count 0 do gráfico, mas mostra na
 * legenda em cinza.
 *
 * Percentuais somam exatamente 100 (correção de arredondamento aplicada
 * no maior bucket — paridade com Pipedrive).
 */
export function buildOriginData(leads: Lead[], bounds: RangeBounds): OriginDatum[] {
  const filtered = leads.filter((l) => isInRange(l.createdAt, bounds));
  const total = filtered.length;

  const counts: Record<OriginBucket, number> = {
    paid: 0,
    whatsapp: 0,
    referral: 0,
    site: 0,
    other: 0,
  };
  for (const lead of filtered) {
    const bucket = BUCKET_OF_ORIGIN.get(lead.origin) ?? 'other';
    counts[bucket] += 1;
  }

  const data: OriginDatum[] = (Object.keys(ORIGIN_BUCKETS) as OriginBucket[]).map((bucket) => {
    const def = ORIGIN_BUCKETS[bucket];
    const count = counts[bucket];
    const pct = total === 0 ? 0 : Math.round((count / total) * 100);
    return {
      bucket,
      label: def.label,
      count,
      pct,
      fill: def.fill,
      origins: def.origins,
    };
  });

  // Correção de arredondamento — joga o resíduo no maior bucket pra somar 100.
  if (total > 0) {
    const sumPct = data.reduce((acc, d) => acc + d.pct, 0);
    const drift = 100 - sumPct;
    if (drift !== 0) {
      const maxIdx = data.reduce(
        (best, d, i) => (d.count > (data[best]?.count ?? 0) ? i : best),
        0,
      );
      const target = data[maxIdx];
      if (target) target.pct += drift;
    }
  }

  return data;
}

// ─── Funil horizontal ─────────────────────────────────────────────────────

/**
 * Funil horizontal com TODAS as etapas (incluindo terminais Ganho/Perdido),
 * em ordem natural do pipeline (Novo → Perdido).
 *
 * Diferenças vs `buildFunnelData` (Recharts trapezoidal, legado):
 *  - **Inclui etapas terminais** — leitura linear do funil exige ver onde
 *    entrou e onde saiu, em paralelo.
 *  - **Não ordena por count** — mantém ordem do pipeline. Recharts exigia
 *    desc, o componente HTML+CSS não.
 *  - **Conta deals abertos pra ativas, fechados pra terminais** — etapa
 *    Ganho conta `won`, etapa Perdido conta `lost`, etapas ativas contam
 *    `open`. Espelha a semântica do PRD: terminais não têm "abertos".
 */
export function buildHorizontalFunnelData(deals: Deal[]): HorizontalFunnelDatum[] {
  return DEFAULT_STAGES.map((stage) => {
    let count = 0;
    let totalCents = 0;
    if (stage.terminal) {
      const matchingStatus = stage.id === 'ganho' ? 'won' : 'lost';
      const matching = deals.filter((d) => d.status === matchingStatus);
      count = matching.length;
      totalCents = matching.reduce((sum, d) => sum + d.valueCents, 0);
    } else {
      const matching = deals.filter((d) => d.status === 'open' && d.stageId === stage.id);
      count = matching.length;
      totalCents = matching.reduce((sum, d) => sum + d.valueCents, 0);
    }
    return {
      stageId: stage.id,
      name: stage.name,
      count,
      totalCents,
      barClass: STAGE_BAR_CLASS[stage.id] ?? 'bg-muted-foreground',
      terminalTone: stage.tone,
    };
  });
}

// ─── Hot leads (alimenta banner) ──────────────────────────────────────────

/**
 * Lista de leads quentes — `temperature === 'hot'`, ordenados pelo `updatedAt`
 * mais recente (proxy do "toque" enquanto não temos `lastActivityAt` real
 * em M5). Usado pelo `<HotLeadsAlert>` — em M5 só `length` importa, mas o
 * shape já permite virar drawer no futuro.
 */
export function getHotLeads(leads: Lead[], limit: number = 10): HotLead[] {
  return leads
    .filter((l) => l.temperature === 'hot')
    .map((l) => ({
      id: l.id,
      name: l.name,
      lastTouchedAt: l.updatedAt ?? l.createdAt,
    }))
    .sort((a, b) => b.lastTouchedAt.localeCompare(a.lastTouchedAt))
    .slice(0, limit);
}

// ─── Tabela "Próximos do prazo" (sem mudança) ─────────────────────────────

/**
 * Top N deals abertos com prazo, ordenados por `dueAt` ascendente.
 *
 * Datas ISO ordenam cronologicamente sozinhas — datas no passado
 * (atrasados) ficam acima das futuras naturalmente. O `<DueDatePill>`
 * comunica visualmente o estado (overdue/today/soon/future) — o vendedor
 * varre a lista de cima pra baixo na ordem natural de urgência.
 */
export function getUpcomingDeals(deals: Deal[], leads: Lead[], limit: number = 8): UpcomingDeal[] {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  return deals
    .filter((d) => d.status === 'open' && d.dueAt)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, limit)
    .map((deal) => ({ deal, lead: leadById.get(deal.leadId) }));
}

// ─── Trend chart 30 dias (sem mudança) ────────────────────────────────────

/**
 * Série temporal dos últimos N dias (default 30) com count de deals
 * **criados** vs **ganhos** por dia. Alimenta o `<TrendChart>` — vendedor
 * lê de relance se a entrada e o fechamento estão acompanhando.
 *
 * Mantido com 30d fixos mesmo após a refatoração — é um insight temporal
 * complementar ao filtro de range, não substituível por ele.
 */
export function buildTrendData(deals: Deal[], now: Date = NOW, days: number = 30): TrendDatum[] {
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

// ─── Atividade recente (sem mudança) ──────────────────────────────────────

/**
 * Timeline derivada das fixtures de deals — top N eventos mais recentes
 * em ordem decrescente. Tipos suportados: `created`, `won`, `lost`.
 */
export function getRecentActivity(deals: Deal[], limit: number = 6): ActivityItem[] {
  const events: ActivityItem[] = [];

  for (const d of deals) {
    events.push({
      timestamp: d.createdAt,
      type: 'created',
      dealId: d.id,
      dealTitle: d.title,
      leadId: d.leadId,
      ownerId: d.ownerId,
    });

    if (d.closedAt && (d.status === 'won' || d.status === 'lost')) {
      events.push({
        timestamp: d.closedAt,
        type: d.status,
        dealId: d.id,
        dealTitle: d.title,
        leadId: d.leadId,
        ownerId: d.ownerId,
      });
    }
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}
