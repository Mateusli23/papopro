import { Badge } from '@papopro/ui';

import type { AgentStatus } from '../types';

/**
 * Badge visual do status do agente. Decisão de tom:
 *  - `active` → success (vendendo o estado positivo de "funcionando")
 *  - `paused` → muted (vendedor pausou; não é erro nem urgência)
 *  - `testing` → warning (atenção: ainda não atende real)
 *
 * `aria-label` enriquecido pra leitores de tela ("Ativo, atendendo leads")
 * em vez do texto cru ("Ativo") — testers não sabem o que "Ativo" significa
 * sem o contexto.
 */

interface AgentStatusBadgeProps {
  status: AgentStatus;
  className?: string;
}

const COPY: Record<
  AgentStatus,
  { label: string; aria: string; tone: 'success' | 'secondary' | 'warning' }
> = {
  active: { label: 'Ativo', aria: 'Ativo, atendendo leads', tone: 'success' },
  paused: { label: 'Pausado', aria: 'Pausado, não atende novos leads', tone: 'secondary' },
  testing: {
    label: 'Em teste',
    aria: 'Em teste, só responde no chat de simulação',
    tone: 'warning',
  },
};

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const { label, aria, tone } = COPY[status];
  return (
    <Badge variant={tone} className={className} aria-label={aria}>
      {label}
    </Badge>
  );
}
