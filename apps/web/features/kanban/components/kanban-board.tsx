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

import { useLeads, moveLeadToStage } from '@/features/leads/store';
import type { Lead } from '@/features/leads/types';
import { ACTIVE_STAGES, getStage, getStageName } from '@/lib/fixtures/pipelines';

import { KanbanCard } from './kanban-card';
import { KanbanColumn } from './kanban-column';

/**
 * Board do Kanban. Decisões importantes:
 *
 * 1. **Sensor com `distance: 6`** — clicks <6px viram navegação no link
 *    interno do card; arrastes >6px ativam o drag e o link é cancelado
 *    automaticamente pelo dnd-kit (o `useSortable` previne o click sintético).
 *
 * 2. **Drop em cima de outra coluna** vs **drop entre cards**:
 *    - `over.data.current.type === 'column'` → drop no espaço vazio da coluna
 *    - caso contrário, `over.data.current.lead` → reordenar perto desse lead
 *      (no MVP, vamos só pra coluna; reorder dentro de uma coluna é overkill
 *      antes de termos persistência real em M8).
 *
 * 3. **Optimistic update síncrono**: `moveLeadToStage` muta o store antes
 *    do `onDragEnd` retornar, então o Re-render reflete o destino imediato.
 *    Toast confirma sutilmente.
 *
 * 4. **Etapas terminais** (Ganho/Perdido) **não** aparecem como colunas
 *    do Kanban (UX igual Pipedrive — fechados saem da visão operacional).
 */
interface KanbanBoardProps {
  /** Quando informado, cada coluna ganha um botão "+ Adicionar lead". */
  onAddLead?: (stageId: string) => void;
}

export function KanbanBoard({ onAddLead }: KanbanBoardProps = {}) {
  const leads = useLeads();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  // Map etapa → leads, ordenado por nome (estável). Em M8 entra `order`
  // explícito por etapa pra reordenar; aqui é overhead que ainda não vale.
  const leadsByStage = React.useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of ACTIVE_STAGES) {
      map.set(stage.id, []);
    }
    for (const lead of leads) {
      const stage = getStage(lead.stageId);
      if (!stage || stage.terminal) continue;
      const list = map.get(lead.stageId);
      if (list) list.push(lead);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return map;
  }, [leads]);

  const activeLead = React.useMemo(
    () => leads.find((l) => l.id === activeId) ?? null,
    [leads, activeId],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    // Identifica etapa de destino: drop direto na coluna (over.id = "column:<id>")
    // ou em cima de outro card (procura coluna pelo lead alvo).
    let targetStageId: string | null = null;
    const overData = over.data.current as
      | { type?: string; stageId?: string; lead?: Lead }
      | undefined;
    if (overData?.type === 'column' && overData.stageId) {
      targetStageId = overData.stageId;
    } else if (overData?.lead?.stageId) {
      targetStageId = overData.lead.stageId;
    }

    if (!targetStageId || targetStageId === lead.stageId) return;

    moveLeadToStage(lead.id, targetStageId);
    toast.success(`${lead.name} movido para ${getStageName(targetStageId)}.`, { duration: 3000 });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leadsByStage.get(stage.id) ?? []}
            onAddLead={onAddLead}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-72">
            <KanbanCard lead={activeLead} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
