'use client';

import * as React from 'react';

import { Activity, CheckCircle2, FileText, TrendingUp, Users } from '@papopro/ui/icons';

import { computeDashboardKpis } from '@/features/dashboard/transforms';
import type { RangeBounds } from '@/features/dashboard/types';
import { useDeals } from '@/features/deals/store';
import { useLeads } from '@/features/leads/store';
import { useTasks } from '@/features/tasks/store';
import { formatCentsCompact } from '@/lib/utils/format';

import { KpiCard } from './kpi-card';

interface KpiGridProps {
  bounds: RangeBounds;
}

/**
 * Os 5 KPIs do topo do dashboard. Recalculam em real-time via `useLeads()`,
 * `useDeals()` e `useTasks()` quando o usuário muda algo em outra rota.
 *
 * Os 3 KPIs sensíveis a período (Novos leads, Conversão, Propostas) recebem
 * `trend` (↑/↓ % vs período anterior igual). Pipeline e Tarefas Pendentes
 * são snapshot atual — sem trend (faria comparação ambígua).
 *
 * Layout: 2 colunas em mobile, 5 colunas em md+. Quando spanning estourar
 * a largura horizontal, o Tailwind faz scroll horizontal natural.
 */
export function KpiGrid({ bounds }: KpiGridProps) {
  const leads = useLeads();
  const deals = useDeals();
  const tasks = useTasks();

  const k = React.useMemo(
    () => computeDashboardKpis(leads, deals, tasks, bounds),
    [leads, deals, tasks, bounds],
  );

  return (
    <section
      aria-label="Indicadores principais"
      // 2 cols em mobile, 3 em tablet (cards respiram), 5 em desktop largo
      // pra acomodar valores monetários "R$ 999K" + trend sem quebrar.
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
    >
      <KpiCard
        label="Novos leads recebidos"
        value={String(k.newLeadsCount)}
        Icon={Users}
        tone="info"
        trend={k.newLeadsTrend}
        hint={
          k.hotLeadsCount > 0
            ? `${k.hotLeadsCount} ${k.hotLeadsCount === 1 ? 'quente' : 'quentes'} agora`
            : 'dentro do período filtrado'
        }
      />
      <KpiCard
        label="Tarefas pendentes"
        value={String(k.pendingTasksCount)}
        Icon={CheckCircle2}
        tone={k.pendingTasksCount > 0 ? 'warning' : 'success'}
        hint={k.pendingTasksCount === 0 ? 'tudo em dia' : 'aguardando ação'}
      />
      <KpiCard
        label="Valor em aberto"
        value={k.openPipelineCents > 0 ? formatCentsCompact(k.openPipelineCents) : 'R$ 0'}
        Icon={TrendingUp}
        tone="warning"
        hint={
          k.openDealsCount > 0
            ? `somando ${k.openDealsCount} ${k.openDealsCount === 1 ? 'negócio ativo' : 'negócios ativos'}`
            : 'nada em andamento'
        }
      />
      <KpiCard
        label="Conversão no período"
        value={`${k.conversionRatePct}%`}
        Icon={Activity}
        tone="success"
        trend={k.conversionTrend}
        hint={
          k.closedInRange === 0
            ? 'sem negócios fechados ainda'
            : `${k.wonInRange} ${k.wonInRange === 1 ? 'ganho' : 'ganhos'} · ${k.lostInRange} ${k.lostInRange === 1 ? 'perdido' : 'perdidos'}`
        }
      />
      {/*
       * Propostas é snapshot puro do pipeline atual (deals abertos em
       * `proposta`) — não há histórico de mudança de stage em M5, então
       * comparar com período anterior produziria sempre `flat 0` (review
       * M5p#2 CRÍTICO #1). Em M8+ quando `deal.stageHistory[]` existir,
       * o trend real volta. Por enquanto, sem indicador.
       */}
      <KpiCard
        label="Propostas em negociação"
        value={k.proposalsCents > 0 ? formatCentsCompact(k.proposalsCents) : 'R$ 0'}
        Icon={FileText}
        tone="info"
        hint="valor ainda em conversa"
      />
    </section>
  );
}
