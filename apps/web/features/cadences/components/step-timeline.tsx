'use client';

import * as React from 'react';

import { Button, EmptyState } from '@papopro/ui';
import { PlusCircle, Repeat } from '@papopro/ui/icons';

import type { CadenceStep } from '../types';

import { StepCard } from './step-card';

/**
 * Timeline vertical de passos da cadência. Renderiza um line guide à
 * esquerda (linha tracejada cinza) que conecta os bullets dos `StepCard`s.
 * O guide é puramente decorativo — `aria-hidden`.
 *
 * Steps já chegam ordenados por `(dayOffset asc, order asc)` graças aos
 * transforms (`sortSteps` em `applyAddStep`/`applyUpdateStep`).
 *
 * Quando vazio, EmptyState com CTA "Adicionar primeiro passo".
 */

interface StepTimelineProps {
  steps: CadenceStep[];
  onAddStep: () => void;
  onEditStep: (step: CadenceStep) => void;
  onDeleteStep: (step: CadenceStep) => void;
}

export function StepTimeline({ steps, onAddStep, onEditStep, onDeleteStep }: StepTimelineProps) {
  if (steps.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="Cadência sem passos ainda"
        description="Adicione o primeiro passo pra definir o que enviar e quando — D+0, D+1, D+3, e assim por diante."
        action={
          <Button onClick={onAddStep}>
            <PlusCircle className="size-4" />
            Adicionar primeiro passo
          </Button>
        }
      />
    );
  }

  return (
    <div className="relative flex flex-col gap-4">
      {/* Line guide vertical — só decorativo */}
      <div
        aria-hidden
        className="border-border absolute bottom-16 left-6 top-6 -z-0 border-l-2 border-dashed"
      />

      {steps.map((step) => (
        <StepCard key={step.id} step={step} onEdit={onEditStep} onDelete={onDeleteStep} />
      ))}

      <div className="flex gap-3 pl-1">
        <div className="flex size-12 shrink-0 items-center justify-center">
          <div className="border-border size-3 rounded-full border-2 border-dashed" />
        </div>
        <Button
          variant="outline"
          onClick={onAddStep}
          className="text-muted-foreground hover:text-foreground border-dashed"
        >
          <PlusCircle className="size-4" />
          Adicionar passo
        </Button>
      </div>
    </div>
  );
}
