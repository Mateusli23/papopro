import { notFound, redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { getLead, listDefaultPipeline, listSalesReps } from '@/features/leads/queries';
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
 * `/leads/[id]` — Server Component (M8#2). Carrega o lead + tags + open deals
 * via Prisma + RLS; `notFound()` se RLS bloquear ou registro não existir
 * (LGPD: não distingue "não existe" de "sem permissão"). Passa snapshot
 * inicial + salesReps + pipeline stages pro Client Component, que liga edição
 * inline às Server Actions de M8#2.
 *
 * **Timeline + tasks ainda mockadas** (banner visível no detail view) — viram
 * reais em M8#4.
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

  const [lead, salesReps, pipeline] = await Promise.all([
    getLead(workspaceId, params.id),
    listSalesReps(workspaceId),
    listDefaultPipeline(workspaceId),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <LeadDetailView
      lead={lead}
      salesReps={salesReps}
      stages={pipeline?.stages ?? []}
      callerRole={callerMembership.role}
    />
  );
}
