'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button, Checkbox } from '@papopro/ui';
import { AlertCircle, ArrowRight, Loader2 } from '@papopro/ui/icons';

import { signupAction } from '../actions';
import { signupSchema, type SignupInput } from '../schemas';

import { FormField } from './form-field';

interface SignupFormProps {
  /** Path relativo pra retomar após confirmação de email (ex: `/invite/accept?token=…`). */
  next?: string;
  /** Email pré-preenchido (UX de convite — trava o campo pra não desviar do fluxo). */
  prefilledEmail?: string;
}

/**
 * Form de cadastro (signup). Validação Zod + RHF, submit via Server Action
 * `signupAction` (M7#3, ampliado em M7#4 Onda 2 com `next` opcional).
 *
 * Fluxo:
 *  1. RHF valida (Zod) → submit chamado
 *  2. `signupAction(data, { next })` → Supabase signUp + email de confirmação
 *     + cookies httpOnly. `next` vai pro `emailRedirectTo` (volta pro convite
 *     depois de confirmar email).
 *  3. Sucesso: redirect pra `/verify-email`.
 *  4. Erro: `setSubmitError(result.error)` — pt-BR já traduzido na action.
 */
export function SignupForm({ next, prefilledEmail }: SignupFormProps = {}) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: prefilledEmail ?? '',
      password: '',
      acceptTerms: false,
    },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);

    // Bloqueia divergência entre email pré-preenchido (do convite) e o que
    // veio submetido. Defense-in-depth: o input pode estar `readOnly` mas
    // DevTools consegue alterar — server-side garante.
    if (prefilledEmail && data.email.toLowerCase() !== prefilledEmail.toLowerCase()) {
      setSubmitError(
        'Para aceitar o convite, crie a conta com o email convidado. Para outro email, peça um novo convite.',
      );
      return;
    }

    const result = await signupAction(data, next ? { next } : undefined);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.refresh();
    router.push(result.redirectTo ?? '/verify-email');
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Criar sua conta</h1>
        <p className="text-muted-foreground text-body">
          7 dias grátis, sem cartão. Configure seu workspace em menos de 2 minutos.
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {submitError && (
          <div
            role="alert"
            data-testid="signup-error"
            className="bg-destructive/10 text-destructive text-body flex items-start gap-2 rounded-md p-3"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <FormField
          id="signup-name"
          data-testid="signup-name"
          label="Seu nome"
          type="text"
          autoComplete="name"
          placeholder="Maria Silva"
          error={errors.name?.message}
          {...register('name')}
        />

        <FormField
          id="signup-email"
          data-testid="signup-email"
          label="Email de trabalho"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="voce@empresa.com"
          // `readOnly` em vez de `disabled`: campo continua submetido pelo
          // form (disabled exclui do form data), só não é editável. UX clara
          // que esse é o email do convite — usuário não confunde.
          readOnly={Boolean(prefilledEmail)}
          hint={prefilledEmail ? 'Email do convite — crie a conta com esse endereço.' : undefined}
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          id="signup-password"
          data-testid="signup-password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          hint="Use pelo menos 8 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex flex-col gap-1.5">
          {/*
           * Checkbox via Controller — o Radix Checkbox expõe `onCheckedChange`
           * (booleano) em vez do `onChange` esperado pelo `register` do RHF.
           * `Controller` é a ponte oficial: aceitamos `value` para o checked
           * controlado e `onChange` para propagar a mudança ao form.
           */}
          <label
            htmlFor="signup-terms"
            className="text-foreground text-body flex cursor-pointer items-start gap-2.5"
          >
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="signup-terms"
                  ref={field.ref}
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.acceptTerms) || undefined}
                  aria-describedby={errors.acceptTerms ? 'signup-terms-error' : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <span className="leading-snug">
              Concordo com os{' '}
              <Link href="/legal/terms" className="text-primary font-medium hover:underline">
                termos de uso
              </Link>{' '}
              e a{' '}
              <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
                política de privacidade
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="signup-terms-error" role="alert" className="text-caption text-destructive">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          data-testid="signup-submit"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Criando conta…
            </>
          ) : (
            <>
              Criar conta
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-body text-center">
        Já tem conta?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="text-primary font-medium hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
