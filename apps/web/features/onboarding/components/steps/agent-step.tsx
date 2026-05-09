'use client';

import * as React from 'react';

import { cn, Input, Label } from '@papopro/ui';
import { Sparkles } from '@papopro/ui/icons';

import { AGENT_TEMPLATES, type AgentTemplateId } from '../../schemas';

interface AgentStepProps {
  template: string | null;
  agentName: string;
  onChange: (patch: { agentTemplate?: string; agentName?: string }) => void;
}

/**
 * Passo 3 — escolha de template + nome do agente.
 *
 * UX: cards-radio em vez de Select. Os 4 templates ocupam pouco espaço e
 * dão pra o usuário ler a descrição na hora — vale o real-estate. Em M11 a
 * lista vira dinâmica (templates + agentes customizados); aqui é fixture.
 *
 * Nome do agente é só pra UI; em M11 vira `ai_agents.name` na criação real.
 */
export function AgentStep({ template, agentName, onChange }: AgentStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-title font-semibold">Crie seu primeiro agente IA</h3>
        <p className="text-muted-foreground text-body">
          O agente atende leads no WhatsApp seguindo o roteiro que você ensinar. Comece com um
          template — você pode customizar depois.
        </p>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2" aria-labelledby="agent-template-label">
        <legend id="agent-template-label" className="sr-only">
          Template do agente
        </legend>
        {AGENT_TEMPLATES.map((tpl) => {
          const isActive = template === tpl.id;
          return (
            <label
              key={tpl.id}
              htmlFor={`agent-tpl-${tpl.id}`}
              className={cn(
                'border-border bg-card relative flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-all',
                isActive
                  ? 'border-primary ring-primary/30 ring-2'
                  : 'hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <input
                id={`agent-tpl-${tpl.id}`}
                type="radio"
                name="agent-template"
                value={tpl.id}
                checked={isActive}
                onChange={() => onChange({ agentTemplate: tpl.id satisfies AgentTemplateId })}
                className="sr-only"
              />
              <div className="flex items-center gap-2">
                <Sparkles
                  className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground')}
                />
                <span className="text-foreground text-body font-medium">{tpl.label}</span>
              </div>
              <p className="text-muted-foreground text-caption">{tpl.description}</p>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-agent-name">Nome do agente</Label>
        <Input
          id="wizard-agent-name"
          placeholder="Ex: Sofia · SDR"
          value={agentName}
          onChange={(e) => onChange({ agentName: e.target.value })}
        />
        <p className="text-muted-foreground text-caption">
          O nome aparece pro lead no início da conversa.
        </p>
      </div>
    </div>
  );
}
