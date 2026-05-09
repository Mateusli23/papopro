'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';
import { Clock, TrendingUp, Trophy, Users, type LucideIcon } from '@papopro/ui/icons';

import { useDeals } from '@/features/deals/store';
import { useLeads } from '@/features/leads/store';
import { computeReportsKpis } from '@/features/reports/transforms';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * 4 KPIs no topo de Relatórios. Padrão visual idêntico ao `KpiGrid` do
 * dashboard (mesmas `TONE_STYLES`, mesma estrutura `StatCard`) — copiado
 * intencionalmente em vez de extraído pra `@papopro/ui` porque até esse
 * momento só temos 2 instâncias (dashboard + reports). Quando aparecer a
 * 3ª (provavelmente em /agents ou /cadences), aí sim extraímos.
 *
 * Set de KPIs aqui é diferente do dashboard:
 *  - Dashboard: Total Leads / Negócios Abertos / Valor Pipeline / Conversão
 *  - Reports: Total Leads / Pipeline aberto / Conversão / Ciclo médio
 *
 * Reports troca "Negócios abertos" por "Ciclo médio" porque relatórios
 * é sobre tempo/performance — quanto tempo um deal leva pra fechar é
 * mais informativo aqui do que count de abertos (que dashboard já mostra).
 */

interface StatCard {
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  tone: 'info' | 'warning' | 'success' | 'destructive';
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

export function SummaryKpis() {
  const leads = useLeads();
  const deals = useDeals();

  const stats = React.useMemo<StatCard[]>(() => {
    const k = computeReportsKpis(leads, deals);
    return [
      {
        label: 'Total de leads',
        value: String(k.totalLeads),
        hint:
          k.newLeadsLast7d === 0
            ? 'sem novos esta semana'
            : `${k.newLeadsLast7d} ${k.newLeadsLast7d === 1 ? 'novo' : 'novos'} esta semana`,
        Icon: Users,
        tone: 'info',
      },
      {
        label: 'Pipeline aberto',
        value: k.openPipelineCents > 0 ? formatCentsCompact(k.openPipelineCents) : 'R$ 0',
        hint:
          k.openDealsCount > 0
            ? `${k.openDealsCount} ${k.openDealsCount === 1 ? 'negócio' : 'negócios'} em andamento`
            : 'sem negócios abertos',
        Icon: TrendingUp,
        tone: 'warning',
      },
      {
        label: 'Conversão (30d)',
        value: `${k.conversionRatePct}%`,
        hint:
          k.closedLast30d === 0
            ? 'sem fechamentos no mês'
            : `${k.wonLast30d} de ${k.closedLast30d} fechamentos`,
        Icon: Trophy,
        tone: 'success',
      },
      {
        label: 'Ciclo médio',
        value: k.avgCycleDays === 0 ? '—' : `${k.avgCycleDays}d`,
        hint:
          k.avgCycleDays === 0 ? 'sem fechamentos pra calcular' : 'da criação ao fechamento (90d)',
        Icon: Clock,
        tone: 'info',
      },
    ];
  }, [leads, deals]);

  return (
    <section
      aria-label="Indicadores principais de relatórios"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
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
              <span className="text-caption text-muted-foreground/80">{s.hint}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
