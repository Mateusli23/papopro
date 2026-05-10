'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Switch } from '@papopro/ui';

import { toggleCadenceStatus } from '../store';
import type { Cadence } from '../types';

/**
 * Switch otimista de Ativa/Pausada. Toggle é instantâneo no store (não há
 * latência mockada) e dispara toast com a ação realizada.
 *
 * Em M8 vira Server Action — o componente continua otimista localmente
 * (TanStack Query mutation com `onMutate`), mas reverte se o backend falhar.
 *
 * O click stoppa propagação porque o toggle vive dentro do CadenceCard
 * (clicável); sem `stopPropagation`, alternar status navegaria pra
 * `/cadences/[id]`.
 */

interface CadenceStatusToggleProps {
  cadence: Cadence;
  /** Se quiser ocultar o label "Ativa/Pausada" e mostrar só o switch. */
  compact?: boolean;
}

export function CadenceStatusToggle({ cadence, compact = false }: CadenceStatusToggleProps) {
  const isActive = cadence.status === 'active';

  function handleChange() {
    const updated = toggleCadenceStatus(cadence.id);
    if (updated) {
      toast.success(
        updated.status === 'active' ? `"${updated.name}" ativada.` : `"${updated.name}" pausada.`,
        { duration: 3000 },
      );
    }
  }

  // `onClick` no wrapper só impede navegação do <Link> ancestral; a mudança
  // de estado real flui via `onCheckedChange` do Radix Switch (também aciona
  // por Space/Enter no teclado, ao contrário de `onClick`).
  return (
    <label className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {!compact && (
        <span
          className={`text-caption font-medium ${isActive ? 'text-success' : 'text-muted-foreground'}`}
        >
          {isActive ? 'Ativa' : 'Pausada'}
        </span>
      )}
      <Switch
        checked={isActive}
        onCheckedChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${isActive ? 'Pausar' : 'Ativar'} cadência ${cadence.name}`}
      />
    </label>
  );
}
