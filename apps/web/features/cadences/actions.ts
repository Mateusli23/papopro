'use server';

/**
 * Server Actions de Cadências (M10#3).
 *
 * 12 operações cobrindo CRUD de cadência + steps + enrollments + cold
 * thresholds. Substituem as mutações in-memory do store (M5/M6). Mantêm a
 * mesma API pública de input/output das funções `apply*` em `transforms.ts`
 * pra que o caller (dialogs, toggles) só troque a fonte.
 *
 * **Padrão idiomático M8/M9**:
 *   Zod safeParse → requireRole → withWorkspace(tx) → defense-in-depth
 *   where: { workspaceId } → audit log na MESMA tx → revalidatePath.
 *
 * **RBAC** (CLAUDE.md §2.6):
 *  - Criar/editar/clonar cadência: Owner / Admin / Manager
 *  - Deletar cadência: Owner / Admin (Manager NÃO — pode esfregar dados sem aprovação)
 *  - Enroll/pause/resume lead: qualquer membro O/A/M/Vendedor (Vendedor só do próprio lead)
 *  - Editar cold thresholds: Owner / Admin
 *
 * **Templates** clonados do fixture `CADENCE_TEMPLATES` (lib/fixtures) — o
 * SQL seed M10#1 já criou 3 cadências por workspace, mas o usuário pode
 * querer NOVA cadência baseada em template; aqui clonamos os steps.
 *
 * **Métricas** em `Cadence.metrics` são lidas via `queries.ts` em batch.
 * As Server Actions NÃO atualizam métricas — elas são derivadas.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { CadenceStatus, CadenceTemplateKey, type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { CADENCE_TEMPLATES, getTemplate } from '@/lib/fixtures/cadence-templates';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { acknowledgeColdAlertSchema } from './cold-alerts.helpers';
import {
  cadenceCreateSchema,
  cadenceUpdateSchema,
  stepCreateSchema,
  stepUpdateSchema,
  type CadenceCreateInput,
} from './schemas';

// ─── Tipos compartilhados ───────────────────────────────────────────────────

export type CadenceActionResult = { ok: true; id: string } | { ok: false; error: string };

export type StepActionResult =
  | { ok: true; cadenceId: string; stepId: string }
  | { ok: false; error: string };

export type EnrollmentActionResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; error: string };

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Mapeia o template_key da UI (4 valores) → enum Prisma (5 valores).
 * Templates explícitos viram seus valores; uma cadência criada a partir de
 * uma cópia/edit começa como `custom`.
 */
function templateKeyForDb(key: string): CadenceTemplateKey {
  switch (key) {
    case 'imobiliario':
      return CadenceTemplateKey.imobiliario;
    case 'b2b':
      return CadenceTemplateKey.b2b;
    case 'alto-ticket':
      return CadenceTemplateKey.alto_ticket;
    case 'blank':
      return CadenceTemplateKey.blank;
    default:
      return CadenceTemplateKey.custom;
  }
}

function statusForDb(status: 'active' | 'paused' | undefined): CadenceStatus | undefined {
  if (status === undefined) return undefined;
  return status === 'active' ? CadenceStatus.active : CadenceStatus.paused;
}

/**
 * Carrega uma stage do workspace garantindo (1) ownership e (2) que não é
 * terminal — cadência em `ganho`/`perdido` não faz sentido (PRD §2.2).
 *
 * Defesa-em-profundidade: o schema Zod já garante UUID válido, mas o cliente
 * pode mandar qualquer UUID. Sem essa checagem no Server Action, uma cadência
 * podia ficar apontando pra stage de outro tenant ou pra etapa terminal.
 *
 * Roda fora de `withWorkspace` propositalmente: a query JOIN-a `pipelines`
 * filtrando por `workspaceId`, então RLS adicional seria redundante. Retorna
 * `null` em qualquer falha (não-encontrada, cross-tenant, terminal) — caller
 * traduz pra mensagem de erro.
 */
