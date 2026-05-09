import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse seu workspace PapoPro.',
};

export default function LoginPage() {
  return <LoginForm />;
}
