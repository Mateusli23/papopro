import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { PlanLimitBanner } from '@/components/plan-limit-banner';
import { getTeamMembersAndInvitations } from '@/features/team/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { getWorkspaceUsage, toWorkspaceUsageUI } from '@/lib/limits';

import { TeamView } from './team-view';

export const metadata: Metadata = {
  title: 'Time · Configurações',
  description: 'Gerencie membros, convites e papéis do workspace.',
};

/**
 * **`dynamic = 'force-dynamic'` (M7#5):** a página depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase + queries admin client. Sem o
 * flag, Next tenta prerender em CI sem `.env.local` e crasha. Mesma razão de
 * `app/(dashboard)/layout.tsx` (M7#4 fix).
 */
export const dynamic = 'force-dynamic';

/**
 * `/settings/team` — gestão real de membros e convites (M7#5).
 *
 * Server Component carrega dados pelo `workspaceId` do cookie ativo,
 * identifica o papel do caller (pra UI mostrar/esconder ações) e passa tudo
 * pro Client Component. Middleware já garantiu sessão + workspace; aqui
 * defendemos contra inconsistências (ctx perdido entre middleware e action).
 */
export default async function TeamSettingsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    // Middleware deveria ter pego — mas defense-in-depth: redirect explícito
    // se o estado chega inconsistente até aqui.
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    // User logado mas sem membership no workspace ativo — cookie stale.
    redirect('/onboarding');
  }

  const [{ members, pendingInvitations }, usage] = await Promise.all([
    getTeamMembersAndInvitations(workspaceId),
    getWorkspaceUsage(workspaceId),
  ]);

  const usageUI = toWorkspaceUsageUI(usage);
  const isOwner = callerMembership.role === 'Owner';

  return (
    <div className="flex flex-col gap-4">
      <PlanLimitBanner kind="members" state={usageUI.members} isOwner={isOwner} />
      <TeamView
        initialMembers={members}
        initialPendingInvitations={pendingInvitations}
        callerRole={callerMembership.role}
        callerUserId={ctx.user.id}
      />
    </div>
  );
}
