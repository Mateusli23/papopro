/**
 * Transformações puras do domínio Deal — separadas do `store.ts` pra
 * que possam ser testadas sem tocar no estado global do client store.
 *
 * Toda transformação aqui é **pura**: recebe `Deal[]` (e parâmetros), devolve
 * `Deal[]` ou agregação. Sem side-effects, sem dependências de React.
 *
 * O `store.ts` é um wrapper fino que aplica essas transformações ao
 * snapshot atual e dispara `emit()` pros listeners.
 *
 * Em M8 essas funções viram o "core" das Server Actions correspondentes
 * (`createDeal`, `moveDealStage`) — a única diferença é que a Server
 * Action persiste no Postgres em vez de mutar um array.
 */
import type { DealCreateInput } from './schemas';
import type { Deal, DealStatus } from './types';

// =============================================================================
// Prisma row → UI shape (M8#3 — server-fed kanban)
// =============================================================================

/**
 * Shape mínimo da Prisma `Deal` row (com `stage` + `lead` via include) que
 * `toDealUI` espera. Definido aqui pra desacoplar transforms de `@papopro/db`
 * em runtime — qualquer arquivo client/smoke pode usar sem puxar Prisma engine.
 *
 * `queries.ts:listDeals` faz exatamente esse include e o tipo bate.
 */
export interface PrismaDealRow {
  id: string;
  title: string;
  leadId: string;
  stageId: string;
  valueCents: number;
  ownerId: string;
  probability: number | null;
  dueAt: Date | null;
  description: string | null;
  status: DealStatus;
  lostReason: string | null;
  orderInStage: number;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Stage relation — `slug` alimenta `getStageStyle()`, `name` aparece em toasts. */
  stage: { slug: string; name: string };
  /** Lead relation — `name` no card, `company` no subtítulo. */
  lead: { id: string; name: string; company: string | null };
}

/**
 * Converte `Prisma.Deal` (com relações) na shape `Deal` que a UI consome
 * desde M4. Mantém shape estável e isola adaptação (Date → ISO, null →
 * undefined, denormaliza stage.slug e lead.name).
 */
export function toDealUI(row: PrismaDealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    leadId: row.leadId,
    stageId: row.stageId,
    stageSlug: row.stage.slug,
    valueCents: row.valueCents,
    ownerId: row.ownerId,
    probability: row.probability ?? undefined,
    dueAt: row.dueAt?.toISOString(),
    description: row.description ?? undefined,
    status: row.status,
    lostReason: row.lostReason ?? undefined,
    orderInStage: row.orderInStage,
    leadName: row.lead.name,
    leadCompany: row.lead.company ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString(),
  };
}

// =============================================================================
// Ordering helpers (M8#3 — drag-and-drop)
// =============================================================================

/** Espaçamento default entre vizinhos. Escolhido grande pra dar muito espaço
 * pra inserções midpoint sucessivas antes de precisar de rebalanceamento. */
export const ORDER_STEP = 1000;

/**
 * Calcula o `orderInStage` de um drop a partir dos vizinhos imediatos.
 *
 *  - Drop no início (só `after`): `after.orderInStage - ORDER_STEP`
 *  - Drop no final (só `before`): `before.orderInStage + ORDER_STEP`
 *  - Drop no meio: midpoint inteiro entre os dois (Math.floor)
 *  - Coluna vazia (ambos undefined): `0`
 *
 * **Colisão.** Quando o midpoint colapsa (ex: vizinhos com orders 5 e 6, midpoint
 * = 5), o caller decide rebalancear a coluna (UPDATE em batch espaçando
 * múltiplos de ORDER_STEP). Aqui só sinalizamos retornando o piso.
 */
