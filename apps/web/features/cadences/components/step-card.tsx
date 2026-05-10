'use client';

import * as React from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@papopro/ui';
import { Edit, Mail, MessageCircle, MoreVertical, Trash2 } from '@papopro/ui/icons';

import type { CadenceStep, DayOffset } from '../types';

/**
 * Cartão de um único passo na timeline. Mostra:
 *  - bullet com `D+N` colorido conforme proximidade
 *  - badge de canal (WhatsApp ou Email)
 *  - corpo da mensagem (até 4 linhas; CSS line-clamp)
 *  - menu de ações (editar / remover)
 *
 * Cores do bullet espelham a "intensidade" do follow-up — D+0 e D+1 são
 * primary (urgência alta), D+3 a D+7 info, D+14 warning, D+30 muted.
 * Mantém um arco visual coerente na timeline.
 */

const DAY_TONE: Record<DayOffset, string> = {
  0: 'border-primary bg-primary text-primary-foreground',
  1: 'border-primary bg-primary text-primary-foreground',
  3: 'border-info/40 bg-info/15 text-info',
  7: 'border-info/40 bg-info/15 text-info',
  14: 'border-warning/40 bg-warning/15 text-warning',
  30: 'border-border bg-muted text-muted-foreground',
};

interface StepCardProps {
  step: CadenceStep;
  onEdit: (step: CadenceStep) => void;
  onDelete: (step: CadenceStep) => void;
}

export function StepCard({ step, onEdit, onDelete }: StepCardProps) {
  return (
    <div className="flex gap-3">
      {/* Bullet com D+N — sai do line guide à esquerda */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'text-caption relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 font-mono font-semibold tabular-nums',
            DAY_TONE[step.dayOffset],
          )}
        >
          D+{step.dayOffset}
        </div>
      </div>

      {/* Card */}
      <div className="border-border bg-card hover:border-primary/30 group flex flex-1 flex-col gap-2 rounded-lg border p-4 transition">
        <header className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {step.channel === 'whatsapp' ? (
              <span className="text-caption text-success bg-success/10 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium">
                <MessageCircle className="size-3" />
                WhatsApp
              </span>
            ) : (
              <span className="text-caption text-info bg-info/10 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium">
                <Mail className="size-3" />
                Email
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Ações do passo"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(step)} className="gap-2">
                <Edit className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDelete(step)} className="text-destructive gap-2">
                <Trash2 className="size-4" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <p
          className="text-body text-foreground whitespace-pre-wrap break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {highlightPlaceholders(step.templateBody)}
        </p>
      </div>
    </div>
  );
}

/**
 * Renderiza placeholders `{xxx}` com cor diferenciada — ajuda o vendedor
 * a perceber o que vai virar dado real e o que é texto fixo.
 */
function highlightPlaceholders(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\{(nome|empresa|produto)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`ph-${key++}`}
        className="bg-primary/10 text-primary text-caption rounded px-1 font-mono"
      >
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
