import { differenceInCalendarDays, parseISO } from 'date-fns';

import { cn } from '@papopro/ui';
import { Calendar, Clock } from '@papopro/ui/icons';

import { formatDayMonth } from '@/lib/utils/format';

/**
 * Pill compacto pra prazo de deal — 4 estados visuais que mapeiam direto
 * pra urgência operacional do vendedor:
 *
 *  - **Atrasado** (passou): destructive + ícone Clock + pulse sutil → ação imediata
 *  - **Hoje**: warning + ícone Clock → cuidado, é hoje
 *  - **≤3 dias**: info + ícone Calendar → na semana
 *  - **Futuro**: muted + ícone Calendar → tranquilo
 *  - **Sem prazo**: muted, "—"
 *
 * Em superfícies densas (card de Kanban) usar `dense=true` pra reduzir
 * padding e mostrar só o ícone + número de dias.
 */

const NOW = new Date('2026-05-09T14:00:00-03:00');

interface DueDatePillProps {
  due?: string;
  dense?: boolean;
  className?: string;
}

export function DueDatePill({ due, dense = false, className }: DueDatePillProps) {
  if (!due) {
    return (
      <span
        className={cn(
          'text-caption text-muted-foreground/70 inline-flex items-center gap-1',
          className,
        )}
        aria-label="Sem prazo definido"
      >
        <Calendar className="size-3" aria-hidden />
        {!dense && '—'}
      </span>
    );
  }

  const days = differenceInCalendarDays(parseISO(due), NOW);
  const variant = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : 'future';

  const label =
    variant === 'overdue'
      ? `Atrasado ${Math.abs(days)}d`
      : variant === 'today'
        ? 'Hoje'
        : variant === 'soon'
          ? `${days}d`
          : formatDayMonth(due);

  const Icon = variant === 'overdue' || variant === 'today' ? Clock : Calendar;

  const tone =
    variant === 'overdue'
      ? 'bg-destructive/15 text-destructive ring-1 ring-destructive/20'
      : variant === 'today'
        ? 'bg-warning/20 text-warning ring-1 ring-warning/30'
        : variant === 'soon'
          ? 'bg-info/15 text-info ring-1 ring-info/20'
          : 'bg-muted text-muted-foreground';

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-full font-medium',
        dense ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
        tone,
        className,
      )}
      aria-label={`Prazo: ${label}`}
      title={`Prazo: ${formatDayMonth(due)}`}
    >
      <Icon className={cn('size-3', variant === 'overdue' && 'animate-pulse')} aria-hidden />
      {label}
    </span>
  );
}
