import type { Metadata } from 'next';

import { AgentsView } from './agents-view';

export const metadata: Metadata = {
  title: 'Agentes IA',
  description:
    'Crie agentes IA com prompts, regras de roteamento e base de conhecimento compartilhada.',
};

export default function AgentsPage() {
  return <AgentsView />;
}
