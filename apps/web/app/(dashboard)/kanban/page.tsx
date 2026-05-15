import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { listDeals, listLeadsForCombobox } from '@/features/deals/queries';
import { listDefaultPipeline, listSalesReps } from '@/features/leads/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { KanbanView } from './kanban-view';

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'Funil visual com drag-and-drop. Indicadores de temperatura e deal rotting.',
};

/**
 * `dynamic = 'force-dynamic'` (M8#3): depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase + queries com workspace ativo.
 * Sem o flag, Next tenta prerender em CI e crasha. Mesma razão de `/leads`.
 */
export const dynamic = 'force-dynamic';

/**
 * `/kanban` — Server Component carrega os 4 datasets do workspace ativo
 * (deals, pipeline, vendedores, leads pra combobox) e passa pro Client
 * Component como snapshot inicial.
 *
 * **M8#3:** substitui fixture FAKE_DEALS por queries Prisma + RLS. Drag-and-
 * drop dispara `moveDealStageAction`/`updateDealOrderAction` com optimistic
 * UI no client. Wrapper `<Suspense>` permanece por causa de `useSearchParams`
 * no filho (`?stage=…` deep-link).
 */
export default async function KanbanPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const [initialDeals, pipeline, salesReps, leadOptions] = await Promise.all([
    listDeals(workspaceId),
    listDefaultPipeline(workspaceId),
    listSalesReps(workspaceId),
    listLeadsForCombobox(workspaceId),
  ]);

  return (
    <Suspense>
      <KanbanView
        initialDeals={initialDeals}
        pipeline={pipeline}
        salesReps={salesReps}
        leadOptions={leadOptions}
        callerRole={callerMembership.role}
      />
    </Suspense>
  );
}
