'use client';

import * as React from 'react';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@papopro/ui';
import { TrendingUp } from '@papopro/ui/icons';

import { buildTrendData } from '@/features/dashboard/transforms';
import type { TrendDatum } from '@/features/dashboard/types';
import { useDeals } from '@/features/deals/store';

/**
 * Tendência 30d — `<LineChart>` Recharts com 2 séries:
 *
 *  - **Criados** (azul / `--info`): deals com `createdAt` no dia
 *  - **Ganhos** (verde / `--success`): deals com `closedAt` no dia + status='won'
 *
 * Lost não entra — o gráfico mostra atividade positiva. Lost já vive no
 * KPI #4 (Taxa de Conversão).
 *
 * Mesmas pegadinhas Recharts do `<DashboardFunnelChart>`:
 *  - SVG client-side puro → `'use client'` obrigatório
 *  - `<ResponsiveContainer>` precisa height fixo
 *  - `isAnimationActive={false}` evita flicker em re-renders
 *  - Cores via `stroke="hsl(var(--token))"` (respeita dark/light)
 *
 * Eixos:
 *  - X: ticks a cada ~5 dias (não polui com 30 labels)
 *  - Y: int + `allowDecimals={false}` (count é inteiro)
 */
export function DashboardTrendChart() {
  const deals = useDeals();
  const data = React.useMemo(() => buildTrendData(deals), [deals]);
  const totalActivity = data.reduce((acc, d) => acc + d.created + d.won, 0);
  // Pra um chart legível, mostramos 1 tick a cada 5 dias (6 ticks total
  // em 30 dias — primeira, última e 4 intermediárias).
  const tickIndices = data.map((_, i) => i).filter((i) => i % 5 === 0 || i === data.length - 1);
  const ticks = tickIndices.map((i) => data[i]!.label);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-title">Tendência 30 dias</CardTitle>
          <CardDescription>Negócios criados vs ganhos por dia</CardDescription>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="pt-0">
        {totalActivity === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Sem atividade nos últimos 30 dias"
            description="Quando criar ou ganhar negócios, a tendência aparece aqui."
          />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                ticks={ticks}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={32}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              <Line
                type="monotone"
                dataKey="created"
                stroke="hsl(var(--info))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
                name="Criados"
              />
              <Line
                type="monotone"
                dataKey="won"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
                name="Ganhos"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Legenda inline no header — duas pílulas com cor + label, mais discreta
 * que `<Legend>` default do Recharts (que ocupa altura extra).
 */
function Legend() {
  return (
    <div className="text-caption text-muted-foreground flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-info inline-block size-2 rounded-full" aria-hidden />
        Criados
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-success inline-block size-2 rounded-full" aria-hidden />
        Ganhos
      </span>
    </div>
  );
}

/**
 * Tooltip custom — Recharts default mostra cores hardcoded e usa fontes
 * sans default. Renderizamos com nossas classes pra coerência visual.
 */
function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: TrendDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const created = payload.find((p) => p.dataKey === 'created')?.value ?? 0;
  const won = payload.find((p) => p.dataKey === 'won')?.value ?? 0;
  return (
    <div className="bg-popover border-border text-caption rounded-md border px-3 py-2 shadow-md">
      <div className="text-foreground font-semibold">{label}</div>
      <div className="text-info flex items-center gap-1.5 tabular-nums">
        <span className="bg-info inline-block size-2 rounded-full" aria-hidden />
        {created} criados
      </div>
      <div className="text-success flex items-center gap-1.5 tabular-nums">
        <span className="bg-success inline-block size-2 rounded-full" aria-hidden />
        {won} ganhos
      </div>
    </div>
  );
}