export function computeOrderBetween(beforeOrder: number | null, afterOrder: number | null): number {
  if (beforeOrder === null && afterOrder === null) return 0;
  if (beforeOrder === null && afterOrder !== null) return afterOrder - ORDER_STEP;
  if (afterOrder === null && beforeOrder !== null) return beforeOrder + ORDER_STEP;
  // Ambos definidos — midpoint inteiro.
  return Math.floor(((beforeOrder ?? 0) + (afterOrder ?? 0)) / 2);
}

/** Probabilidade default por etapa — heurística simples, ajustada em M11. */
export function defaultProbabilityFor(stageId: string): number | undefined {
  switch (stageId) {
    case 'novo':
      return 10;
    case 'em_contato':
      return 25;
    case 'proposta':
      return 50;
    case 'negociacao':
      return 75;
    case 'ganho':
      return 100;
    case 'perdido':
      return 0;
    default:
      return undefined;
  }
}

export function statusForStage(stageId: string): DealStatus {
  if (stageId === 'ganho') return 'won';
  if (stageId === 'perdido') return 'lost';
  return 'open';
}

/**
 * Move um deal para outra etapa. Se for terminal (`ganho`/`perdido`),
 * marca `status` correspondente e `closedAt`. Se sair de uma terminal
 * pra ativa, status volta pra `open` e `closedAt` é limpo.
 *
 * Retorna o array novo (imutável). Se o deal não existir ou a etapa for
 * a mesma, retorna o array original (referência preservada — `===`).
 */
export function applyMoveDeal(
  deals: Deal[],
  dealId: string,
  stageId: string,
  now: string = new Date().toISOString(),
): Deal[] {
  const idx = deals.findIndex((d) => d.id === dealId);
  if (idx === -1) return deals;
  const current = deals[idx];
  if (!current || current.stageId === stageId) return deals;

  const isTerminal = stageId === 'ganho' || stageId === 'perdido';
  const next: Deal = {
    ...current,
    stageId,
    status: statusForStage(stageId),
    closedAt: isTerminal ? now : undefined,
    probability: defaultProbabilityFor(stageId),
    updatedAt: now,
  };
  return [...deals.slice(0, idx), next, ...deals.slice(idx + 1)];
}

/** Cria um novo deal. Retorna `[novosDeals, dealCriado]`. */
export function applyCreateDeal(
  deals: Deal[],
  input: DealCreateInput,
  idGen: () => string,
  now: string = new Date().toISOString(),
): { deals: Deal[]; created: Deal } {
  const created: Deal = {
    id: idGen(),
    title: input.title,
    leadId: input.leadId,
    stageId: input.stageId,
    valueCents: input.valueCents,
    ownerId: input.ownerId,
    dueAt: input.dueAt,
    description: input.description,
    status: statusForStage(input.stageId),
    probability: defaultProbabilityFor(input.stageId),
    createdAt: now,
    updatedAt: now,
  };
  return { deals: [created, ...deals], created };
}

// ─── Agregações (alimentam KPIs e header de coluna) ────────────────────────

export interface StageAggregate {
  stageId: string;
  count: number;
  totalCents: number;
}

/**
 * Conta + soma por etapa. Header de cada coluna do Kanban consome isso.
 *
 * Estável: mesmo input → mesmo output. Inclui etapas com 0 deals se
 * passadas em `stageIds`.
 */
export function aggregateByStage(deals: Deal[], stageIds?: string[]): StageAggregate[] {
  const map = new Map<string, StageAggregate>();
  if (stageIds) {
    for (const s of stageIds) map.set(s, { stageId: s, count: 0, totalCents: 0 });
  }
  for (const d of deals) {
    const agg = map.get(d.stageId) ?? { stageId: d.stageId, count: 0, totalCents: 0 };
    agg.count += 1;
    agg.totalCents += d.valueCents;
    map.set(d.stageId, agg);
  }
  return Array.from(map.values());
}

/** Soma total de deals abertos (KPI "Pipeline ativo"). */
export function sumOpenPipelineCents(deals: Deal[]): number {
  return deals.filter((d) => d.status === 'open').reduce((acc, d) => acc + d.valueCents, 0);
}
