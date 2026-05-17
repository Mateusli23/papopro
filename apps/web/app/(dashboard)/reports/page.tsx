import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import {
  type CadenceReportRow,
  type CadenceReportsSummary,
  type ColdByStageRow,
  getCadenceReportsSummary,
  listCadenceReportsByCadence,
  listColdAlertsByStage,
} from '@/features/cadences/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import type { Role } from '@/lib/auth/require-role';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { reportNonFatal } from '@/lib/observability/report';

import { CadencesReportsSection } from './cadences-reports-section';
import { ReportsView } from './reports-view';

export const metadata: Metadata = {
  title: 'Relatórios',
};

/**
 * `dynamic = 'force-dynamic'` (M10#5): a seção "Cadências" agora carrega
 * dados reais via Prisma + RLS, então a página depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase. Sem o flag, Next tenta prerender
 * no CI e crasha sem `.env.local`. O `(dashboard)/layout.tsx` já marca
 * force-dynamic, mas declarar aqui também documenta a dependência local.
 */
export const dynamic = 'force-dynamic';

/**
 * `/reports` — híbrido fixture-client + server-fed (M10#5).
 *
 * **Resto da página** (KPIs/funil/rep performance/cooling leads) continua
 * via TanStack Query stores + fixtures NOW=2026-05-09 hardcoded — migração
 * total fica pra M10.x ou M13.
 *
 * **Seção "Cadências"** (M10#5) é server-fed real: 3 queries via
 * `withWorkspace(tx)` rodam aqui no Server Component e descem pro
 * `<CadencesReportsSection>` (também Server, exceto a BarChart que delega
 * pra Client porque Recharts é SVG browser-only).
 *
 * Erro em qualquer query degrada graciosamente (vazios + `reportNonFatal`)
 * em vez de derrubar a página inteira — o usuário ainda vê os blocos
 * fixture-client.
 */
export default async function ReportsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!membership) {
    redirect('/onboarding');
  }

  const role = membership.role as Role;

  const emptySummary: CadenceReportsSummary = {
    activeCadencesCount: 0,
    activeEnrollmentsCount: 0,
    dispatched30d: 0,
    responseRate30d: 0,
  };

  // Promise.allSettled — uma query quebrada não pode derrubar as outras
  // duas. `reportNonFatal` registra pra Sentry sem propagar.
  const [summaryRes, byCadenceRes, coldRes] = await Promise.allSettled([
    getCadenceReportsSummary(workspaceId),
    listCadenceReportsByCadence(workspaceId),
    listColdAlertsByStage(workspaceId, ctx.user.id, role),
  ]);

  let summary: CadenceReportsSummary = emptySummary;
  if (summaryRes.status === 'fulfilled') {
    summary = summaryRes.value;
  } else {
    reportNonFatal('reports.cadenceSummary', summaryRes.reason);
  }

  let byCadence: CadenceReportRow[] = [];
  if (byCadenceRes.status === 'fulfilled') {
    byCadence = byCadenceRes.value;
  } else {
    reportNonFatal('reports.cadenceByCadence', byCadenceRes.reason);
  }

  let coldByStage: ColdByStageRow[] = [];
  if (coldRes.status === 'fulfilled') {
    coldByStage = coldRes.value;
  } else {
    reportNonFatal('reports.coldByStage', coldRes.reason);
  }

  return (
    <>
      <ReportsView />
      <div className="container mx-auto px-4 pb-12 sm:px-6 lg:px-8">
        <CadencesReportsSection summary={summary} byCadence={byCadence} coldByStage={coldByStage} />
      </div>
    </>
  );
}
