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

import { updateDealAction } from '@/features/deals/actions';
import type { SalesRep } from '@/features/leads/types';

import { updateDealSchema, type UpdateDealInput } from '../schemas';
import type { Deal } from '../types';

/**
 * Dialog de edição de negócio (M8#3p — patch que faltou na onda inicial
 * do Kanban). Cobre os 5 campos que o vendedor revisita com frequência:
 * título, valor, vendedor, prazo, probabilidade, descrição.
 *
 * Mudança de **etapa** NÃO entra aqui — o fluxo canônico é drag-and-drop,
 * que dispara `moveDealStageAction` direto. Misturar os dois caminhos
 * geraria estados ambíguos (ex: editar pra Ganho via dialog desincronizaria
 * do `orderInStage` calculado pelo move).
 *
 * `lostReason` aparece só quando o deal já está com status=lost.
 */

interface DealEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
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

function buildDefaults(deal: Deal): UpdateDealInput {
  return {
    dealId: deal.id,
    title: deal.title,
    valueCents: deal.valueCents,
    ownerId: deal.ownerId,
    probability: deal.probability ?? 50,
    dueAt: deal.dueAt ?? '',
    description: deal.description ?? '',
    lostReason: deal.lostReason ?? '',
  };
}

function formatCentsForDisplay(cents: number): string {
  if (!cents) return '';
  return String(Math.floor(cents / 100));
}

export function DealEditDialog({ open, onOpenChange, deal, salesReps }: DealEditDialogProps) {
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
  } = useForm<UpdateDealInput>({
    resolver: zodResolver(updateDealSchema),
    defaultValues: buildDefaults(deal),
  });

  const [valueDisplay, setValueDisplay] = React.useState(formatCentsForDisplay(deal.valueCents));
  const [dueDisplay, setDueDisplay] = React.useState(isoToDateInput(deal.dueAt));

  React.useEffect(() => {
    if (open) {
      reset(buildDefaults(deal));
      setValueDisplay(formatCentsForDisplay(deal.valueCents));
      setDueDisplay(isoToDateInput(deal.dueAt));
      setSubmitError(null);
    }
  }, [open, deal, reset]);

  function parseValueToCents(raw: string): number {
    const digits = raw.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) * 100 : 0;
  }

  function onSubmit(data: UpdateDealInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateDealAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      toast.success('Negócio atualizado.', { duration: 3000 });
      router.refresh();
      onOpenChange(false);
    });
  }

  const isLost = deal.status === 'lost';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar negócio</DialogTitle>
          <DialogDescription>
            Atualize valor, prazo, vendedor responsável e outros campos. Pra mudar a etapa, arraste
            o card no Kanban.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <input type="hidden" {...register('dealId')} />

          <Field label="Título do negócio*" error={errors.title?.message}>
            <Input
              {...register('title')}
              placeholder="ex: Apartamento Vértice Zona Sul"
              aria-invalid={Boolean(errors.title)}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  setValue('dueAt', e.target.value ? new Date(e.target.value).toISOString() : '');
                }}
              />
            </Field>

            <Field label="Vendedor responsável*" error={errors.ownerId?.message}>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
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

            <Field label="Probabilidade (%)" error={errors.probability?.message}>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                {...register('probability', { valueAsNumber: true })}
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

          {isLost && (
            <Field label="Motivo da perda" error={errors.lostReason?.message}>
              <Input
                {...register('lostReason')}
                placeholder="ex: Preço, prazo, decisão por concorrente"
              />
            </Field>
          )}

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
