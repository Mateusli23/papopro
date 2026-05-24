'use client';

import * as React from 'react';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import type { DragMoveEvent } from '@/app/(dashboard)/kanban/kanban-view';
import type { PipelineStage } from '@/features/leads/types';

import type { Deal } from '../types';

import { DealCard } from './deal-card';
import { DealsKanbanColumn } from './deals-kanban-column';

/**
 * Pipeline Kanban dos deals — versão M8#3 (server-fed, controlada).
 *
 * Componente **controlado**: recebe `deals` por prop (estado otimista
 * gerenciado pelo container `KanbanView`) e emite `onDrop(DragMoveEvent)`
 * a cada drag finalizado. Não tem state interno de deals.
 *
 * Sensores idênticos ao M4 (PointerSensor + TouchSensor + KeyboardSensor)
 * — mudar agora só por causa do server seria regressão de UX. Cf.
 * commits anteriores pra contexto histórico do `delay: 250` no Touch.
 */

interface DealsKanbanBoardProps {
  deals: Deal[];
  stages: PipelineStage[];
  canEdit: boolean;
  onAddDeal?: (stageId: string) => void;
  onDrop: (event: DragMoveEvent) => void;
  /** Quando passado, cards mostram menu "Editar negócio" no canto. */
  onEditDeal?: (deal: Deal) => void;
}

export function DealsKanbanBoard({
  deals,
  stages,
  canEdit,
  onAddDeal,
  onDrop,
  onEditDeal,
}: DealsKanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Agrupa deals por stage, mantendo a ordem persistida em `orderInStage`.
  // Tie-break por `createdAt` desc (mais novo primeiro) cobre fixtures sem
  // `orderInStage` (todos com 0) — sort estável dá a ordem visual desejada.
  const dealsByStage = React.useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of deals) {
      const list = map.get(deal.stageId);
      if (list) list.push(deal);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const oa = a.orderInStage ?? 0;
        const ob = b.orderInStage ?? 0;
        if (oa !== ob) return oa - ob;
        // Tie-break: mais recente primeiro
        return b.createdAt.localeCompare(a.createdAt);
      });
    }
    return map;
  }, [deals, stages]);

  const activeDeal = React.useMemo(
    () => (activeId ? (deals.find((d) => d.id === activeId) ?? null) : null),
    [deals, activeId],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return; // defesa-em-profundidade — sensors já desativados se !canEdit
    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    const overData = over.data.current as
      | { type?: string; stageId?: string; deal?: Deal }
      | undefined;

    // Drop direto numa coluna vazia: `over.data.type === 'column'`.
    // Drop sobre outro deal: `over.data.deal` carrega o vizinho.
    const targetStageId =
      overData?.type === 'column' && overData.stageId
        ? overData.stageId
        : (overData?.deal?.stageId ?? null);
    if (!targetStageId) return;

    // Calcula `beforeId`/`afterId` no contexto do destino.
    const targetList = dealsByStage.get(targetStageId) ?? [];
    let beforeId: string | undefined;
    let afterId: string | undefined;

    if (overData?.type === 'column') {
      // Drop direto na coluna: vai pro FINAL (após o último deal).
      const last = targetList.filter((d) => d.id !== dealId).slice(-1)[0];
      beforeId = last?.id;
      afterId = undefined;
    } else if (overData?.deal) {
      // Drop sobre outro deal. Determina before/after considerando que estamos
      // entre o deal alvo e o seu vizinho (decisão simplificada: cai antes do alvo).
      const overDealId = overData.deal.id;
      const overIdx = targetList.findIndex((d) => d.id === overDealId);
      if (overIdx >= 0) {
        // Filtra o próprio deal sendo movido (cross-stage não precisa, intra-stage sim).
        const idxAdjusted =
          deal.stageId === targetStageId
            ? targetList.findIndex((d) => d.id === overDealId)
            : overIdx;
        const prevDeal = targetList[idxAdjusted - 1];
        beforeId = prevDeal && prevDeal.id !== dealId ? prevDeal.id : undefined;
        afterId = overDealId !== dealId ? overDealId : undefined;
      }
    }

    // Bail-out: drop no mesmo lugar exato (mesma stage + mesma posição).
    if (
      deal.stageId === targetStageId &&
      beforeId === undefined &&
      afterId === undefined &&
      targetList.length === 1
    ) {
      return;
    }

    onDrop({
      dealId,
      toStageId: targetStageId,
      beforeId,
      afterId,
    });
  }

  return (
    <DndContext
      sensors={canEdit ? sensors : []}
      collisionDetection={closestCenter}
      autoScroll={{ threshold: { x: 0.1, y: 0.1 }, acceleration: 5 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="-mx-4 flex touch-pan-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {stages.map((stage) => (
          <div key={stage.id} data-stage={stage.id}>
            <DealsKanbanColumn
              stage={stage}
              deals={dealsByStage.get(stage.id) ?? []}
              onAddDeal={canEdit ? onAddDeal : undefined}
              onEditDeal={canEdit ? onEditDeal : undefined}
            />
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {activeDeal ? (
          <div className="w-[300px]">
            <DealCard deal={activeDeal} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
