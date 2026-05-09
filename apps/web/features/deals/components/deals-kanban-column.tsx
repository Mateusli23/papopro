'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Badge, Button, cn } from '@papopro/ui';
import { Plus, Sparkles, Trophy, X as XIcon } from '@papopro/ui/icons';

import type { PipelineStage } from '@/features/leads/types';
import { formatCentsCompact } from '@/lib/utils/format';

import { getStageStyle } from '../stage-style';
import type { Deal } from '../types';

import { DealCard } from './deal-card';

/**
 * Coluna do Pipeline Kanban. Anatomia:
 *
 *  ┌─ stripe colorido (3px) ─┐
 *  ├─ header (nome + count + soma) ─┤
 *  ├─ cards (vertical sortable) ─┤
 *  └─ rodapé "+ adicionar" ─┘
 *
 * Cada coluna registra um `useDroppable` próprio (cobre o caso de coluna
 * vazia, em que o `SortableContext` sozinho não aceitaria drop).
 *
 * Etapas terminais (Ganho/Perdido) ganham:
 *  - Ícone temático no header (Trophy / X)
 *  - Tinge de fundo sutil (success/5 / destructive/5)
 *  - Empty state diferente ("Mova deals fechados pra cá")
 */

interface DealsKanbanColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  onAddDeal?: (stageId: string) => void;
}

export function DealsKanbanColumn({ stage, deals, onAddDeal }: DealsKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage.id}`,
    data: { stageId: stage.id, type: 'column' },
  });

  const style = getStageStyle(stage.id);
  const totalCents = deals.reduce((acc, d) => acc + d.valueCents, 0);
  const isWonColumn = stage.id === 'ganho';
  const isLostColumn = stage.id === 'perdido';
  const HeaderIcon = isWonColumn ? Trophy : isLostColumn ? XIcon : null;

  return (
    <section
      aria-label={`Etapa: ${stage.name}`}
      className={cn(
        'border-border flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border',
        style.columnTint ?? 'bg-muted/40',
      )}
    >
      {/* Stripe topo */}
      <div className={cn('h-[3px] w-full', style.stripe)} aria-hidden />

      {/* Header */}
      <header className={cn('flex flex-col gap-1 px-3 py-2.5', style.headerBg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {HeaderIcon && <HeaderIcon className={cn('size-4 shrink-0', style.headerText)} />}
            <h2 className={cn('text-body truncate font-semibold', style.headerText)}>
              {stage.name}
            </h2>
            <Badge
              variant="secondary"
              className="bg-background/80 text-foreground h-5 px-1.5 font-semibold tabular-nums"
            >
              {deals.length}
            </Badge>
          </div>
        </div>
        <div className="text-caption text-muted-foreground tabular-nums">
          {totalCents > 0 ? `${formatCentsCompact(totalCents)} em pipeline` : 'sem valor'}
        </div>
      </header>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors',
          isOver && 'bg-primary/[0.06] ring-primary/30 ring-2 ring-inset',
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.length === 0 ? (
            <ColumnEmptyState stageId={stage.id} />
          ) : (
            deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
          )}
        </SortableContext>
      </div>

      {/* Rodapé */}
      {onAddDeal && !isWonColumn && !isLostColumn && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary hover:bg-primary/5 m-1.5 justify-start gap-1.5"
          onClick={() => onAddDeal(stage.id)}
        >
          <Plus className="size-3.5" />
          Adicionar negócio
        </Button>
      )}
    </section>
  );
}

const EMPTY_HINT: Record<string, string> = {
  novo: 'Adicione o primeiro deal desta etapa.',
  em_contato: 'Mova deals daqui quando começar a conversa.',
  proposta: 'Quando enviar uma proposta, traz o deal pra cá.',
  negociacao: 'Etapa crítica — deals próximos do fechamento.',
  ganho: 'Arraste pra cá quando fechar.',
  perdido: 'Arraste pra cá quando perder — guardamos pra análise.',
};

function ColumnEmptyState({ stageId }: { stageId: string }) {
  return (
    <div className="border-border/60 text-muted-foreground bg-background/40 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-8 text-center">
      <Sparkles className="text-muted-foreground/60 size-4" aria-hidden />
      <p className="text-caption max-w-[180px]">
        {EMPTY_HINT[stageId] ?? 'Sem deals nesta etapa.'}
      </p>
    </div>
  );
}
