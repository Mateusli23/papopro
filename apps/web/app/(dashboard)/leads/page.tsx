import { Suspense } from 'react';

import type { Metadata } from 'next';

import { LeadsView } from './leads-view';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Lista densa de leads do workspace com filtros, busca e ações rápidas.',
};

/**
 * `/leads` — Server Component fino. Toda a lógica vive no `LeadsView`
 * client porque depende do store in-memory e dos `searchParams` reativos.
 *
 * O wrapper `<Suspense>` é exigência do Next 14 quando o filho client
 * usa `useSearchParams()` — sem ele, o build de produção falha com
 * "missing-suspense-with-csr-bailout". Em SSR o fallback nunca renderiza
 * (toda a página é client-side); só serve pra satisfazer o prerender.
 *
 * Em M8 a leitura passa a ser server-side via Prisma + cookies (workspace
 * ativo) e o componente client recebe os leads como prop inicial pra
 * hidratar o store.
 */
export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsView />
    </Suspense>
  );
}
