import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getLead } from '@/lib/fixtures/leads';

import { LeadDetailView } from './lead-detail-view';

interface LeadDetailPageProps {
  params: { id: string };
}

export function generateMetadata({ params }: LeadDetailPageProps): Metadata {
  const lead = getLead(params.id);
  return {
    title: lead ? lead.name : 'Lead não encontrado',
  };
}

/**
 * `/leads/[id]` — Server Component fino. Confirma que o ID existe nas
 * fixtures (404 explícito é melhor que tela quebrada). O conteúdo client
 * volta a ler o lead via `useLead(id)` pra refletir mutações inline em
 * tempo real (sem refresh).
 *
 * Em M8 essa server component vira `await getLead({ workspaceId, id })`
 * com Prisma + RLS, e o client recebe o snapshot inicial como prop.
 */
export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const lead = getLead(params.id);
  if (!lead) notFound();
  return <LeadDetailView leadId={params.id} />;
}
