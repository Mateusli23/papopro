'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

/**
 * Hint visual dos placeholders disponíveis pro prompt do agente.
 *
 * Versão read-only do `cadences/components/placeholder-hint.tsx` — não
 * suporta inserção clicável (decisão do plano M5#5: prompt simples nesta
 * fatia, sem complexidade de caret position). Em M11 com auto-complete real
 * vem como dropdown estilo Notion.
 *
 * Os 4 placeholders aparecem em todos os templates default — vendedor
 * sabe que pode usar pra personalizar a resposta sem ter que decorar a sintaxe.
 */

export const AGENT_PLACEHOLDERS = ['{nome}', '{empresa}', '{produto}', '{vendedor}'] as const;

interface AgentPromptPlaceholdersProps {
  className?: string;
}

export function AgentPromptPlaceholders({ className }: AgentPromptPlaceholdersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-caption text-muted-foreground/80">
        Placeholders disponíveis no prompt:
      </span>
      {AGENT_PLACEHOLDERS.map((p) => (
        <span
          key={p}
          className="text-caption bg-muted text-muted-foreground rounded-md border px-2 py-0.5 font-mono"
        >
          {p}
        </span>
      ))}
    </div>
  );
}
