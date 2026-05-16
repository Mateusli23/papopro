import { notFound, redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { listActivitiesForLead } from '@/features/activities/queries';
import { listAttachmentsForLead } from '@/features/attachments/queries';
import { listAvailableCadencesForLead, listLeadEnrollments } from '@/features/cadences/queries';
import { getLead, listDefaultPipeline, listSalesReps } from '@/features/leads/queries';
import { listTasksForLead } from '@/features/tasks/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { LeadDetailView } from './lead-detail-view';

interface LeadDetailPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LeadDetailPageProps): Promise<Metadata> {
  // generateMetadata roda fora do request normal — sem cookie no contexto
  // do fetch (apenas no body do request). Em vez de re-buscar tudo aqui
  // (overhead + duplicação), fica fixo com placeholder; o `<title>` final
  // é setado dinamicamente pelo Server Component que carrega o lead real.
  return {
    title: `Lead #${params.id.slice(0, 8)}…`,
  };
}

/**
 * `/leads/[id]` — Server Component (M8#4). Carrega lead + tags + open deals
 * + activities + tasks via Prisma + RLS; `notFound()` se RLS bloquear ou
 * registro não existir (LGPD: não distingue "não existe" de "sem permissão").
 *
 * **M8#4:** banner mock removido — timeline + tasks são reais agora.
 */
export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const [
    lead,
    salesReps,
    pipeline,
    initialActivities,
    initialTasks,
    initialAttachments,
    initialEnrollments,
    availableCadences,
  ] = await Promise.all([
    getLead(workspaceId, params.id),
    listSalesReps(workspaceId),
    listDefaultPipeline(workspaceId),
    listActivitiesForLead(workspaceId, params.id),
    listTasksForLead(workspaceId, params.id),
    listAttachmentsForLead(workspaceId, params.id),
    listLeadEnrollments(workspaceId, params.id),
    listAvailableCadencesForLead(workspaceId),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <LeadDetailView
      lead={lead}
      salesReps={salesReps}
      stages={pipeline?.stages ?? []}
      initialActivities={initialActivities}
      initialTasks={initialTasks}
      initialAttachments={initialAttachments}
      initialEnrollments={initialEnrollments}
      availableCadences={availableCadences}
      callerUserId={ctx.user.id}
      callerRole={callerMembership.role}
    />
  );
}
