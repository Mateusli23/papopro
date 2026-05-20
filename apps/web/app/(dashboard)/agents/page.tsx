import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { AgentLimitBanner } from '@/features/agents/components/agent-limit-banner';
import { getKnowledgeBaseFields, listAgentsForWorkspace } from '@/features/agents/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { getWorkspaceUsage, toWorkspaceUsageUI } from '@/lib/limits';

import { AgentsView } from './agents-view';

export const metadata: Metadata = {
  title: 'Agentes IA',
  description:
    'Crie agentes IA com prompts, regras de roteamento e base de conhecimento compartilhada.',
};

/**
 * `dynamic = 'force-dynamic'` (M11#3): página depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase. Mesmo padrão de `/leads` e
 * `/cadences`. Sem isso, Next tenta prerender em build sem env e crasha.
 */
export const dynamic = 'force-dynamic';

/**
 * `/agents` — Server Component carrega agentes + Cérebro do workspace ativo
 * e passa pro Client Component como snapshot inicial.
 *
 * M11#3: substitui `FAKE_AGENTS`/`FAKE_KNOWLEDGE_BASE` (deletados) pelos
 * queries Prisma + RLS. Mutations no client passam por Server Actions de
 * `features/agents/actions.ts`; após cada uma, `router.refresh()` re-busca
 * via este Server Component pra eventual consistency.
 */
export default async function AgentsPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const [initialAgents, initialKb, usage] = await Promise.all([
    listAgentsForWorkspace(workspaceId),
    getKnowledgeBaseFields(workspaceId),
    getWorkspaceUsage(workspaceId),
  ]);

  const usageUI = toWorkspaceUsageUI(usage);
  const isOwner = callerMembership.role === 'Owner';

  return (
    <div className="flex flex-col gap-4">
      <AgentLimitBanner state={usageUI.activeAgents} isOwner={isOwner} />
      <AgentsView
        initialAgents={initialAgents}
        initialKb={initialKb}
        callerRole={callerMembership.role}
      />
    </div>
  );
}
