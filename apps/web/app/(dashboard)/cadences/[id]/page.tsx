import { notFound, redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { getCadence } from '@/features/cadences/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { CadenceEditorView } from './cadence-editor-view';

export const metadata: Metadata = {
  title: 'Editar cadência',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

/**
 * `/cadences/[id]` — Server Component carrega a cadência completa (steps +
 * métricas agregadas em uma única tx via `getCadence`) e passa pro editor.
 *
 * Cadência inexistente / de outro workspace → 404 (Prisma respeita RLS).
 */
export default async function CadenceDetailPage({ params }: PageProps) {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  const cadence = await getCadence(workspaceId, params.id);
  if (!cadence) {
    notFound();
  }

  return <CadenceEditorView initialCadence={cadence} />;
}
