'use client';

import * as React from 'react';

import { Label, Textarea, cn } from '@papopro/ui';

import { updateAgentDraftAction } from '../actions';
import type { Agent } from '../types';

import { AgentPromptPlaceholders } from './agent-prompt-placeholders';

/**
 * Editor de prompt do agente — Textarea grande controlado, com placeholders
 * mostrados acima do campo. Chama `updateAgent(id, { prompt })` em cada
 * keystroke (debounced 250ms) — sem auto-save de versão (mock leve).
 *
 * Caracteres mostrados em tempo real (max 4000 do schema). Visual de
 * "perto do limite" quando passa de 80%.
 *
 * Decisão de design (plano M5#5): textarea simples sem chips clicáveis.
 * Chips de inserção entram em M11 com Tippy + caret position se necessário.
 */

const PROMPT_MAX = 4000;
// Debounce maior em M11#3 (Server Action vai pro DB; 250ms causaria N
// chamadas redundantes). 800ms balanceia UX e custo de roundtrip.
const SAVE_DEBOUNCE_MS = 800;

interface AgentPromptEditorProps {
  agent: Agent;
}

export function AgentPromptEditor({ agent }: AgentPromptEditorProps) {
  // Local state pra tipo fluido sem esperar o re-render do store.
  // `useEffect` sincroniza com o agente quando muda externamente (ex:
  // restoreVersion troca o draft via store).
  const [draft, setDraft] = React.useState(agent.prompt);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza quando o store muda externamente (ex: restoreVersion).
  // Usamos `agent.prompt` como dep — nunca compare draft com agent ou
  // entramos em loop infinito (digita → updateAgent → store muda → effect
  // resetaria draft).
  //
  // **Fix code review HIGH M5#5**: cancelar debounce pendente no sync. Sem
  // isso, sequência "digita X → restaurar versão antes de 250ms passar" faz
  // o setTimeout antigo escrever X de volta no store, anulando o restore.
  // Mesma proteção vale pra navegação entre agentes e duplicate.
  React.useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDraft(agent.prompt);
  }, [agent.prompt]);

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setDraft(next);
    // Debounce — store update otimista mas evita re-render por keystroke.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void updateAgentDraftAction(agent.id, { prompt: next });
    }, SAVE_DEBOUNCE_MS);
  }

  const len = draft.length;
  const nearLimit = len > PROMPT_MAX * 0.8;
  const overLimit = len > PROMPT_MAX;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`prompt-${agent.id}`} className="text-body font-medium">
          Prompt do agente
        </Label>
        <span
          className={cn(
            'text-caption tabular-nums',
            overLimit
              ? 'text-destructive font-semibold'
              : nearLimit
                ? 'text-warning'
                : 'text-muted-foreground/80',
          )}
          aria-live="polite"
        >
          {len} / {PROMPT_MAX}
        </span>
      </div>

      <AgentPromptPlaceholders />

      <Textarea
        id={`prompt-${agent.id}`}
        value={draft}
        onChange={handleChange}
        rows={10}
        placeholder="Você é um vendedor experiente que..."
        aria-invalid={overLimit ? true : undefined}
        className="text-body font-mono"
      />

      <p className="text-caption text-muted-foreground/80">
        Descreva o objetivo do agente, instruções, exemplos de resposta. Quanto mais específico,
        mais consistente fica.
      </p>
    </div>
  );
}
