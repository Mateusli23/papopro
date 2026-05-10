'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Switch } from '@papopro/ui';

import { showUndoableToast } from '@/lib/utils/show-undoable-toast';

import { setAgentStatus, toggleAgentStatus } from '../store';
import type { Agent } from '../types';

/**
 * Switch ativo↔pausado do agente. Aplica o guard de 3 ativos no transform —
 * se já há 3 ativos, mostra toast vermelho via `react-hot-toast` e mantém
 * o switch no estado anterior (otimismo revertido instantaneamente).
 *
 * Quando o agente está em `'testing'`, o Switch reflete `false` (não-ativo)
 * e ligá-lo passa pra `'active'`. **Undo** usa `previousStatus` capturado
 * pelo transform — `testing → active` desfaz pra `testing`, não pra `paused`
 * (review HIGH M5#5).
 *
 * Padrão `onCheckedChange` do Radix Switch — funciona com Space/Enter no
 * teclado nativamente (lição da review M5#3).
 */

interface AgentStatusToggleProps {
  agent: Agent;
}

export function AgentStatusToggle({ agent }: AgentStatusToggleProps) {
  const checked = agent.status === 'active';

  function handleChange() {
    const result = toggleAgentStatus(agent.id);
    if (result.limitReached) {
      toast.error(
        'Limite do plano Pro IA: até 3 agentes ativos ao mesmo tempo. Pause um dos ativos pra liberar espaço.',
        { duration: 5000 },
      );
      return;
    }
    if (!result.agent || !result.previousStatus) return;
    const previous = result.previousStatus;
    const next = result.agent.status;
    if (next === 'active') {
      showUndoableToast(
        <span>
          <strong>{agent.name}</strong> está ativo — leads novos passam a ser atendidos.
        </span>,
        () => {
          // Restaura status exato anterior (`testing` ou `paused`), não
          // sempre `paused` — review HIGH M5#5.
          setAgentStatus(agent.id, previous);
        },
      );
    } else {
      showUndoableToast(
        <span>
          <strong>{agent.name}</strong> pausado — sem novas respostas até reativar.
        </span>,
        () => {
          setAgentStatus(agent.id, previous);
        },
      );
    }
  }

  return (
    <div
      // Botão do Switch pode receber click — paramos aqui pra que envolventes
      // (ex: Link no card) não disparem navegação. Wrapper inevitable porque
      // Radix Switch é um button puro e propagation no Radix é necessária
      // pra os atalhos de teclado (Space/Enter) funcionarem.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
      className="inline-flex items-center gap-2"
    >
      <span className="text-caption text-muted-foreground sr-only sm:not-sr-only">
        {checked ? 'Ativo' : agent.status === 'testing' ? 'Em teste' : 'Pausado'}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={handleChange}
        aria-label={checked ? `Desativar agente ${agent.name}` : `Ativar agente ${agent.name}`}
      />
    </div>
  );
}
