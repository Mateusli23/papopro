import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { getBillingState } from '@/features/billing/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { getWorkspaceUsage, toWorkspaceUsageUI } from '@/lib/limits';

import { BillingView } from './billing-view';

export const metadata: Metadata = {
  title: 'Cobrança · Configurações',
  description: 'Plano atual, status da assinatura e cobrança via Stripe.',
};

/**
 * `dynamic = 'force-dynamic'` (M12#1): página depende do cookie httpOnly
 * `papopro_workspace_id`, sessão Supabase e queries reais ao banco. Sem o
 * flag, Next tenta prerender em CI sem `.env.local` e crasha.
 */
export const dynamic = 'force-dynamic';

/**
 * `/settings/billing` — **Owner only** (M12#1).
 *
 * Cobrança tem implicação financeira — Admin/Manager/Vendedor/Viewer não
 * acessam a página. Não-Owners caem em `/settings` sem aviso (mesmo padrão
 * do `/settings/cadences/cold-thresholds`).
 *
 * Server Component carrega `getBillingState` e passa snapshot pro
 * `<BillingView>` client. As mutations (assinar/gerenciar) usam Server
 * Actions; só o webhook do Stripe é Route Handler.
 */
export default async function BillingSettingsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!membership) {
    redirect('/onboarding');
  }

  if (membership.role !== 'Owner') {
    redirect('/settings');
  }

  const [state, usage] = await Promise.all([
    getBillingState(workspaceId),
    getWorkspaceUsage(workspaceId),
  ]);

  return <BillingView initialState={state} initialUsage={toWorkspaceUsageUI(usage)} />;
}
