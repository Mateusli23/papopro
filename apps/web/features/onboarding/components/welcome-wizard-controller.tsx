'use client';

import * as React from 'react';

import { useAuthMock } from '@/lib/auth/auth-mock-provider';

import { WelcomeWizard } from './welcome-wizard';

/**
 * Controller que decide quando abrir o `WelcomeWizard`.
 *
 * Regra (M3): abre AUTOMATICAMENTE no primeiro acesso a qualquer rota do
 * dashboard quando o usuário está logado E ainda não completou/pulou o
 * wizard. Após concluir/pular, o cookie `papopro_auth_mock_wizard_completed`
 * fica setado e o wizard nunca mais reabre nessa sessão.
 *
 * Estado `loading` do AuthMock é importante: enquanto o cookie ainda não
 * foi lido (entre render inicial e useEffect do provider), `wizardCompleted`
 * default é `false` — se abríssemos o wizard nesse intervalo, o usuário que
 * JÁ concluiu veria o wizard piscar antes de fechar. Esperar `loading=false`
 * resolve.
 */
export function WelcomeWizardController() {
  const { loading, user, wizardCompleted } = useAuthMock();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (wizardCompleted) return;
    setOpen(true);
  }, [loading, user, wizardCompleted]);

  return <WelcomeWizard open={open} onOpenChange={setOpen} />;
}
