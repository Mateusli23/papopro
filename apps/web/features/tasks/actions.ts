'use server';

/**
 * Server Actions do feature `tasks` (M8#4).
 *
 * Cinco operações cobrem o CRUD da timeline + /tasks:
 *  - `createTaskAction` — modal "Nova tarefa" (ficha do lead ou /tasks)
 *  - `updateTaskAction` — edição via TaskEditDialog
 *  - `completeTaskAction` — checkbox "Concluir" / dropdown "Concluir"
 *  - `reopenTaskAction` — inverso de complete (desmarca checkbox)
 *  - `deleteTaskAction` — remoção (hard delete; tasks são efêmeras)
 *
 * **Padrão (espelha `features/leads/actions.ts`):**
 *  1. Zod parse
 *  2. `requireRole([...])`
 *  3. `getRequestAuditContext()`
 *  4. `withWorkspace(workspaceId, async tx => ...)` — RLS + defense-in-depth
 *  5. Atividade(s) + audit log na MESMA tx
 *  6. `recomputeLeadNextAction` (denormalização `Lead.nextActionAt/Label`)
 *  7. `revalidatePath('/leads/[id]')` + `revalidatePath('/tasks')`
 *  8. Retorno `{ ok: true, taskId } | { ok: false, error }`
 *
 * **RBAC:** Owner/Admin/Manager/Vendedor podem criar/editar/concluir/reabrir
 * tasks. **Deletar** é restrito a Owner/Admin/Manager (Vendedor não apaga
 * task de colega — mesma regra de `assignLeadAction` em M8#2).
 *
 * **Activities geradas:**
 *  - `createTaskAction` → activity `task` com `meta.eventKind='created'`
 *  - `completeTaskAction` → activity `task` com `meta.eventKind='completed'`
 *  - `updateTaskAction` / `reopenTaskAction` / `deleteTaskAction` → SEM
 *    activity (eventos de baixa relevância na timeline; só audit log)
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import {
  completeTaskSchema,
  deleteTaskSchema,
  reopenTaskSchema,
  taskCreateSchema,
  updateTaskSchema,
  type CompleteTaskInput,
  type DeleteTaskInput,
  type ReopenTaskInput,
  type TaskCreateInput,
  type UpdateTaskInput,
} from './schemas';

export type TaskActionResult = { ok: true; taskId: string } | { ok: false; error: string };

// =============================================================================
// helpers
// =============================================================================

/**
 * Recalcula `Lead.nextActionAt` e `Lead.nextActionLabel` baseado na próxima
 * task `pending` do lead (ordem `dueAt ASC, createdAt ASC`). Chamado em
 * todas as mutações de task que possam mudar a "próxima ação".
 *
 * Quando nenhuma task pending sobra, seta `null` em ambos os campos.
 */
async function recomputeLeadNextAction(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  leadId: string,
): Promise<void> {
  const next = await tx.task.findFirst({
    where: { workspaceId, leadId, status: 'pending' },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    select: { dueAt: true, title: true },
  });
  await tx.lead.update({
    where: { id: leadId },
    data: {
      nextActionAt: next?.dueAt ?? null,
      nextActionLabel: next?.title ?? null,
    },
  });
}

