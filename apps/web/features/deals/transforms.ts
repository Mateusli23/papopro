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
