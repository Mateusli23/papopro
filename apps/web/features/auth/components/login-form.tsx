'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@papopro/ui';
import { AlertCircle, ArrowRight, Loader2 } from '@papopro/ui/icons';

import { loginSchema, type LoginInput } from '../schemas';

import { FormField } from './form-field';

/**
 * Form de login. Validação client-side com Zod + React Hook Form.
 *
 * Estado da navegação **mockado** (M3): o submit espera ~600 ms para mostrar
 * o loading no botão e redireciona pro dashboard sem checar credenciais. Em
 * M7 esse handler vira Server Action chamando `supabase.auth.signInWithPassword`,
 * mas a forma do componente não muda — o RHF e os schemas continuam.
 *
 * O slot `submitError` já está pronto para renderizar erros vindos do servidor
 * (ex: "Email ou senha incorretos") — basta setar via `setSubmitError`.
 */
export function LoginForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async () => {
    setSubmitError(null);

    // Mock: simula latência da rede pra mostrar o loading do botão.
    // Em M7, troca por Server Action real.
    await new Promise((resolve) => setTimeout(resolve, 600));

    router.push('/dashboard');
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Bem-vindo de volta</h1>
        <p className="text-muted-foreground text-body">
          Acesse seu workspace e continue de onde parou.
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
          id="login-email"
          label="Email"
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

        <div className="flex flex-col gap-1.5">
          <FormField
            id="login-password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end">
            <Link href="/forgot" className="text-primary text-caption font-medium hover:underline">
              Esqueci a senha
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Entrando…
            </>
          ) : (
            <>
              Acessar
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-body text-center">
        Ainda não tem conta?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
