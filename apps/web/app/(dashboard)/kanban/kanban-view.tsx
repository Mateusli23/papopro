'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button, PageHeader } from '@papopro/ui';
import { List, PlusCircle } from '@papopro/ui/icons';

import { DealCreateDialog } from '@/features/deals/components/deal-create-dialog';
import { DealsKanbanBoard } from '@/features/deals/components/deals-kanban-board';
import { PipelineStats } from '@/features/deals/components/pipeline-stats';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * `/kanban` — Pipeline de Negócios. Layout único responsivo (M4 trazia
 * dois layouts; foram unificados ao adicionar TouchSensor no board com
 * `delay: 250`):
 *
 *  - Em qualquer largura: 6 colunas lado a lado com scroll horizontal
 *    snap-x (swipe nativo no celular).
 *  - Mouse/pen: drag a partir de 6px de movimento.
 *  - Touch: long-press de 250ms ativa drag (não interfere com swipe rápido).
 *  - Teclado: Tab → Space → Arrows → Space.
 *
 * Atalho `n` abre o modal "Adicionar negócio". O botão "+ Adicionar
 * negócio" dentro de cada coluna pré-seleciona a etapa.
 *
 * Em M8 essa view passa a hidratar com dados reais (Server Component que
 * lê `deals` via Prisma + RLS, passa snapshot inicial pro client).
 */
export function KanbanView() {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultStage, setDefaultStage] = React.useState<string | undefined>();

  function openCreate(stageId?: string) {
    setDefaultStage(stageId);
    setCreateOpen(true);
  }

  useGlobalShortcuts({ onCreateLead: () => openCreate() });

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Pipeline"
        description="Arraste negócios entre etapas — as cores no header de cada coluna mapeiam o estado, o stripe lateral do card repete a etapa e o pill no rodapé indica o prazo."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leads">
                <List /> Ver leads
              </Link>
            </Button>
            <Button size="sm" onClick={() => openCreate()}>
              <PlusCircle /> Adicionar negócio
            </Button>
          </>
        }
      />

      <PipelineStats />

      <DealsKanbanBoard onAddDeal={openCreate} />

      <DealCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setDefaultStage(undefined);
        }}
        defaultStageId={defaultStage}
      />
    </div>
  );
}
