'use client';

import * as React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@papopro/ui';
import { Loader2, Mail, MessageCircle } from '@papopro/ui/icons';

import { CADENCE_CHANNELS, DAY_OFFSETS, stepCreateSchema, type StepCreateInput } from '../schemas';
import { addStep, updateStep } from '../store';
import type { CadenceStep } from '../types';

import { PlaceholderHint } from './placeholder-hint';

/**
 * Dialog de criação OU edição de step.
 *
 *  - Sem `step` → modo criação (chama `addStep`)
 *  - Com `step` → modo edição (chama `updateStep`)
 *
 * Campos: dayOffset (Select com valores fixos do PRD), canal (Select),
 * corpo (Textarea com chips de placeholders).
 *
 * O Textarea usa ref compartilhado com o `PlaceholderHint` pra inserir
 * tokens na posição do cursor.
 */

interface StepEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cadenceId: string;
  /** Step existente — ausente = criação. */
  step?: CadenceStep;
  /** Pré-selecionado em modo criação a partir do dayOffset clicado. */
  defaultDayOffset?: 0 | 1 | 3 | 7 | 14 | 30;
}

const CHANNEL_LABELS: Record<'whatsapp' | 'email', string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
};

export function StepEditDialog({
  open,
  onOpenChange,
  cadenceId,
  step,
  defaultDayOffset,
}: StepEditDialogProps) {
  const isEdit = Boolean(step);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StepCreateInput>({
    resolver: zodResolver(stepCreateSchema),
    defaultValues: buildDefaults(step, defaultDayOffset),
  });

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults(step, defaultDayOffset));
    }
  }, [open, step, defaultDayOffset, reset]);

  function onSubmit(data: StepCreateInput) {
    if (step) {
      const updated = updateStep(cadenceId, step.id, data);
      if (updated) {
        toast.success('Passo atualizado.', { duration: 3000 });
      }
    } else {
      const created = addStep(cadenceId, data);
      if (created) {
        toast.success(`Passo D+${data.dayOffset} adicionado.`, { duration: 3000 });
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar passo' : 'Adicionar passo'}</DialogTitle>
          <DialogDescription>
            Defina quando, por qual canal e o que enviar. Use placeholders pra personalizar com
            dados do lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Disparo*" error={errors.dayOffset?.message}>
              <Controller
                control={control}
                name="dayOffset"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v) as StepCreateInput['dayOffset'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OFFSETS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          D+{d} {d === 0 ? '(no mesmo dia)' : `(${d} ${d === 1 ? 'dia' : 'dias'})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Canal*" error={errors.channel?.message}>
              <Controller
                control={control}
                name="channel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CADENCE_CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            {c === 'whatsapp' ? (
                              <MessageCircle className="size-4" />
                            ) : (
                              <Mail className="size-4" />
                            )}
                            {CHANNEL_LABELS[c]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="Mensagem*" error={errors.templateBody?.message}>
            <Controller
              control={control}
              name="templateBody"
              render={({ field }) => (
                <>
                  <Textarea
                    ref={(el) => {
                      textareaRef.current = el;
                      field.ref(el);
                    }}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="ex: Olá {nome}, vi seu interesse em {produto}…"
                    rows={6}
                    aria-invalid={Boolean(errors.templateBody)}
                  />
                  <PlaceholderHint
                    textareaRef={textareaRef}
                    value={field.value}
                    onChange={(next) => setValue('templateBody', next, { shouldValidate: true })}
                  />
                </>
              )}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? 'Salvar' : 'Adicionar passo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaults(
  step?: CadenceStep,
  defaultDayOffset?: 0 | 1 | 3 | 7 | 14 | 30,
): StepCreateInput {
  if (step) {
    return {
      dayOffset: step.dayOffset,
      channel: step.channel,
      templateBody: step.templateBody,
    };
  }
  return {
    dayOffset: defaultDayOffset ?? 0,
    channel: 'whatsapp',
    templateBody: '',
  };
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