async function loadActiveStageInWorkspace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  workspaceId: string,
  stageId: string,
): Promise<{ id: string; terminal: boolean } | null> {
  const stage = await tx.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { workspaceId, deletedAt: null } },
    select: { id: true, terminal: true },
  });
  if (!stage) return null;
  if (stage.terminal) return null;
  return stage;
}

// ============================================================================
// createCadenceAction
// ============================================================================

export async function createCadenceAction(input: CadenceCreateInput): Promise<CadenceActionResult> {
  const parsed = cadenceCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { name, description, stageId, templateKey } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para criar cadências.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const template = getTemplate(templateKey);

  try {
    const cadenceId = await withWorkspace(workspaceId, async (tx) => {
      const stage = await loadActiveStageInWorkspace(tx, workspaceId, stageId);
      if (!stage) throw new Error('STAGE_INVALID');

      const cadence = await tx.cadence.create({
        data: {
          workspaceId,
          stageId,
          name,
          description: description ?? null,
          templateKey: templateKeyForDb(templateKey),
          status: CadenceStatus.active,
          createdById: userId,
          steps: template
            ? {
                create: template.steps.map((s) => ({
                  dayOffset: s.dayOffset,
                  channel: s.channel,
                  templateBody: s.templateBody,
                  orderIndex: s.order,
                })),
              }
            : undefined,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_created',
          entityType: 'cadence',
          entityId: cadence.id,
          changes: {
            name,
            stageId,
            templateKey,
            stepsCount: template?.steps.length ?? 0,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return cadence.id;
    });

    revalidatePath('/cadences');
    revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, id: cadenceId };
  } catch (err) {
    if ((err as Error).message === 'STAGE_INVALID') {
      return {
        ok: false,
        error: 'Selecione uma etapa ativa do seu funil (Ganho/Perdido não aceitam cadência).',
      };
    }
    reportNonFatal('cadences.create', err, { workspaceId, userId });
    return { ok: false, error: 'Falha ao criar cadência. Tente novamente.' };
  }
}

// ============================================================================
// updateCadenceAction
// ============================================================================

const updateActionSchema = cadenceUpdateSchema.extend({
  id: z.string().uuid({ message: 'Cadência inválida.' }),
});

export async function updateCadenceAction(
  input: z.infer<typeof updateActionSchema>,
): Promise<CadenceActionResult> {
  const parsed = updateActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { id, ...patch } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para editar cadências.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const exists = await tx.cadence.findFirst({
        where: { id, workspaceId },
        select: { id: true },
      });
      if (!exists) throw new Error('CADENCE_NOT_FOUND');

      if (patch.stageId !== undefined) {
        const stage = await loadActiveStageInWorkspace(tx, workspaceId, patch.stageId);
        if (!stage) throw new Error('STAGE_INVALID');
      }

      await tx.cadence.update({
        where: { id },
        data: {
          name: patch.name,
          description: patch.description ?? undefined,
          stageId: patch.stageId,
          status: statusForDb(patch.status),
          templateKey: patch.templateKey ? templateKeyForDb(patch.templateKey) : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_updated',
          entityType: 'cadence',
          entityId: id,
          changes: patch as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/cadences');
    revalidatePath(`/cadences/${id}`);
    return { ok: true, id };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CADENCE_NOT_FOUND') {
      return { ok: false, error: 'Cadência não encontrada.' };
    }
    if (message === 'STAGE_INVALID') {
      return {
        ok: false,
        error: 'Selecione uma etapa ativa do seu funil (Ganho/Perdido não aceitam cadência).',
      };
    }
    reportNonFatal('cadences.update', err, { workspaceId, userId, cadenceId: id });
    return { ok: false, error: 'Falha ao atualizar cadência.' };
  }
}

// ============================================================================
// toggleCadenceStatusAction
// ============================================================================

export async function toggleCadenceStatusAction(id: string): Promise<CadenceActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'Cadência inválida.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para alterar status de cadência.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const current = await tx.cadence.findFirst({
        where: { id, workspaceId },
        select: { status: true },
      });
      if (!current) throw new Error('CADENCE_NOT_FOUND');

      const nextStatus =
        current.status === CadenceStatus.active ? CadenceStatus.paused : CadenceStatus.active;

      await tx.cadence.update({ where: { id }, data: { status: nextStatus } });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: nextStatus === CadenceStatus.active ? 'cadence_reactivated' : 'cadence_paused',
          entityType: 'cadence',
          entityId: id,
          changes: { from: current.status, to: nextStatus } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/cadences');
    revalidatePath(`/cadences/${id}`);
    return { ok: true, id };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CADENCE_NOT_FOUND') {
      return { ok: false, error: 'Cadência não encontrada.' };
    }
    reportNonFatal('cadences.toggle', err, { workspaceId, userId, cadenceId: id });
    return { ok: false, error: 'Falha ao alterar status.' };
  }
}

