'use client';

import * as React from 'react';

import { useUser } from '@/lib/auth/use-user';

import { WelcomeWizard } from './welcome-wizard';

interface WelcomeWizardControllerProps {
  /**
   * Vem do `getCurrentUserContext` no Server Component pai (Onda 1). Em prod
   * o middleware garante que quem chega aqui tem workspace; isso é defesa
   * adicional pra evitar abrir wizard em estado inválido.
   */
  hasWorkspace: boolean;
  /**
   * Vem do cookie httpOnly `papopro_wizard_completed` lido server-side (Onda 3).
   * Substitui o `useWorkspaceMock().wizardCompleted` legado.
   */
  wizardCompleted: boolean;
}

/**
 * Controller que decide quando abrir o `WelcomeWizard`.
 *
 * **Regra:** abre AUTOMATICAMENTE quando o user tem workspace **E** ainda
 * não marcou o wizard como concluído. Se `wizardCompleted=true`, nunca abre.
 *
 * **M7#4 Onda 3:** ambos os flags vêm via prop do server (sem cookie client
 * read, sem provider). `useUser` continua client porque o wizard depende de
 * estar logado pra renderizar — o status do user é hidratado em runtime.
 */
export function WelcomeWizardController({
  hasWorkspace,
  wizardCompleted,
}: WelcomeWizardControllerProps) {
  const { loading: userLoading, user } = useUser();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (userLoading) return;
    if (!user) return;
    if (!hasWorkspace) return;
    if (wizardCompleted) return;
    setOpen(true);
  }, [userLoading, user, hasWorkspace, wizardCompleted]);

  return <WelcomeWizard open={open} onOpenChange={setOpen} />;
}
