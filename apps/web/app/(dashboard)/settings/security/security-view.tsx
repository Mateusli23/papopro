'use client';

import * as React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@papopro/ui';
import { AlertCircle, Lock } from '@papopro/ui/icons';

import { updatePasswordAction } from '@/features/auth/actions';
import { FormField } from '@/features/auth/components/form-field';
import { updatePasswordSchema, type UpdatePasswordInput } from '@/features/auth/schemas';

/**
 * Form de troca de senha. Server Action `updatePasswordAction` chama
 * `supabase.auth.updateUser({ password })`.
 *
 * Sucesso: toast verde + reset do form. Erro: mensagem inline (mesmo padrão
 * dos forms de auth — banner vermelho no topo do form).
 *
 * M7#5 adiciona "Encerrar todas as sessões" (signOut com scope `'global'`)
 * + log de auditoria de mudança de senha.
 */
export function SecurityView() {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);

    const result = await updatePasswordAction(data);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    toast.success(result.message ?? 'Senha atualizada.');
    reset();
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Segurança"
        description="Atualize a senha de acesso e gerencie sua sessão."
      />

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="bg-primary/10 text-primary mt-1 flex size-10 shrink-0 items-center justify-center rounded-md"
            >
              <Lock className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-title">Trocar senha</CardTitle>
              <p className="text-muted-foreground text-body">
                Use uma senha forte que você não usa em outros serviços. Mínimo 8 caracteres.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form noValidate onSubmit={onSubmit} className="flex max-w-md flex-col gap-5">
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
              id="security-new-password"
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              hint="Use letras, números e símbolos pra ficar mais forte."
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />

            <FormField
              id="security-confirm-password"
              label="Confirme a nova senha"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" disabled={isSubmitting} className="self-start">
              {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
