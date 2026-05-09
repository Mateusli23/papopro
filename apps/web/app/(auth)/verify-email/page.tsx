import type { Metadata } from 'next';

import { VerifyEmailCard } from '@/features/auth/components/verify-email-card';

export const metadata: Metadata = {
  title: 'Confirme seu email',
  description: 'Confirme seu email para ativar sua conta PapoPro.',
};

interface VerifyEmailPageProps {
  searchParams: { email?: string | string[] };
}

/**
 * Aceita `?email=` opcional para personalizar o texto. Validação leve aqui:
 * se vier array (raro, mas o tipo do Next permite) ou vazio, ignora; o
 * componente trata o caso ausente.
 */
export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const raw = searchParams.email;
  const email = typeof raw === 'string' && raw.length > 0 ? raw : undefined;

  return <VerifyEmailCard email={email} />;
}
