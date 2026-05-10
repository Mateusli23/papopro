'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
} from '@papopro/ui';
import { ChevronLeft, Loader2 } from '@papopro/ui/icons';

import { getAgentTemplate } from '@/lib/fixtures/agent-templates';

import { agentCreateSchema, type AgentCreateInput } from '../schemas';
import { createAgent } from '../store';
import type { AgentTemplateKey } from '../types';

import { AgentTemplatePicker } from './agent-template-picker';

/**
 * Modal "Novo agente" — wizard de 2 passos:
 *  1. Escolha do template (AgentTemplatePicker)
 *  2. Nome + emoji (com defaults sugeridos pelo template)
 *
 * Submeter cria via store (otimista) e navega pra `/agents/[id]` pra que
 * o usuário comece a editar imediatamente. `defaultAvatarEmoji` do template
 * preenche o input, mas o usuário pode trocar antes de submeter.
 *
 * Em M11 vira Server Action `createAgent({ input })` reusando o mesmo
 * schema Zod e a mesma navegação de redirect.
 */

interface AgentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'template' | 'details';

export function AgentCreateDialog({ open, onOpenChange }: AgentCreateDialogProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('template');
  const [pickedTemplate, setPickedTemplate] = React.useState<AgentTemplateKey | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AgentCreateInput>({
    resolver: zodResolver(agentCreateSchema),
    defaultValues: {
      name: '',
      avatarEmoji: '',
      templateKey: 'blank',
    },
  });

  // Reseta tudo ao abrir — modal "limpo" toda vez.
  React.useEffect(() => {
    if (open) {
      setStep('template');
      setPickedTemplate(null);
      reset({ name: '', avatarEmoji: '', templateKey: 'blank' });
    }
  }, [open, reset]);

  function pickTemplate(key: AgentTemplateKey) {
    setPickedTemplate(key);
    setValue('templateKey', key);
    const tpl = getAgentTemplate(key);
    if (tpl) {
      // Pré-preenche nome sugerido + emoji default — usuário ajusta no passo 2.
      // "Em branco" começa nome vazio (template não tem persona definida).
      setValue('name', tpl.key === 'blank' ? '' : tpl.label);
      setValue('avatarEmoji', tpl.defaultAvatarEmoji);
    }
  }

  function goNext() {
    if (!pickedTemplate) return;
    setStep('details');
  }

  function goBack() {
    setStep('template');
  }

  function onSubmit(data: AgentCreateInput) {
    const created = createAgent(data);
    toast.success(
      `${created.name} criado em modo de teste — revise o prompt e ative quando estiver pronto.`,
      { duration: 5000 },
    );
    onOpenChange(false);
    router.push(`/agents/${created.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === 'template' ? (
          <>
            <DialogHeader>
              <DialogTitle>Novo agente IA</DialogTitle>
              <DialogDescription>
                Escolha um template pronto pra começar com prompt já redigido, ou monte do zero.
              </DialogDescription>
            </DialogHeader>

            <AgentTemplatePicker value={pickedTemplate} onChange={pickTemplate} />

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
              <DialogTitle>Configurar agente</DialogTitle>
              <DialogDescription>
                Dê um nome reconhecível. O agente vai começar em modo de teste — você pode ativar
                depois de testar no chat de simulação.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Field label="Nome do agente*" error={errors.name?.message}>
                <Input
                  {...register('name')}
                  placeholder="ex: Sofia · SDR"
                  aria-invalid={Boolean(errors.name)}
                  autoFocus
                />
              </Field>

              <Field
                label="Emoji do avatar"
                hint="Ajuda a diferenciar visualmente quando você tem mais de um agente."
                error={errors.avatarEmoji?.message}
              >
                <Input
                  {...register('avatarEmoji')}
                  placeholder="ex: 🎯"
                  maxLength={4}
                  className="w-24"
                  aria-invalid={Boolean(errors.avatarEmoji)}
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
                    Criar agente
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
