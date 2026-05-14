import 'server-only';

import type { Prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toTaskUI, type TaskWithLead } from './transforms';
import type { TaskKind, TaskStatus } from './types';

/**
 * Lead simplificado pra alimentar combobox em forms (M8#4 — leads do workspace
 * disponíveis pro `TaskCreateDialog` selecionar). Duplicado intencionalmente
 * com `features/deals/queries.ts` (M8#3 — PR #48) — quando ambos os PRs
 * estiverem em `dev`, consolida-se num único lugar (decisão pós-merge).
 */
export interface LeadComboboxOption {
  id: string;
  name: string;
  company: string | null;
}

export async function listLeadsForCombobox(workspaceId: string): Promise<LeadComboboxOption[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listLeadsForCombobox] invalid workspaceId', workspaceId);
    return [];
  }
  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.lead.findMany({
      where: { workspaceId, status: 'ativo', deletedAt: null },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows;
  });
}

/**
 * Queries server-only do feature `tasks` (M8#4).
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** todas com `withWorkspace` (RLS) +
 * `where: { workspaceId }` explícito.
 *
 * **Sort canônico:**
 *  - Para `/tasks` (lista geral): `status ASC` (pending primeiro) +
 *    `dueAt ASC` (mais cedo primeiro), criada-antes desempata.
 *  - Para `/leads/[id]` (próximas ações): mesma ordem.
 */

export interface ListTasksFilters {
  /** Filtra por vendedor (workspace_member.id). */
  assignedToId?: string;
  /** Filtra por tipo. */
  kind?: TaskKind;
  /** Filtra por status; default = todos. */
  status?: TaskStatus;
  /** Paginação. Default 200 (volume MVP). */
  take?: number;
}

export async function listTasksForLead(
  workspaceId: string,
  leadId: string,
): Promise<TaskWithLead[]> {
  if (!isUuid(workspaceId) || !isUuid(leadId)) {
    console.error('[listTasksForLead] invalid ids', { workspaceId, leadId });
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.task.findMany({
      where: { workspaceId, leadId },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    // Sem include de lead — a ficha já conhece o lead. Economiza payload.
    return rows.map((row) => toTaskUI(row));
  });
}

export async function listTasks(
  workspaceId: string,
  filters: ListTasksFilters = {},
): Promise<TaskWithLead[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listTasks] invalid workspaceId', workspaceId);
    return [];
  }

  const where: Prisma.TaskWhereInput = { workspaceId };
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.kind) where.kind = filters.kind;
  if (filters.status) where.status = filters.status;

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.task.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, company: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
      take: filters.take ?? 200,
    });
    return rows.map((row) => toTaskUI(row));
  });
}

export async function getTask(workspaceId: string, taskId: string): Promise<TaskWithLead | null> {
  if (!isUuid(workspaceId) || !isUuid(taskId)) return null;

  return await withWorkspace(workspaceId, async (tx) => {
    const row = await tx.task.findFirst({
      where: { id: taskId, workspaceId },
      include: { lead: { select: { id: true, name: true, company: true } } },
    });
    return row ? toTaskUI(row) : null;
  });
}