function revalidateLeadAndTasks(leadId: string) {
  revalidatePath('/tasks');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

// =============================================================================
// createTaskAction
// =============================================================================

export async function createTaskAction(input: TaskCreateInput): Promise<TaskActionResult> {
  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para criar tarefas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const taskId = await withWorkspace<string>(workspaceId, async (tx) => {
      // Defense-in-depth FK validation
      const [lead, assignee] = await Promise.all([
        tx.lead.findFirst({
          where: { id: parsed.data.leadId, workspaceId, deletedAt: null },
          select: { id: true },
        }),
        tx.workspaceMember.findFirst({
          where: { id: parsed.data.assignedTo, workspaceId },
          select: { id: true },
        }),
      ]);
      if (!lead) throw new Error('LEAD_NOT_FOUND');
      if (!assignee) throw new Error('ASSIGNEE_NOT_FOUND');

      const task = await tx.task.create({
        data: {
          workspaceId,
          leadId: parsed.data.leadId,
          kind: parsed.data.kind,
          title: parsed.data.title.trim(),
          notes: parsed.data.notes ?? null,
          dueAt: new Date(parsed.data.dueAt),
          status: 'pending',
          assignedToId: parsed.data.assignedTo,
          createdById: userId,
        },
        select: { id: true },
      });

      // Activity `task` (eventKind=created) — timeline mostra "Tarefa criada".
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: parsed.data.leadId,
          type: 'task',
          body: parsed.data.title.trim(),
          authorId: parsed.data.assignedTo,
          meta: {
            eventKind: 'created',
            taskId: task.id,
            kind: parsed.data.kind,
          } as Prisma.InputJsonValue,
        },
      });

      await recomputeLeadNextAction(tx, workspaceId, parsed.data.leadId);

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'task_created',
          entityType: 'task',
          entityId: task.id,
          changes: {
            leadId: parsed.data.leadId,
            kind: parsed.data.kind,
            title: parsed.data.title,
            dueAt: parsed.data.dueAt,
            assignedTo: parsed.data.assignedTo,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return task.id;
    });

    revalidateLeadAndTasks(parsed.data.leadId);
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') {
        return { ok: false, error: 'Lead não encontrado. Recarregue a página.' };
      }
      if (err.message === 'ASSIGNEE_NOT_FOUND') {
        return { ok: false, error: 'Vendedor não pertence ao workspace.' };
      }
    }
    reportNonFatal('tasks.create.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível criar a tarefa agora. Tente em instantes.' };
  }
}

// =============================================================================
// updateTaskAction
// =============================================================================

export async function updateTaskAction(input: UpdateTaskInput): Promise<TaskActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para editar tarefas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { taskId, ...patch } = parsed.data;

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        select: { id: true, leadId: true, dueAt: true },
      });
      if (!task) throw new Error('TASK_NOT_FOUND');

      if (patch.assignedToId) {
        const owner = await tx.workspaceMember.findFirst({
          where: { id: patch.assignedToId, workspaceId },
          select: { id: true },
        });
        if (!owner) throw new Error('ASSIGNEE_NOT_FOUND');
      }

      const data: Prisma.TaskUpdateInput = {};
      if (patch.kind !== undefined) data.kind = patch.kind;
      if (patch.title !== undefined) data.title = patch.title.trim();
      if (patch.notes !== undefined) data.notes = patch.notes || null;
      if (patch.assignedToId !== undefined) {
        data.assignedTo = { connect: { id: patch.assignedToId } };
      }
      if (patch.dueAt !== undefined) data.dueAt = new Date(patch.dueAt);

      await tx.task.update({ where: { id: taskId }, data });

      // Se o `dueAt` mudou (afeta ordem), recalcula Lead.nextActionAt.
      if (patch.dueAt !== undefined) {
        await recomputeLeadNextAction(tx, workspaceId, task.leadId);
      }

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'task_completed', // não temos `task_updated` no enum — reaproveito; `changes` documenta.
          entityType: 'task',
          entityId: taskId,
          changes: { ...patch, eventKind: 'updated' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return task.leadId;
    });

    revalidateLeadAndTasks(leadId);
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'TASK_NOT_FOUND') return { ok: false, error: 'Tarefa não encontrada.' };
      if (err.message === 'ASSIGNEE_NOT_FOUND')
        return { ok: false, error: 'Vendedor não pertence ao workspace.' };
    }
    reportNonFatal('tasks.update.tx', err, { workspaceId, userId, taskId });
    return { ok: false, error: 'Não foi possível atualizar a tarefa agora.' };
  }
}

// =============================================================================
// completeTaskAction
// =============================================================================

