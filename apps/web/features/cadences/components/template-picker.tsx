'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';
import { Briefcase, Gem, Home, SquarePen, type LucideIcon } from '@papopro/ui/icons';

import { CADENCE_TEMPLATES } from '@/lib/fixtures/cadence-templates';

import type { CadenceTemplate, CadenceTemplateKey } from '../types';

/**
 * Cards de seleção de template no `CadenceCreateDialog` (passo 1).
 *
 * Visual estilo radio-card (não usa <RadioGroup>): card inteiro vira o
 * controle. Foco e seleção são síncronos (controlled). Preview do nº de
 * passos + canais ajuda a entender o conteúdo antes de escolher.
 *
 * Acessibilidade: cada card é `role="radio"` com `aria-checked`. A
 * navegação por teclado em `tab + enter/space` funciona via `<button>`.
 */

const ICON_MAP: Record<CadenceTemplate['iconKey'], LucideIcon> = {
  home: Home,
  briefcase: Briefcase,
  gem: Gem,
  'square-pen': SquarePen,
};

interface TemplatePickerProps {
  value: CadenceTemplateKey | null;
  onChange: (key: CadenceTemplateKey) => void;
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  // Usamos `aria-pressed` (toggle pattern) em vez de `radiogroup` porque
  // `radiogroup` exige navegação por setas (←↑→↓) que não implementamos.
  // Tab + Enter/Space funcionam nativamente em <button>, suficiente aqui.
  return (
    <div
      role="group"
      aria-label="Templates de cadência"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {CADENCE_TEMPLATES.map((tpl) => {
        const Icon = ICON_MAP[tpl.iconKey];
        const selected = value === tpl.key;
        const channels = summarizeChannels(tpl);
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
              {tpl.steps.length > 0 ? (
                <span className="text-caption text-muted-foreground tabular-nums">
                  {tpl.steps.length} passos
                </span>
              ) : (
                <span className="text-caption text-muted-foreground">do zero</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-body text-foreground font-semibold">{tpl.label}</span>
              <span className="text-caption text-muted-foreground line-clamp-2">
                {tpl.description}
              </span>
            </div>
            <div className="text-caption text-muted-foreground/80 mt-1 flex flex-wrap gap-x-2">
              <span>{channels}</span>
              <span aria-hidden>·</span>
              <span className="line-clamp-1">{tpl.recommendedFor}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function summarizeChannels(tpl: CadenceTemplate): string {
  if (tpl.steps.length === 0) return 'Sem passos';
  const set = new Set(tpl.steps.map((s) => s.channel));
  if (set.size === 2) return 'WhatsApp + Email';
  return set.has('whatsapp') ? 'WhatsApp' : 'Email';
}
