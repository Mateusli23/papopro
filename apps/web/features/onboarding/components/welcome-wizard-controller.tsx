'use client';

import * as React from 'react';

import { useWorkspaceMock } from '@/features/workspace/workspace-mock-provider';
import { useUser } from '@/lib/auth/use-user';

import { WelcomeWizard } from './welcome-wizard';

/**
 * Controller que decide quando abrir o `WelcomeWizard`.
 *
 * Regra (M7#3): abre AUTOMATICAMENTE no primeiro acesso ao dashboard quando
 * o user está logado (Supabase) E ainda não completou/pulou o wizard mock.
 *
 * Em M7#4 a fonte de `wizardCompleted` vira "user tem ao menos um
 * `workspace_member` com `joined_at != null`" — wizard vira o handler real
 * de criação de workspace + role Owner.
 *
 * Os dois `loading` (user + workspace) são esperados juntos pra evitar flash:
 * se abríssemos antes do cookie hidratar, o user que já completou veria o
 * wizard piscar.
 */
export function WelcomeWizardController() {
  const { loading: userLoading, user } = useUser();
  const { loading: wsLoading, wizardCompleted } = useWorkspaceMock();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (userLoading || wsLoading) return;
    if (!user) return;
    if (wizardCompleted) return;
    setOpen(true);
  }, [userLoading, wsLoading, user, wizardCompleted]);

  return <WelcomeWizard open={open} onOpenChange={setOpen} />;
}
