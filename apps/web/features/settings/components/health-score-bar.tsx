'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

import type { WhatsAppHealth } from '../types';

interface HealthScoreBarProps {
  health: WhatsAppHealth;
  className?: string;
}

const HEALTH_COPY: Record<WhatsAppHealth, { label: string; tone: string }> = {
  green: { label: 'Verde — pronto para enviar', tone: 'text-success' },
  yellow: { label: 'Amarelo — instável, monitore', tone: 'text-warning' },
  red: { label: 'Vermelho — envios pausados automaticamente', tone: 'text-destructive' },
};

const SEGMENTS: WhatsAppHealth[] = ['red', 'yellow', 'green'];

/**
 * Barra horizontal segmentada (vermelho · amarelo · verde) com indicador da
 * posição atual. Espelha o `Health Score` do glossário (CLAUDE.md §9).
 *
 * Em M9 a posição vem da Edge Function de heartbeat; aqui derivada do
 * `WhatsAppConnection.health` direto.
 */
export function HealthScoreBar({ health, className }: HealthScoreBarProps) {
  const idx = SEGMENTS.indexOf(health);
  const copy = HEALTH_COPY[health];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex h-2 overflow-hidden rounded-full">
        {SEGMENTS.map((segment, i) => (
          <div
            key={segment}
            className={cn(
              'flex-1 transition-opacity',
              segment === 'red' && 'bg-destructive',
              segment === 'yellow' && 'bg-warning',
              segment === 'green' && 'bg-success',
              i !== idx && 'opacity-25',
            )}
          />
        ))}
      </div>
      <span className={cn('text-body font-medium', copy.tone)}>{copy.label}</span>
    </div>
  );
}
