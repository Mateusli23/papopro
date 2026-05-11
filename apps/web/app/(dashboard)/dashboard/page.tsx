import type { Metadata } from 'next';

import { DashboardContent } from './dashboard-content';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Dashboard — Server Component fino. Toda lógica de variante (pré × pós
 * onboarding) e dados do user vivem no `DashboardContent` client.
 *
 * Em M7#3 o user veio do Supabase (`useUser`), mas `wizardCompleted` ainda
 * é mock (`useWorkspaceMock`) — fonte cliente. M7#4 vai derivar isso de
 * `getCurrentUserContext().memberships`, aí faz sentido mover a decisão
 * pro server e enviar a variante já renderizada.
 */
export default function DashboardPage() {
  return <DashboardContent />;
}
