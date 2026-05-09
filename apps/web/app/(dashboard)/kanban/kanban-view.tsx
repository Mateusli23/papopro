'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button, PageHeader } from '@papopro/ui';
import { List, PlusCircle } from '@papopro/ui/icons';

import { KanbanBoard } from '@/features/kanban/components/kanban-board';
import { KanbanMobile } from '@/features/kanban/components/kanban-mobile';
import { LeadCreateDialog } from '@/features/leads/components/lead-create-dialog';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * `/kanban` — board responsivo. Em ≥md mostra colunas com drag-and-drop;
 * em <md vira lista colapsável (`KanbanMobile`). O switch de view (Kanban
 * × Lista) leva pra `/leads` — não duplicamos a tabela aqui.
 *
 * Em M5 entram `g+k` (Kanban) e `g+l` (Leads) no `useGlobalShortcuts`,
 * junto com `n` (novo lead) — preparado em hooks/use-global-shortcuts.ts.
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
        title="Funil"
        description="Arraste cards entre etapas para mover negócios. As cores no canto sinalizam temperatura e prazo."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leads">
                <List /> Ver em lista
              </Link>
            </Button>
            <Button size="sm" onClick={() => openCreate()}>
              <PlusCircle /> Adicionar lead
            </Button>
          </>
        }
      />

      <div className="hidden md:block">
        <KanbanBoard onAddLead={openCreate} />
      </div>
      <div className="md:hidden">
        <KanbanMobile />
      </div>

      <LeadCreateDialog
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
