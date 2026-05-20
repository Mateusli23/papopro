import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { getAgentReports } from '@/features/agents/metrics';
import type { AgentReports } from '@/features/agents/metrics.helpers';
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

import { AgentsReportsSection } from './agents-reports-section';
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
 * **Seção "Agentes IA"** (M11#7) é server-fed real: `getAgentReports`
 * agrega `agent_sessions` + `agent_messages` e desce pro
 * `<AgentsReportsSection>` (Server Component puro).
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

  const emptyAgentReports: AgentReports = {
    summary: {
      activeAgentsCount: 0,
      totalAgentsCount: 0,
      totalConversations: 0,
      overallResolutionRate: 0,
      avgResponseTimeSec: 0,
    },
    byAgent: [],
  };

  // Promise.allSettled — uma query quebrada não pode derrubar as outras.
  // `reportNonFatal` registra pra Sentry sem propagar.
  const [summaryRes, byCadenceRes, coldRes, agentReportsRes] = await Promise.allSettled([
    getCadenceReportsSummary(workspaceId),
    listCadenceReportsByCadence(workspaceId),
    listColdAlertsByStage(workspaceId, ctx.user.id, role),
    getAgentReports(workspaceId),
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

  let agentReports: AgentReports = emptyAgentReports;
  if (agentReportsRes.status === 'fulfilled') {
    agentReports = agentReportsRes.value;
  } else {
    reportNonFatal('reports.agentReports', agentReportsRes.reason);
  }

  return (
    <>
      <ReportsView />
      <div className="container mx-auto flex flex-col gap-10 px-4 pb-12 sm:px-6 lg:px-8">
        <CadencesReportsSection summary={summary} byCadence={byCadence} coldByStage={coldByStage} />
        <AgentsReportsSection summary={agentReports.summary} byAgent={agentReports.byAgent} />
      </div>
    </>
  );
}
