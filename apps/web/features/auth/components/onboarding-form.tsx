'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@papopro/ui';
import { AlertCircle, ArrowRight, Loader2 } from '@papopro/ui/icons';

import { createWorkspaceAction } from '@/features/workspace/actions';
import { workspaceCreateSchema, type WorkspaceCreateInput } from '@/features/workspace/schemas';

import { FormField } from './form-field';

/**
 * Form de onboarding — cria o primeiro workspace de verdade (M7#4 Onda 1).
 *
 * Antes (M3): persistia em fixtures, navegava direto pra /dashboard.
 * Agora: chama `createWorkspaceAction`, que insere Workspace + WorkspaceMember
 * (Owner) + NotificationPreference + AuditLog em uma transação, e seta o
 * cookie httpOnly `papopro_workspace_id` lido pelo middleware.
 *
 * Pós-sucesso: `router.refresh()` força o middleware a re-rodar com o cookie
 * novo (evita "redireciona pra /onboarding de novo" em refresh manual) e
 * `router.push(redirectTo)` navega pro destino que a action sugeriu — hoje
 * sempre `/dashboard`.
 *
 * O schema vive em `features/workspace/schemas.ts` (não em `features/auth`)
 * porque conceitualmente o owner é o feature workspace; onboarding é só uma
 * superfície de UI que dispara a criação.
 */
export function OnboardingForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceCreateInput>({
    resolver: zodResolver(workspaceCreateSchema),
    defaultValues: { name: '', segment: null },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const result = await createWorkspaceAction(data);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    // router.refresh() reativa o middleware com o cookie recém-setado; sem
    // ele, o push abaixo entrega ao middleware um snapshot stale e mandaria
    // o usuário de volta pra /onboarding em raros race conditions.
    router.refresh();
    router.push(result.redirectTo);
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
        error={errors.name?.message}
        {...register('name')}
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
