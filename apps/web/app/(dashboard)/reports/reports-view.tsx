'use client';

import { PageHeader } from '@papopro/ui';

import { ConversionFunnel } from '@/features/reports/components/conversion-funnel';
import { CoolingLeadsCard } from '@/features/reports/components/cooling-leads-card';
import { RepPerformanceTable } from '@/features/reports/components/rep-performance-table';
import { StageTimeCard } from '@/features/reports/components/stage-time-card';
import { SummaryKpis } from '@/features/reports/components/summary-kpis';

/**
 * `/reports` — Tela de Relatórios (analytics do workspace).
 *
 * Diferente do `/dashboard` (visão de momento), Relatórios mostra **como
 * o time vem performando**: taxas de conversão acumuladas, tempo médio
 * por etapa, ranking de vendedores, leads esfriando.
 *
 * Layout (top → bottom, mobile-first):
 *  1. PageHeader
 *  2. SummaryKpis: 4 cards (Total leads, Pipeline, Conversão, Ciclo médio)
 *  3. ConversionFunnel: BarChart Recharts full-width com 6 etapas
 *  4. RepPerformanceTable: tabela full-width
 *  5. Grid 2 colunas em desktop:
 *     - StageTimeCard (esquerda): 4 mini-cards com semáforo
 *     - CoolingLeadsCard (direita): top 6 leads em risco
 *
 * Em mobile (`<lg`): tudo full-width empilhado.
 *
 * Filtros (período/vendedor) ficaram fora desta versão pra manter escopo
 * curto. Entram em iteração futura ou em M8 quando virar Server Action.
 *
 * Em M8 essa view passa a hidratar com dados reais (Server Component que
 * lê deals/leads via Prisma + RLS, passa snapshot inicial pro client).
 */
export function ReportsView() {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Relatórios"
        description="Como seu time vem performando — funil, conversão, ranking e leads em risco."
      />

      <SummaryKpis />

      <ConversionFunnel />

      <RepPerformanceTable />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StageTimeCard />
        <CoolingLeadsCard />
      </div>
    </div>
  );
}
