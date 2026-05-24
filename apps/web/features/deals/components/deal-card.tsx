'use client';

import * as React from 'react';

import Link from 'next/link';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@papopro/ui';
import { Edit, MoreVertical, Trophy, User, X as XIcon } from '@papopro/ui/icons';

import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { getLead } from '@/lib/fixtures/leads';
import { formatCentsCompact } from '@/lib/utils/format';
import { isUuid } from '@/lib/utils/uuid';

import { getStageStyle } from '../stage-style';
import type { Deal } from '../types';

import { DueDatePill } from './due-date-pill';

/**
 * Card de Deal — peça principal do Pipeline Kanban. Hierarquia visual,
 * de cima pra baixo:
 *
 *  1. **Stripe lateral** (3px) na cor da etapa — identidade cromática
 *     que o olho do vendedor reconhece sem ler nada.
 *  2. **Título do deal** (peso 600, 14px) em destaque.
 *  3. **Lead vinculado** com ícone — link que leva pro detalhe do contato.
 *  4. **Valor** em peso 600 + tabular-nums + tamanho médio — informação
 *     mais escaneada do card.
 *  5. **Footer**: avatar do vendedor (tooltip com nome) + DueDatePill.
 *
 * Estados visuais:
 *  - `won`: ícone Trophy no canto sup direito + leve tinge success
 *  - `lost`: ícone X muted + tinge destructive
 *  - hover: borda primary/40 + shadow + lift de 1px
 *  - drag: rotate 1deg + scale 1.02 + shadow-2xl + opacity 95% (via overlay)
 *
 * O card inteiro é a área de drag (padrão Pipedrive) — o `<Link>` interno
 * é cancelado automaticamente pelo dnd-kit em arrastes >6px (sensor com
 * `activationConstraint: { distance: 6 }` no board).
 */

interface DealCardProps {
  deal: Deal;
  /** Renderiza como overlay (durante drag) — esconde DnD listeners. */
  isOverlay?: boolean;
  /**
   * Quando passado, mostra menu "⋮" no canto sup direito com ação "Editar".
   * O parent (KanbanView) abre o `DealEditDialog` ao receber o callback.
   * Omitido = card read-only (ex: Viewer ou contexto fora do Kanban).
   */
  onEdit?: (deal: Deal) => void;
}

export function DealCard({ deal, isOverlay = false, onEdit }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { deal },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // M8#3: server-fed deals trazem `leadName`/`leadCompany`/`stageSlug` direto.
  // Fixtures legadas (M4) usam slug em `stageId` e dependem de `getLead`.
  // Detecta o modo pelo formato do leadId (UUID = server; senão fixture).
  const leadFromFixtures = !isUuid(deal.leadId) ? getLead(deal.leadId) : null;
  const leadName = deal.leadName ?? leadFromFixtures?.name;
  const leadIdForLink = deal.leadId;
  const stage = getStageStyle(deal.stageSlug ?? deal.stageId);
  const isWon = deal.status === 'won';
  const isLost = deal.status === 'lost';

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dragging={isDragging || undefined}
      className={cn(
        'bg-card group relative flex cursor-grab flex-col gap-2 overflow-hidden rounded-md border py-2.5 pl-3 pr-2.5 shadow-sm',
        'border-border transition-all duration-150 will-change-transform',
        'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md',
        'active:cursor-grabbing',
        // Touch UX (mobile): `touch-pan-x` deixa o browser cuidar de swipes
        // horizontais antes do TouchSensor ativar (250ms hold). `select-none`
        // evita o callout de seleção do iOS Safari durante o long-press.
        'touch-pan-x select-none',
        isDragging && 'opacity-30',
        isOverlay && 'ring-primary/30 rotate-[1deg] scale-[1.02] shadow-2xl ring-2',
        isWon && 'bg-success/[0.04]',
        isLost && 'bg-destructive/[0.04]',
      )}
    >
      {/* Stripe lateral colorido */}
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', stage.cardStripe)} aria-hidden />

      {/* Status terminal + menu de ações no canto superior direito.
          Quando o deal está won/lost, mostramos só o ícone (status >
          edição). Caso contrário, e se `onEdit` veio (caller não-Viewer),
          mostramos o menu "⋮" discreto que abre só on hover/focus pra não
          poluir a hierarquia visual do card. */}
      {isWon && (
        <Trophy className="text-success absolute right-2 top-2 size-4" aria-label="Ganho" />
      )}
      {isLost && (
        <XIcon className="text-destructive/70 absolute right-2 top-2 size-4" aria-label="Perdido" />
      )}
      {!isWon && !isLost && onEdit && !isOverlay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Ações do negócio"
              // Bloqueia drag-and-drop: o sensor do board (`distance: 6`)
              // já desambigua click vs drag, mas explícito > implícito.
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEdit(deal);
              }}
            >
              <Edit className="size-3.5" /> Editar negócio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Título do deal */}
      <header className="pr-5">
        <DealTitleLink deal={deal} dragging={isDragging || isOverlay} />
        {leadName && (
          <Link
            href={`/leads/${leadIdForLink}`}
            className="text-caption text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 truncate"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{leadName}</span>
          </Link>
        )}
      </header>

      {/* Valor */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body-lg text-foreground font-semibold tabular-nums">
          {formatCentsCompact(deal.valueCents)}
        </span>
        {deal.probability !== undefined && !isWon && !isLost && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-caption text-muted-foreground tabular-nums">
                {deal.probability}%
              </span>
            </TooltipTrigger>
            <TooltipContent>Probabilidade de fechar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Footer: avatar + prazo */}
      <footer className="border-border/60 flex items-center justify-between gap-2 border-t pt-2">
        <RepAvatar repId={deal.ownerId} />
        <DueDatePill due={deal.dueAt} dense />
      </footer>
    </article>
  );
}

function DealTitleLink({ deal, dragging }: { deal: Deal; dragging: boolean }) {
  if (dragging) {
    return (
      <span className="text-body text-foreground line-clamp-2 cursor-grabbing break-words font-semibold">
        {deal.title}
      </span>
    );
  }
  // O sensor do board (distance: 6) garante que clicks curtos navegam.
  return (
    <Link
      href={`/leads/${deal.leadId}`}
      className="text-body text-foreground group-hover:text-primary line-clamp-2 break-words font-semibold"
    >
      {deal.title}
    </Link>
  );
}
