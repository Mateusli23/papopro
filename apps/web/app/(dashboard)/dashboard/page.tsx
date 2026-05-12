import type { Metadata } from 'next';

import { readWizardCookie } from '@/lib/auth/workspace-cookie';

import { DashboardContent } from './dashboard-content';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Dashboard — Server Component lê o cookie `papopro_wizard_completed` server-
 * side e passa pra `DashboardContent` (client) decidir entre variante
 * pré-onboarding (checklist orientador) e pós-onboarding (KPIs reais).
 *
 * **M7#4 Onda 3:** substitui o `useWorkspaceMock().wizardCompleted` legacy
 * pelo cookie httpOnly setado por `markWizardCompletedAction`. Servidor é a
 * fonte de verdade — sem race entre client cookie e provider hidratando.
 */
export default function DashboardPage() {
  const wizardCompleted = readWizardCookie();
  return <DashboardContent wizardCompleted={wizardCompleted} />;
}
