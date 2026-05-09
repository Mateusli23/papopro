'use client';

import * as React from 'react';

import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';

import { useTasks } from '@/features/tasks/store';
import { groupTasksByDay } from '@/features/tasks/transforms';
import type { Task } from '@/features/tasks/types';

import { TASK_KIND_META } from './task-kind-icon';

/**
 * Vista de mês — grid 7×6 com tasks compactas dentro de cada célula.
 *
 * Padrão Google Calendar / Notion Calendar: cada dia mostra até 3 chips
 * de tasks; se tiver mais, mostra "+N mais" no rodapé. Click numa célula
 * dispara `onDayClick(date)` — orquestrador (`CalendarView`) usa pra
 * navegar pra vista Dia ou abrir o modal de criação.
 *
 * Constructor da grid usa `startOfWeek(monthStart, weekStartsOn=0)` pra
 * garantir alinhamento Domingo→Sábado consistente. Sempre 6 linhas — em
 * meses curtos (4 semanas), última linha mostra dias do próximo mês com
 * opacity reduzida.
 */

const MAX_VISIBLE_TASKS = 3;

interface MonthViewProps {
  currentDate: Date;
  onDayClick?: (date: Date) => void;
  onTaskClick?: (task: Task) => void;
}

export function MonthView({ currentDate, onDayClick, onTaskClick }: MonthViewProps) {
  const tasks = useTasks();
  const grouped = React.useMemo(() => groupTasksByDay(tasks), [tasks]);

  const days = React.useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const out: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    // Garante 6 linhas (42 dias) pra altura consistente entre meses
    while (out.length < 42) {
      cursor = addDays(cursor, 1);
      out.push(cursor);
    }
    return out;
  }, [currentDate]);

  const weekDayLabels = React.useMemo(() => {
    const labels: string[] = [];
    const sample = startOfWeek(new Date(), { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) {
      labels.push(format(addDays(sample, i), 'EEE', { locale: ptBR }));
    }
    return labels;
  }, []);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="bg-muted/40 border-border grid grid-cols-7 border-b">
        {weekDayLabels.map((d) => (
          <div
            key={d}
            className="text-caption text-muted-foreground px-2 py-2 text-center font-medium uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = grouped[key] ?? [];
          const visible = dayTasks.slice(0, MAX_VISIBLE_TASKS);
          const hidden = dayTasks.length - visible.length;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(day)}
              className={cn(
                'border-border flex flex-col gap-1 border-b border-r p-1.5 text-left transition-colors',
                'hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none',
                'min-h-[96px]',
                !inMonth && 'bg-muted/20 text-muted-foreground/50',
                i % 7 === 6 && 'border-r-0',
                i >= 35 && 'border-b-0',
              )}
              aria-label={`${format(day, "dd 'de' MMMM", { locale: ptBR })} — ${dayTasks.length} tarefa${dayTasks.length === 1 ? '' : 's'}`}
            >
              <span
                className={cn(
                  'text-caption inline-flex h-5 w-5 items-center justify-center rounded-full font-medium tabular-nums',
                  today && 'bg-primary text-primary-foreground font-semibold',
                  !today && inMonth && 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </span>

              <div className="flex flex-col gap-0.5">
                {visible.map((task) => (
                  <TaskChip key={task.id} task={task} onClick={onTaskClick} />
                ))}
                {hidden > 0 && (
                  <span className="text-caption text-muted-foreground/80 px-1">+{hidden} mais</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CHIP_TONE: Record<(typeof TASK_KIND_META)[Task['kind']]['tone'], string> = {
  info: 'bg-info/15 text-info border-info/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/20 text-warning border-warning/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

function TaskChip({ task, onClick }: { task: Task; onClick?: (task: Task) => void }) {
  const meta = TASK_KIND_META[task.kind];
  const isDone = task.status === 'done';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(task);
          }}
          className={cn(
            'text-caption inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded border px-1.5 py-0.5 font-medium transition-colors hover:opacity-80',
            CHIP_TONE[meta.tone],
            isDone && 'line-through opacity-50',
          )}
        >
          <meta.Icon className="size-2.5 shrink-0" aria-hidden />
          <span className="truncate">{task.title}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {meta.label} · {format(new Date(task.dueAt), 'HH:mm')}
        <br />
        {task.title}
      </TooltipContent>
    </Tooltip>
  );
}
