'use client';

import * as React from 'react';

import { Button } from '@papopro/ui';
import { PlusCircle, Sparkles } from '@papopro/ui/icons';

import { useDashboardRange } from '../hooks/use-dashboard-range';
import { formatHeaderDate } from '../range';

import { DashboardRangePills } from './dashboard-range-pills';
import { FunnelHorizontalChart } from './funnel-horizontal-chart';
import { HotLeadsAlert } from './hot-leads-alert';
import { KpiGrid } from './kpi-grid';
import { OriginDonut } from './origin-donut';
import { RecentActivityCard } from './recent-activity-card';
import { DashboardTrendChart } from './trend-chart';
import { UpcomingDealsTable } from './upcoming-deals-table';

/**
 * Variante pós-wizard do dashboard — operacional do dia.
 *
 * Estrutura (top → bottom), espelhando a imagem de referência aprovada:
 *  1. Header com saudação + data por extenso, à direita pills de período
 *  2. KpiGrid: 5 cards (Leads novos / Tarefas pendentes / Pipeline / Conversão / Propostas)
 *     com trend (↑/↓ %) nos sensíveis a período
 *  3. Funil horizontal (1/3) + Donut Origem (2/3 OU 1/2 — ver abaixo)
 *  4. Atividade recente (1/3) + Próximos do prazo (2/3)
 *  5. LineChart 30 dias full-width (rebaixado)
 *  6. Banner full-width de leads quentes (esconde quando 0)
 *
 * Justificativa do split funil + donut em col-span 1+1 (não 1+2):
 *  - Donut precisa de espaço pra legenda lateral confortável
 *  - Funil tem 6 linhas + label de valor — precisa largura
 *  - 50/50 dá balance visual; 1/3 + 2/3 espremeria o donut
 *
 * Em mobile (<lg) tudo empilha verticalmente; pills viram scroll horizontal.
 *
 * Os botões "Ativar agente IA" e "Adicionar lead" permanecem placeholders
 * (sem onClick) — virarão ações reais nos milestones backend.
 */
export function PostWizardDashboard({ greeting }: { greeting: string }) {
  const { bounds } = useDashboardRange();
  const dateLine = React.useMemo(() => formatHeaderDate(), []);

  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-title-lg text-foreground font-semibold">{greeting}</h1>
          <p className="text-body text-muted-foreground">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <DashboardRangePills />
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm">
              <Sparkles /> Ativar agente IA
            </Button>
            <Button size="sm">
              <PlusCircle /> Adicionar lead
            </Button>
          </div>
        </div>
      </header>

      <KpiGrid bounds={bounds} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FunnelHorizontalChart />
        <OriginDonut bounds={bounds} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RecentActivityCard />
        </div>
        <div className="lg:col-span-2">
          <UpcomingDealsTable />
        </div>
      </div>

      <DashboardTrendChart />

      <HotLeadsAlert />
    </div>
  );
}
