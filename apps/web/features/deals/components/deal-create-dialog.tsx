'use client';

import * as React from 'react';

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

import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { ACTIVE_STAGES, DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import { dealCreateSchema, type DealCreateInput } from '../schemas';
import { createDeal } from '../store';

/**
 * Modal "Adicionar negócio" — criação de Deal vinculada a um Lead existente.
 *
 * Validação Zod + RHF, mutação via store. Default do `dueAt` é +30 dias
 * (tempo médio razoável pra deals SMB B2B). O combobox de leads filtra
 * por nome/empresa pra acelerar a busca.
 *
 * Em M8 vira Server Action `createDeal({ input })` — schema reaproveitado.
 */

interface DealCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etapa pré-selecionada (vindo do "+ Adicionar" da coluna). */
  defaultStageId?: string;
  /** Lead pré-selecionado (vindo do detalhe do lead, M5+). */
  defaultLeadId?: string;
}

const LEAD_OPTIONS: ComboboxOption[] = FAKE_LEADS.map((l) => ({
  value: l.id,
  label: l.company ? `${l.name} — ${l.company}` : l.name,
}));

function buildDefaults(stageId?: string, leadId?: string): DealCreateInput {
  return {
    title: '',
    leadId: leadId ?? '',
    stageId: stageId ?? 'novo',
    valueCents: 0,
    ownerId: SALES_REPS[0]?.id ?? '',
    dueAt: addDays(new Date('2026-05-09T14:00:00-03:00'), 30).toISOString(),
  };
}

export function DealCreateDialog({
  open,
  onOpenChange,
  defaultStageId,
  defaultLeadId,
}: DealCreateDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealCreateInput>({
    resolver: zodResolver(dealCreateSchema),
    defaultValues: buildDefaults(defaultStageId, defaultLeadId),
  });

  const [valueDisplay, setValueDisplay] = React.useState('');
  const [dueDisplay, setDueDisplay] = React.useState(
    fmtDate(addDays(new Date('2026-05-09T14:00:00-03:00'), 30), 'yyyy-MM-dd'),
  );

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults(defaultStageId, defaultLeadId));
      setValueDisplay('');
      setDueDisplay(fmtDate(addDays(new Date('2026-05-09T14:00:00-03:00'), 30), 'yyyy-MM-dd'));
    }
  }, [open, defaultStageId, defaultLeadId, reset]);

  function parseValueToCents(raw: string): number {
    const digits = raw.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) * 100 : 0;
  }

  function onSubmit(data: DealCreateInput) {
    const deal = createDeal(data);
    toast.success(`Negócio "${deal.title}" criado.`, { duration: 4000 });
    onOpenChange(false);
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
                  options={LEAD_OPTIONS}
                  placeholder="Selecione um lead…"
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
                      {DEFAULT_STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {ACTIVE_STAGES.find((a) => a.id === s.id) ? '' : ' (fechado)'}
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

            <Field label="Valor estimado (R$)" error={errors.valueCents?.message}>
              <Input
                inputMode="numeric"
                value={valueDisplay}
                onChange={(e) => {
                  setValueDisplay(e.target.value);
                  setValue('valueCents', parseValueToCents(e.target.value));
                }}
                placeholder="ex: 50000"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
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
