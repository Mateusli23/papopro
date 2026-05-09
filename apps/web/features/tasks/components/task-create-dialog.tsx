'use client';

import * as React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format as fmtDate } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import {
  Button,
  Combobox,
  type ComboboxOption,
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

import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import { TASK_KINDS, taskCreateSchema, type TaskCreateInput } from '../schemas';
import { createTask } from '../store';

import { TASK_KIND_META } from './task-kind-icon';

/**
 * Modal "Nova tarefa" — cria uma task pendente vinculada a um lead.
 *
 * Mesmo padrão do `DealCreateDialog`: RHF + Zod + mutação via store.
 * Default `assignedTo` é o usuário logado (primeiro rep de SALES_REPS),
 * `dueAt` é "hoje +1 dia 09:00" (padrão razoável pra follow-up).
 *
 * Campos:
 *  - Lead (combobox com busca)
 *  - Tipo (select com ícone)
 *  - Título (input)
 *  - Vendedor responsável (select)
 *  - Prazo (input date — vira ISO ao salvar)
 *  - Notas (textarea)
 *
 * Em M8 vira Server Action `createTask({ input })` reusando o mesmo
 * schema Zod.
 */

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lead pré-selecionado (vindo do detalhe do lead). */
  defaultLeadId?: string;
  /** Data pré-selecionada (vindo de um click numa célula do calendário). */
  defaultDueDate?: Date;
}

const LEAD_OPTIONS: ComboboxOption[] = FAKE_LEADS.map((l) => ({
  value: l.id,
  label: l.company ? `${l.name} — ${l.company}` : l.name,
}));

const NOW = new Date('2026-05-09T14:00:00-03:00');

function buildDefaults(leadId?: string, dueDate?: Date): TaskCreateInput {
  const due = dueDate ?? addDays(NOW, 1);
  // Hora default: 09:00 do dia (manhã, momento clássico de fazer follow-up)
  due.setHours(9, 0, 0, 0);
  return {
    title: '',
    leadId: leadId ?? '',
    kind: 'follow_up',
    assignedTo: SALES_REPS[0]?.id ?? '',
    dueAt: due.toISOString(),
  };
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  defaultLeadId,
  defaultDueDate,
}: TaskCreateDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskCreateInput>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: buildDefaults(defaultLeadId, defaultDueDate),
  });

  const initialDate = defaultDueDate ?? addDays(NOW, 1);
  const [dueDisplay, setDueDisplay] = React.useState(fmtDate(initialDate, 'yyyy-MM-dd'));

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults(defaultLeadId, defaultDueDate));
      setDueDisplay(fmtDate(defaultDueDate ?? addDays(NOW, 1), 'yyyy-MM-dd'));
    }
  }, [open, defaultLeadId, defaultDueDate, reset]);

  function onSubmit(data: TaskCreateInput) {
    const task = createTask(data);
    toast.success(`Tarefa "${task.title}" criada.`, { duration: 4000 });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            Crie uma tarefa pendente vinculada a um lead. Você pode editar e marcar como concluída
            depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Lead vinculado*" error={errors.leadId?.message}>
            <Controller
              control={control}
              name="leadId"
              render={({ field }) => (
                <Combobox
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  options={LEAD_OPTIONS}
                  placeholder="Selecione um lead…"
                  searchPlaceholder="Buscar por nome ou empresa…"
                  emptyMessage="Nenhum lead encontrado"
                />
              )}
            />
          </Field>

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
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <Field label="Vendedor responsável*" error={errors.assignedTo?.message}>
              <Controller
                control={control}
                name="assignedTo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_REPS.map((r) => (
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
                    // Salva como ISO mantendo 09:00 como hora default
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Criar tarefa
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
