'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@papopro/ui';
import { AlertCircle, Loader2 } from '@papopro/ui/icons';

import { createLeadAction } from '../actions';
import { LEAD_ORIGINS, leadCreateSchema, type LeadCreateInput } from '../schemas';
import type { PipelineStage, SalesRep } from '../types';

/**
 * Modal "Adicionar lead" (M8#2). Validação Zod + RHF, mutação via
 * `createLeadAction` (Server Action real). Após criar, oferece navegação
 * pro detalhe via toast e dispara `router.refresh()` pra Server Component
 * `/leads/page.tsx` re-fetcher a lista.
 *
 * **`salesReps` + `activeStages` vêm como prop** (passados pelo
 * `LeadsView` que recebeu do Server Component) — não importa mais
 * `SALES_REPS`/`ACTIVE_STAGES` de fixtures.
 */
interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etapa pré-selecionada (Kanban: "+ adicionar nesta coluna"). Default: primeira etapa não-terminal. */
  defaultStageId?: string;
  salesReps: SalesRep[];
  /** Etapas não-terminais ordenadas (pipeline.stages.filter(s => !s.terminal)). */
  activeStages: PipelineStage[];
}

export function LeadCreateDialog({
  open,
  onOpenChange,
  defaultStageId,
  salesReps,
  activeStages,
}: LeadCreateDialogProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const buildDefaults = React.useCallback(
    (): LeadCreateInput => ({
      name: '',
      phone: '',
      stageId: defaultStageId ?? activeStages[0]?.id ?? '',
      assignedTo: salesReps[0]?.id ?? '',
      origin: 'manual',
      valueCents: 0,
      tags: [],
    }),
    [defaultStageId, activeStages, salesReps],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadCreateInput>({
    resolver: zodResolver(leadCreateSchema),
    defaultValues: buildDefaults(),
  });

  // Aceita "850.000" / "850000" / "1.200,00" e converte pra centavos.
  const [valueDisplay, setValueDisplay] = React.useState('');

  function parseValueToCents(raw: string): number {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10);
  }

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults());
      setValueDisplay('');
      setSubmitError(null);
    }
  }, [open, buildDefaults, reset]);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const result = await createLeadAction(data);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    toast.success(`Lead "${data.name}" criado e oportunidade aberta no Kanban.`, {
      duration: 5000,
    });
    onOpenChange(false);
    // Refresh força Server Component `/leads/page.tsx` a re-fetch.
    router.refresh();
    // Navega pro detalhe — padrão Linear: user já vê a ficha completa.
    router.push(`/leads/${result.leadId}`);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar lead</DialogTitle>
          <DialogDescription>
            Cadastro rápido — o app já abre a oportunidade correspondente no Kanban.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {submitError && (
            <div
              role="alert"
              className="bg-destructive/10 text-destructive text-body flex items-start gap-2 rounded-md p-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome*" error={errors.name?.message}>
              <Input
                {...register('name')}
                placeholder="ex: Mariana Costa"
                aria-invalid={Boolean(errors.name)}
                autoFocus
              />
            </Field>

            <Field label="Telefone*" error={errors.phone?.message}>
              <Input
                {...register('phone')}
                placeholder="+55 11 9 9999-0000"
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>

            <Field label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...register('email')}
                placeholder="contato@empresa.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>

            <Field label="Empresa" error={errors.company?.message}>
              <Input {...register('company')} placeholder="ex: Construtora Vértice" />
            </Field>

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
                      {activeStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Vendedor*" error={errors.assignedTo?.message}>
              <Controller
                control={control}
                name="assignedTo"
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

            <Field label="Origem" error={errors.origin?.message}>
              <Controller
                control={control}
                name="origin"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_ORIGINS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
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
          </div>

          <Field label="Observação" error={errors.notes?.message}>
            <Textarea
              {...register('notes')}
              placeholder="Contexto importante: indicação, decisor, restrições…"
              rows={3}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Criar lead
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
