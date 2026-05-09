'use client';

import { Button, PageHeader } from '@papopro/ui';
import { PlusCircle, Sparkles } from '@papopro/ui/icons';

import { DashboardFunnelChart } from './funnel-chart';
import { KpiGrid } from './kpi-grid';
import { DashboardTrendChart } from './trend-chart';
import { UpcomingDealsTable } from './upcoming-deals-table';

/**
 * Variante pós-wizard do dashboard — substitui o `<PostOnboardingDashboard>`
 * antigo (mock hardcoded com KPIs fictícios + 3 cards estáticos) pelo
 * dashboard real derivado das fixtures de leads/deals.
 *
 * Estrutura (top → bottom):
 *  - `<PageHeader>` com greeting + ações
 *  - `<KpiGrid>`: 4 cards (Total Leads / Negócios Abertos / Valor Pipeline / Conversão)
 *  - `<DashboardTrendChart>` full-width: linha temporal 30d criados vs ganhos
 *  - Linha responsiva: FunnelChart (1/3) + UpcomingDealsTable (2/3)
 *
 * Justificativa de ordem:
 *  - KPIs são "visão de momento" (números agora)
 *  - Trend é "história curta" (últimos 30d) — entra como ponte temporal
 *  - Funnel + Tabela são "ação" (o que está aberto, o que precisa de atenção)
 *
 * Justificativa do split 1/3 + 2/3 (funnel/tabela) em desktop:
 *  - Funnel é leitura ambiente — não precisa espaço pra clicar
 *  - Tabela é superfície de ação — vendedor escaneia 8 linhas × 6 colunas,
 *    precisa de largura pra não truncar nomes/títulos
 *
 * Em mobile (<lg) tudo vira full-width empilhado.
 *
 * Os botões "Ativar agente IA" e "Adicionar lead" permanecem placeholders
 * por agora — virarão ações reais em milestones posteriores.
 */
export function PostWizardDashboard({ greeting }: { greeting: string }) {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={greeting}
        description="Visão rápida do funil e do que precisa do seu olhar agora."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Sparkles /> Ativar agente IA
            </Button>
            <Button size="sm">
              <PlusCircle /> Adicionar lead
            </Button>
          </>
        }
      />

      <KpiGrid />

      <DashboardTrendChart />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DashboardFunnelChart />
        </div>
        <div className="lg:col-span-2">
          <UpcomingDealsTable />
        </div>
      </div>
    </div>
  );
}
