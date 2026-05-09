'use client';

import * as React from 'react';

import { FAKE_DEALS } from '@/lib/fixtures/deals';

import type { DealCreateInput, DealUpdateInput } from './schemas';
import { applyCreateDeal, applyMoveDeal } from './transforms';
import type { Deal } from './types';

/**
 * Store in-memory client-side de Deals — mesmo padrão do
 * `features/leads/store.ts`. A lógica de transformação vive em
 * `transforms.ts` (puro, testável); este arquivo só gerencia
 * snapshot + listeners + ID counter.
 *
 * Em M8 cada mutação passa a ser Server Action que retorna o estado novo;
 * o `useDeals` migra pra TanStack Query (`useQuery`) sem mudar a API.
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
  const { deals, created } = applyCreateDeal(dealsState, input, nextId);
  dealsState = deals;
  emit();
  return created;
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
 * Move um deal pra outra etapa — wrapper sobre `applyMoveDeal`. Se o
 * resultado for `===` ao snapshot atual (no-op), não dispara emit.
 */
export function moveDealToStage(id: string, stageId: string): Deal | undefined {
  const next = applyMoveDeal(dealsState, id, stageId);
  if (next === dealsState) return undefined;
  dealsState = next;
  emit();
  return dealsState.find((d) => d.id === id);
}
