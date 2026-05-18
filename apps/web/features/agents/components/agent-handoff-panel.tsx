'use client';

import * as React from 'react';

import { Card, Input, Label, Switch, cn } from '@papopro/ui';

import { updateHandoffTriggerAction } from '../actions';
import type { Agent, HandoffTrigger, HandoffTriggerKind } from '../types';

/**
 * Painel de gatilhos de handoff (PRD §3.9).
 *
 * 6 gatilhos sempre presentes (criados no template): vendedor liga/desliga
 * cada um e ajusta config quando aplicável (palavras-chave para `keyword` e
 * `agent_to_agent`).
 *
 * Layout: lista vertical compacta. Cada item tem Switch + label + descrição
 * + (opcional) input de palavras-chave inline.
 *
 * Manual handoff fica sempre `enabled: true` na fixture — vendedor não
 * deveria conseguir DESABILITAR o botão "Assumir conversa". Mas mesmo assim
 * deixamos editável; em M11 vira readonly via schema.
 */

interface HandoffMeta {
  label: string;
  description: string;
  /** Se `true`, mostra input de palavras-chave abaixo do Switch quando enabled. */
  hasKeywords?: boolean;
  keywordsPlaceholder?: string;
}

const META: Record<HandoffTriggerKind, HandoffMeta> = {
  manual: {
    label: 'Manual',
    description: 'Vendedor pode assumir manualmente clicando em "Assumir conversa".',
  },
  keyword: {
    label: 'Palavra-chave',
    description: 'Quando o lead falar uma destas palavras, passa pra um humano.',
    hasKeywords: true,
    keywordsPlaceholder: 'atendente, humano, vendedor',
  },
  commercial_intent: {
    label: 'Intenção comercial',
    description: 'Quando o lead demonstrar interesse em fechar (quero contratar, quanto fica).',
  },
  stage_negotiation: {
    label: 'Etapa Negociação',
    description: 'Ao avançar pra etapa Negociação, o humano assume automaticamente.',
  },
  outside_business_hours: {
    label: 'Fora do horário',
    description: 'Fora do horário comercial (default 9h–21h), agente pausa e humano assume.',
  },
  agent_to_agent: {
    label: 'Outro agente IA',
    description: 'Passa pra outro agente IA quando o lead falar uma destas palavras.',
    hasKeywords: true,
    keywordsPlaceholder: 'proposta, fechar, orçamento',
  },
};

interface AgentHandoffPanelProps {
  agent: Agent;
}

export function AgentHandoffPanel({ agent }: AgentHandoffPanelProps) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">Gatilhos de handoff</h3>
        <p className="text-caption text-muted-foreground/80">
          Quando o agente deve passar a conversa pra um humano (ou outro agente).
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {agent.handoffTriggers.map((trigger) => (
          <HandoffRow key={trigger.id} agentId={agent.id} trigger={trigger} />
        ))}
      </ul>
    </Card>
  );
}

interface HandoffRowProps {
  agentId: string;
  trigger: HandoffTrigger;
}

function HandoffRow({ agentId, trigger }: HandoffRowProps) {
  const meta = META[trigger.kind];
  const [keywordsRaw, setKeywordsRaw] = React.useState(trigger.config?.keywords?.join(', ') ?? '');

  // Sync com trigger só quando o **valor canônico** mudou — não a cada
  // rerender (review MEDIUM M5#5). `trigger.config?.keywords` é uma nova
  // referência de array a cada mutação no store, mesmo quando outras
  // triggers do mesmo agente mudam. Comparamos pela string canônica pra
  // não resetar o input enquanto o usuário digita.
  const canonicalKeywords = trigger.config?.keywords?.join(', ') ?? '';
  const lastSyncedRef = React.useRef(canonicalKeywords);
  React.useEffect(() => {
    if (canonicalKeywords !== lastSyncedRef.current) {
      lastSyncedRef.current = canonicalKeywords;
      setKeywordsRaw(canonicalKeywords);
    }
  }, [canonicalKeywords]);

  async function handleToggle(checked: boolean) {
    await updateHandoffTriggerAction(agentId, {
      kind: trigger.kind,
      enabled: checked,
      config: trigger.config,
    });
  }

  async function handleKeywordsBlur() {
    const keywords = keywordsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await updateHandoffTriggerAction(agentId, {
      kind: trigger.kind,
      enabled: trigger.enabled,
      config: { ...trigger.config, keywords },
    });
  }

  return (
    <li
      className={cn(
        'border-border flex flex-col gap-2 rounded-md border p-3',
        trigger.enabled ? 'bg-card' : 'bg-muted/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-0.5">
          <Label
            htmlFor={`handoff-${trigger.id}`}
            className="text-body text-foreground font-medium"
          >
            {meta.label}
          </Label>
          <p className="text-caption text-muted-foreground/80">{meta.description}</p>
        </div>
        <Switch
          id={`handoff-${trigger.id}`}
          checked={trigger.enabled}
          onCheckedChange={handleToggle}
          aria-label={`${trigger.enabled ? 'Desabilitar' : 'Habilitar'} gatilho ${meta.label}`}
        />
      </div>

      {trigger.enabled && meta.hasKeywords && (
        <Input
          value={keywordsRaw}
          onChange={(e) => setKeywordsRaw(e.target.value)}
          onBlur={handleKeywordsBlur}
          placeholder={meta.keywordsPlaceholder}
          aria-label={`Palavras-chave de ${meta.label}`}
          className="text-caption"
        />
      )}
    </li>
  );
}
