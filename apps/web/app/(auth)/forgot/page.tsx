import type { Metadata } from 'next';

import { ForgotForm } from '@/features/auth/components/forgot-form';

export const metadata: Metadata = {
  title: 'Esqueci a senha',
  description: 'Receba um link por email para redefinir sua senha.',
};

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
