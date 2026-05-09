'use client';

import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Clock } from '@papopro/ui/icons';

import { useDeals } from '@/features/deals/store';
import { computeStageAvgTime } from '@/features/reports/transforms';
import type { StageAvgTime } from '@/features/reports/types';

/**
 * Tempo médio que deals abertos estão "parados" em cada etapa ativa.
 *
 * Sem histórico real de transições nas fixtures, usamos `(NOW - createdAt)`
 * como proxy — explicitado na descrição do card pra não enganar. Em M8,
 * com `activities.stage_change` no Postgres, o cálculo vira preciso
 * (tempo desde a última mudança pra essa etapa) sem mudar a UI.
 *
 * 4 mini-cards horizontais (uma por etapa ativa). Status semáforo
 * mapeado pro `rotDays` da etapa do `pipelines.ts`:
 *  - healthy: avg <= rotDays/2 (success)
 *  - warning: avg <= rotDays mas > rotDays/2 (warning)
 *  - critical: avg > rotDays (destructive)
 */

const STATUS_STYLES: Record<
  StageAvgTime['status'],
  { bg: string; text: string; ring: string; label: string }
> = {
  healthy: {
    bg: 'bg-success/[0.06]',
    text: 'text-success',
    ring: 'ring-success/20',
    label: 'no prazo',
  },
  warning: {
    bg: 'bg-warning/[0.08]',
    text: 'text-warning',
    ring: 'ring-warning/20',
    label: 'atenção',
  },
  critical: {
    bg: 'bg-destructive/[0.06]',
    text: 'text-destructive',
    ring: 'ring-destructive/20',
    label: 'atrasado',
  },
};

export function StageTimeCard() {
  const deals = useDeals();
  const data = React.useMemo(() => computeStageAvgTime(deals), [deals]);
  const total = data.reduce((acc, s) => acc + s.count, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-title">Tempo médio por etapa</CardTitle>
        <CardDescription>
          Dias desde a criação dos negócios atualmente abertos em cada etapa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {total === 0 ? (
          <EmptyState
            icon={Clock}
            title="Sem negócios abertos"
            description="Quando criar negócios, o tempo médio aparece aqui."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.map((stage) => {
              const tone = STATUS_STYLES[stage.status];
              return (
                <div
                  key={stage.stageId}
                  className={cn(
                    'border-border flex flex-col gap-1 rounded-lg border p-3 ring-1',
                    tone.bg,
                    tone.ring,
                  )}
                >
                  <span className="text-caption text-muted-foreground font-medium">
                    {stage.name}
                  </span>
                  <span className={cn('text-title-lg font-semibold tabular-nums', tone.text)}>
                    {stage.count === 0 ? '—' : `${stage.avgDays}d`}
                  </span>
                  <span className="text-caption text-muted-foreground/80">
                    {stage.count === 0
                      ? 'sem negócios'
                      : `${stage.count} ${stage.count === 1 ? 'negócio' : 'negócios'} · alvo ${stage.rotDays}d · ${tone.label}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
