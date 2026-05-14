import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { prisma } from '@papopro/db';

import { listSalesReps } from '@/features/leads/queries';
import { listLeadsForCombobox, listTasks } from '@/features/tasks/queries';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

import { TasksView } from './tasks-view';

export const metadata: Metadata = {
  title: 'Tarefas',
};

/**
 * Server Component (M8#4) — lê tasks + sales reps + leads do workspace ativo
 * via Prisma + RLS e passa pra `<TasksView>` como snapshot inicial.
 *
 * `dynamic = 'force-dynamic'` por causa do cookie httpOnly + queries
 * dependentes do workspace ativo (mesmo padrão de /leads e /kanban).
 */
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) redirect('/login');

  const callerMembership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!callerMembership) redirect('/onboarding');

  // Resolve workspace_member.id do caller pra abas "Minhas" filtrarem certo.
  const callerMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ctx.user.id } },
    select: { id: true },
  });

  const [initialTasks, salesReps, leadOptions] = await Promise.all([
    listTasks(workspaceId),
    listSalesReps(workspaceId),
    listLeadsForCombobox(workspaceId),
  ]);

  return (
    <TasksView
      initialTasks={initialTasks}
      salesReps={salesReps}
      leadOptions={leadOptions}
      callerMemberId={callerMember?.id ?? null}
      callerRole={callerMembership.role}
    />
  );
}
