'use client';

import * as React from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@papopro/ui';
import { TrendingUp } from '@papopro/ui/icons';

import { useDeals } from '@/features/deals/store';
import { buildConversionFunnel } from '@/features/reports/transforms';
import type { ConversionFunnelDatum } from '@/features/reports/types';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Funil de conversão — `<BarChart>` Recharts vertical com 6 barras (uma
 * por etapa do pipeline). Cada barra mostra quantos deals **estão na
 * etapa OU já passaram por ela** (cumulative).
 *
 * Diferente do `<DashboardFunnelChart>` que mostra trapézios proporcionais
 * só de deals abertos por etapa. Aqui é "quantos toparam o funil em
 * algum momento" — leitura analytics, não snapshot.
 *
 * Inclui Ganho/Perdido como barras finais — diferente do dashboard, em
 * Relatórios faz sentido mostrar fechamentos ao lado das etapas pra
 * leitura "o funil inteiro com resultado".
 *
 * Pegadinhas Recharts respeitadas:
 *  - Cores via `<Cell fill>` (uma cor por barra) em vez de `<Bar fill>` único
 *  - `isAnimationActive={false}` evita flicker em re-render
 *  - `<ResponsiveContainer>` precisa de height fixo (usamos 320)
 *  - SVG client-side puro → `'use client'` obrigatório
 */
export function ConversionFunnel() {
  const deals = useDeals();
  const data = React.useMemo(() => buildConversionFunnel(deals), [deals]);
  const total = data.reduce((acc, d) => acc + d.cumulative, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title">Funil de conversão</CardTitle>
        <CardDescription>
          Negócios que entraram em cada etapa — fechados (Ganho/Perdido) contam separadamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Sem negócios pra analisar"
            description="Quando o pipeline tiver atividade, o funil aparece aqui."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={data}
              margin={{ top: 24, right: 16, left: -8, bottom: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
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
              <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
              <Bar dataKey="cumulative" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={entry.stageId} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="cumulative"
                  position="top"
                  className="fill-foreground text-caption font-semibold"
                  stroke="none"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Tooltip custom — mostra count + valor + taxa de avanço pra próxima
 * etapa (quando aplicável).
 */
function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConversionFunnelDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="bg-popover border-border text-caption rounded-md border px-3 py-2 shadow-md">
      <div className="text-foreground font-semibold">{datum.name}</div>
      <div className="text-muted-foreground tabular-nums">
        {datum.cumulative} {datum.cumulative === 1 ? 'negócio' : 'negócios'}
      </div>
      {datum.totalCents > 0 && (
        <div className="text-muted-foreground tabular-nums">
          {formatCentsCompact(datum.totalCents)} parados aqui
        </div>
      )}
      {datum.advanceRatePct !== null && (
        <div className="text-info border-border mt-1 border-t pt-1 tabular-nums">
          {datum.advanceRatePct}% avançam pra próxima
        </div>
      )}
    </div>
  );
}
