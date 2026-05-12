import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse seu workspace PapoPro.',
};

interface LoginPageProps {
  searchParams: { next?: string | string[] };
}

/**
 * `?next=` é propagado pelo landing `/invite/accept` (M7#4 Onda 2): quem já
 * tem conta clica em "Já tenho conta — entrar" e o login redireciona de
 * volta pro fluxo de aceite após autenticar.
 *
 * Validação de open-redirect roda no form/middleware (`safeNextParam`).
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const rawNext = searchParams.next;
  const next = typeof rawNext === 'string' && rawNext.length > 0 ? rawNext : undefined;
  return <LoginForm next={next} />;
}
