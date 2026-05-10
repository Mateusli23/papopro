import type { Metadata } from 'next';

import { AgentEditorView } from './agent-editor-view';

export const metadata: Metadata = {
  title: 'Editar agente',
  description: 'Configure prompt, persona, roteamento e gatilhos de handoff.',
};

interface PageProps {
  params: { id: string };
}

export default function AgentDetailPage({ params }: PageProps) {
  return <AgentEditorView agentId={params.id} />;
}
