'use client';

import * as React from 'react';

import {
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from '@papopro/ui';

import { updateHandoffTriggerAction } from '../actions';
import type { Agent, HandoffTrigger, HandoffTriggerKind } from '../types';

/**
 * Painel de gatilhos de handoff (PRD §3.9 / M11#6).
 *
 * 6 gatilhos sempre presentes: vendedor liga/desliga cada um e ajusta a
 * config quando aplicável:
 *   - `keyword` / `agent_to_agent` → palavras-chave
 *   - `agent_to_agent`            → agente IA de destino (`<Select>`)
 *   - `stage_negotiation`         → etapa que dispara o handoff (`<Select>`)
 *
 * Em runtime (M11#6) o roteador consulta esse estado: keyword/intenção
 * comercial → handoff pra humano; `agent_to_agent` → troca de agente;
 * `stage_negotiation` → hook na mudança de etapa do lead.
 */

interface HandoffMeta {
  label: string;
  description: string;
  hasKeywords?: boolean;
  keywordsPlaceholder?: string;
  /** Mostra `<Select>` de agente de destino (gatilho `agent_to_agent`). */
  hasTargetAgent?: boolean;
  /** Mostra `<Select>` de etapa do funil (gatilho `stage_negotiation`). */
  hasStage?: boolean;
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
    description: 'Quando a IA detectar interesse em fechar (quero contratar, quanto fica).',
  },
  stage_negotiation: {
    label: 'Etapa Negociação',
    description: 'Ao mover o lead pra etapa escolhida, o humano assume automaticamente.',
    hasStage: true,
  },
  outside_business_hours: {
    label: 'Fora do horário',
    description: 'Fora do horário comercial (9h–21h), a IA para e o humano assume.',
  },
  agent_to_agent: {
    label: 'Outro agente IA',
    description: 'Passa pra outro agente IA quando o lead falar uma destas palavras.',
    hasKeywords: true,
    keywordsPlaceholder: 'proposta, fechar, orçamento',
    hasTargetAgent: true,
  },
};

interface AgentHandoffPanelProps {
  agent: Agent;
  /** Outros agentes do workspace — opções do `<Select>` de `agent_to_agent`. */
  agentOptions: Array<{ id: string; name: string }>;
  /** Etapas do pipeline default — opções do `<Select>` de `stage_negotiation`. */
  stageOptions: Array<{ id: string; name: string }>;
}

export function AgentHandoffPanel({ agent, agentOptions, stageOptions }: AgentHandoffPanelProps) {
  // Agente não pode passar pra si mesmo — filtra o próprio fora da lista.
  const targetAgentOptions = agentOptions.filter((a) => a.id !== agent.id);

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
          <HandoffRow
            key={trigger.id}
            agentId={agent.id}
            trigger={trigger}
            targetAgentOptions={targetAgentOptions}
            stageOptions={stageOptions}
          />
        ))}
      </ul>
    </Card>
  );
}

interface HandoffRowProps {
  agentId: string;
  trigger: HandoffTrigger;
  targetAgentOptions: Array<{ id: string; name: string }>;
  stageOptions: Array<{ id: string; name: string }>;
}

function HandoffRow({ agentId, trigger, targetAgentOptions, stageOptions }: HandoffRowProps) {
  const meta = META[trigger.kind];
  const [keywordsRaw, setKeywordsRaw] = React.useState(trigger.config?.keywords?.join(', ') ?? '');

  // Sync com trigger só quando o **valor canônico** mudou — não a cada
  // rerender. `trigger.config?.keywords` é nova referência a cada mutação no
  // store; comparamos pela string canônica pra não resetar o input enquanto
  // o usuário digita.
  const canonicalKeywords = trigger.config?.keywords?.join(', ') ?? '';
  const lastSyncedRef = React.useRef(canonicalKeywords);
  React.useEffect(() => {
    if (canonicalKeywords !== lastSyncedRef.current) {
      lastSyncedRef.current = canonicalKeywords;
      setKeywordsRaw(canonicalKeywords);
    }
  }, [canonicalKeywords]);

  /** Persiste o trigger preservando os campos de config não tocados. */
  async function persist(patch: {
    enabled?: boolean;
    keywords?: string[];
    targetAgentId?: string;
    stageId?: string;
  }) {
    await updateHandoffTriggerAction(agentId, {
      kind: trigger.kind,
      enabled: patch.enabled ?? trigger.enabled,
      config: {
        keywords: patch.keywords ?? trigger.config?.keywords,
        targetAgentId: patch.targetAgentId ?? trigger.config?.targetAgentId,
        stageId: patch.stageId ?? trigger.config?.stageId,
      },
    });
  }

  async function handleToggle(checked: boolean) {
    await persist({ enabled: checked });
  }

  async function handleKeywordsBlur() {
    const keywords = keywordsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await persist({ keywords });
  }

  // Gatilho `agent_to_agent` sem destino OU `stage_negotiation` sem etapa:
  // ligado mas incompleto — não dispara em runtime. UI avisa.
  const missingTarget = trigger.enabled && meta.hasTargetAgent && !trigger.config?.targetAgentId;
  const missingStage = trigger.enabled && meta.hasStage && !trigger.config?.stageId;

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

      {trigger.enabled && meta.hasTargetAgent && (
        <div className="flex flex-col gap-1">
          <Select
            value={trigger.config?.targetAgentId || undefined}
            onValueChange={(value) => persist({ targetAgentId: value })}
            disabled={targetAgentOptions.length === 0}
          >
            <SelectTrigger className="text-caption h-8" aria-label="Agente de destino">
              <SelectValue
                placeholder={
                  targetAgentOptions.length === 0
                    ? 'Crie outro agente primeiro'
                    : 'Escolha o agente de destino'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {targetAgentOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {missingTarget && (
            <p className="text-caption text-warning">
              Escolha o agente de destino — sem ele o handoff não dispara.
            </p>
          )}
        </div>
      )}

      {trigger.enabled && meta.hasStage && (
        <div className="flex flex-col gap-1">
          <Select
            value={trigger.config?.stageId || undefined}
            onValueChange={(value) => persist({ stageId: value })}
            disabled={stageOptions.length === 0}
          >
            <SelectTrigger className="text-caption h-8" aria-label="Etapa que dispara o handoff">
              <SelectValue placeholder="Escolha a etapa" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {missingStage && (
            <p className="text-caption text-warning">
              Escolha a etapa — sem ela o handoff não dispara.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
