'use client';

import * as React from 'react';

import type { Cadence } from './types';

/**
 * Store client-side de Cadências (M10#3) — **hydrate-from-server pattern**.
 *
 * **Mudança vs M5**: até M10#2 o store carregava `FAKE_CADENCES` fixture e
 * fazia mutações in-memory via funções `createCadence`/`toggleCadenceStatus`
 * etc. M10#3 substitui:
 *
 *  - Inicialização: estado parte VAZIO; Server Component (`cadences/page.tsx`)
 *    chama `listCadences()` e injeta via `hydrateCadencesFromServer(initial)`.
 *  - Mutações: **componentes chamam Server Actions diretamente**
 *    (`createCadenceAction`, `toggleCadenceStatusAction`, etc.). A action
 *    revalida o path; Server Component re-fetcha; `hydrate` substitui o
 *    snapshot. Não há mais mutação client-side — fonte única de verdade é
 *    o banco.
 *
 * **Por que NÃO TanStack Query**: padrão hydrate-from-server (M9#4 Inbox)
 * já é robusto e mantém API pública `useCadences()` inalterada — zero
 * mudança nos componentes que apenas LEEM. TanStack Query entra em M11
 * quando agentes IA precisarem de cache server-state mais complexo.
 *
 * **Por que removemos as mutação functions**: dupla fonte de verdade
 * (otimismo no client + persistência no server) introduz race conditions
 * sutis (ex: usuário pausa cadência, server falha, cache fica fora de sync).
 * Em M10#3 ficamos com pessimismo total: toast loading → action → toast
 * sucesso/erro → revalidatePath. Otimismo entra em M10#5 se UX exigir.
 */

let cadencesState: Cadence[] = [];
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

function getServerSnapshot(): Cadence[] {
  // SSR snapshot. Server Component injeta os dados reais via
  // `hydrateCadencesFromServer` no primeiro render do client.
  return cadencesState;
}

/**
 * Hidrata o store com snapshot fresco do servidor. Chamado por
 * `useEffect([initial])` no Server-Component pai (`CadencesView`).
 * Substitui o array inteiro — não faz merge.
 */
export function hydrateCadencesFromServer(initial: Cadence[]): void {
  cadencesState = initial;
  emit();
}

export function useCadences(): Cadence[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCadence(id: string): Cadence | undefined {
  const all = useCadences();
  return React.useMemo(() => all.find((c) => c.id === id), [all, id]);
}
