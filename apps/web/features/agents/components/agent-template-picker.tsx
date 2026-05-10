'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';
import {
  type LucideIcon,
  MessageCircle,
  Sparkles,
  SquarePen,
  ThermometerSnowflake,
} from '@papopro/ui/icons';

import { AGENT_TEMPLATES } from '@/lib/fixtures/agent-templates';

import type { AgentTemplate, AgentTemplateKey } from '../types';

/**
 * Cards de seleção de template no `AgentCreateDialog` (passo 1).
 *
 * Padrão idêntico ao `cadences/components/template-picker.tsx`: card inteiro
 * vira o controle, foco e seleção síncronos, `aria-pressed` ao invés de
 * radiogroup (Tab + Enter/Space funcionam nativamente em `<button>`).
 */

const ICON_MAP: Record<AgentTemplate['iconKey'], LucideIcon> = {
  sparkles: Sparkles,
  'message-circle': MessageCircle,
  'thermometer-snowflake': ThermometerSnowflake,
  'square-pen': SquarePen,
};

interface AgentTemplatePickerProps {
  value: AgentTemplateKey | null;
  onChange: (key: AgentTemplateKey) => void;
}

export function AgentTemplatePicker({ value, onChange }: AgentTemplatePickerProps) {
  return (
    <div
      role="group"
      aria-label="Templates de agente IA"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {AGENT_TEMPLATES.map((tpl) => {
        const Icon = ICON_MAP[tpl.iconKey];
        const selected = value === tpl.key;
        return (
          <button
            key={tpl.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tpl.key)}
            className={cn(
              'bg-card group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition',
              'hover:border-primary/40 hover:bg-muted/50',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              selected ? 'border-primary ring-primary/20 bg-primary/5 ring-2' : 'border-border',
            )}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                  selected
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground group-hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-caption text-muted-foreground" aria-hidden>
                {tpl.defaultAvatarEmoji}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-body text-foreground font-semibold">{tpl.label}</span>
              <span className="text-caption text-muted-foreground line-clamp-2">
                {tpl.description}
              </span>
            </div>
            <div className="text-caption text-muted-foreground/80 mt-1 line-clamp-1">
              {tpl.recommendedFor}
            </div>
          </button>
        );
      })}
    </div>
  );
}
