import { notFound, redirect } from 'next/navigation';

import type { Metadata } from 'next';

import {
  getActiveSimulationState,
  getAgentDetailById,
  listAgentOptions,
} from '@/features/agents/queries';
import { listDefaultPipeline } from '@/features/leads/queries';
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

  const [agent, simulationState, agentOptions, pipeline] = await Promise.all([
    getAgentDetailById(workspaceId, params.id),
    getActiveSimulationState(workspaceId, params.id),
    listAgentOptions(workspaceId),
    listDefaultPipeline(workspaceId),
  ]);

  if (!agent) notFound();

  // Opções dos Selects do painel de handoff (M11#6): agentes-alvo do
  // `agent_to_agent` e etapas do `stage_negotiation`.
  const stageOptions = (pipeline?.stages ?? []).map((s) => ({ id: s.id, name: s.name }));

  return (
    <AgentEditorView
      agent={agent}
      initialSimulationState={simulationState}
      callerRole={callerMembership.role}
      agentOptions={agentOptions}
      stageOptions={stageOptions}
    />
  );
}
