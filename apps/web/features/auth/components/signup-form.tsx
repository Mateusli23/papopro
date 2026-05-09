'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button, Checkbox } from '@papopro/ui';
import { AlertCircle, ArrowRight, Loader2 } from '@papopro/ui/icons';

import { signupSchema, type SignupInput } from '../schemas';

import { FormField } from './form-field';

/**
 * Form de cadastro (signup). Validação Zod + RHF, mesma forma do login.
 *
 * Submit mockado (M3): cria nada, só redireciona para `/onboarding`, onde o
 * usuário nomeia o primeiro workspace. Em M7 vira `supabase.auth.signUp` +
 * envio de email de confirmação via Resend; o redirect passa a ser para
 * `/verify-email` antes do onboarding.
 */
export function SignupForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async () => {
    setSubmitError(null);

    // Mock: simula latência da rede. Em M7, troca por Server Action real.
    await new Promise((resolve) => setTimeout(resolve, 600));

    router.push('/onboarding');
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
            className="bg-destructive/10 text-destructive text-body flex items-start gap-2 rounded-md p-3"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <FormField
          id="signup-name"
          label="Seu nome"
          type="text"
          autoComplete="name"
          placeholder="Maria Silva"
          error={errors.name?.message}
          {...register('name')}
        />

        <FormField
          id="signup-email"
          label="Email de trabalho"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="voce@empresa.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          id="signup-password"
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

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
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
        <Link href="/login" className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
