import type { Metadata } from 'next';

import { ReportsView } from './reports-view';

/**
 * Server Component fino — só metadata + render do client view.
 * Mesmo padrão de [kanban/page.tsx](../kanban/page.tsx) e [dashboard/page.tsx](../dashboard/page.tsx).
 *
 * Em M8 vira Server Component que lê deals/leads via Prisma + RLS e
 * passa snapshot inicial pro `<ReportsView>` hidratar mais rápido.
 */
export const metadata: Metadata = {
  title: 'Relatórios',
};

export default function ReportsPage() {
  return <ReportsView />;
}
