'use client';

import * as React from 'react';

import { addDays, endOfWeek, format, isToday, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { cn } from '@papopro/ui';

import { useTasks } from '@/features/tasks/store';
import { groupTasksByDay } from '@/features/tasks/transforms';
import type { Task } from '@/features/tasks/types';

import { TaskRow } from './task-row';

/**
 * Vista de semana — 7 colunas verticais (Dom→Sáb), cada uma com lista
 * de tasks ordenada por hora.
 *
 * Decisão consciente: NÃO renderizar grid de horas (tipo Google Calendar
 * com row pra cada hora) porque tasks sem horário definido (só dueAt = dia)
 * ficariam órfãs. Lista vertical por dia funciona melhor pro fluxo de
 * trabalho de vendas onde "tarefa de hoje" é mais importante que "tarefa
 * das 14:00".
 *
 * Click numa coluna dispara `onDayClick` (vai pra vista Dia).
 */

interface WeekViewProps {
  currentDate: Date;
  onDayClick?: (date: Date) => void;
  onTaskClick?: (task: Task) => void;
}

export function WeekView({ currentDate, onDayClick, onTaskClick }: WeekViewProps) {
  const tasks = useTasks();
  const grouped = React.useMemo(() => groupTasksByDay(tasks), [tasks]);

  const days = React.useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    const out: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [currentDate]);

  return (
    <div className="border-border grid grid-cols-1 overflow-hidden rounded-lg border md:grid-cols-7">
      {days.map((day, i) => {
        const today = isToday(day);
        const key = format(day, 'yyyy-MM-dd');
        const dayTasks = grouped[key] ?? [];

        return (
          <div
            key={i}
            className={cn(
              'border-border flex min-h-[200px] flex-col',
              i < days.length - 1 && 'border-b md:border-b-0 md:border-r',
            )}
          >
            <button
              type="button"
              onClick={() => onDayClick?.(day)}
              className={cn(
                'border-border flex flex-col items-start gap-0.5 border-b px-3 py-2 text-left transition-colors',
                'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                today ? 'bg-primary/5' : 'bg-muted/30',
              )}
              aria-label={`Abrir dia ${format(day, "dd 'de' MMMM", { locale: ptBR })}`}
            >
              <span
                className={cn(
                  'text-caption font-medium uppercase',
                  today ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {format(day, 'EEE', { locale: ptBR })}
              </span>
              <span
                className={cn(
                  'text-title-lg font-semibold tabular-nums',
                  today ? 'text-primary' : 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
            </button>

            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {dayTasks.length === 0 ? (
                <span className="text-caption text-muted-foreground/50 px-1 py-2 text-center">
                  Sem tarefas
                </span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayTasks.map((task) => (
                    <li key={task.id} onClick={() => onTaskClick?.(task)}>
                      <TaskRow task={task} showAssignee={false} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
