'use client';

import * as React from 'react';

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@papopro/ui';

import { AGENT_TONES } from '../schemas';
import { updateAgent } from '../store';
import type { Agent, AgentTone } from '../types';

/**
 * Persona (Textarea curto, ~240 chars) + Tone (Select 4 opções).
 *
 * Layout: 2 colunas em md+, stack em mobile. Persona ocupa 2/3 da largura
 * porque é o campo "longo"; tone fica em 1/3.
 *
 * Cada campo persiste no store imediatamente (sem debounce — esses são
 * campos curtos, render por keystroke não dói).
 */

const PERSONA_MAX = 240;

const TONE_COPY: Record<AgentTone, { label: string; description: string }> = {
  consultivo: { label: 'Consultivo', description: 'Ouve antes de propor. Faz perguntas abertas.' },
  amigavel: { label: 'Amigável', description: 'Tom próximo, casual, sem cobrança.' },
  direto: { label: 'Direto', description: 'Curto e objetivo. Não enrola.' },
  formal: { label: 'Formal', description: 'Tom institucional, sem gírias.' },
};

interface AgentPersonaFieldsProps {
  agent: Agent;
}

export function AgentPersonaFields({ agent }: AgentPersonaFieldsProps) {
  const [persona, setPersona] = React.useState(agent.persona);

  React.useEffect(() => {
    setPersona(agent.persona);
  }, [agent.persona]);

  function handlePersonaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setPersona(next);
    updateAgent(agent.id, { persona: next });
  }

  function handleToneChange(value: string) {
    updateAgent(agent.id, { tone: value as AgentTone });
  }

  const personaLen = persona.length;
  const personaOver = personaLen > PERSONA_MAX;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`persona-${agent.id}`} className="text-body font-medium">
            Persona
          </Label>
          <span
            className={cn(
              'text-caption tabular-nums',
              personaOver ? 'text-destructive font-semibold' : 'text-muted-foreground/80',
            )}
          >
            {personaLen} / {PERSONA_MAX}
          </span>
        </div>
        <Textarea
          id={`persona-${agent.id}`}
          value={persona}
          onChange={handlePersonaChange}
          rows={3}
          placeholder="ex: Sofia, SDR experiente. Curiosa, paciente, escuta antes de propor."
          aria-invalid={personaOver ? true : undefined}
        />
        <p className="text-caption text-muted-foreground/80">
          Descreva como o lead deveria perceber o agente — em 2-3 linhas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-body font-medium">Tom de voz</Label>
        <Select value={agent.tone} onValueChange={handleToneChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {TONE_COPY[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-caption text-muted-foreground/80">{TONE_COPY[agent.tone].description}</p>
      </div>
    </div>
  );
}
