'use client';

import * as React from 'react';

import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, EmptyState } from '@papopro/ui';
import { Calendar } from '@papopro/ui/icons';

import { useTasks } from '@/features/tasks/store';
import { getTasksOnDay } from '@/features/tasks/transforms';
import type { Task } from '@/features/tasks/types';

import { TaskRow } from './task-row';

/**
 * Vista de dia — lista vertical de tasks ordenada por hora.
 *
 * Mostra header com nome do dia + indicador "hoje" se aplicável. Body é
 * uma lista plana usando `TaskRow` (mesmo componente da `TaskList`),
 * mantendo coerência visual entre as 4 superfícies de tasks (Minhas /
 * Time / Semana / Dia).
 *
 * EmptyState quando não há tasks no dia — orientador, sugere criar uma.
 */

interface DayViewProps {
  currentDate: Date;
  onTaskClick?: (task: Task) => void;
  /** Hook opcional pra trigar criação de task com data pré-selecionada. */
  onCreateForDay?: (date: Date) => void;
}

export function DayView({ currentDate, onTaskClick, onCreateForDay }: DayViewProps) {
  const tasks = useTasks();
  const dayTasks = React.useMemo(
    () => getTasksOnDay(tasks, currentDate).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [tasks, currentDate],
  );

  const today = isToday(currentDate);
  const titleDate = format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const titleSuffix = today ? ' · hoje' : '';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <header className="flex items-baseline justify-between gap-3">
          <h3 className="text-title text-foreground capitalize">
            {titleDate}
            {titleSuffix && (
              <span className="text-primary text-body ml-2 font-normal">{titleSuffix}</span>
            )}
          </h3>
          <span className="text-caption text-muted-foreground tabular-nums">
            {dayTasks.length} {dayTasks.length === 1 ? 'tarefa' : 'tarefas'}
          </span>
        </header>

        {dayTasks.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sem tarefas neste dia"
            description={
              onCreateForDay
                ? 'Que tal aproveitar e marcar uma ligação ou reunião?'
                : 'Quando criar uma tarefa pra este dia, ela aparece aqui.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {dayTasks.map((task) => (
              <li key={task.id} onClick={() => onTaskClick?.(task)}>
                <TaskRow task={task} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
