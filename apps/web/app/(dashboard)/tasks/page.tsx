import type { Metadata } from 'next';

import { TasksView } from './tasks-view';

/**
 * Server Component fino — só metadata + render do client view.
 * Mesmo padrão de [kanban/page.tsx](../kanban/page.tsx),
 * [reports/page.tsx](../reports/page.tsx) e
 * [dashboard/page.tsx](../dashboard/page.tsx).
 *
 * Em M8 vira Server Component que lê tasks via Prisma + RLS e passa
 * snapshot inicial pra `<TasksView>` hidratar mais rápido.
 */
export const metadata: Metadata = {
  title: 'Tarefas',
};

export default function TasksPage() {
  return <TasksView />;
}
