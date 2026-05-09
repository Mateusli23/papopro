'use client';

import * as React from 'react';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Badge, Button, cn, EmptyState } from '@papopro/ui';
import { Inbox, PlusCircle } from '@papopro/ui/icons';

import type { Lead, PipelineStage } from '@/features/leads/types';
import { formatCentsCompact } from '@/lib/utils/format';

import { KanbanCard } from './kanban-card';

/**
 * Coluna do Kanban — header com nome + contagem + soma, lista vertical
 * de cards, e botão "+ adicionar lead nesta etapa" no rodapé.
 *
 * Cada coluna registra um `useDroppable` próprio pra que mesmo colunas
 * vazias aceitem drop (o `SortableContext` sozinho ignora colunas sem
 * itens).
 */
interface KanbanColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  onAddLead?: (stageId: string) => void;
}

export function KanbanColumn({ stage, leads, onAddLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage.id}`,
    data: { stageId: stage.id, type: 'column' },
  });

  const totalCents = leads.reduce((acc, l) => acc + (l.valueCents || 0), 0);

  return (
    <div className="bg-muted/40 flex h-full min-h-[300px] w-72 shrink-0 flex-col gap-2 rounded-lg p-2">
      <header className="flex items-center justify-between gap-2 px-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-body text-foreground truncate font-semibold">{stage.name}</h2>
          <Badge variant="secondary" className="h-5 px-1.5">
            {leads.length}
          </Badge>
        </div>
        <span className="text-caption text-muted-foreground tabular-nums">
          {formatCentsCompact(totalCents)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 rounded-md p-1 transition-colors',
          isOver && 'bg-primary/10 ring-primary/30 ring-2',
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <EmptyState
                icon={Inbox}
                title="Sem leads aqui"
                description="Arraste cards de outras etapas ou adicione um novo."
                className="border-0 bg-transparent p-2"
              />
            </div>
          ) : (
            leads.map((lead) => <KanbanCard key={lead.id} lead={lead} />)
          )}
        </SortableContext>
      </div>

      {onAddLead && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground justify-start"
          onClick={() => onAddLead(stage.id)}
        >
          <PlusCircle /> Adicionar lead
        </Button>
      )}
    </div>
  );
}
