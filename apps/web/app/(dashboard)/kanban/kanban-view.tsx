'use client';

import * as React from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { toast } from 'react-hot-toast';

import { Button, PageHeader } from '@papopro/ui';
import { List, PlusCircle } from '@papopro/ui/icons';

import { moveDealStageAction, updateDealOrderAction } from '@/features/deals/actions';
import { DealCreateDialog } from '@/features/deals/components/deal-create-dialog';
import { DealEditDialog } from '@/features/deals/components/deal-edit-dialog';
import { DealsKanbanBoard } from '@/features/deals/components/deals-kanban-board';
import { PipelineStats } from '@/features/deals/components/pipeline-stats';
import type { LeadComboboxOption } from '@/features/deals/queries';
import { computeOrderBetween } from '@/features/deals/transforms';
import type { Deal } from '@/features/deals/types';
import type { Pipeline, PipelineStage, SalesRep } from '@/features/leads/types';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import type { Role } from '@/lib/auth/require-role';

/**
 * `/kanban` — Pipeline de Negócios (M8#3 server-fed).
 *
 * Container que orquestra: PipelineStats + DealsKanbanBoard + DealCreateDialog.
 * Mantém o estado otimista (`optimisticDeals`) e despacha Server Actions no
 * drag-and-drop com rollback em erro.
 *
 * **Optimistic UI:** drop dispara `setOptimistic(applyMove)` imediato, depois
 * chama action. On error: rollback + toast destrutivo + `router.refresh()`
 * pra ressincronizar com o server (caso outra aba já tenha mudado). On
 * success: o `revalidatePath('/kanban')` do server re-fetcha o Server
 * Component e React reconcilia o `useOptimistic` automaticamente.
 *
 * **Stages do funil real:** vêm do `pipeline` carregado (UUIDs do DB).
 * Slugs (`'novo'`, `'proposta'`) só viajam via `stage.slug` pra alimentar
 * `getStageStyle()` — não são usados como ID em lugar nenhum.
 */

interface KanbanViewProps {
  initialDeals: Deal[];
  pipeline: Pipeline | null;
  salesReps: SalesRep[];
  leadOptions: LeadComboboxOption[];
  callerRole: Role;
}

/** Evento de drag — informações suficientes pra o reducer decidir o resultado. */
export interface DragMoveEvent {
  dealId: string;
  /** Etapa de destino (igual à atual = reorder, diferente = mover etapa). */
  toStageId: string;
  /** Deal logo acima do drop (no destino), se houver. */
  beforeId?: string;
  /** Deal logo abaixo do drop (no destino), se houver. */
  afterId?: string;
}

