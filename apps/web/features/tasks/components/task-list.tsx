'use client';

import * as React from 'react';

import { Card, CardContent, EmptyState } from '@papopro/ui';
import { ListChecks } from '@papopro/ui/icons';

import { useTasks } from '@/features/tasks/store';
import { filterTasks, type TaskFilters } from '@/features/tasks/transforms';

import { TaskRow } from './task-row';

/**
 * Lista de tasks renderizada como `<ul>` agrupada por status:
 *  - Pendentes (atrasadas + ativas) — em cima, ordenadas por dueAt asc
 *  - Concluídas — embaixo (colapsável visualmente: opacity reduzida, sem
 *    separator, mas presente pra quem quer marcar uma tarefa errada como
 *    pendente de novo)
 *
 * Quando ambos vazios, EmptyState.
 */

interface TaskListProps {
  filters?: TaskFilters;
  /** Esconde a coluna do vendedor (útil em vista "Minhas tarefas"). */
  showAssignee?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function TaskList({
  filters,
  showAssignee = true,
  emptyTitle = 'Sem tarefas por aqui',
  emptyDescription = 'Quando criar tarefas, elas aparecem nesta lista.',
}: TaskListProps) {
  const tasks = useTasks();
  const filtered = React.useMemo(() => filterTasks(tasks, filters), [tasks, filters]);

  const { pending, done } = React.useMemo(() => {
    const pendingArr = filtered
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const doneArr = filtered
      .filter((t) => t.status === 'done')
      .sort((a, b) => (b.doneAt ?? b.dueAt).localeCompare(a.doneAt ?? a.dueAt));
    return { pending: pendingArr, done: doneArr };
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState icon={ListChecks} title={emptyTitle} description={emptyDescription} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <section aria-label="Tarefas pendentes" className="flex flex-col gap-2">
          <SectionHeader label="Pendentes" count={pending.length} />
          <ul className="flex flex-col gap-2">
            {pending.map((task) => (
              <TaskRow key={task.id} task={task} showAssignee={showAssignee} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section aria-label="Tarefas concluídas" className="flex flex-col gap-2">
          <SectionHeader label="Concluídas" count={done.length} muted />
          <ul className="flex flex-col gap-2">
            {done.map((task) => (
              <TaskRow key={task.id} task={task} showAssignee={showAssignee} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ label, count, muted }: { label: string; count: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h3
        className={
          muted
            ? 'text-caption text-muted-foreground/70 font-semibold uppercase tracking-wide'
            : 'text-caption text-muted-foreground font-semibold uppercase tracking-wide'
        }
      >
        {label}
      </h3>
      <span className="text-caption text-muted-foreground/60 tabular-nums">{count}</span>
    </div>
  );
}
