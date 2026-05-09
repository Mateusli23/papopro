'use client';

import * as React from 'react';

import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button, cn } from '@papopro/ui';
import { ChevronLeft, ChevronRight, PlusCircle } from '@papopro/ui/icons';

import type { Task } from '@/features/tasks/types';

import { DayView } from './day-view';
import { MonthView } from './month-view';
import { WeekView } from './week-view';

/**
 * Calendário com 3 vistas — orquestrador que gerencia `view` (mês/semana/dia)
 * e `currentDate` + entrega aos sub-componentes.
 *
 * Header com:
 *  - Toggle (Mês / Semana / Dia)
 *  - Navegação ← → (delta varia por vista: 1 mês / 1 semana / 1 dia)
 *  - Botão "Hoje" (reset)
 *  - Label do período corrente (ex: "Maio 2026", "12-18 mai", "12 mai")
 *  - Botão "Nova tarefa" passando o dia atual como default
 *
 * Click numa célula/dia da vista mês ou semana navega pra vista Dia
 * com aquele dia selecionado (drilldown clássico de calendário).
 */

type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  /** Data inicial — default `new Date()`. */
  initialDate?: Date;
  /** Callback quando usuário clica numa task. */
  onTaskClick?: (task: Task) => void;
  /** Callback quando usuário pede criação (header ou empty state). */
  onCreateTask?: (defaultDate?: Date) => void;
}

export function CalendarView({ initialDate, onTaskClick, onCreateTask }: CalendarViewProps) {
  const [view, setView] = React.useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = React.useState<Date>(
    () => initialDate ?? new Date('2026-05-09T14:00:00-03:00'),
  );

  function goToday() {
    setCurrentDate(new Date('2026-05-09T14:00:00-03:00'));
  }

  function goPrev() {
    if (view === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  }

  function goNext() {
    if (view === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date);
    setView('day');
  }

  const periodLabel = React.useMemo(() => {
    if (view === 'month') {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      // Se semana inteira no mesmo mês: "12-18 mai 2026"; senão: "29 abr - 5 mai 2026"
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'd', { locale: ptBR })}–${format(end, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
      }
      return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [currentDate, view]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="border-border bg-muted/30 inline-flex items-center rounded-md border p-0.5">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'text-caption rounded px-3 py-1 font-medium transition-colors',
                  view === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={view === v}
              >
                {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>

          <div className="border-border inline-flex items-center rounded-md border">
            <button
              type="button"
              onClick={goPrev}
              className="hover:bg-muted/40 flex size-8 items-center justify-center rounded-l-md transition-colors"
              aria-label="Período anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              className="rounded-none border-l border-r"
            >
              Hoje
            </Button>
            <button
              type="button"
              onClick={goNext}
              className="hover:bg-muted/40 flex size-8 items-center justify-center rounded-r-md transition-colors"
              aria-label="Próximo período"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <span className="text-body text-foreground capitalize">{periodLabel}</span>
        </div>

        {onCreateTask && (
          <Button size="sm" onClick={() => onCreateTask(currentDate)}>
            <PlusCircle /> Nova tarefa
          </Button>
        )}
      </header>

      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          onDayClick={handleDayClick}
          onTaskClick={onTaskClick}
        />
      )}
      {view === 'week' && (
        <WeekView currentDate={currentDate} onDayClick={handleDayClick} onTaskClick={onTaskClick} />
      )}
      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          onTaskClick={onTaskClick}
          onCreateForDay={onCreateTask}
        />
      )}
    </div>
  );
}
