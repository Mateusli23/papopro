'use client';

import * as React from 'react';

import Link from 'next/link';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@papopro/ui';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from '@papopro/ui/icons';

import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas';

import { FormField } from './form-field';

/**
 * Form de "esqueci a senha". Pede o email e mostra estado de confirmação
 * ("se existe conta com esse email, enviamos um link") — propositalmente
 * agnóstico sobre existência da conta para não vazar quais emails têm conta
 * (boa prática anti-enumeração de usuários).
 *
 * Mockado em M3: submit espera 600 ms e troca pra tela de confirmação. Em M7
 * vira Server Action `supabase.auth.resetPasswordForEmail` + dispatch de
 * email via Resend.
 */
export function ForgotForm() {
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async () => {
    setSubmitError(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmittedEmail(getValues('email'));
  });

  // Estado pós-envio: confirmação genérica (não revela se a conta existe).
  if (submittedEmail) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <span className="bg-success/15 text-success flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-foreground text-title-lg font-semibold">Confira seu email</h1>
            <p className="text-muted-foreground text-body">
              Se existe uma conta para <strong className="text-foreground">{submittedEmail}</strong>
              , enviamos um link para redefinir a senha. O link expira em 30 minutos.
            </p>
          </div>
        </div>

        <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-md border p-4">
          <p className="text-foreground text-body font-medium">Não chegou?</p>
          <ul className="text-muted-foreground text-caption flex list-disc flex-col gap-1 pl-5">
            <li>Verifique a caixa de spam ou promoções.</li>
            <li>Confira se digitou o email certo.</li>
            <li>Pode levar até 5 minutos para chegar.</li>
          </ul>
        </div>

        <Button variant="outline" asChild className="w-full">
          <Link href="/login">
            <ArrowLeft />
            Voltar para o login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Esqueci a senha</h1>
        <p className="text-muted-foreground text-body">
          Informe o email cadastrado e enviamos um link para você criar uma nova senha.
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
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
          id="forgot-email"
          label="Email da conta"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          placeholder="voce@empresa.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              Enviar link de redefinição
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-body text-center">
        Lembrou a senha?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
