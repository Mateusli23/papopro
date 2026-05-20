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
import { Archive, ArchiveRestore, Bot, UserPlus } from '@papopro/ui/icons';

import {
  assumeConversationAction,
  resumeAiOnConversationAction,
} from '@/features/agents/handoff-actions';
import { moveLeadToStage } from '@/features/leads/store';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';
import { showUndoableToast } from '@/lib/utils/show-undoable-toast';

import {
  archiveConversationAction,
  transferConversationAction,
  unarchiveConversationAction,
} from '../conversation-actions';
import { useConversation } from '../store';

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
  const isAiEnabled = conversation.aiEnabled;

  const handleStageChange = (nextStageId: string) => {
    if (nextStageId === currentStageId) return;
    const previous = currentStageId;
    // moveLeadToStage continua mockado (M9#4 não migra leads/store) — UX
    // otimista mantém comportamento; migração real entra junto com Kanban
    // futuro polimento.
    moveLeadToStage(leadId, nextStageId);
    showUndoableToast('Etapa atualizada', () => moveLeadToStage(leadId, previous));
  };

  const handleReassign = async (nextVendorId: string) => {
    if (nextVendorId === conversation.vendorId) return;
    const result = await transferConversationAction({
      conversationId,
      vendorId: nextVendorId,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Vendedor atribuído.');
  };

  const handleHandoffToggle = async () => {
    if (isAiEnabled) {
      const result = await assumeConversationAction({ conversationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Você assumiu a conversa — a IA foi desligada aqui.');
    } else {
      const result = await resumeAiOnConversationAction({ conversationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('IA reativada — o agente volta a atender esta conversa.');
    }
  };

  const handleArchiveToggle = async () => {
    if (isArchived) {
      const result = await unarchiveConversationAction({ conversationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      showUndoableToast('Conversa desarquivada', async () => {
        const r = await archiveConversationAction({ conversationId });
        if (!r.ok) toast.error(r.error);
      });
    } else {
      const result = await archiveConversationAction({ conversationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      showUndoableToast('Conversa arquivada', async () => {
        const r = await unarchiveConversationAction({ conversationId });
        if (!r.ok) toast.error(r.error);
      });
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

      {/* Handoff agente↔humano (M11#6). `aiEnabled` vem do servidor; o toggle
       * passa por `assumeConversationAction`/`resumeAiOnConversationAction`. */}
      <Button
        type="button"
        variant={isAiEnabled ? 'ghost' : 'outline'}
        size="sm"
        onClick={handleHandoffToggle}
        className={cn(
          'mt-1 justify-start gap-2',
          isAiEnabled ? 'text-muted-foreground hover:text-foreground' : 'text-foreground',
        )}
      >
        {isAiEnabled ? (
          <>
            <UserPlus className="size-3.5" />
            Assumir conversa
          </>
        ) : (
          <>
            <Bot className="size-3.5" />
            Devolver pra IA
          </>
        )}
      </Button>
      {!isAiEnabled && (
        <p className="text-caption text-muted-foreground/80 -mt-1 pl-1">
          A IA está desligada nesta conversa — você está no comando.
        </p>
      )}

      <Button
        type="button"
        variant={isArchived ? 'outline' : 'ghost'}
        size="sm"
        onClick={handleArchiveToggle}
        className={cn(
          'justify-start gap-2',
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

// `showUndoableToast` extraído pra `lib/utils/show-undoable-toast.tsx` em M5#5
// — segundo consumer (versionamento de agentes IA) precisava do mesmo padrão.
