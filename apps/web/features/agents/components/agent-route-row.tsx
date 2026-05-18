'use client';

import * as React from 'react';

import { Badge, Button, cn } from '@papopro/ui';
import { Trash2 } from '@papopro/ui/icons';

import { getStageName } from '@/lib/fixtures/pipelines';

import { deleteRouteAction } from '../actions';
import type { AgentRoute, RouteKind } from '../types';

/**
 * Linha individual de regra de roteamento. Cada linha mostra:
 *  - chip do `kind` (etapa/tag/numero/palavra-chave)
 *  - valor formatado (etapa vira nome legível, tag vira chip, etc)
 *  - botão remover
 *
 * Match-first é semântica do array; UI mostra a posição com numeração 1, 2, 3.
 */

const KIND_LABEL: Record<RouteKind, string> = {
  stage: 'Etapa',
  tag: 'Tag',
  whatsapp_number: 'Número',
  keyword: 'Palavra-chave',
};

const KIND_TONE: Record<RouteKind, 'secondary' | 'info' | 'success' | 'warning'> = {
  stage: 'info',
  tag: 'secondary',
  whatsapp_number: 'success',
  keyword: 'warning',
};

interface AgentRouteRowProps {
  agentId: string;
  route: AgentRoute;
  index: number;
}

export function AgentRouteRow({ agentId, route, index }: AgentRouteRowProps) {
  async function handleDelete() {
    await deleteRouteAction(agentId, route.id);
  }

  // Pra `kind === 'stage'`, formata o stageId pra nome legível.
  const displayValue = route.kind === 'stage' ? getStageName(route.value) : route.value;

  return (
    <li className="border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2">
      <span
        className={cn(
          'text-caption text-muted-foreground inline-flex size-5 items-center justify-center rounded-full border font-semibold tabular-nums',
        )}
        aria-label={`Regra ${index + 1}`}
      >
        {index + 1}
      </span>
      <Badge variant={KIND_TONE[route.kind]} className="text-caption shrink-0">
        {KIND_LABEL[route.kind]}
      </Badge>
      <span className="text-body text-foreground flex-1 truncate font-medium">{displayValue}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        aria-label={`Remover regra ${index + 1}`}
        className="text-muted-foreground hover:text-destructive size-7"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
