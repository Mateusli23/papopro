import type { Metadata } from 'next';

import { SecurityView } from './security-view';

export const metadata: Metadata = {
  title: 'Segurança · Configurações',
  description: 'Trocar senha e gerenciar sessão.',
};

/**
 * `/settings/security` — troca de senha do usuário logado.
 *
 * Aterriza aqui:
 *  - Direto via sub-nav (usuário decide trocar a senha).
 *  - Após reset por email (forgotAction → /auth/callback?next=/settings/security).
 *
 * O middleware já garante user + email confirmado antes desta rota. M7#5
 * adiciona "Encerrar todas as sessões" + audit log.
 */
export default function SecuritySettingsPage() {
  return <SecurityView />;
}
