import { notFound, redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { getActiveSimulationState, getAgentDetailById } from '@/features/agents/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { isUuid } from '@/lib/utils/uuid';

import { AgentEditorView } from './agent-editor-view';

export const metadata: Metadata = {
  title: 'Editar agente',
  description: 'Configure prompt, persona, roteamento e gatilhos de handoff.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

/**
 * `/agents/[id]` — Server Component carrega o agente + sessão de simulation
 * ativa (se houver) e passa pro Client Component como snapshot inicial.
 *
 * 404 quando: id inválido (não-UUID), agente não existe no workspace, ou
 * foi soft-deleted. Defense-in-depth no `where` da query garante isolamento.
 */
export default async function AgentDetailPage({ params }: PageProps) {
  if (!isUuid(params.id)) notFound();

  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const [agent, simulationState] = await Promise.all([
    getAgentDetailById(workspaceId, params.id),
    getActiveSimulationState(workspaceId, params.id),
  ]);

  if (!agent) notFound();

  return (
    <AgentEditorView
      agent={agent}
      initialSimulationState={simulationState}
      callerRole={callerMembership.role}
    />
  );
}
