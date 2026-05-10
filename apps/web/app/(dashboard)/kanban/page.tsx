import { Suspense } from 'react';

import type { Metadata } from 'next';

import { KanbanView } from './kanban-view';

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'Funil visual com drag-and-drop. Indicadores de temperatura e deal rotting.',
};

/**
 * Wrapper `<Suspense>` é exigência do Next 14 quando o filho client usa
 * `useSearchParams()` — sem ele, o build de produção falha com
 * "missing-suspense-with-csr-bailout". Em SSR o fallback nunca renderiza
 * (toda a página é client-side); só serve pra satisfazer o prerender.
 */
export default function KanbanPage() {
  return (
    <Suspense>
      <KanbanView />
    </Suspense>
  );
}
