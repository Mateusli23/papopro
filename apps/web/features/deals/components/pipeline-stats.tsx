'use client';

import * as React from 'react';

import { differenceInCalendarDays, parseISO } from 'date-fns';

import { cn } from '@papopro/ui';
import { Activity, AlertCircle, Trophy, Zap, type LucideIcon } from '@papopro/ui/icons';

import { formatCentsCompact } from '@/lib/utils/format';

import type { Deal } from '../types';

/**
 * Faixa de KPIs no topo do Pipeline. Mostra de relance:
 *
 *  - **Pipeline ativo** — soma de tudo que não fechou (info)
 *  - **Em negociação** — soma só da etapa Negociação (warning, momento crítico)
 *  - **Ganho (30d)** — fechados como ganho nos últimos 30 dias (success)
 *  - **Atrasados** — deals abertos com `dueAt` no passado (destructive, ação)
 *
 * Calculado client-side a partir do store — atualiza em real-time conforme
 * o usuário arrasta deals entre etapas. Layout em grid responsivo (1col em
 * mobile, 4 em ≥md).
 */

interface StatCard {
  label: string;
  value: string;
  hint?: string;
  Icon: LucideIcon;
  tone: 'info' | 'warning' | 'success' | 'destructive';
}

interface PipelineStatsProps {
  deals: Deal[];
}

const TONE_STYLES: Record<
  StatCard['tone'],
  { bg: string; text: string; ring: string; iconBg: string }
> = {
  info: {
    bg: 'bg-info/[0.06]',
    text: 'text-info',
    ring: 'ring-info/20',
    iconBg: 'bg-info/15 text-info',
  },
  warning: {
    bg: 'bg-warning/[0.08]',
    text: 'text-warning',
    ring: 'ring-warning/20',
    iconBg: 'bg-warning/20 text-warning',
  },
  success: {
    bg: 'bg-success/[0.06]',
    text: 'text-success',
    ring: 'ring-success/20',
    iconBg: 'bg-success/15 text-success',
  },
  destructive: {
    bg: 'bg-destructive/[0.06]',
    text: 'text-destructive',
    ring: 'ring-destructive/20',
    iconBg: 'bg-destructive/15 text-destructive',
  },
};

export function PipelineStats({ deals }: PipelineStatsProps) {
  const stats = React.useMemo<StatCard[]>(() => {
    const now = new Date();
    const open = deals.filter((d) => d.status === 'open');
    // M8#3: "negociação" detectada pelo slug se houver, senão pelo stageId
    // legado das fixtures M4. Server-fed deals sempre trazem `stageSlug`.
    const negociacao = open.filter((d) => (d.stageSlug ?? d.stageId) === 'negociacao');
    const wonLast30 = deals.filter(
      (d) =>
        d.status === 'won' &&
        d.closedAt &&
        differenceInCalendarDays(now, parseISO(d.closedAt)) <= 30,
    );
    const overdue = open.filter(
      (d) => d.dueAt && differenceInCalendarDays(parseISO(d.dueAt), now) < 0,
    );

    const sum = (arr: typeof deals) => arr.reduce((a, d) => a + d.valueCents, 0);

    return [
      {
        label: 'Pipeline ativo',
        value: formatCentsCompact(sum(open)),
        hint: `${open.length} negócios em andamento`,
        Icon: Activity,
        tone: 'info',
      },
      {
        label: 'Em negociação',
        value: formatCentsCompact(sum(negociacao)),
        hint: `${negociacao.length} próximos do fechamento`,
        Icon: Zap,
        tone: 'warning',
      },
      {
        label: 'Ganho (30d)',
        value: formatCentsCompact(sum(wonLast30)),
        hint: `${wonLast30.length} fechados no mês`,
        Icon: Trophy,
        tone: 'success',
      },
      {
        label: 'Atrasados',
        value: String(overdue.length),
        hint: overdue.length === 0 ? 'tudo no prazo 🎉' : 'precisam de atenção',
        Icon: AlertCircle,
        tone: 'destructive',
      },
    ];
  }, [deals]);

  return (
    <section aria-label="Indicadores do pipeline" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const tone = TONE_STYLES[s.tone];
        return (
          <div
            key={s.label}
            className={cn(
              'border-border flex items-start gap-3 rounded-xl border p-3 ring-1',
              tone.bg,
              tone.ring,
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                tone.iconBg,
              )}
              aria-hidden
            >
              <s.Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-caption text-muted-foreground font-medium">{s.label}</span>
              <span className={cn('text-title font-semibold tabular-nums', tone.text)}>
                {s.value}
              </span>
              {s.hint && <span className="text-caption text-muted-foreground/80">{s.hint}</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
