'use client';

import * as React from 'react';

import { useWorkspaceMock } from '@/features/workspace/workspace-mock-provider';
import { useUser } from '@/lib/auth/use-user';

import { WelcomeWizard } from './welcome-wizard';

interface WelcomeWizardControllerProps {
  /**
   * Vem do `getCurrentUserContext` no Server Component pai. Em M7#4 Onda 1
   * essa é a fonte de verdade — quem chega no dashboard tem workspace; o
   * wizard a partir daí guia os 3 passos restantes (WhatsApp, agente, CSV).
   *
   * Em Onda 3 a fonte de "primeira visita" também vira backend (campo em
   * `users.first_run_completed_at` ou similar) e o `useWorkspaceMock` sai
   * inteiro.
   */
  hasWorkspace: boolean;
}

/**
 * Controller que decide quando abrir o `WelcomeWizard`.
 *
 * Regra (M7#4 Onda 1): abre AUTOMATICAMENTE quando o user tem workspace **E**
 * ainda não marcou o wizard como concluído (cookie via `WorkspaceMockProvider`,
 * legado de M3 que sai em Onda 3).
 *
 * Se `hasWorkspace=false`, o controller mantém o wizard fechado — esse caso
 * só acontece transientemente (race entre createWorkspaceAction setar cookie e
 * o middleware reler), porque o middleware redireciona pra /onboarding antes
 * de chegar aqui.
 */
export function WelcomeWizardController({ hasWorkspace }: WelcomeWizardControllerProps) {
  const { loading: userLoading, user } = useUser();
  const { loading: wsLoading, wizardCompleted } = useWorkspaceMock();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (userLoading || wsLoading) return;
    if (!user) return;
    if (!hasWorkspace) return;
    if (wizardCompleted) return;
    setOpen(true);
  }, [userLoading, wsLoading, user, hasWorkspace, wizardCompleted]);

  return <WelcomeWizard open={open} onOpenChange={setOpen} />;
}
