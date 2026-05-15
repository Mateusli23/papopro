'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
} from '@papopro/ui';
import {
  Calendar,
  CheckCircle2,
  Edit,
  Mail,
  MessageCircle,
  MoreVertical,
  Phone,
  PlusCircle,
  Send,
  Trash2,
  type LucideIcon,
} from '@papopro/ui/icons';

import { completeTaskAction, deleteTaskAction, reopenTaskAction } from '@/features/tasks/actions';
import { TaskCreateDialog } from '@/features/tasks/components/task-create-dialog';
import { TaskEditDialog } from '@/features/tasks/components/task-edit-dialog';
import type { LeadComboboxOption } from '@/features/tasks/queries';
import type { Task, TaskKind } from '@/features/tasks/types';
import { formatDateShort, formatRelative } from '@/lib/utils/format';

import type { SalesRep } from '../types';

type Role = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

const KIND_META: Record<TaskKind, { Icon: LucideIcon; label: string; tone: string }> = {
  call: { Icon: Phone, label: 'Ligação', tone: 'bg-primary/15 text-primary' },
  whatsapp: { Icon: MessageCircle, label: 'WhatsApp', tone: 'bg-success/15 text-success' },
  email: { Icon: Mail, label: 'Email', tone: 'bg-info/15 text-info' },
  meeting: { Icon: Calendar, label: 'Reunião', tone: 'bg-primary/15 text-primary' },
  follow_up: { Icon: Send, label: 'Follow-up', tone: 'bg-warning/20 text-warning' },
  other: { Icon: CheckCircle2, label: 'Outro', tone: 'bg-muted text-muted-foreground' },
};

/**
 * Painel direito da página de detalhe (M8#4 — server-fed).
 *
 * Tasks reais via Server Actions: completar/reabrir/editar/excluir + criar.
 *
 * Quick actions "Mensagem/Ligar/Reunião" continuam disabled (chegam em M9
 * WhatsApp + M10 cadência). "Adicionar tarefa" ficou funcional.
 */

interface LeadNextActionsProps {
  leadId: string;
  initialTasks: Task[];
  salesReps: SalesRep[];
  /** Lead atual (pra alimentar dialog de create com pré-seleção). */
  leadName: string;
  leadCompany: string | null;
  callerRole: Role;
}

export function LeadNextActions({
  leadId,
  initialTasks,
  salesReps,
  leadName,
  leadCompany,
  callerRole,
}: LeadNextActionsProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const canEdit = callerRole !== 'Viewer';
  const canDelete = callerRole === 'Owner' || callerRole === 'Admin' || callerRole === 'Manager';

  // Pra alimentar o combobox do create — só este lead.
  const leadOption: LeadComboboxOption[] = React.useMemo(
    () => [{ id: leadId, name: leadName, company: leadCompany }],
    [leadId, leadName, leadCompany],
  );

  const pending = initialTasks.filter((t) => t.status === 'pending');
  const done = initialTasks.filter((t) => t.status === 'done');

  return (
    <>
      <aside
        aria-label="Próximas ações"
        className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-title text-foreground">Próximas ações</h2>
          <Badge variant={pending.length === 0 ? 'secondary' : 'warning'}>
            {pending.length} pendentes
          </Badge>
        </header>

        {pending.length === 0 ? (
          <p className="text-body text-muted-foreground">
            {canEdit
              ? 'Nenhuma tarefa pendente. Use "Adicionar tarefa" abaixo pra criar uma.'
              : 'Nenhuma tarefa pendente neste lead.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((task) => (
              <PendingTaskItem
                key={task.id}
                task={task}
                salesReps={salesReps}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </ul>
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-caption text-muted-foreground font-medium">Atalhos rápidos</span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS_DISABLED.map((a) => {
              const Icon = a.Icon;
              return (
                <Button
                  key={a.label}
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col gap-2 px-3 py-3"
                  disabled
                  aria-label={a.label}
                >
                  <span
                    className={cn('flex size-8 items-center justify-center rounded-full', a.tone)}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-caption text-foreground font-medium">{a.label}</span>
                </Button>
              );
            })}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-2 px-3 py-3"
                onClick={() => setCreateOpen(true)}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full',
                    'bg-warning/10 text-warning',
                  )}
                  aria-hidden
                >
                  <PlusCircle className="size-4" />
                </span>
                <span className="text-caption text-foreground font-medium">Adicionar tarefa</span>
              </Button>
            )}
          </div>
          <p className="text-caption text-muted-foreground/70">
            Mensagem/Ligar/Reunião ficam funcionais a partir do M9 (WhatsApp).
          </p>
        </div>

        {done.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-caption text-muted-foreground font-medium">
                Concluídas ({done.length})
              </span>
              <ul className="flex flex-col gap-1.5">
                {done.slice(0, 5).map((t) => (
                  <DoneTaskRow key={t.id} task={t} canEdit={canEdit} />
                ))}
              </ul>
            </div>
          </>
        )}
      </aside>

      {canEdit && (
        <TaskCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultLeadId={leadId}
          salesReps={salesReps}
          leadOptions={leadOption}
        />
      )}
    </>
  );
}

const QUICK_ACTIONS_DISABLED: { label: string; Icon: LucideIcon; tone: string }[] = [
  { label: 'Mandar mensagem', Icon: MessageCircle, tone: 'bg-success/10 text-success' },
  { label: 'Ligar', Icon: Phone, tone: 'bg-primary/10 text-primary' },
  { label: 'Agendar reunião', Icon: Calendar, tone: 'bg-info/10 text-info' },
];

interface PendingTaskItemProps {
  task: Task;
  salesReps: SalesRep[];
  canEdit: boolean;
  canDelete: boolean;
}

function PendingTaskItem({ task, salesReps, canEdit, canDelete }: PendingTaskItemProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const meta = KIND_META[task.kind];
  const Icon = meta.Icon;

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTaskAction({ taskId: task.id });
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
      <li className="border-border bg-background group relative flex gap-3 rounded-md border p-3">
        <span
          className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', meta.tone)}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body text-foreground font-medium">{task.title}</span>
          <span className="text-caption text-muted-foreground">
            {meta.label} · {formatRelative(task.dueAt)}
          </span>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-start gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleComplete}
              disabled={isPending}
            >
              Concluir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
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
          </div>
        )}
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

function DoneTaskRow({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const meta = KIND_META[task.kind];
  const Icon = meta.Icon;

  function handleReopen() {
    if (!canEdit) return;
    startTransition(async () => {
      const result = await reopenTaskAction({ taskId: task.id });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="text-success size-3.5 shrink-0" />
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="text-caption text-muted-foreground line-through">{task.title}</span>
      <span className="text-caption text-muted-foreground/70 ml-auto shrink-0">
        {formatDateShort(task.doneAt)}
      </span>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="text-caption h-6 px-1.5"
          onClick={handleReopen}
          disabled={isPending}
        >
          Reabrir
        </Button>
      )}
    </li>
  );
}
