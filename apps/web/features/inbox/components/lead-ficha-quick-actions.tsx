'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';
import { Archive, ArchiveRestore } from '@papopro/ui/icons';

import { moveLeadToStage } from '@/features/leads/store';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import {
  archiveConversation,
  reassignConversation,
  unarchiveConversation,
  useConversation,
} from '../store';

/**
 * Bloco de quick actions no topo da ficha do lead — entrega 5/5 do M5#4c.
 *
 * Três ações apenas (decisão da PLAN.md):
 *   1. **Mover etapa** — Select inline. Toca o **store de leads** (não inbox)
 *      via `moveLeadToStage`, mesmo path do Kanban. Lead.stageId muda em todas
 *      as telas (dashboard, kanban, leads list, ficha).
 *   2. **Atribuir vendedor** — Select inline. Toca **só** `conversation.vendorId`
 *      via `reassignConversation`. `lead.assignedRepId` fica intacto — decisão
 *      de design confirmada com o usuário: "esta conversa vai com outra
 *      pessoa", sem efeito colateral.
 *   3. **Arquivar / Desarquivar** — botão único que troca o estado. Toast
 *      com botão "Desfazer" por 5s; clicar reverte a operação.
 *
 * Toast pattern segue o que `cadences` já usa (`react-hot-toast`). O
 * `toast.success(msg)` aceita JSX como mensagem — usamos pra colocar o
 * "Desfazer" inline. Sem rollback porque o store é mock (mutação síncrona
 * já foi aplicada antes do toast aparecer).
 *
 * **Composer em arquivada**: já desabilitado em M5#4b. Quando desarquiva,
 * o composer reabre automaticamente porque é state-derived.
 */
interface LeadFichaQuickActionsProps {
  conversationId: string;
  leadId: string;
  /** stageId atual do lead (lido do `getLead` no caller — passamos pra evitar refetch). */
  currentStageId: string;
}

export function LeadFichaQuickActions({
  conversationId,
  leadId,
  currentStageId,
}: LeadFichaQuickActionsProps) {
  const conversation = useConversation(conversationId);

  if (!conversation) return null;

  const isArchived = Boolean(conversation.archivedAt);

  const handleStageChange = (nextStageId: string) => {
    if (nextStageId === currentStageId) return;
    const previous = currentStageId;
    moveLeadToStage(leadId, nextStageId);
    showUndoableToast('Etapa atualizada', () => moveLeadToStage(leadId, previous));
  };

  const handleReassign = (nextVendorId: string) => {
    if (nextVendorId === conversation.vendorId) return;
    const previous = conversation.vendorId;
    reassignConversation(conversationId, nextVendorId);
    showUndoableToast('Vendedor atribuído', () => reassignConversation(conversationId, previous));
  };

  const handleArchiveToggle = () => {
    if (isArchived) {
      unarchiveConversation(conversationId);
      showUndoableToast('Conversa desarquivada', () => archiveConversation(conversationId));
    } else {
      archiveConversation(conversationId);
      showUndoableToast('Conversa arquivada', () => unarchiveConversation(conversationId));
    }
  };

  return (
    <div role="group" aria-labelledby="qa-heading" className="flex flex-col gap-2">
      <span id="qa-heading" className="text-caption text-muted-foreground font-medium">
        Ações rápidas
      </span>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Mover etapa */}
        <div className="flex flex-col gap-1">
          <label htmlFor="qa-stage" className="text-caption text-muted-foreground">
            Etapa
          </label>
          <Select value={currentStageId} onValueChange={handleStageChange}>
            <SelectTrigger id="qa-stage" className="text-caption h-8">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Atribuir vendedor */}
        <div className="flex flex-col gap-1">
          <label htmlFor="qa-vendor" className="text-caption text-muted-foreground">
            Vendedor
          </label>
          <Select value={conversation.vendorId} onValueChange={handleReassign}>
            <SelectTrigger id="qa-vendor" className="text-caption h-8">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              {SALES_REPS.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="button"
        variant={isArchived ? 'outline' : 'ghost'}
        size="sm"
        onClick={handleArchiveToggle}
        className={cn(
          'mt-1 justify-start gap-2',
          isArchived ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="size-3.5" />
            Desarquivar conversa
          </>
        ) : (
          <>
            <Archive className="size-3.5" />
            Arquivar conversa
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Toast com botão "Desfazer" inline. Padrão extraído pra remover duplicação
 * dos 3 handlers (review M5#4c). Cada toast captura seu `undo` por closure
 * — toasts concorrentes preservam o estado anterior independentemente.
 *
 * Em M9 quando essas ações virarem Server Actions, este helper continua
 * útil — só troca o callback síncrono por um async com optimistic update +
 * revert no erro. A UI permanece igual.
 */
function showUndoableToast(message: string, undo: () => void) {
  toast.success(
    (t) => (
      <span className="flex items-center gap-3">
        {message}
        <button
          type="button"
          onClick={() => {
            undo();
            toast.dismiss(t.id);
          }}
          className="text-primary text-caption font-semibold hover:underline"
        >
          Desfazer
        </button>
      </span>
    ),
    { duration: 5000 },
  );
}
