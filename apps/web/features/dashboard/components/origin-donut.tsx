'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Globe } from '@papopro/ui/icons';

import { buildOriginData } from '@/features/dashboard/transforms';
import type { OriginDatum, RangeBounds } from '@/features/dashboard/types';
import { useLeads } from '@/features/leads/store';

interface OriginDonutProps {
  bounds: RangeBounds;
}

/**
 * Donut "Leads por origem" — agrupa as 9 origens em 5 buckets visuais
 * (Patrocinado / WhatsApp / Indicação / Site / Outro). Respeita o filtro
 * de período do dashboard.
 *
 * Layout: gráfico à esquerda + legenda à direita com cor + label + count + %.
 * Em mobile o gráfico fica em cima, legenda embaixo.
 *
 * Click numa fatia ou linha da legenda navega pra `/leads?origin=X` com
 * a primeira origem do bucket aplicada como filtro (UX simples — vendedor
 * que quer "Meta Ads" especificamente troca o filtro depois).
 *
 * Recharts foi escolhido (vs SVG manual) porque já está no projeto pra
 * `<TrendChart>`, e PieChart com `innerRadius` é o que ele faz bem.
 */
export function OriginDonut({ bounds }: OriginDonutProps) {
  const router = useRouter();
  const leads = useLeads();
  const data = React.useMemo(() => buildOriginData(leads, bounds), [leads, bounds]);

  // Esconde do gráfico fatias com count 0 — Recharts renderia segmento
  // de 0% que confunde. Mantemos na legenda em cinza.
  const chartData = data.filter((d) => d.count > 0);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  function handleClick(datum: OriginDatum) {
    if (datum.origins.length > 0) {
      router.push(`/leads?origin=${datum.origins[0]}`);
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-title">Origem dos leads</CardTitle>
        <CardDescription>
          Entenda quais canais estão trazendo oportunidades no período filtrado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {totalCount === 0 ? (
          <EmptyState
            icon={Globe}
            title="Nenhum lead nesse período"
            description="Ao receber leads, você verá aqui quais canais estão funcionando melhor."
          />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:gap-6">
            <div className="h-44 w-full max-w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={false}
                    onClick={(payload) =>
                      payload && 'bucket' in payload && handleClick(payload as OriginDatum)
                    }
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.bucket} fill={entry.fill} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as OriginDatum | undefined;
                      if (!d) return null;
                      return (
                        <div className="bg-popover border-border text-caption rounded-md border p-2 shadow">
                          <div className="text-foreground font-medium">{d.label}</div>
                          <div className="text-muted-foreground">
                            {d.count} {d.count === 1 ? 'lead' : 'leads'} · {d.pct}%
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-1 flex-col gap-1.5">
              {data.map((d) => (
                <li key={d.bucket}>
                  <button
                    type="button"
                    onClick={() => handleClick(d)}
                    disabled={d.count === 0}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors',
                      d.count === 0
                        ? 'text-muted-foreground/60 cursor-default'
                        : 'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          d.count === 0 ? 'hsl(var(--muted-foreground) / 0.3)' : d.fill,
                      }}
                    />
                    <span className="text-body flex-1 truncate font-medium">{d.label}</span>
                    <span className="text-caption tabular-nums">
                      <span className="text-foreground">{d.count}</span>
                      <span className="text-muted-foreground"> · {d.pct}%</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
