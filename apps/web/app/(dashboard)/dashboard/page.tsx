import type { Metadata } from 'next';

import { DashboardContent } from './dashboard-content';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Dashboard — Server Component fino. Toda lógica de variante (pré × pós
 * onboarding) e dados do user vivem no `DashboardContent` client, porque
 * dependem do `AuthMockProvider`. Quando M7 substituir o AuthMock por
 * sessão Supabase real, fica trivial mover essa decisão pro server (ler
 * `wizardCompleted` no `cookies()` e renderizar a variante certa direto).
 */
export default function DashboardPage() {
  return <DashboardContent />;
}
