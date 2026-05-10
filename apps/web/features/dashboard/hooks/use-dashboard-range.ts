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

  const customValid = React.useMemo(() => {
    if (range !== 'custom') return false;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    return Boolean(from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()));
  }, [range, fromRaw, toRaw]);

  const bounds = React.useMemo(() => {
    if (range === 'custom' && customValid && fromRaw && toRaw) {
      return computeRangeBounds('custom', DASHBOARD_NOW, {
        start: new Date(fromRaw),
        end: new Date(toRaw),
      });
    }
    if (range === 'custom') {
      // Fallback enquanto sincroniza a URL — mostra "today" pra não
      // travar a UI (efeito abaixo limpa `?range=custom` inválido).
      return computeRangeBounds('today', DASHBOARD_NOW);
    }
    return computeRangeBounds(range, DASHBOARD_NOW);
  }, [range, fromRaw, toRaw, customValid]);

  // Sincroniza URL out-of-sync: `?range=custom` sem `from/to` válidos
  // (deep-link copiado pela metade) é defaultado pra `?range=week` na
  // próxima paint pra que a UI não fique mostrando "Hoje" enquanto a
  // URL diz "custom" (review M5p#2 ALTO #7).
  React.useEffect(() => {
    if (range === 'custom' && !customValid) {
      const next = new URLSearchParams(params.toString());
      next.delete('range');
      next.delete('from');
      next.delete('to');
      const query = next.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    }
  }, [range, customValid, params, router]);

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
