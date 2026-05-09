'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@papopro/ui';
import { AlertCircle, ArrowRight, Loader2 } from '@papopro/ui/icons';

import { onboardingSchema, type OnboardingInput } from '../schemas';

import { FormField } from './form-field';

/**
 * Form de onboarding mínimo — pede o nome do primeiro workspace e redireciona
 * pro dashboard.
 *
 * Em M3 isso é suficiente para destravar a navegação ponta-a-ponta. O wizard
 * completo de 4 passos (workspace, conectar WhatsApp, criar agente IA,
 * importar CSV — PLAN.md M3) entra junto com as features que ele dispara, em
 * marcos posteriores; aqui o objetivo é só nomear e seguir.
 *
 * Em M7 o submit vira Server Action que cria a row em `workspaces`, vincula
 * o usuário em `workspace_members` como Owner e seta o cookie de workspace
 * ativo lido pelo `with-workspace.ts`.
 */
export function OnboardingForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { workspaceName: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async () => {
    setSubmitError(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    router.push('/dashboard');
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      {submitError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-body flex items-start gap-2 rounded-md p-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <FormField
        id="onboarding-workspace"
        label="Nome do workspace"
        type="text"
        autoFocus
        autoComplete="organization"
        placeholder="Ex: Imóvel Pro Vendas"
        hint="Você pode criar mais workspaces depois nas configurações."
        error={errors.workspaceName?.message}
        {...register('workspaceName')}
      />

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Criando workspace…
          </>
        ) : (
          <>
            Continuar para o dashboard
            <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