export async function completeTaskAction(input: CompleteTaskInput): Promise<TaskActionResult> {
  const parsed = completeTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para concluir tarefas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { taskId } = parsed.data;

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        select: {
          id: true,
          leadId: true,
          status: true,
          title: true,
          kind: true,
          assignedToId: true,
        },
      });
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.status === 'done') return task.leadId; // idempotente

      const now = new Date();
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'done', doneAt: now },
      });

      // Activity `task` (eventKind=completed).
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: task.leadId,
          type: 'task',
          body: task.title,
          authorId: task.assignedToId,
          meta: {
            eventKind: 'completed',
            taskId: task.id,
            kind: task.kind,
          } as Prisma.InputJsonValue,
        },
      });

      // Lead também tem `lastInteractionAt` — task concluída é interação real.
      await tx.lead.update({
        where: { id: task.leadId },
        data: { lastInteractionAt: now },
      });

      await recomputeLeadNextAction(tx, workspaceId, task.leadId);

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'task_completed',
          entityType: 'task',
          entityId: taskId,
          changes: { title: task.title, kind: task.kind } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return task.leadId;
    });

    revalidateLeadAndTasks(leadId);
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof Error && err.message === 'TASK_NOT_FOUND') {
      return { ok: false, error: 'Tarefa não encontrada.' };
    }
    reportNonFatal('tasks.complete.tx', err, { workspaceId, userId, taskId });
    return { ok: false, error: 'Não foi possível concluir a tarefa agora.' };
  }
}

// =============================================================================
// reopenTaskAction
// =============================================================================

export async function reopenTaskAction(input: ReopenTaskInput): Promise<TaskActionResult> {
  const parsed = reopenTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para reabrir tarefas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { taskId } = parsed.data;

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        select: { id: true, leadId: true, status: true },
      });
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.status === 'pending') return task.leadId; // idempotente

      await tx.task.update({
        where: { id: taskId },
        data: { status: 'pending', doneAt: null },
      });

      // Sem activity — reabrir não é evento relevante na timeline.
      await recomputeLeadNextAction(tx, workspaceId, task.leadId);

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'task_completed', // reaproveito enum (não temos `task_reopened`); `changes` documenta.
          entityType: 'task',
          entityId: taskId,
          changes: { eventKind: 'reopened' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return task.leadId;
    });

    revalidateLeadAndTasks(leadId);
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof Error && err.message === 'TASK_NOT_FOUND') {
      return { ok: false, error: 'Tarefa não encontrada.' };
    }
    reportNonFatal('tasks.reopen.tx', err, { workspaceId, userId, taskId });
    return { ok: false, error: 'Não foi possível reabrir a tarefa agora.' };
  }
}

// =============================================================================
// deleteTaskAction
// =============================================================================

export async function deleteTaskAction(input: DeleteTaskInput): Promise<TaskActionResult> {
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Restrito a Owner/Admin/Manager (Vendedor não apaga task de colega).
  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem excluir tarefas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { taskId } = parsed.data;

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, workspaceId },
        select: { id: true, leadId: true, title: true },
      });
      if (!task) throw new Error('TASK_NOT_FOUND');

      // Hard delete — schema não tem `deletedAt`. Tasks são efêmeras.
      await tx.task.delete({ where: { id: taskId } });

      // Activities relacionadas continuam (append-only) — não removo do log.
      await recomputeLeadNextAction(tx, workspaceId, task.leadId);

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'task_completed', // sem `task_deleted` no enum atual; `changes` documenta.
          entityType: 'task',
          entityId: taskId,
          changes: { eventKind: 'deleted', title: task.title } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return task.leadId;
    });

    revalidateLeadAndTasks(leadId);
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof Error && err.message === 'TASK_NOT_FOUND') {
      return { ok: false, error: 'Tarefa não encontrada.' };
    }
    reportNonFatal('tasks.delete.tx', err, { workspaceId, userId, taskId });
    return { ok: false, error: 'Não foi possível excluir a tarefa agora.' };
  }
}
