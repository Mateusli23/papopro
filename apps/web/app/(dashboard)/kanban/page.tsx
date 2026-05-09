import type { Metadata } from 'next';

import { KanbanView } from './kanban-view';

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'Funil visual com drag-and-drop. Indicadores de temperatura e deal rotting.',
};

export default function KanbanPage() {
  return <KanbanView />;
}
