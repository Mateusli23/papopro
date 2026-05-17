import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { listColdThresholds } from '@/features/cadences/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { ColdThresholdsView } from './cold-thresholds-view';

export const metadata: Metadata = {
  title: 'Lead frio · Configurações',
  description: 'Prazos sem interação por etapa do funil — defaults seedados por workspace.',
};

export const dynamic = 'force-dynamic';

/**
 * `/settings/cadences/cold-thresholds` — Owner/Admin only.
 *
 * Tabela com 5 thresholds default (seedados por M10#1 no signup): 7d Novo,
 * 14d Em Contato, 7d Proposta, 5d Negociação, 30d Global. Owner/Admin pode
 * ajustar `daysInactive` e `enabled`. O cold-lead-detector (M10#4) usa
 * esses valores pra disparar `cold_lead_alerts`.
 */
export default async function ColdThresholdsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  // Apenas Owner/Admin acessa a página.
  if (callerMembership.role !== 'Owner' && callerMembership.role !== 'Admin') {
    redirect('/settings');
  }

  const thresholds = await listColdThresholds(workspaceId);

  return <ColdThresholdsView initialThresholds={thresholds} />;
}
