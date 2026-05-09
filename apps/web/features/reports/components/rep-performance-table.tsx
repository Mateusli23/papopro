'use client';

import * as React from 'react';

import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Users } from '@papopro/ui/icons';

import { useDeals } from '@/features/deals/store';
import { computeRepPerformance } from '@/features/reports/transforms';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Tabela "Performance por vendedor" — 5 reps das fixtures, ordenados por
 * `wonValueCents` desc com tiebreak de `activeDeals`. Reps zerados vão
 * pro fim (mostram "—" no lugar de 0%).
 *
 * `<table>` HTML semântica (mesmo padrão do `UpcomingDealsTable` do
 * dashboard) — screen readers anunciam coluna/linha sem ginástica de ARIA.
 *
 * Sem click por enquanto: vendedores ainda não têm rota dedicada
 * (entra em alguma futura feature de configurações/team).
 */

const ACCENT_CLASS: Record<string, string> = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent/20 text-foreground',
};

export function RepPerformanceTable() {
  const deals = useDeals();
  const rows = React.useMemo(() => computeRepPerformance(deals), [deals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title">Performance por vendedor</CardTitle>
        <CardDescription>Ranking dos últimos 30 dias — ordenado por valor ganho</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              icon={Users}
              title="Sem vendedores no workspace"
              description="Convide membros pra começar a medir performance."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-body w-full">
              <thead className="text-caption text-muted-foreground border-border border-b">
                <tr className="text-left">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Vendedor
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Ativos
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Ganhos 30d
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Valor ganho
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Conversão
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const accentClass = ACCENT_CLASS[row.accent] ?? ACCENT_CLASS.primary;
                  const isLeader = i === 0 && row.wonValueCents > 0;
                  return (
                    <tr
                      key={row.repId}
                      className="border-border hover:bg-muted/40 border-b transition-colors last:border-b-0"
                    >
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2.5">
                          <Avatar className="size-7 text-[11px]">
                            <AvatarFallback className={cn('font-semibold', accentClass)}>
                              {row.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-foreground font-medium">
                            {row.repName}
                            {isLeader && (
                              <span className="text-success text-caption ml-1.5 font-normal">
                                · líder do mês
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                        {row.activeDeals}
                      </td>
                      <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                        {row.wonLast30d}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right font-medium tabular-nums',
                          row.wonValueCents > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                        )}
                      >
                        {row.wonValueCents > 0 ? formatCentsCompact(row.wonValueCents) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right tabular-nums',
                          row.conversionRatePct === 0
                            ? 'text-muted-foreground/60'
                            : 'text-foreground',
                        )}
                      >
                        {row.conversionRatePct === 0 && row.wonLast30d === 0
                          ? '—'
                          : `${row.conversionRatePct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
