'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Switch } from '@papopro/ui';

import { toggleCadenceStatusAction } from '../actions';
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

  const [pending, setPending] = React.useState(false);

  async function handleChange() {
    if (pending) return;
    setPending(true);
    const result = await toggleCadenceStatusAction(cadence.id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Status anterior era `cadence.status`; o action alternou.
    const next = cadence.status === 'active' ? 'pausada' : 'ativada';
    toast.success(`"${cadence.name}" ${next}.`, { duration: 3000 });
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
