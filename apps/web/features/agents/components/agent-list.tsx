'use client';

import * as React from 'react';

import { Button, EmptyState } from '@papopro/ui';
import { Bot } from '@papopro/ui/icons';

import { filterAgents } from '../transforms';
import type { Agent } from '../types';

import { AgentCard } from './agent-card';

/**
 * Lista de agentes — grid responsivo (1 col no mobile, 2 em sm+, 3 em xl+).
 * Aceita filtros pré-aplicados via props ou recebe `agents` cru e filtra
 * com `filterAgents`. Centralizar filtro aqui (vs no `AgentsView`) deixa
 * a busca otimizada — `filterAgents` é pura, fácil de memoizar.
 */

interface AgentListProps {
  agents: Agent[];
  search?: string;
  onCreateClick: () => void;
}

export function AgentList({ agents, search, onCreateClick }: AgentListProps) {
  const filtered = React.useMemo(() => filterAgents(agents, { search }), [agents, search]);

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Nenhum agente cadastrado"
        description="Comece com um template (Qualificação SDR, Atendimento ou Recuperação) ou monte do zero. Em poucos minutos seu primeiro lead recebe a conversa certa."
        action={
          <Button type="button" onClick={onCreateClick}>
            Criar primeiro agente
          </Button>
        }
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Nenhum agente nessa busca"
        description="Ajuste os termos ou limpe a busca pra ver todos os agentes do workspace."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
