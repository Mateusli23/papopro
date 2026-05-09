import type { Metadata } from 'next';

import { LeadsView } from './leads-view';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Lista densa de leads do workspace com filtros, busca e ações rápidas.',
};

/**
 * `/leads` — Server Component fino. Toda a lógica vive no `LeadsView`
 * client porque depende do store in-memory e dos `searchParams` reativos
 * (filtros via nuqs). Em M8 a leitura passa a ser server-side via Prisma
 * + cookies (workspace ativo) e o componente client recebe os leads como
 * prop inicial pra hidratar o store.
 */
export default function LeadsPage() {
  return <LeadsView />;
}
