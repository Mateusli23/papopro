'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@papopro/ui';
import { Edit, MoreVertical, Trash2 } from '@papopro/ui/icons';

import { DueDatePill } from '@/features/deals/components/due-date-pill';
import { RepAvatar } from '@/features/leads/components/rep-avatar';
import type { SalesRep } from '@/features/leads/types';
import { completeTaskAction, deleteTaskAction, reopenTaskAction } from '@/features/tasks/actions';
import { TaskEditDialog } from '@/features/tasks/components/task-edit-dialog';
import type { TaskWithLead } from '@/features/tasks/transforms';

import { TASK_KIND_META, TaskKindIcon } from './task-kind-icon';

/**
 * Linha de uma task na lista (Minhas / Time / Calendário, M8#4).
 *
 * Server-fed: checkbox dispara `completeTaskAction`/`reopenTaskAction`;
 * dropdown `⋮` oferece Editar/Excluir. Mesma anatomia do `DealCard` em M8#3p.
 *
 * Quando `showAssignee=false` (vista "Minhas"), esconde avatar do vendedor.
 */

interface TaskRowProps {
  task: TaskWithLead;
  /** Mostra coluna do vendedor (default: true). */
  showAssignee?: boolean;
  /** Salesreps pra alimentar o `TaskEditDialog`. */
  salesReps: SalesRep[];
  /** Permissão de edição. Viewer recebe false. */
  canEdit: boolean;
  /** Permissão de delete. Owner/Admin/Manager. */
  canDelete: boolean;
}

export function TaskRow({
  task,
  showAssignee = true,
  salesReps,
  canEdit,
  canDelete,
}: TaskRowProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const isDone = task.status === 'done';
  const meta = TASK_KIND_META[task.kind];

  function handleToggle() {
    if (!canEdit) return;
    startTransition(async () => {
      const result = isDone
        ? await reopenTaskAction({ taskId: task.id })
        : await completeTaskAction({ taskId: task.id });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!canDelete) return;
    startTransition(async () => {
      const result = await deleteTaskAction({ taskId: task.id });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success('Tarefa excluída.');
        router.refresh();
      }
    });
  }

  return (
    <>
      <li
        className={cn(
          'border-border hover:bg-muted/40 group flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
          isDone && 'opacity-60',
        )}
      >
        <Checkbox
          className="mt-0.5"
          checked={isDone}
          onCheckedChange={handleToggle}
          disabled={!canEdit || isPending}
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
            {task.leadName && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/leads/${task.leadId}`}
                  className="hover:text-foreground hover:underline"
                  aria-label={`Abrir lead ${task.leadName}`}
                >
                  {task.leadName}
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
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                  aria-label="Ações da tarefa"
                  disabled={isPending}
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setEditOpen(true);
                  }}
                >
                  <Edit className="size-3.5" /> Editar
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </li>

      {canEdit && (
        <TaskEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={task}
          salesReps={salesReps}
        />
      )}
    </>
  );
}
