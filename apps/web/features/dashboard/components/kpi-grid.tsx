'use client';

import * as React from 'react';

import { Activity, CheckCircle2, FileText, TrendingUp, Users } from '@papopro/ui/icons';

import { computeDashboardKpis } from '@/features/dashboard/transforms';
import type { RangeBounds } from '@/features/dashboard/types';
import { useDeals } from '@/features/deals/store';
import { useLeads } from '@/features/leads/store';
import { useTasks } from '@/features/tasks/store';

import { KpiCard } from './kpi-card';

const DASHBOARD_BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

function formatDashboardMoney(cents: number): string {
  if (cents <= 0) return 'R$ 0';
  return DASHBOARD_BRL_COMPACT.format(cents / 100);
}

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
      // 1 col em celular estreito evita valores monetários grandes saindo da tela.
      // 2 cols em telas um pouco maiores, 3 em tablet, 5 em desktop largo
      // pra acomodar valores monetários "R$ 999K" + trend sem quebrar.
      className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
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
        value={formatDashboardMoney(k.openPipelineCents)}
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
        value={formatDashboardMoney(k.proposalsCents)}
        Icon={FileText}
        tone="info"
        hint="valor ainda em conversa"
      />
    </section>
  );
}
