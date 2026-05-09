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
import { Loader2 } from '@papopro/ui/icons';

import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import { LEAD_ORIGINS, leadCreateSchema, type LeadCreateInput } from '../schemas';
import { createLead } from '../store';

/**
 * Modal "Adicionar lead". Validação Zod + RHF, mutação via store
 * in-memory. Após criar, oferece "Abrir lead" (navega pro detalhe) ou
 * fecha mantendo o usuário na lista.
 *
 * Em M8 o `onSubmit` chama a Server Action `createLead` real (mesmo
 * shape de input — daí o uso do mesmo schema Zod).
 */
interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etapa pré-selecionada (Kanban: "+ adicionar nesta coluna"). */
  defaultStageId?: string;
}

const DEFAULT_VALUES: LeadCreateInput = {
  name: '',
  phone: '',
  stageId: 'novo',
  assignedTo: SALES_REPS[0]?.id ?? '',
  origin: 'manual',
  valueCents: 0,
  tags: [],
};

export function LeadCreateDialog({ open, onOpenChange, defaultStageId }: LeadCreateDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadCreateInput>({
    resolver: zodResolver(leadCreateSchema),
    defaultValues: { ...DEFAULT_VALUES, stageId: defaultStageId ?? 'novo' },
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
      reset({ ...DEFAULT_VALUES, stageId: defaultStageId ?? 'novo' });
      setValueDisplay('');
    }
  }, [open, defaultStageId, reset]);

  function onSubmit(data: LeadCreateInput) {
    const lead = createLead(data);
    toast.success(`Lead "${lead.name}" criado.`, { duration: 4000 });
    onOpenChange(false);
    // Navega pro detalhe — usuário já vê a ficha completa, padrão Linear.
    router.push(`/leads/${lead.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar lead</DialogTitle>
          <DialogDescription>
            Cadastro rápido — depois você completa a ficha na página do lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                      {ACTIVE_STAGES.map((s) => (
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
