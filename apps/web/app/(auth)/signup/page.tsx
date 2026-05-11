import type { Metadata } from 'next';

import { SignupForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Crie sua conta PapoPro — 7 dias grátis, sem cartão.',
};

interface SignupPageProps {
  searchParams: { next?: string | string[]; email?: string | string[] };
}

/**
 * `?next=` e `?email=` são propagados pelo landing `/invite/accept` (Onda 2):
 *  - `next` orienta o `emailRedirectTo` do Supabase signUp (volta pro convite
 *    depois da confirmação de email).
 *  - `email` pré-preenche o campo + trava (UX: convite é pra esse endereço,
 *    trocar quebraria o fluxo).
 *
 * Validações de segurança (open-redirect, formato) ficam no caller (Server
 * Action / form), aqui só pegamos o valor cru.
 */
export default function SignupPage({ searchParams }: SignupPageProps) {
  const rawNext = searchParams.next;
  const rawEmail = searchParams.email;
  const next = typeof rawNext === 'string' && rawNext.length > 0 ? rawNext : undefined;
  const prefilledEmail = typeof rawEmail === 'string' && rawEmail.length > 0 ? rawEmail : undefined;
  return <SignupForm next={next} prefilledEmail={prefilledEmail} />;
}
