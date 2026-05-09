'use client';

import * as React from 'react';

import { FAKE_TASKS } from '@/lib/fixtures/tasks';

import type { TaskCreateInput, TaskUpdateInput } from './schemas';
import { applyCreateTask, applyToggleDone, applyUpdateTask } from './transforms';
import type { Task } from './types';

/**
 * Store in-memory client-side de Tasks — mesmo padrão de
 * `features/leads/store.ts` e `features/deals/store.ts`. A lógica de
 * transformação vive em `transforms.ts` (puro, testável); este arquivo só
 * gerencia snapshot + listeners + ID counter.
 *
 * Em M8 cada mutação passa a ser Server Action que retorna o estado novo;
 * `useTasks` migra pra TanStack Query (`useQuery`) sem mudar a API
 * pública.
 */

let tasksState: Task[] = [...FAKE_TASKS];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return tasksState;
}

function getServerSnapshot() {
  return FAKE_TASKS;
}

export function useTasks(): Task[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useTask(id: string): Task | undefined {
  const all = useTasks();
  return React.useMemo(() => all.find((t) => t.id === id), [all, id]);
}

let counter = tasksState.length;
function nextId(): string {
  counter += 1;
  return `task_${counter.toString().padStart(5, '0')}`;
}

export function createTask(input: TaskCreateInput): Task {
  const { tasks, created } = applyCreateTask(tasksState, input, nextId);
  tasksState = tasks;
  emit();
  return created;
}

export function updateTask(id: string, patch: TaskUpdateInput): Task | undefined {
  const next = applyUpdateTask(tasksState, id, patch);
  if (next === tasksState) return undefined;
  tasksState = next;
  emit();
  return tasksState.find((t) => t.id === id);
}

export function toggleTaskDone(id: string): Task | undefined {
  const next = applyToggleDone(tasksState, id);
  if (next === tasksState) return undefined;
  tasksState = next;
  emit();
  return tasksState.find((t) => t.id === id);
}
