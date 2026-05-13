import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import {
  listDefaultPipeline,
  listLeads,
  listLeadTags,
  listSalesReps,
} from '@/features/leads/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { LeadsView } from './leads-view';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Lista densa de leads do workspace com filtros, busca e ações rápidas.',
};

/**
 * `dynamic = 'force-dynamic'` (M8#2): página depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase + queries com workspace ativo.
 * Sem o flag, Next tenta prerender em CI sem `.env.local` e crasha. Mesma
 * razão de `/settings/team/page.tsx`.
 */
export const dynamic = 'force-dynamic';

/**
 * `/leads` — Server Component carrega os 4 datasets do workspace ativo e
 * passa pro Client Component como snapshot inicial.
 *
 * **M8#2:** substitui o fixture FAKE_LEADS pelos queries Prisma + RLS. Os
 * filtros continuam client-side (volume MVP ~500 leads, filtragem
 * imperceptível em-memória); polimento posterior migra pra URL searchParams
 * + `where` server-side.
 */
export default async function LeadsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const [initialLeads, salesReps, pipeline, tags] = await Promise.all([
    listLeads(workspaceId),
    listSalesReps(workspaceId),
    listDefaultPipeline(workspaceId),
    listLeadTags(workspaceId),
  ]);

  return (
    <LeadsView
      initialLeads={initialLeads}
      salesReps={salesReps}
      pipeline={pipeline}
      tags={tags}
      callerRole={callerMembership.role}
    />
  );
}
