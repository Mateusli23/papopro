'use client';

import * as React from 'react';

import { temperatureFromLastInteraction, FAKE_LEADS } from '@/lib/fixtures/leads';

import type { LeadCreateInput, LeadUpdateInput } from './schemas';
import type { Lead } from './types';

/**
 * Store in-memory client-side dos leads — substitui a Server Action real
 * que vai entrar em M8. Por trás é um snapshot mutável + um set de listeners
 * que disparam re-render via `useSyncExternalStore` (princípio mais simples
 * possível, sem trazer Zustand pra um caso de fixture).
 *
 * Importante: como vive no client, qualquer mutação só persiste enquanto a
 * sessão não recarrega — recarregou, volta ao snapshot inicial. Suficiente
 * pra demo clicável, e o contrato (`createLead`, `updateLead`, `moveLead`)
 * casa exatamente com o que vamos expor em M8.
 */

let leadsState: Lead[] = [...FAKE_LEADS];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): Lead[] {
  return leadsState;
}

/** Snapshot estável SSR — evita warning do useSyncExternalStore. */
function getServerSnapshot(): Lead[] {
  return FAKE_LEADS;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useLeads(): Lead[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useLead(id: string): Lead | undefined {
  const all = useLeads();
  return React.useMemo(() => all.find((l) => l.id === id), [all, id]);
}

// ─── Mutations ─────────────────────────────────────────────────────────────

let createCounter = leadsState.length;
function nextLeadId(): string {
  createCounter += 1;
  return `lead_${createCounter.toString().padStart(3, '0')}`;
}

export function createLead(input: LeadCreateInput): Lead {
  const now = new Date().toISOString();
  const lead: Lead = {
    id: nextLeadId(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    company: input.company,
    position: input.position,
    origin: input.origin,
    status: 'ativo',
    stageId: input.stageId,
    assignedTo: input.assignedTo,
    temperature: 'cold',
    valueCents: input.valueCents,
    tags: input.tags,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  leadsState = [lead, ...leadsState];
  emit();
  return lead;
}

export function updateLead(id: string, patch: LeadUpdateInput): Lead | undefined {
  let updated: Lead | undefined;
  leadsState = leadsState.map((lead) => {
    if (lead.id !== id) return lead;
    const next: Lead = {
      ...lead,
      ...patch,
      tags: patch.tags ?? lead.tags,
      updatedAt: new Date().toISOString(),
    };
    updated = next;
    return next;
  });
  if (updated) emit();
  return updated;
}

/**
 * Move um lead pra outra etapa — usado pelo Kanban (drag-and-drop) e pelo
 * Sub-PR B (botão "mover etapa" no detalhe).
 *
 * Em M8 vira `moveDealStage` Server Action com optimistic update no client.
 */
export function moveLeadToStage(id: string, stageId: string): Lead | undefined {
  return updateLead(id, { stageId });
}

/** Bulk import — usado pela importação de CSV. */
export function importLeads(rows: LeadCreateInput[]): Lead[] {
  const created = rows.map(createLead);
  return created;
}

/** Recalcula a temperatura de todos os leads — útil se mudarmos `lastInteractionAt`. */
export function refreshTemperatures(): void {
  leadsState = leadsState.map((lead) => ({
    ...lead,
    temperature: temperatureFromLastInteraction(lead.lastInteractionAt),
  }));
  emit();
}
