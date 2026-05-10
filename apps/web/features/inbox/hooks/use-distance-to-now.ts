'use client';

import * as React from 'react';

import { formatRelative } from '@/lib/utils/format';

/**
 * Wrapper hidratação-safe do `formatRelative` ("há 2 horas"). Como o
 * cálculo depende de `Date.now()` interno, o resultado server vs client
 * pode divergir → React loga hydration mismatch.
 *
 * Estratégia (mesma do `cadence-metrics-panel.tsx`): retorna `fallback`
 * inicial; popula real via `useEffect`.
 */
export function useDistanceToNow(iso: string | undefined, fallback = '—'): string {
  const [label, setLabel] = React.useState(fallback);

  React.useEffect(() => {
    setLabel(formatRelative(iso));
  }, [iso]);

  return label;
}
