'use client';

import * as React from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { computeRangeBounds, DASHBOARD_NOW, parseDashboardRange } from '../range';
import type { DashboardRange, RangeBounds } from '../types';

/**
 * Hook que gerencia o filtro de período do dashboard.
 *
 * - Lê `?range=` da URL e calcula `RangeBounds` (start, end, previousStart,
 *   previousEnd, label).
 * - Persiste mudanças via `router.replace()` (não cria entry no history —
 *   trocar Hoje/Semana/Mês não polui o "Voltar").
 * - Pra `range='custom'` aceita também `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
 *
 * Em M5 a data de referência é fixa (`DASHBOARD_NOW`) pra que as fixtures
 * congruentes com o seed de `transforms.ts` continuem fazendo sentido.
 * Em M8+ vira `new Date()` real (dados ao vivo).
 */
export function useDashboardRange(): {
  bounds: RangeBounds;
  setRange: (range: DashboardRange, customRange?: { start: Date; end: Date }) => void;
} {
  const router = useRouter();
  const params = useSearchParams();

  const range = parseDashboardRange(params.get('range'));
  // `params` é objeto novo a cada render — extraímos os valores
  // estáveis pra que o useMemo dependa só do que importa.
  const fromRaw = params.get('from');
  const toRaw = params.get('to');

  const bounds = React.useMemo(() => {
    if (range === 'custom') {
      const from = fromRaw ? new Date(fromRaw) : undefined;
      const to = toRaw ? new Date(toRaw) : undefined;
      // Se algum dos lados é inválido, cai pro fallback do helper (today).
      if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        return computeRangeBounds('custom', DASHBOARD_NOW, { start: from, end: to });
      }
      return computeRangeBounds('today', DASHBOARD_NOW);
    }
    return computeRangeBounds(range, DASHBOARD_NOW);
  }, [range, fromRaw, toRaw]);

  const setRange = React.useCallback(
    (next: DashboardRange, customRange?: { start: Date; end: Date }) => {
      const url = new URL(window.location.href);
      if (next === 'week') {
        // `week` é o default — limpa a URL pra ficar mais bonita.
        url.searchParams.delete('range');
      } else {
        url.searchParams.set('range', next);
      }
      if (next === 'custom' && customRange) {
        url.searchParams.set('from', customRange.start.toISOString().slice(0, 10));
        url.searchParams.set('to', customRange.end.toISOString().slice(0, 10));
      } else {
        url.searchParams.delete('from');
        url.searchParams.delete('to');
      }
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    },
    [router],
  );

  return { bounds, setRange };
}
