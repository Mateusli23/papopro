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
import { ChevronLeft, Loader2 } from '@papopro/ui/icons';

import { getTemplate } from '@/lib/fixtures/cadence-templates';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';

// Etapa default quando nem o caller nem o template sugerem uma. Pega a
// primeira ativa do pipeline (em vez de hardcode 'novo') pra resistir a
// reordenamentos futuros do funil default.
const DEFAULT_FALLBACK_STAGE = ACTIVE_STAGES[0]?.id ?? 'novo';

import { createCadenceAction } from '../actions';
import { cadenceCreateSchema, type CadenceCreateInput } from '../schemas';
import type { CadenceTemplateKey } from '../types';

import { TemplatePicker } from './template-picker';

/**
 * Modal "Nova cadência" — wizard de 2 passos:
 *  1. Escolha do template (TemplatePicker)
 *  2. Nome + descrição + etapa do funil (com default sugerido pelo template)
 *
 * Submeter cria via store (otimista) e navega pra `/cadences/[id]` pra que
 * o usuário comece a editar imediatamente. `defaultStageId` do template
 * preenche o select, mas o usuário pode trocar antes de submeter.
 *
 * Em M8 vira Server Action `createCadence({ input })` reusando o mesmo
 * schema Zod e a mesma navegação de redirect.
 */

interface CadenceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etapa pré-selecionada (vinda do CTA "+ Criar para esta etapa"). */
  defaultStageId?: string;
}

type Step = 'template' | 'details';

export function CadenceCreateDialog({
  open,
  onOpenChange,
  defaultStageId,
}: CadenceCreateDialogProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('template');
  const [pickedTemplate, setPickedTemplate] = React.useState<CadenceTemplateKey | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CadenceCreateInput>({
    resolver: zodResolver(cadenceCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      stageId: defaultStageId ?? DEFAULT_FALLBACK_STAGE,
      templateKey: 'blank',
    },
  });

  // Reseta tudo ao abrir/fechar — modal "limpo" toda vez.
  React.useEffect(() => {
    if (open) {
      setStep('template');
      setPickedTemplate(null);
      reset({
        name: '',
        description: '',
        stageId: defaultStageId ?? DEFAULT_FALLBACK_STAGE,
        templateKey: 'blank',
      });
    }
  }, [open, defaultStageId, reset]);

  function pickTemplate(key: CadenceTemplateKey) {
    setPickedTemplate(key);
    setValue('templateKey', key);
    const tpl = getTemplate(key);
    if (tpl) {
      // Pré-preenche nome sugerido + etapa default — usuário ajusta no passo 2
      setValue('name', tpl.key === 'blank' ? '' : tpl.label);
      // Só sobrescreve a etapa se o usuário não veio com defaultStageId fixo
      if (!defaultStageId) {
        setValue('stageId', tpl.defaultStageId);
      }
    }
  }

  function goNext() {
    if (!pickedTemplate) return;
    setStep('details');
  }

  function goBack() {
    setStep('template');
  }

  async function onSubmit(data: CadenceCreateInput) {
    const loadingId = toast.loading('Criando cadência…');
    const result = await createCadenceAction(data);
    toast.dismiss(loadingId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Cadência "${data.name}" criada.`, { duration: 4000 });
    onOpenChange(false);
    router.push(`/cadences/${result.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === 'template' ? (
          <>
            <DialogHeader>
              <DialogTitle>Nova cadência</DialogTitle>
              <DialogDescription>
                Escolha um template pronto pra começar com mensagens já redigidas, ou monte do zero.
              </DialogDescription>
            </DialogHeader>

            <TemplatePicker value={pickedTemplate} onChange={pickTemplate} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={goNext} disabled={!pickedTemplate}>
                Avançar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configurar cadência</DialogTitle>
              <DialogDescription>
                Dê um nome reconhecível e escolha em qual etapa do funil ela vai disparar.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Field label="Nome da cadência*" error={errors.name?.message}>
                <Input
                  {...register('name')}
                  placeholder="ex: Boas-vindas Imobiliário"
                  aria-invalid={Boolean(errors.name)}
                  autoFocus
                />
              </Field>

              <Field
                label="Descrição"
                hint="Curta — ajuda você e o time a lembrar pra que serve."
                error={errors.description?.message}
              >
                <Textarea
                  {...register('description')}
                  placeholder="ex: Acompanha o lead da primeira mensagem até a visita."
                  rows={2}
                />
              </Field>

              <Field label="Etapa do funil*" error={errors.stageId?.message}>
                <Controller
                  control={control}
                  name="stageId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVE_STAGES.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <DialogFooter className="sm:justify-between">
                <Button type="button" variant="ghost" onClick={goBack} className="gap-1">
                  <ChevronLeft className="size-4" />
                  Trocar template
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin" />}
                    Criar cadência
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-caption text-muted-foreground font-medium">{label}</Label>
      {children}
      {hint && !error && <span className="text-caption text-muted-foreground/80">{hint}</span>}
      {error && (
        <span role="alert" className="text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
