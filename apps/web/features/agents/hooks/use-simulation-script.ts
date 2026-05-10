'use client';

import * as React from 'react';

import { getAgentTemplate } from '@/lib/fixtures/agent-templates';

import type { Agent } from '../types';

/**
 * Hook que controla o chat de simulação canned.
 *
 * Cada template tem um `simulationScript` de 3-4 turnos alternando
 * `out`/`in`. Vendedor digita → próxima mensagem `in` da fila aparece com
 * delay 800ms (typing indicator). Quando esgota o script, chat mostra
 * "Roteiro de simulação esgotado — clique em Limpar pra recomeçar."
 *
 * Reset acontece quando:
 *  - usuário clica em "Limpar"
 *  - `agentId` muda (navegou pra outro agente)
 *  - `templateKey` muda (mas isso não muda no editor — só seria relevante se
 *    permitíssemos trocar template depois de criado, que não permitimos)
 */

const TYPING_DELAY_MS = 800;

interface SimulatedMessage {
  id: string;
  direction: 'in' | 'out';
  body: string;
  createdAt: number;
}

interface UseSimulationScriptResult {
  messages: SimulatedMessage[];
  isTyping: boolean;
  exhausted: boolean;
  send: (text: string) => void;
  reset: () => void;
}

export function useSimulationScript(agent: Agent): UseSimulationScriptResult {
  const [messages, setMessages] = React.useState<SimulatedMessage[]>([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [scriptIndex, setScriptIndex] = React.useState(0);
  const counterRef = React.useRef(0);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset ao trocar agente.
  React.useEffect(() => {
    setMessages([]);
    setScriptIndex(0);
    setIsTyping(false);
    counterRef.current = 0;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [agent.id]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Resolve o script — usa templateKey do agente; fallback pra "blank" se
  // não tem template (agente custom).
  const script = React.useMemo(() => {
    const tpl = agent.templateKey ? getAgentTemplate(agent.templateKey) : undefined;
    return tpl?.simulationScript ?? [];
  }, [agent.templateKey]);

  // Mensagens `in` da fila (filtra os `out` do script — esses são "exemplos
  // do que o lead pode falar" e não são mostrados; só os `in` aparecem
  // quando o vendedor digita).
  const inMessages = React.useMemo(() => script.filter((s) => s.direction === 'in'), [script]);

  function nextId(): string {
    counterRef.current += 1;
    return `sim_${counterRef.current}`;
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isTyping) return; // ignora se ainda está "digitando"

    const userMsg: SimulatedMessage = {
      id: nextId(),
      direction: 'out',
      body: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Próxima resposta do agente — se ainda há na fila.
    const nextInMessage = inMessages[scriptIndex];
    if (!nextInMessage) return; // exhausted — não responde mais

    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      const agentMsg: SimulatedMessage = {
        id: nextId(),
        direction: 'in',
        body: nextInMessage.body,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setScriptIndex((s) => s + 1);
      setIsTyping(false);
    }, TYPING_DELAY_MS);
  }

  function reset() {
    setMessages([]);
    setScriptIndex(0);
    setIsTyping(false);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  const exhausted = scriptIndex >= inMessages.length && messages.length > 0;

  return { messages, isTyping, exhausted, send, reset };
}
