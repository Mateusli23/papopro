'use client';

import * as React from 'react';

import { getTemplate } from '@/lib/fixtures/cadence-templates';
import { FAKE_CADENCES } from '@/lib/fixtures/cadences';

import type {
  CadenceCreateInput,
  CadenceUpdateInput,
  StepCreateInput,
  StepUpdateInput,
} from './schemas';
import {
  applyAddStep,
  applyCreateCadence,
  applyDeleteCadence,
  applyDeleteStep,
  applyDuplicate,
  applyToggleStatus,
  applyUpdateCadence,
  applyUpdateStep,
} from './transforms';
import type { Cadence, CadenceStep } from './types';

/**
 * Store in-memory client-side de Cadências — mesmo padrão de
 * `features/tasks/store.ts` e `features/leads/store.ts`. Toda lógica de
 * mutação vive nas transforms puras (testáveis sem React); este arquivo
 * só gerencia snapshot + listeners + counters de ID.
 *
 * Em M8 cada mutação vira Server Action com input validado por Zod;
 * `useCadences` migra pra TanStack Query (`useQuery`) sem mudar a API
 * pública dos hooks.
 *
 * Workspace fixo `'ws_demo'` na criação — em M7 lê do contexto de auth.
 */

const WORKSPACE_ID = 'ws_demo';

let cadencesState: Cadence[] = [...FAKE_CADENCES];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return cadencesState;
}

function getServerSnapshot() {
  return FAKE_CADENCES;
}

export function useCadences(): Cadence[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCadence(id: string): Cadence | undefined {
  const all = useCadences();
  return React.useMemo(() => all.find((c) => c.id === id), [all, id]);
}

// ─── ID generators ────────────────────────────────────────────────────────

/**
 * Counters começam acima do tamanho da fixture pra evitar colisão com IDs
 * já usados em `FAKE_CADENCES` (que segue o mesmo padrão `cad_NNNNN`).
 * O step counter usa um número alto pra não colidir com IDs existentes.
 */
let cadenceCounter = cadencesState.length;
function nextCadenceId(): string {
  cadenceCounter += 1;
  return `cad_${cadenceCounter.toString().padStart(5, '0')}`;
}

let stepCounter = cadencesState.reduce((sum, c) => sum + c.steps.length, 0);
function nextStepId(): string {
  stepCounter += 1;
  return `step_${stepCounter.toString().padStart(5, '0')}`;
}

// ─── Mutações (cadência) ──────────────────────────────────────────────────

export function createCadence(input: CadenceCreateInput): Cadence {
  const template = getTemplate(input.templateKey);
  const { cadences, created } = applyCreateCadence(
    cadencesState,
    input,
    template,
    nextCadenceId,
    nextStepId,
    WORKSPACE_ID,
  );
  cadencesState = cadences;
  emit();
  return created;
}

export function updateCadence(id: string, patch: CadenceUpdateInput): Cadence | undefined {
  const next = applyUpdateCadence(cadencesState, id, patch);
  if (next === cadencesState) return undefined;
  cadencesState = next;
  emit();
  return cadencesState.find((c) => c.id === id);
}

export function toggleCadenceStatus(id: string): Cadence | undefined {
  const next = applyToggleStatus(cadencesState, id);
  if (next === cadencesState) return undefined;
  cadencesState = next;
  emit();
  return cadencesState.find((c) => c.id === id);
}

export function duplicateCadence(id: string): Cadence | undefined {
  const { cadences, created } = applyDuplicate(cadencesState, id, nextCadenceId, nextStepId);
  if (!created) return undefined;
  cadencesState = cadences;
  emit();
  return created;
}

export function deleteCadence(id: string): boolean {
  const next = applyDeleteCadence(cadencesState, id);
  if (next === cadencesState) return false;
  cadencesState = next;
  emit();
  return true;
}

// ─── Mutações (step) ──────────────────────────────────────────────────────

export function addStep(cadenceId: string, input: StepCreateInput): CadenceStep | undefined {
  const { cadences, created } = applyAddStep(cadencesState, cadenceId, input, nextStepId);
  if (!created) return undefined;
  cadencesState = cadences;
  emit();
  return created;
}

export function updateStep(
  cadenceId: string,
  stepId: string,
  patch: StepUpdateInput,
): CadenceStep | undefined {
  const next = applyUpdateStep(cadencesState, cadenceId, stepId, patch);
  if (next === cadencesState) return undefined;
  cadencesState = next;
  emit();
  return cadencesState.find((c) => c.id === cadenceId)?.steps.find((s) => s.id === stepId);
}

export function deleteStep(cadenceId: string, stepId: string): boolean {
  const next = applyDeleteStep(cadencesState, cadenceId, stepId);
  if (next === cadencesState) return false;
  cadencesState = next;
  emit();
  return true;
}
