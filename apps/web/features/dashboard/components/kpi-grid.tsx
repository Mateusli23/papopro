'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';
import { Activity, TrendingUp, Trophy, Users, type LucideIcon } from '@papopro/ui/icons';

import { computeDashboardKpis } from '@/features/dashboard/transforms';
import { useDeals } from '@/features/deals/store';
import { useLeads } from '@/features/leads/store';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Os 4 KPIs do topo do dashboard.
 *
 * O padrão visual espelha intencionalmente o `<PipelineStats>` do Kanban
 * (`features/deals/components/pipeline-stats.tsx`) — mesma estrutura de
 * `StatCard` (border + ring + icon box), mesmos `TONE_STYLES`. **Copiado**
 * em vez de importado porque o set de KPIs é diferente (lá são 4 métricas
 * de pipeline, aqui são 2 de pipeline + 1 de leads + 1 de conversão), e
 * extrair primitivo agora seria YAGNI.
 *
 * Recalcula em tempo real via `useDeals()` + `useLeads()` — quando o usuário
 * cria/move um deal em outra rota, o número aqui atualiza no próximo render.
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

export function KpiGrid() {
  const leads = useLeads();
  const deals = useDeals();

  const stats = React.useMemo<StatCard[]>(() => {
    const k = computeDashboardKpis(leads, deals);
    return [
      {
        label: 'Total de leads',
        value: String(k.totalLeads),
        hint:
          k.hotLeadsCount > 0
            ? `${k.hotLeadsCount} ${k.hotLeadsCount === 1 ? 'lead quente' : 'quentes'} agora`
            : 'sem leads quentes no momento',
        Icon: Users,
        tone: 'info',
      },
      {
        label: 'Negócios abertos',
        value: String(k.openDealsCount),
        hint:
          k.openPipelineCents > 0
            ? `${formatCentsCompact(k.openPipelineCents)} no pipeline`
            : 'pipeline vazio',
        Icon: Activity,
        tone: 'info',
      },
      {
        label: 'Valor do pipeline',
        value: k.openPipelineCents > 0 ? formatCentsCompact(k.openPipelineCents) : 'R$ 0',
        hint: k.openDealsCount > 0 ? `em ${k.openDealsCount} negócios` : 'nada em andamento',
        Icon: TrendingUp,
        tone: 'warning',
      },
      {
        label: 'Taxa de conversão',
        value: `${k.conversionRatePct}%`,
        hint:
          k.closedLast30d === 0
            ? 'sem fechamentos no mês'
            : `${k.wonLast30d} ${k.wonLast30d === 1 ? 'ganho' : 'ganhos'} · ${k.lostLast30d} ${k.lostLast30d === 1 ? 'perdido' : 'perdidos'} (30d)`,
        Icon: Trophy,
        tone: 'success',
      },
    ];
  }, [leads, deals]);

  return (
    <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
