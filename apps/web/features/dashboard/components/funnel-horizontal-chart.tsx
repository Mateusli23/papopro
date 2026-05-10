'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Layers } from '@papopro/ui/icons';

import { buildHorizontalFunnelData } from '@/features/dashboard/transforms';
import { useDeals } from '@/features/deals/store';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Funil horizontal — substitui o `<DashboardFunnelChart>` Recharts trapezoidal.
 *
 * Layout: cada etapa é uma linha com nome à esquerda + barra colorida + label
 * (count + valor compactado) à direita. Largura proporcional ao maior count
 * do array. Inclui as 6 etapas (4 ativas + Ganho + Perdido) em ordem natural.
 *
 * Por que HTML+Tailwind ao invés de Recharts?
 *  - Mais legível pra etapas com 0 deals (mostra label "0", não some).
 *  - Dark mode trivial via classes (`bg-info`, `bg-success`).
 *  - Click em qualquer barra navega pra `/kanban?stage=X` — semântica de
 *    drill-down clara.
 *  - Tira ~80 linhas de dependência Recharts pra esse caso específico.
 *
 * Em mobile (< sm) o layout permanece igual — barras horizontais escalam
 * naturalmente. Container pode dar scroll horizontal se label de valor for
 * muito longo (raro com `formatCentsCompact`).
 */
export function FunnelHorizontalChart() {
  const router = useRouter();
  const deals = useDeals();
  const data = React.useMemo(() => buildHorizontalFunnelData(deals), [deals]);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-title">Funil de vendas</CardTitle>
        <CardDescription>Negócios em cada etapa do pipeline — abertos e terminais.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {totalCount === 0 ? (
          <EmptyState
            icon={Layers}
            title="Sem negócios no funil"
            description="Adicione um negócio pra começar a popular o funil."
          />
        ) : (
          <ul className="flex flex-col gap-2.5" aria-label="Funil de vendas por etapa">
            {data.map((row) => {
              const widthPct = (row.count / maxCount) * 100;
              return (
                <li key={row.stageId}>
                  <button
                    type="button"
                    onClick={() => router.push(`/kanban?stage=${row.stageId}`)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-md px-1 py-1 text-left',
                      'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                      'transition-colors',
                    )}
                    aria-label={`Etapa ${row.name} — ${row.count} negócios`}
                  >
                    <span className="text-caption text-muted-foreground w-24 shrink-0 truncate font-medium">
                      {row.name}
                    </span>
                    <div className="bg-muted/30 relative h-5 flex-1 overflow-hidden rounded-sm">
                      {/* Etapa com 0 deals fica sem barra (só o trilho cinza)
                          — uma barrinha mínima de 2% confundiria leitura
                          ("tem algo aí?"). Etapa com 1+ deals ganha barra
                          com largura proporcional + mínimo de 2% pra
                          permanecer visível mesmo com count baixo
                          (review M5p#2 ALTO #9). */}
                      {row.count > 0 && (
                        <div
                          className={cn('h-full rounded-sm transition-all', row.barClass)}
                          style={{ width: `${Math.max(2, widthPct)}%` }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="text-caption text-foreground w-32 shrink-0 text-right font-medium tabular-nums">
                      <span>{row.count}</span>
                      {row.totalCents > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {formatCentsCompact(row.totalCents)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
