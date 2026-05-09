'use client';

import * as React from 'react';

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@papopro/ui';
import { Activity } from '@papopro/ui/icons';

import { buildFunnelData } from '@/features/dashboard/transforms';
import type { FunnelDatum } from '@/features/dashboard/types';
import { useDeals } from '@/features/deals/store';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Funil de vendas — `<FunnelChart>` trapezoidal do Recharts.
 *
 * Inclui só as 4 etapas ativas (Novo → Negociação) — Ganho/Perdido são
 * resultados, não etapas. Cores via `hsl(var(--token))` (ver `transforms.ts`)
 * pra que o gráfico respeite dark/light sem JS.
 *
 * Pegadinhas do Recharts respeitadas:
 *  - Dados em ordem decrescente de `value` (sortado em `buildFunnelData`)
 *  - `<ResponsiveContainer>` com height fixo (não 100%) — senão colapsa
 *  - `isAnimationActive={false}` — re-render por `useDeals()` change
 *    causaria flicker; CLAUDE.md §8 (animação só com semântica)
 *  - SVG client-side puro → arquivo precisa de `'use client'`
 *
 * Empty state quando todas etapas vazias — substitui o chart por
 * `<EmptyState>` orientador (princípio: nunca tela em branco).
 */
export function DashboardFunnelChart() {
  const deals = useDeals();
  const data = React.useMemo(() => buildFunnelData(deals), [deals]);
  const totalOpen = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-title">Funil de vendas</CardTitle>
        <CardDescription>Negócios abertos por etapa</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center pt-0">
        {totalOpen === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sem negócios abertos"
            description="Adicione um negócio pra começar a popular o funil."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <FunnelChart>
              <Tooltip content={<FunnelTooltip />} cursor={false} />
              <Funnel dataKey="value" data={data} isAnimationActive={false}>
                <LabelList
                  position="right"
                  dataKey="labelRight"
                  className="fill-foreground text-caption"
                  stroke="none"
                />
                <LabelList
                  position="center"
                  dataKey="labelCenter"
                  className="fill-background text-caption font-semibold"
                  stroke="none"
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Tooltip custom — Recharts default usa cores hardcoded e não respeita
 * tokens. Renderizamos nosso próprio popover com as mesmas classes
 * do design system.
 */
function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FunnelDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="bg-popover border-border text-caption rounded-md border px-3 py-2 shadow-md">
      <div className="text-foreground font-semibold">{datum.name}</div>
      <div className="text-muted-foreground">
        {datum.value} {datum.value === 1 ? 'negócio' : 'negócios'}
      </div>
      {datum.totalCents > 0 && (
        <div className="text-muted-foreground tabular-nums">
          {formatCentsCompact(datum.totalCents)}
        </div>
      )}
    </div>
  );
}