export function KanbanView({
  initialDeals,
  pipeline,
  salesReps,
  leadOptions,
  callerRole,
}: KanbanViewProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultStage, setDefaultStage] = React.useState<string | undefined>();
  const [editingDealId, setEditingDealId] = React.useState<string | null>(null);
  const searchParams = useSearchParams();

  const stages = React.useMemo(() => pipeline?.stages ?? [], [pipeline]);
  const validStageIds = React.useMemo(() => new Set(stages.map((s) => s.id)), [stages]);
  const canEdit = callerRole !== 'Viewer';

  // Reducer puro pra optimistic move: aplica a mudança no array atual sem
  // tocar no servidor. Reaproveitado em sucesso (já confirmado) e em rollback.
  const [optimisticDeals, applyOptimistic] = React.useOptimistic(
    initialDeals,
    (current: Deal[], event: DragMoveEvent): Deal[] => {
      return applyOptimisticMove(current, event, stages);
    },
  );

  function openCreate(stageId?: string) {
    if (!canEdit) return;
    setDefaultStage(stageId);
    setCreateOpen(true);
  }

  useGlobalShortcuts({ onCreateLead: () => openCreate() });

  // Deep-link `?stage=X`
  React.useEffect(() => {
    const stage = searchParams.get('stage');
    if (!stage || !validStageIds.has(stage)) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-stage="${stage}"]`);
      target?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [searchParams, validStageIds]);

  /**
   * Handler central de drop. Mover-de-etapa e reorder caem aqui;
   * a Server Action é escolhida pela diferença `fromStageId !== toStageId`.
   */
  const handleDrop = React.useCallback(
    async (event: DragMoveEvent) => {
      const dealBefore = optimisticDeals.find((d) => d.id === event.dealId);
      if (!dealBefore) return;
      const isCrossStage = dealBefore.stageId !== event.toStageId;

      // 1. Optimistic: a UI já mostra o resultado.
      applyOptimistic(event);

      // 2. Server: persiste e revalida.
      const result = isCrossStage
        ? await moveDealStageAction({
            dealId: event.dealId,
            stageId: event.toStageId,
            beforeId: event.beforeId,
            afterId: event.afterId,
          })
        : await updateDealOrderAction({
            dealId: event.dealId,
            beforeId: event.beforeId,
            afterId: event.afterId,
          });

      // 3. Toast contextual.
      if (!result.ok) {
        toast.error(result.error, { duration: 4000 });
        // `revalidatePath` no servidor não foi disparado; o Server Component
        // não vai re-fetchar. Para limpar o optimistic, força um refresh.
        if (typeof window !== 'undefined') window.location.reload();
        return;
      }
      const stageName = stages.find((s) => s.id === event.toStageId)?.name ?? '';
      const stageTone = stages.find((s) => s.id === event.toStageId)?.tone;
      if (isCrossStage) {
        if (stageTone === 'success') {
          toast.success(`🏆 ${dealBefore.title} fechado como ganho!`, { duration: 3500 });
        } else if (stageTone === 'destructive') {
          toast(`${dealBefore.title} marcado como perdido.`, { icon: '✖️', duration: 3000 });
        } else {
          toast.success(`${dealBefore.title} movido para ${stageName}.`, { duration: 2500 });
        }
      }
      // Reorder intra-coluna: silencioso (UI já mostra o novo lugar; toast seria ruidoso).
    },
    [optimisticDeals, applyOptimistic, stages],
  );

  if (!pipeline) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          title="Pipeline"
          description="Não encontramos o funil padrão do seu workspace."
        />
        <div className="bg-muted/40 text-muted-foreground mt-6 rounded-xl border p-6 text-center">
          Recarregue a página. Se persistir, contate o suporte.
        </div>
      </div>
    );
  }

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
            {canEdit && (
              <Button size="sm" onClick={() => openCreate()}>
                <PlusCircle /> Adicionar negócio
              </Button>
            )}
          </>
        }
      />

      <PipelineStats deals={optimisticDeals} />

      <DealsKanbanBoard
        deals={optimisticDeals}
        stages={stages}
        canEdit={canEdit}
        onAddDeal={canEdit ? openCreate : undefined}
        onDrop={handleDrop}
        onEditDeal={canEdit ? (d) => setEditingDealId(d.id) : undefined}
      />

      {/* Dialog de edição — lê o deal mais recente do optimisticDeals pra
          pegar mudanças aplicadas durante drag e revalidate. */}
      {editingDealId &&
        (() => {
          const editingDeal = optimisticDeals.find((d) => d.id === editingDealId);
          if (!editingDeal) return null;
          return (
            <DealEditDialog
              open={true}
              onOpenChange={(o) => {
                if (!o) setEditingDealId(null);
              }}
              deal={editingDeal}
              salesReps={salesReps}
            />
          );
        })()}

      <DealCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setDefaultStage(undefined);
        }}
        defaultStageId={defaultStage}
        stages={stages}
        salesReps={salesReps}
        leadOptions={leadOptions}
      />
    </div>
  );
}

/**
 * Aplica o resultado de um drag pro array de deals — pura, sem efeito colateral.
 * Calcula `orderInStage` otimista via midpoint dos vizinhos (mesmo helper que
 * o servidor usa). Se o servidor decidir um valor diferente (raro,
 * rebalanceamento), o `revalidatePath` reconcilia tudo.
 */
function applyOptimisticMove(deals: Deal[], event: DragMoveEvent, stages: PipelineStage[]): Deal[] {
  const idx = deals.findIndex((d) => d.id === event.dealId);
  if (idx === -1) return deals;
  const current = deals[idx]!;

  // Calcula novo orderInStage a partir dos vizinhos.
  const beforeOrder =
    event.beforeId !== undefined
      ? (deals.find((d) => d.id === event.beforeId)?.orderInStage ?? null)
      : null;
  const afterOrder =
    event.afterId !== undefined
      ? (deals.find((d) => d.id === event.afterId)?.orderInStage ?? null)
      : null;
  const newOrder = computeOrderBetween(beforeOrder, afterOrder);

  // Status automático na entrada de etapa terminal.
  const newStage = stages.find((s) => s.id === event.toStageId);
  const stageChanged = current.stageId !== event.toStageId;
  let newStatus = current.status;
  let newClosedAt = current.closedAt;
  if (stageChanged && newStage) {
    if (newStage.tone === 'success') {
      newStatus = 'won';
      newClosedAt = new Date().toISOString();
    } else if (newStage.tone === 'destructive') {
      newStatus = 'lost';
      newClosedAt = new Date().toISOString();
    } else {
      newStatus = 'open';
      newClosedAt = undefined;
    }
  }

  const next: Deal = {
    ...current,
    stageId: event.toStageId,
    // Após mover de etapa, atualiza o slug se a stage destino é conhecida
    // (a stage do pipeline já carrega o slug via `listDefaultPipeline`).
    stageSlug: newStage?.slug ?? current.stageSlug,
    orderInStage: newOrder,
    status: newStatus,
    closedAt: newClosedAt,
  };

  return [...deals.slice(0, idx), next, ...deals.slice(idx + 1)];
}
