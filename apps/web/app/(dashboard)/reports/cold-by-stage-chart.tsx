'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@papopro/ui';
import { Snowflake } from '@papopro/ui/icons';

import { filterColdRowsForChart } from '@/features/cadences/reports.helpers';

interface ChartRow {
  stageId: string;
  stageName: string;
  coldCount: number;
}

interface Props {
  rows: readonly ChartRow[];
}

/**
 * BarChart "Leads frios por etapa" (M10#5). Recharts client — SVG é
 * browser-only. Cor `warning` (mostarda semântico) alinhada com o banner
 * `ColdAlertBanner` do M10#4.
 *
 * Pegadinhas Recharts respeitadas (mesma lista de `ConversionFunnel`):
 *  - height fixo no `<ResponsiveContainer>`
 *  - `isAnimationActive={false}` evita flicker em revalidatePath
 *  - tokens via `hsl(var(--*))` no SVG (não cor hardcoded)
 */
export function ColdByStageChart({ rows }: Props) {
  const data = filterColdRowsForChart(rows);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title">Leads frios por etapa</CardTitle>
        <CardDescription>
          Alertas ativos (não vistos) agrupados pela etapa onde o lead estacionou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={Snowflake}
            title="Nenhum lead frio no momento"
            description="Quando algum lead ficar inativo além do threshold da etapa, ele aparece aqui."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data as ChartRow[]}
              margin={{ top: 24, right: 16, left: -8, bottom: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="stageName"
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
              <Tooltip content={<ColdTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
              <Bar
                dataKey="coldCount"
                radius={[6, 6, 0, 0]}
                fill="hsl(var(--warning))"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ColdTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="bg-popover border-border text-caption rounded-md border px-3 py-2 shadow-md">
      <div className="text-foreground font-semibold">{datum.stageName}</div>
      <div className="text-muted-foreground tabular-nums">
        {datum.coldCount} {datum.coldCount === 1 ? 'lead frio' : 'leads frios'}
      </div>
    </div>
  );
}