// ============================================================================
// duplicateCadenceAction
// ============================================================================

export async function duplicateCadenceAction(id: string): Promise<CadenceActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'Cadência inválida.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para duplicar cadências.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const newId = await withWorkspace(workspaceId, async (tx) => {
      const source = await tx.cadence.findFirst({
        where: { id, workspaceId },
        include: { steps: true },
      });
      if (!source) throw new Error('CADENCE_NOT_FOUND');

      const cloned = await tx.cadence.create({
        data: {
          workspaceId,
          stageId: source.stageId,
          name: `${source.name} (cópia)`,
          description: source.description,
          templateKey: CadenceTemplateKey.custom, // cópia é sempre custom — força revisão
          status: CadenceStatus.paused, // padrão M5: cópia começa pausada
          createdById: userId,
          steps: {
            create: source.steps.map((s) => ({
              dayOffset: s.dayOffset,
              channel: s.channel,
              templateBody: s.templateBody,
              orderIndex: s.orderIndex,
            })),
          },
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_created',
          entityType: 'cadence',
          entityId: cloned.id,
          changes: {
            source: source.id,
            stepsCount: source.steps.length,
            cloned: true,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return cloned.id;
    });

    revalidatePath('/cadences');
    revalidatePath(`/cadences/${newId}`);
    return { ok: true, id: newId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CADENCE_NOT_FOUND') {
      return { ok: false, error: 'Cadência original não encontrada.' };
    }
    reportNonFatal('cadences.duplicate', err, { workspaceId, userId, cadenceId: id });
    return { ok: false, error: 'Falha ao duplicar cadência.' };
  }
}

// ============================================================================
// deleteCadenceAction
// ============================================================================

export async function deleteCadenceAction(id: string): Promise<CadenceActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'Cadência inválida.' };

  // Manager NÃO pode deletar — exige Owner ou Admin.
  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem excluir cadências.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const exists = await tx.cadence.findFirst({
        where: { id, workspaceId },
        select: { id: true, name: true },
      });
      if (!exists) throw new Error('CADENCE_NOT_FOUND');

      // CASCADE cuida de steps + enrollments + step_runs em sequência.
      await tx.cadence.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_deleted',
          entityType: 'cadence',
          entityId: id,
          changes: { name: exists.name } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/cadences');
    return { ok: true, id };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CADENCE_NOT_FOUND') {
      return { ok: false, error: 'Cadência não encontrada.' };
    }
    reportNonFatal('cadences.delete', err, { workspaceId, userId, cadenceId: id });
    return { ok: false, error: 'Falha ao excluir cadência.' };
  }
}

// ============================================================================
// addStepAction
// ============================================================================

const addStepActionSchema = stepCreateSchema.extend({
  cadenceId: z.string().uuid({ message: 'Cadência inválida.' }),
});

