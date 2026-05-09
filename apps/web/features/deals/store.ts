'use client';

import * as React from 'react';

import { FAKE_DEALS } from '@/lib/fixtures/deals';

import type { DealCreateInput, DealUpdateInput } from './schemas';
import type { Deal } from './types';

/**
 * Store in-memory client-side de Deals — espelho exato do padrão usado
 * em `features/leads/store.ts`. Mesma assinatura que vai virar Server
 * Action em M8: `createDeal`, `updateDeal`, `moveDealToStage`.
 *
 * Persistência: nenhuma. Recarregou a página, volta ao snapshot inicial.
 * Suficiente pra demo clicável de M4 e validação de UX.
 */

let dealsState: Deal[] = [...FAKE_DEALS];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return dealsState;
}

function getServerSnapshot() {
  return FAKE_DEALS;
}

export function useDeals(): Deal[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDeal(id: string): Deal | undefined {
  const all = useDeals();
  return React.useMemo(() => all.find((d) => d.id === id), [all, id]);
}

let counter = dealsState.length;
function nextId(): string {
  counter += 1;
  return `deal_${counter.toString().padStart(3, '0')}`;
}

export function createDeal(input: DealCreateInput): Deal {
  const now = new Date().toISOString();
  const deal: Deal = {
    id: nextId(),
    title: input.title,
    leadId: input.leadId,
    stageId: input.stageId,
    valueCents: input.valueCents,
    ownerId: input.ownerId,
    dueAt: input.dueAt,
    description: input.description,
    status: input.stageId === 'ganho' ? 'won' : input.stageId === 'perdido' ? 'lost' : 'open',
    probability: defaultProbabilityFor(input.stageId),
    createdAt: now,
    updatedAt: now,
  };
  dealsState = [deal, ...dealsState];
  emit();
  return deal;
}

export function updateDeal(id: string, patch: DealUpdateInput): Deal | undefined {
  let updated: Deal | undefined;
  dealsState = dealsState.map((d) => {
    if (d.id !== id) return d;
    const next: Deal = {
      ...d,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    updated = next;
    return next;
  });
  if (updated) emit();
  return updated;
}

/**
 * Move um deal pra outra etapa. Se for `ganho`/`perdido`, marca status
 * terminal e fecha (`closedAt`). Reabrir = mover pra etapa não-terminal,
 * que reseta o status pra `open`.
 */
export function moveDealToStage(id: string, stageId: string): Deal | undefined {
  let updated: Deal | undefined;
  const now = new Date().toISOString();
  dealsState = dealsState.map((d) => {
    if (d.id !== id) return d;
    const isTerminal = stageId === 'ganho' || stageId === 'perdido';
    const next: Deal = {
      ...d,
      stageId,
      status: stageId === 'ganho' ? 'won' : stageId === 'perdido' ? 'lost' : 'open',
      closedAt: isTerminal ? now : undefined,
      probability: defaultProbabilityFor(stageId),
      updatedAt: now,
    };
    updated = next;
    return next;
  });
  if (updated) emit();
  return updated;
}

function defaultProbabilityFor(stageId: string): number | undefined {
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
