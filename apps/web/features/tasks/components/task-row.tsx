'use client';

import * as React from 'react';

import Link from 'next/link';

import { Checkbox, cn, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';

import { DueDatePill } from '@/features/deals/components/due-date-pill';
import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { useLeads } from '@/features/leads/store';
import { toggleTaskDone } from '@/features/tasks/store';
import type { Task } from '@/features/tasks/types';

import { TASK_KIND_META, TaskKindIcon } from './task-kind-icon';

/**
 * Linha de uma task na lista (Minhas / Time). Mantemos como `<li>` em vez
 * de `<tr>` porque tasks têm visual de "checklist" mais natural que
 * tabela — checkbox + ícone + título + meta lateral lê melhor numa lista
 * vertical.
 *
 * Toggle do checkbox marca/desmarca done e pinta a linha (opacity 60%
 * + line-through).
 *
 * Click no nome do lead (lateral direito) navega pra `/leads/{leadId}`.
 * Click no body da linha NÃO navega — espaço pra futura edição inline em
 * M8 quando virar Server Action.
 */

interface TaskRowProps {
  task: Task;
  /** Mostra coluna do vendedor (default: true). Em vista "Minhas" pode esconder. */
  showAssignee?: boolean;
}

export function TaskRow({ task, showAssignee = true }: TaskRowProps) {
  const leads = useLeads();
  const lead = React.useMemo(() => leads.find((l) => l.id === task.leadId), [leads, task.leadId]);

  const isDone = task.status === 'done';
  const meta = TASK_KIND_META[task.kind];

  return (
    <li
      className={cn(
        'border-border hover:bg-muted/40 group flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
        isDone && 'opacity-60',
      )}
    >
      <Checkbox
        className="mt-0.5"
        checked={isDone}
        onCheckedChange={() => toggleTaskDone(task.id)}
        aria-label={isDone ? `Reabrir tarefa: ${task.title}` : `Concluir tarefa: ${task.title}`}
      />

      <TaskKindIcon kind={task.kind} size="sm" />

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-body text-foreground line-clamp-2 font-medium',
            isDone && 'line-through',
          )}
        >
          {task.title}
        </span>
        <span className="text-caption text-muted-foreground inline-flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{meta.label}</span>
            </TooltipTrigger>
            <TooltipContent>Tipo da tarefa</TooltipContent>
          </Tooltip>
          {lead && (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/leads/${lead.id}`}
                className="hover:text-foreground hover:underline"
                aria-label={`Abrir lead ${lead.name}`}
              >
                {lead.name}
              </Link>
            </>
          )}
          {task.notes && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate" title={task.notes}>
                {task.notes}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DueDatePill due={task.dueAt} />
        {showAssignee && <RepAvatar repId={task.assignedTo} />}
      </div>
    </li>
  );
}
