'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { format as fmtDate, parseISO } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@papopro/ui';
import { Loader2 } from '@papopro/ui/icons';

import type { SalesRep } from '@/features/leads/types';
import { updateTaskAction } from '@/features/tasks/actions';

import { TASK_KINDS, updateTaskSchema, type UpdateTaskInput } from '../schemas';
import type { Task } from '../types';

import { TASK_KIND_META } from './task-kind-icon';

/**
 * Dialog de edição de tarefa (M8#4). Edita título, tipo, vendedor
 * responsável, prazo e notas. Mudança de status (pending/done) tem fluxo
 * próprio via `completeTaskAction`/`reopenTaskAction` chamados no row.
 */

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  salesReps: SalesRep[];
}

function isoToDateInput(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return fmtDate(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function buildDefaults(task: Task): UpdateTaskInput {
  return {
    taskId: task.id,
    kind: task.kind,
    title: task.title,
    notes: task.notes ?? '',
    assignedToId: task.assignedTo,
    dueAt: task.dueAt,
  };
}

export function TaskEditDialog({ open, onOpenChange, task, salesReps }: TaskEditDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: buildDefaults(task),
  });

  const [dueDisplay, setDueDisplay] = React.useState(isoToDateInput(task.dueAt));

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults(task));
      setDueDisplay(isoToDateInput(task.dueAt));
      setSubmitError(null);
    }
  }, [open, task, reset]);

  function onSubmit(data: UpdateTaskInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateTaskAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      toast.success('Tarefa atualizada.', { duration: 3000 });
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>
            Atualize título, tipo, prazo e responsável. Pra marcar como concluída, use o checkbox na
            lista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <input type="hidden" {...register('taskId')} />

          <Field label="Título da tarefa*" error={errors.title?.message}>
            <Input
              {...register('title')}
              placeholder="ex: Ligar pra confirmar visita"
              aria-invalid={Boolean(errors.title)}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo*" error={errors.kind?.message}>
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value ?? task.kind} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {TASK_KIND_META[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Vendedor responsável*" error={errors.assignedToId?.message}>
              <Controller
                control={control}
                name="assignedToId"
                render={({ field }) => (
                  <Select value={field.value ?? task.assignedTo} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {salesReps.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Prazo*" error={errors.dueAt?.message}>
              <Input
                type="date"
                value={dueDisplay}
                onChange={(e) => {
                  setDueDisplay(e.target.value);
                  if (e.target.value) {
                    const d = new Date(e.target.value);
                    d.setHours(9, 0, 0, 0);
                    setValue('dueAt', d.toISOString());
                  }
                }}
              />
            </Field>
          </div>

          <Field label="Notas" error={errors.notes?.message}>
            <Textarea {...register('notes')} placeholder="Contexto, scripts, lembretes…" rows={3} />
          </Field>

          {submitError && (
            <p role="alert" className="text-caption text-destructive">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-caption text-muted-foreground font-medium">{label}</Label>
      {children}
      {error && (
        <span role="alert" className="text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
