'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format as fmtDate } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import {
  Button,
  Combobox,
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
  type ComboboxOption,
} from '@papopro/ui';
import { Loader2 } from '@papopro/ui/icons';

import { createDealAction } from '@/features/deals/actions';
import type { LeadComboboxOption } from '@/features/deals/queries';
import type { PipelineStage, SalesRep } from '@/features/leads/types';
import { formatCentsForCurrencyInput, parseCurrencyInputToCents } from '@/lib/utils/format';

import { dealCreateSchema, type DealCreateInput } from '../schemas';

/**
 * Modal "Adicionar negócio" (M8#3) — invoca `createDealAction` no submit.
 *
 * Stages + reps + leads vêm por prop do Server Component pai (já são dados
 * reais do workspace via Prisma + RLS). Default do `dueAt` é +30 dias.
 * On success: `router.refresh()` re-fetcha o Server Component pra o
 * novo deal aparecer na coluna.
 */

interface DealCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStageId?: string;
  defaultLeadId?: string;
  /** Valor estimado pré-preenchido (centavos). Usado quando o caller já tem
   *  esse contexto — ex: criando deal a partir da ficha de um lead que tem
   *  `valueCents` cadastrado. */
  defaultValueCents?: number;
  /** Título pré-preenchido. Usado pelo CTA da ficha pra sugerir um nome. */
  defaultTitle?: string;
  stages: PipelineStage[];
  salesReps: SalesRep[];
  leadOptions: LeadComboboxOption[];
}

function buildDefaults(
  stageId: string | undefined,
  leadId: string | undefined,
  valueCents: number | undefined,
  title: string | undefined,
  stages: PipelineStage[],
  salesReps: SalesRep[],
): DealCreateInput {
  // Fallback: primeira stage não-terminal (ou primeira disponível).
  const firstActive = stages.find((s) => !s.terminal) ?? stages[0];
  return {
    title: title ?? '',
    leadId: leadId ?? '',
    stageId: stageId ?? firstActive?.id ?? '',
    valueCents: valueCents ?? 0,
    ownerId: salesReps[0]?.id ?? '',
    dueAt: addDays(new Date(), 30).toISOString(),
  };
}

export function DealCreateDialog({
  open,
  onOpenChange,
  defaultStageId,
  defaultLeadId,
  defaultValueCents,
  defaultTitle,
  stages,
  salesReps,
  leadOptions,
}: DealCreateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const leadComboboxOptions: ComboboxOption[] = React.useMemo(
    () =>
      leadOptions.map((l) => ({
        value: l.id,
        label: l.company ? `${l.name} — ${l.company}` : l.name,
      })),
    [leadOptions],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DealCreateInput>({
    resolver: zodResolver(dealCreateSchema),
    defaultValues: buildDefaults(
      defaultStageId,
      defaultLeadId,
      defaultValueCents,
      defaultTitle,
      stages,
      salesReps,
    ),
  });

  const [valueDisplay, setValueDisplay] = React.useState(
    formatCentsForCurrencyInput(defaultValueCents),
  );
  const [dueDisplay, setDueDisplay] = React.useState(
    fmtDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
  );

  React.useEffect(() => {
    if (open) {
      reset(
        buildDefaults(
          defaultStageId,
          defaultLeadId,
          defaultValueCents,
          defaultTitle,
          stages,
          salesReps,
        ),
      );
      setValueDisplay(formatCentsForCurrencyInput(defaultValueCents));
      setDueDisplay(fmtDate(addDays(new Date(), 30), 'yyyy-MM-dd'));
      setSubmitError(null);
    }
  }, [
    open,
    defaultStageId,
    defaultLeadId,
    defaultValueCents,
    defaultTitle,
    stages,
    salesReps,
    reset,
  ]);

  function onSubmit(data: DealCreateInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createDealAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      toast.success(`Negócio "${data.title}" criado.`, { duration: 4000 });
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar negócio</DialogTitle>
          <DialogDescription>
            Vincule a um lead existente, defina a etapa, valor e prazo. Você pode editar depois na
            ficha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Título do negócio*" error={errors.title?.message}>
            <Input
              {...register('title')}
              placeholder="ex: Apartamento Vértice Zona Sul"
              aria-invalid={Boolean(errors.title)}
              autoFocus
            />
          </Field>

          <Field label="Lead vinculado*" error={errors.leadId?.message}>
            <Controller
              control={control}
              name="leadId"
              render={({ field }) => (
                <Combobox
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  options={leadComboboxOptions}
                  placeholder={
                    leadComboboxOptions.length > 0
                      ? 'Selecione um lead…'
                      : 'Crie um lead antes de adicionar negócio'
                  }
                  searchPlaceholder="Buscar por nome ou empresa…"
                  emptyMessage="Nenhum lead encontrado"
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Etapa*" error={errors.stageId?.message}>
              <Controller
                control={control}
                name="stageId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.terminal ? ' (fechado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Vendedor responsável*" error={errors.ownerId?.message}>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <Field label="Valor estimado (R$)" error={errors.valueCents?.message}>
              <Input
                inputMode="numeric"
                value={valueDisplay}
                onChange={(e) => {
                  setValueDisplay(e.target.value);
                  setValue('valueCents', parseCurrencyInputToCents(e.target.value));
                }}
                placeholder="ex: 800.000"
              />
            </Field>

            <Field label="Prazo estimado" error={errors.dueAt?.message}>
              <Input
                type="date"
                value={dueDisplay}
                onChange={(e) => {
                  setDueDisplay(e.target.value);
                  setValue(
                    'dueAt',
                    e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  );
                }}
              />
            </Field>
          </div>

          <Field label="Descrição" error={errors.description?.message}>
            <Textarea
              {...register('description')}
              placeholder="Contexto importante: escopo, decisor, restrições…"
              rows={3}
            />
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
              Criar negócio
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
