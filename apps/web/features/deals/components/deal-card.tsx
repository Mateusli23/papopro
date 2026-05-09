'use client';

import * as React from 'react';

import Link from 'next/link';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';
import { Trophy, User, X as XIcon } from '@papopro/ui/icons';

import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { getLead } from '@/lib/fixtures/leads';
import { formatCentsCompact } from '@/lib/utils/format';

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
}

export function DealCard({ deal, isOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { deal },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const lead = getLead(deal.leadId);
  const stage = getStageStyle(deal.stageId);
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

      {/* Status terminal — ícone discreto no canto superior direito */}
      {isWon && (
        <Trophy className="text-success absolute right-2 top-2 size-4" aria-label="Ganho" />
      )}
      {isLost && (
        <XIcon className="text-destructive/70 absolute right-2 top-2 size-4" aria-label="Perdido" />
      )}

      {/* Título do deal */}
      <header className="pr-5">
        <DealTitleLink deal={deal} dragging={isDragging || isOverlay} />
        {lead && (
          <Link
            href={`/leads/${lead.id}`}
            className="text-caption text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 truncate"
            // Mouse/pen via PointerSensor + touch via TouchSensor: ambos
            // precisam de stopPropagation pra que long-press direto no nome
            // do lead navegue (não ative drag do card pai).
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <User className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.name}</span>
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
      <span className="text-body text-foreground line-clamp-2 cursor-grabbing font-semibold">
        {deal.title}
      </span>
    );
  }
  // O sensor do board (distance: 6) garante que clicks curtos navegam.
  return (
    <Link
      href={`/leads/${deal.leadId}`}
      className="text-body text-foreground group-hover:text-primary line-clamp-2 font-semibold"
    >
      {deal.title}
    </Link>
  );
}
