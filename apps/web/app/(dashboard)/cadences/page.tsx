import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { listCadences } from '@/features/cadences/queries';
import { listDefaultPipeline } from '@/features/leads/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { CadencesView } from './cadences-view';

export const metadata: Metadata = {
  title: 'Cadências',
  description: 'Sequências automáticas de follow-up por etapa do funil.',
};

/**
 * `dynamic = 'force-dynamic'` (M10#3): página depende do cookie httpOnly
 * `papopro_workspace_id` + sessão Supabase + queries com workspace ativo.
 * Sem o flag, Next tenta prerender em CI sem `.env.local` e crasha.
 */
export const dynamic = 'force-dynamic';

/**
 * `/cadences` — Server Component carrega cadências (com steps + métricas
 * agregadas) do workspace ativo e passa pra `CadencesView` como snapshot
 * inicial. Client Component hidrata via `hydrateCadencesFromServer` no mount
 * (padrão M9#4 Inbox).
 *
 * Mutações nas cadências (create/update/toggle/delete) acontecem via
 * Server Actions em `features/cadences/actions.ts`, que revalidam o path —
 * isso re-renderiza essa página e atualiza o snapshot.
 */
export default async function CadencesPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) {
    redirect('/onboarding');
  }

  // Carrega cadências e pipeline em paralelo. O pipeline alimenta o
  // agrupamento por etapa e o select de "Etapa do funil" no modal — antes
  // usávamos o fixture `DEFAULT_STAGES`, que não casa com os UUIDs reais
  // de `pipeline_stages` e fazia as cadências sumirem do agrupamento.
  const [initialCadences, pipeline] = await Promise.all([
    listCadences(workspaceId),
    listDefaultPipeline(workspaceId),
  ]);

  // Workspace sem pipeline default = estado corrupto (cadastro semeia 1
  // por padrão). Devolve fallback vazio pra evitar crash — UI mostra
  // EmptyState explicando que precisa criar pipeline antes.
  const stages = pipeline?.stages ?? [];

  return <CadencesView initialCadences={initialCadences} stages={stages} />;
}
