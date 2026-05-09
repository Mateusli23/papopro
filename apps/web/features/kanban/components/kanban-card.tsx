'use client';

import * as React from 'react';

import Link from 'next/link';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn, TemperatureBadge, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';
import { Calendar } from '@papopro/ui/icons';

import { RepAvatar } from '@/features/leads/components/rep-avatar';
import type { Lead } from '@/features/leads/types';
import { formatCentsCompact, formatDayMonth } from '@/lib/utils/format';

import { calcRotState, ROT_META } from '../rotting';

/**
 * Card individual do Kanban — denso, mas não claustrofóbico. Hierarquia:
 *  1. Nome (foreground, peso 500)
 *  2. Empresa (muted, caption)
 *  3. Valor (foreground, tabular)
 *  4. Próxima ação (warning ou muted) + temperatura no topo direito
 *  5. Vendedor avatar no rodapé esquerdo + dot de rotting no rodapé direito
 *
 * Drag handle = card inteiro (padrão Pipedrive). O `<Link>` interno fica
 * desabilitado durante o drag (`pointer-events: none`) pra não disparar
 * navegação ao soltar — esse controle vem do `KanbanBoard` via `isDragging`.
 *
 * Em M8 o `useSortable` ganha `optimisticId` real: enquanto a Server Action
 * confirma a mudança de coluna, o card já mostra o destino.
 */

interface KanbanCardProps {
  lead: Lead;
  /** Quando true, esconde o link interno (estado de overlay durante drag). */
  isOverlay?: boolean;
}

export function KanbanCard({ lead, isOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rot = calcRotState(lead);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dragging={isDragging || undefined}
      className={cn(
        'border-border bg-card relative flex cursor-grab flex-col gap-2 rounded-md border p-2.5 shadow-sm transition-shadow',
        'hover:border-primary/40 hover:shadow',
        'active:cursor-grabbing',
        isDragging && 'opacity-30',
        isOverlay && 'ring-primary/30 shadow-lg ring-2',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardLink lead={lead} dragging={isDragging || isOverlay}>
            <span className="text-body text-foreground line-clamp-1 font-medium">{lead.name}</span>
          </CardLink>
          {lead.company && (
            <span className="text-caption text-muted-foreground line-clamp-1">{lead.company}</span>
          )}
        </div>
        <TemperatureBadge temperature={lead.temperature} iconOnly />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-body text-foreground font-medium tabular-nums">
          {formatCentsCompact(lead.valueCents)}
        </span>
        {lead.nextActionAt && (
          <span
            className={cn(
              'text-caption inline-flex items-center gap-1',
              rot === 'rotten' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            <Calendar className="size-3" aria-hidden />
            {formatDayMonth(lead.nextActionAt)}
          </span>
        )}
      </div>

      <div className="border-border flex items-center justify-between border-t pt-2">
        <RepAvatar repId={lead.assignedTo} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn('inline-block size-2 rounded-full', ROT_META[rot].color)}
              aria-label={ROT_META[rot].label}
            />
          </TooltipTrigger>
          <TooltipContent>{ROT_META[rot].label}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function CardLink({
  lead,
  dragging,
  children,
}: {
  lead: Lead;
  dragging: boolean;
  children: React.ReactNode;
}) {
  // Durante o drag, qualquer click vira navegação indesejada — desliga o link
  // (e o cursor de pointer some, deixando claro que é um arraste em curso).
  // O sensor do board usa `activationConstraint: { distance: 6 }`, então
  // cliques curtos navegam normalmente; arrastes >6px ativam o drag e o
  // dnd-kit cancela o click sintético do Link.
  if (dragging) {
    return <span className="cursor-grabbing">{children}</span>;
  }
  return (
    <Link href={`/leads/${lead.id}`} className="hover:underline">
      {children}
    </Link>
  );
}