export async function addStepAction(
  input: z.infer<typeof addStepActionSchema>,
): Promise<StepActionResult> {
  const parsed = addStepActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { cadenceId, dayOffset, channel, templateBody } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para editar steps.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const stepId = await withWorkspace(workspaceId, async (tx) => {
      const cadence = await tx.cadence.findFirst({
        where: { id: cadenceId, workspaceId },
        select: { id: true },
      });
      if (!cadence) throw new Error('CADENCE_NOT_FOUND');

      // Calcula order_index = max(order_index) + 1 dentro do mesmo day_offset.
      const max = await tx.cadenceStep.aggregate({
        where: { cadenceId, dayOffset },
        _max: { orderIndex: true },
      });
      const nextOrder = (max._max.orderIndex ?? -1) + 1;

      const step = await tx.cadenceStep.create({
        data: {
          cadenceId,
          dayOffset,
          channel,
          templateBody,
          orderIndex: nextOrder,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_updated',
          entityType: 'cadence_step',
          entityId: step.id,
          changes: { cadenceId, dayOffset, channel, action: 'add_step' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return step.id;
    });

    revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, cadenceId, stepId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'CADENCE_NOT_FOUND') {
      return { ok: false, error: 'Cadência não encontrada.' };
    }
    reportNonFatal('cadences.addStep', err, { workspaceId, userId, cadenceId });
    return { ok: false, error: 'Falha ao adicionar step.' };
  }
}

// ============================================================================
// updateStepAction
// ============================================================================

const updateStepActionSchema = stepUpdateSchema.extend({
  cadenceId: z.string().uuid({ message: 'Cadência inválida.' }),
  stepId: z.string().uuid({ message: 'Step inválido.' }),
});

export async function updateStepAction(
  input: z.infer<typeof updateStepActionSchema>,
): Promise<StepActionResult> {
  const parsed = updateStepActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { cadenceId, stepId, ...patch } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para editar steps.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const step = await tx.cadenceStep.findFirst({
        where: { id: stepId, cadenceId, cadence: { workspaceId } },
        select: { id: true, dayOffset: true },
      });
      if (!step) throw new Error('STEP_NOT_FOUND');

      let newOrderIndex: number | undefined;
      // Mover de dayOffset → recalcula order_index no novo bucket
      // (mesmo padrão `applyUpdateStep` do M5).
      if (patch.dayOffset !== undefined && patch.dayOffset !== step.dayOffset) {
        const max = await tx.cadenceStep.aggregate({
          where: { cadenceId, dayOffset: patch.dayOffset, id: { not: stepId } },
          _max: { orderIndex: true },
        });
        newOrderIndex = (max._max.orderIndex ?? -1) + 1;
      }

      await tx.cadenceStep.update({
        where: { id: stepId },
        data: {
          dayOffset: patch.dayOffset,
          channel: patch.channel,
          templateBody: patch.templateBody,
          orderIndex: newOrderIndex,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_updated',
          entityType: 'cadence_step',
          entityId: stepId,
          changes: { cadenceId, ...patch, action: 'update_step' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, cadenceId, stepId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'STEP_NOT_FOUND') {
      return { ok: false, error: 'Step não encontrado.' };
    }
    reportNonFatal('cadences.updateStep', err, { workspaceId, userId, cadenceId, stepId });
    return { ok: false, error: 'Falha ao atualizar step.' };
  }
}

// ============================================================================
// deleteStepAction
// ============================================================================

export async function deleteStepAction(
  cadenceId: string,
  stepId: string,
): Promise<StepActionResult> {
  if (!isUuid(cadenceId) || !isUuid(stepId)) {
    return { ok: false, error: 'IDs inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Você não tem permissão para excluir steps.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const step = await tx.cadenceStep.findFirst({
        where: { id: stepId, cadenceId, cadence: { workspaceId } },
        select: { id: true },
      });
      if (!step) throw new Error('STEP_NOT_FOUND');

      await tx.cadenceStep.delete({ where: { id: stepId } });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_updated',
          entityType: 'cadence_step',
          entityId: stepId,
          changes: { cadenceId, action: 'delete_step' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, cadenceId, stepId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'STEP_NOT_FOUND') {
      return { ok: false, error: 'Step não encontrado.' };
    }
    reportNonFatal('cadences.deleteStep', err, { workspaceId, userId, cadenceId, stepId });
    return { ok: false, error: 'Falha ao excluir step.' };
  }
}

// ============================================================================
// enrollLeadAction
// ============================================================================

const enrollLeadSchema = z.object({
  cadenceId: z.string().uuid(),
  leadId: z.string().uuid(),
});

export async function enrollLeadAction(
  input: z.infer<typeof enrollLeadSchema>,
): Promise<EnrollmentActionResult> {
  const parsed = enrollLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { cadenceId, leadId } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para inscrever leads em cadência.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId, role } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const enrollmentId = await withWorkspace(workspaceId, async (tx) => {
      // Validações de existência + RBAC fino (Vendedor só do próprio lead).
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, assignedTo: { select: { userId: true } } },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      if (role === 'Vendedor' && lead.assignedTo.userId !== userId) {
        throw new Error('FORBIDDEN_NOT_OWN_LEAD');
      }

      const cadence = await tx.cadence.findFirst({
        where: { id: cadenceId, workspaceId, status: CadenceStatus.active },
        select: { id: true },
      });
      if (!cadence) throw new Error('CADENCE_INACTIVE');

      // Rejeita duplicata via UNIQUE (cadence_id, lead_id).
      try {
        const enrollment = await tx.cadenceEnrollment.create({
          data: {
            workspaceId,
            cadenceId,
            leadId,
            status: 'active',
            // enrolledAt + nextRunAt = NOW() default
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            workspaceId,
            userId,
            action: 'cadence_enrolled',
            entityType: 'cadence_enrollment',
            entityId: enrollment.id,
            changes: { cadenceId, leadId } as Prisma.InputJsonValue,
            ipAddress,
            userAgent,
          },
        });

        return enrollment.id;
      } catch (err) {
        // P2002 = unique violation
        if ((err as { code?: string }).code === 'P2002') {
          throw new Error('ALREADY_ENROLLED');
        }
        throw err;
      }
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, enrollmentId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    if (message === 'CADENCE_INACTIVE') {
      return { ok: false, error: 'Cadência inativa — ative antes de inscrever leads.' };
    }
    if (message === 'ALREADY_ENROLLED') {
      return { ok: false, error: 'Esse lead já está inscrito nessa cadência.' };
    }
    if (message === 'FORBIDDEN_NOT_OWN_LEAD') {
      return { ok: false, error: 'Você só pode inscrever seus próprios leads.' };
    }
    reportNonFatal('cadences.enrollLead', err, { workspaceId, userId, cadenceId, leadId });
    return { ok: false, error: 'Falha ao inscrever lead na cadência.' };
  }
}

// ============================================================================
// pauseEnrollmentAction
// ============================================================================

export async function pauseEnrollmentAction(enrollmentId: string): Promise<EnrollmentActionResult> {
  if (!isUuid(enrollmentId)) return { ok: false, error: 'Inscrição inválida.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para pausar inscrição.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId, role } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  let leadId: string | null = null;
  let cadenceId: string | null = null;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const enrollment = await tx.cadenceEnrollment.findFirst({
        where: { id: enrollmentId, workspaceId },
        include: {
          lead: { select: { assignedTo: { select: { userId: true } } } },
        },
      });
      if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND');

      if (role === 'Vendedor' && enrollment.lead.assignedTo.userId !== userId) {
        throw new Error('FORBIDDEN_NOT_OWN_LEAD');
      }

      leadId = enrollment.leadId;
      cadenceId = enrollment.cadenceId;

      if (enrollment.status !== 'active') {
        // já está pausado/cancelado/concluído — no-op
        return;
      }

      await tx.cadenceEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: 'paused',
          pausedReason: 'manual',
          pausedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_paused',
          entityType: 'cadence_enrollment',
          entityId: enrollmentId,
          changes: { reason: 'manual' } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    if (leadId) revalidatePath(`/leads/${leadId}`);
    if (cadenceId) revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, enrollmentId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'ENROLLMENT_NOT_FOUND') {
      return { ok: false, error: 'Inscrição não encontrada.' };
    }
    if (message === 'FORBIDDEN_NOT_OWN_LEAD') {
      return { ok: false, error: 'Você só pode pausar inscrições dos seus próprios leads.' };
    }
    reportNonFatal('cadences.pauseEnrollment', err, { workspaceId, userId, enrollmentId });
    return { ok: false, error: 'Falha ao pausar inscrição.' };
  }
}

// ============================================================================
// resumeEnrollmentAction
// ============================================================================

export async function resumeEnrollmentAction(
  enrollmentId: string,
): Promise<EnrollmentActionResult> {
  if (!isUuid(enrollmentId)) return { ok: false, error: 'Inscrição inválida.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para reativar inscrição.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId, role } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  let leadId: string | null = null;
  let cadenceId: string | null = null;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const enrollment = await tx.cadenceEnrollment.findFirst({
        where: { id: enrollmentId, workspaceId },
        include: {
          lead: { select: { assignedTo: { select: { userId: true } } } },
        },
      });
      if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND');

      if (role === 'Vendedor' && enrollment.lead.assignedTo.userId !== userId) {
        throw new Error('FORBIDDEN_NOT_OWN_LEAD');
      }

      leadId = enrollment.leadId;
      cadenceId = enrollment.cadenceId;

      if (enrollment.status === 'active') {
        // já ativo — no-op
        return;
      }

      if (enrollment.status === 'cancelled' || enrollment.status === 'completed') {
        throw new Error('ENROLLMENT_TERMINAL');
      }

      await tx.cadenceEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: 'active',
          pausedReason: null,
          pausedAt: null,
          nextRunAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cadence_reactivated',
          entityType: 'cadence_enrollment',
          entityId: enrollmentId,
          changes: { reactivated: true } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    if (leadId) revalidatePath(`/leads/${leadId}`);
    if (cadenceId) revalidatePath(`/cadences/${cadenceId}`);
    return { ok: true, enrollmentId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'ENROLLMENT_NOT_FOUND') {
      return { ok: false, error: 'Inscrição não encontrada.' };
    }
    if (message === 'ENROLLMENT_TERMINAL') {
      return { ok: false, error: 'Inscrição já terminada — duplique a cadência pra reiniciar.' };
    }
    if (message === 'FORBIDDEN_NOT_OWN_LEAD') {
      return { ok: false, error: 'Você só pode reativar inscrições dos seus próprios leads.' };
    }
    reportNonFatal('cadences.resumeEnrollment', err, { workspaceId, userId, enrollmentId });
    return { ok: false, error: 'Falha ao reativar inscrição.' };
  }
}

// ============================================================================
// updateColdThresholdAction
// ============================================================================

const updateColdThresholdSchema = z.object({
  id: z.string().uuid({ message: 'Threshold inválido.' }),
  daysInactive: z.number().int().min(1, 'Mínimo 1 dia').max(365, 'Máximo 365 dias').optional(),
  enabled: z.boolean().optional(),
});

export async function updateColdThresholdAction(
  input: z.infer<typeof updateColdThresholdSchema>,
): Promise<CadenceActionResult> {
  const parsed = updateColdThresholdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { id, daysInactive, enabled } = parsed.data;

  if (daysInactive === undefined && enabled === undefined) {
    return { ok: false, error: 'Nada para atualizar.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem ajustar thresholds de lead frio.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const threshold = await tx.coldLeadThreshold.findFirst({
        where: { id, workspaceId },
        select: { id: true },
      });
      if (!threshold) throw new Error('THRESHOLD_NOT_FOUND');

      await tx.coldLeadThreshold.update({
        where: { id },
        data: {
          daysInactive: daysInactive ?? undefined,
          enabled: enabled ?? undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cold_threshold_updated',
          entityType: 'cold_lead_threshold',
          entityId: id,
          changes: { daysInactive, enabled } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/settings/cadences/cold-thresholds');
    return { ok: true, id };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'THRESHOLD_NOT_FOUND') {
      return { ok: false, error: 'Threshold não encontrado.' };
    }
    reportNonFatal('cadences.updateColdThreshold', err, { workspaceId, userId, thresholdId: id });
    return { ok: false, error: 'Falha ao atualizar threshold.' };
  }
}

// ============================================================================
// acknowledgeColdAlertAction (M10#4)
// ============================================================================
//
// Marca um cold alert como visto. Vendedor só pode ack alerts do próprio
// lead; Owner/Admin/Manager podem ack qualquer alert do workspace.
//
// Auto-ack via triggers Postgres (M10#1 inbound + M10#4 stage_change) seta
// `acknowledged_by_id = NULL` — esta action explícita seta o user_id, então
// o audit log diferencia ack manual vs automático.

export async function acknowledgeColdAlertAction(alertId: string): Promise<CadenceActionResult> {
  const parsed = acknowledgeColdAlertSchema.safeParse({ alertId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Alerta inválido.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para reconhecer alertas de lead frio.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId, role } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  let leadId: string | null = null;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const alert = await tx.coldLeadAlert.findFirst({
        where: { id: alertId, workspaceId },
        include: {
          lead: { select: { id: true, assignedTo: { select: { userId: true } } } },
        },
      });
      if (!alert) throw new Error('ALERT_NOT_FOUND');

      // Defesa contra hidratação inesperada — `assignedTo` é non-null no schema
      // mas se uma cleanup script tiver bypassado `onDelete: Restrict` no
      // passado, o Prisma pode retornar undefined. Fail closed pro Vendedor:
      // sem ownerId visível, recusa o ack pra evitar bypass silencioso.
      const ownerUserId = alert.lead.assignedTo?.userId ?? null;
      if (role === 'Vendedor' && ownerUserId !== userId) {
        throw new Error('FORBIDDEN_NOT_OWN_LEAD');
      }

      leadId = alert.leadId;

      // No-op se já foi ack (auto-ack pelo trigger acontece em paralelo).
      if (alert.acknowledgedAt !== null) {
        return;
      }

      await tx.coldLeadAlert.update({
        where: { id: alertId },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'cold_lead_acknowledged',
          entityType: 'cold_lead_alert',
          entityId: alertId,
          changes: {
            leadId: alert.leadId,
            thresholdId: alert.thresholdId,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/leads');
    if (leadId) revalidatePath(`/leads/${leadId}`);
    revalidatePath('/dashboard');
    return { ok: true, id: alertId };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'ALERT_NOT_FOUND') {
      return { ok: false, error: 'Alerta não encontrado.' };
    }
    if (message === 'FORBIDDEN_NOT_OWN_LEAD') {
      return { ok: false, error: 'Você só pode reconhecer alertas dos seus próprios leads.' };
    }
    reportNonFatal('cadences.acknowledgeColdAlert', err, { workspaceId, userId, alertId });
    return { ok: false, error: 'Falha ao reconhecer alerta.' };
  }
}

// Silencia "imported but not used" — fixture é importado pra runtime mas seu
// índice completo (CADENCE_TEMPLATES) só é usado em algumas operações futuras.
void CADENCE_TEMPLATES;
