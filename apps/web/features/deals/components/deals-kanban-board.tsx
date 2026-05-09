'use client';

import * as React from 'react';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'react-hot-toast';

import { useDeals, moveDealToStage } from '@/features/deals/store';
import { DEFAULT_STAGES, getStageName } from '@/lib/fixtures/pipelines';

import type { Deal } from '../types';

import { DealCard } from './deal-card';
import { DealsKanbanColumn } from './deals-kanban-column';

/**
 * Pipeline Kanban dos deals — mostra TODAS as 6 etapas (incluindo Ganho
 * e Perdido). Drag-and-drop entre quaisquer colunas; mover pra Ganho
 * marca `status=won` + `closedAt`, pra Perdido marca `status=lost`.
 *
 * Sensor com `activationConstraint: { distance: 6 }` — clicks <6px
 * navegam pelo Link interno do card; arrastes >6px ativam o drag e o
 * dnd-kit cancela o click sintético.
 *
 * Em M8 a Server Action `moveDealStage` confirma assincronamente; aqui
 * a mutação é síncrona via store in-memory + toast.
 */

interface DealsKanbanBoardProps {
  /** Quando informado, cada coluna ganha botão "+ Adicionar negócio". */
  onAddDeal?: (stageId: string) => void;
}

export function DealsKanbanBoard({ onAddDeal }: DealsKanbanBoardProps = {}) {
  const deals = useDeals();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dealsByStage = React.useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of DEFAULT_STAGES) map.set(stage.id, []);
    for (const deal of deals) {
      const list = map.get(deal.stageId);
      if (list) list.push(deal);
    }
    // Sort: por valor decrescente nas etapas ativas, por closedAt nas terminais.
    for (const [stageId, list] of map) {
      const isTerminal = stageId === 'ganho' || stageId === 'perdido';
      list.sort((a, b) => {
        if (isTerminal) {
          const ca = a.closedAt ?? a.updatedAt;
          const cb = b.closedAt ?? b.updatedAt;
          return cb.localeCompare(ca);
        }
        return b.valueCents - a.valueCents;
      });
    }
    return map;
  }, [deals]);

  const activeDeal = React.useMemo(
    () => (activeId ? (deals.find((d) => d.id === activeId) ?? null) : null),
    [deals, activeId],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const deal = deals.find((d) => d.id === active.id);
    if (!deal) return;

    const overData = over.data.current as
      | { type?: string; stageId?: string; deal?: Deal }
      | undefined;
    const targetStageId =
      overData?.type === 'column' && overData.stageId
        ? overData.stageId
        : (overData?.deal?.stageId ?? null);

    if (!targetStageId || targetStageId === deal.stageId) return;

    moveDealToStage(deal.id, targetStageId);

    // Toast contextual por destino — terminais ganham mensagem mais celebratória.
    if (targetStageId === 'ganho') {
      toast.success(`🏆 ${deal.title} fechado como ganho!`, { duration: 3500 });
    } else if (targetStageId === 'perdido') {
      toast(`${deal.title} marcado como perdido.`, { icon: '✖️', duration: 3000 });
    } else {
      toast.success(`${deal.title} movido para ${getStageName(targetStageId)}.`, {
        duration: 2500,
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        // Scroll horizontal estilo Pipedrive — colunas têm largura fixa e
        // rolagem suave via CSS scroll-snap (helpa quando passa de 4-5 colunas).
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {DEFAULT_STAGES.map((stage) => (
          <div key={stage.id} className="snap-start">
            <DealsKanbanColumn
              stage={stage}
              deals={dealsByStage.get(stage.id) ?? []}
              onAddDeal={onAddDeal}
            />
          </div>
        ))}
      </div>

      <DragOverlay
        // Dropping animation curta + cursor de "agarrando"
        dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        {activeDeal ? (
          <div className="w-[300px]">
            <DealCard deal={activeDeal} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
