'use server';

/**
 * Server Actions do feature `leads` (M8#2).
 *
 * Cinco operações cobrindo o CRUD da tela `/leads`:
 *  - `createLeadAction` — formulário "Adicionar lead"
 *  - `updateLeadAction` — edição inline de campos da ficha
 *  - `moveLeadToStageAction` — mover etapa (dropdown no detalhe + futuro drag-and-drop M8#3)
 *  - `assignLeadAction` — reassignar a outro vendedor (RBAC restrito: Owner/Admin/Manager)
 *  - `archiveLeadAction` — soft-archive via `status='arquivado'` (RBAC restrito: Owner/Admin/Manager)
 *
 * **Padrão (espelha `features/team/actions.ts`):**
 *  1. Zod parse (falha rápido com mensagem pt-BR)
 *  2. `requireRole([...])` — gate RBAC + extrai `{ userId, workspaceId, role }`
 *  3. `getRequestAuditContext()` — IP + UserAgent pro audit
 *  4. `withWorkspace(workspaceId, async tx => ...)` — RLS ativa + defense-in-depth
 *  5. Lógica de negócio dentro da tx (sempre filtra `where: { workspaceId }`)
 *  6. `auditLog.create({...})` na MESMA tx (semântica all-or-nothing)
 *  7. `revalidatePath('/leads')` (e detalhe se aplicável) pra Server Components re-renderizarem
 *  8. Retorno `{ ok: true, ... } | { ok: false, error }` — caller decide UX
 *
 * **RBAC granular:**
 *  - `createLead` / `updateLead` / `moveLeadToStage`: Owner/Admin/Manager/Vendedor
 *  - `assignLead` / `archiveLead`: Owner/Admin/Manager (Vendedor não redireciona/arquiva
 *    lead de colega)
 *
 * **Tags (m:n):** o caller passa `tags: string[]`; dentro da tx fazemos
 * `upsert` em `Tag` (workspace-scoped, unique por name citext) + `createMany`
 * em `LeadTag`. Idempotente — tag existente é reaproveitada.
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isPrismaErrorCode } from '@/lib/utils/prisma-errors';

import {
  archiveLeadSchema,
  assignLeadSchema,
  leadCreateSchema,
  moveStageSchema,
  updateLeadSchema,
  type ArchiveLeadInput,
  type AssignLeadInput,
  type LeadCreateInput,
  type MoveStageInput,
  type UpdateLeadInput,
} from './schemas';

export type LeadActionResult = { ok: true; leadId: string } | { ok: false; error: string };

// =============================================================================
// helpers
// =============================================================================

/**
 * Sincroniza `lead_tags` (junction m:n) com a lista `tags: string[]` recebida
 * do form. Idempotente: tags inexistentes são criadas, tags em uso são
 * reaproveitadas, vínculos atuais que sumiram da lista são removidos.
 *
 * **`citext` em `tags.name`** garante unique case-insensitive — duas chamadas
 * sucessivas com 'VIP' e 'vip' não criam linhas duplicadas (postgres normaliza
 * na comparação).
 */
async function syncLeadTags(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  leadId: string,
  desiredTagNames: string[],
): Promise<void> {
  const normalized = Array.from(
    new Set(desiredTagNames.map((t) => t.trim()).filter((t) => t.length > 0)),
  );

  // 1. Upsert das tags desejadas — todas existem após esta etapa.
  const tagIds: string[] = [];
  for (const name of normalized) {
    const tag = await tx.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      create: { workspaceId, name },
      update: {},
      select: { id: true },
    });
    tagIds.push(tag.id);
  }

  // 2. Remove vínculos atuais que não estão na lista nova.
  await tx.leadTag.deleteMany({
    where: {
      leadId,
      ...(tagIds.length > 0 ? { tagId: { notIn: tagIds } } : {}),
    },
  });

  // 3. Cria vínculos novos (skipDuplicates pra ser idempotente em update).
  if (tagIds.length > 0) {
    await tx.leadTag.createMany({
      data: tagIds.map((tagId) => ({ leadId, tagId })),
      skipDuplicates: true,
    });
  }
}

// =============================================================================
// createLeadAction
// =============================================================================

export async function createLeadAction(input: LeadCreateInput): Promise<LeadActionResult> {
  const parsed = leadCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para criar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const leadId = await withWorkspace<string>(workspaceId, async (tx) => {
      // Defense-in-depth: confirma que stageId e assignedTo pertencem ao
      // workspace ativo. RLS já bloqueia FK cross-tenant, mas validação
      // explícita produz mensagens melhores e evita erro genérico P2003.
      const [stage, assignee] = await Promise.all([
        tx.pipelineStage.findFirst({
          where: { id: parsed.data.stageId, pipeline: { workspaceId } },
          select: { id: true },
        }),
        tx.workspaceMember.findFirst({
          where: { id: parsed.data.assignedTo, workspaceId },
          select: { id: true },
        }),
      ]);
      if (!stage) throw new Error('STAGE_NOT_FOUND');
      if (!assignee) throw new Error('ASSIGNEE_NOT_FOUND');

      const lead = await tx.lead.create({
        data: {
          workspaceId,
          name: parsed.data.name.trim(),
          email: parsed.data.email,
          phone: parsed.data.phone.trim(),
          company: parsed.data.company,
          position: parsed.data.position,
          origin: parsed.data.origin,
          status: 'ativo',
          stageId: parsed.data.stageId,
          assignedToId: parsed.data.assignedTo,
          valueCents: parsed.data.valueCents,
          notes: parsed.data.notes,
          createdById: userId,
        },
        select: { id: true },
      });

      // Tags m:n.
      if (parsed.data.tags.length > 0) {
        await syncLeadTags(tx, workspaceId, lead.id, parsed.data.tags);
      }

      // Activity `lead_created` — timeline mostra "Lead criado" como primeiro evento.
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: lead.id,
          type: 'lead_created',
          authorId: parsed.data.assignedTo,
          meta: { origin: parsed.data.origin } as Prisma.InputJsonValue,
        },
      });

      // Audit log.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'lead_created',
          entityType: 'lead',
          entityId: lead.id,
          changes: { name: parsed.data.name, origin: parsed.data.origin } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return lead.id;
    });

    revalidatePath('/leads');
    return { ok: true, leadId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'STAGE_NOT_FOUND') {
        return { ok: false, error: 'Etapa do funil não encontrada. Recarregue a página.' };
      }
      if (err.message === 'ASSIGNEE_NOT_FOUND') {
        return { ok: false, error: 'Vendedor não pertence ao workspace. Recarregue a página.' };
      }
    }
    if (isPrismaErrorCode(err, 'P2003')) {
      return { ok: false, error: 'Etapa ou vendedor inválidos.' };
    }
    reportNonFatal('leads.create.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível criar o lead agora. Tente em instantes.' };
  }
}

// =============================================================================
// updateLeadAction
// =============================================================================

export async function updateLeadAction(input: UpdateLeadInput): Promise<LeadActionResult> {
  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para editar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { leadId, tags, ...patch } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!existing) throw new Error('LEAD_NOT_FOUND');

      // Defense-in-depth pros campos que referenciam outras tabelas — se patch
      // tenta mudar stageId ou assignedTo, valida que pertencem ao workspace.
      if (patch.stageId) {
        const stage = await tx.pipelineStage.findFirst({
          where: { id: patch.stageId, pipeline: { workspaceId } },
          select: { id: true },
        });
        if (!stage) throw new Error('STAGE_NOT_FOUND');
      }
      if (patch.assignedTo) {
        const assignee = await tx.workspaceMember.findFirst({
          where: { id: patch.assignedTo, workspaceId },
          select: { id: true },
        });
        if (!assignee) throw new Error('ASSIGNEE_NOT_FOUND');
      }

      // Constrói o `data` do update — só campos presentes no patch.
      const data: Prisma.LeadUpdateInput = {};
      if (patch.name !== undefined) data.name = patch.name.trim();
      if (patch.email !== undefined) data.email = patch.email;
      if (patch.phone !== undefined) data.phone = patch.phone.trim();
      if (patch.company !== undefined) data.company = patch.company;
      if (patch.position !== undefined) data.position = patch.position;
      if (patch.origin !== undefined) data.origin = patch.origin;
      if (patch.stageId !== undefined) data.stage = { connect: { id: patch.stageId } };
      if (patch.assignedTo !== undefined) data.assignedTo = { connect: { id: patch.assignedTo } };
      if (patch.valueCents !== undefined) data.valueCents = patch.valueCents;
      if (patch.notes !== undefined) data.notes = patch.notes;

      await tx.lead.update({
        where: { id: leadId },
        data,
      });

      if (tags !== undefined) {
        await syncLeadTags(tx, workspaceId, leadId, tags);
      }

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'lead_updated',
          entityType: 'lead',
          entityId: leadId,
          changes: { ...patch, tagsChanged: tags !== undefined } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, leadId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') {
        return { ok: false, error: 'Lead não encontrado.' };
      }
      if (err.message === 'STAGE_NOT_FOUND') {
        return { ok: false, error: 'Etapa do funil não encontrada.' };
      }
      if (err.message === 'ASSIGNEE_NOT_FOUND') {
        return { ok: false, error: 'Vendedor não pertence ao workspace.' };
      }
    }
    reportNonFatal('leads.update.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível atualizar o lead agora.' };
  }
}

// =============================================================================
// moveLeadToStageAction
// =============================================================================

export async function moveLeadToStageAction(input: MoveStageInput): Promise<LeadActionResult> {
  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para mover leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { leadId, stageId: newStageId } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, stageId: true, assignedToId: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');
      if (lead.stageId === newStageId) throw new Error('SAME_STAGE');

      const newStage = await tx.pipelineStage.findFirst({
        where: { id: newStageId, pipeline: { workspaceId } },
        select: { id: true },
      });
      if (!newStage) throw new Error('STAGE_NOT_FOUND');

      const previousStageId = lead.stageId;

      await tx.lead.update({
        where: { id: leadId },
        data: { stageId: newStageId, lastInteractionAt: new Date() },
      });

      // Activity `stage_change` — timeline mostra a transição.
      await tx.activity.create({
        data: {
          workspaceId,
          leadId,
          type: 'stage_change',
          authorId: lead.assignedToId,
          meta: { fromStageId: previousStageId, toStageId: newStageId } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'deal_stage_changed',
          entityType: 'lead',
          entityId: leadId,
          changes: { fromStageId: previousStageId, toStageId: newStageId } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/kanban');
    return { ok: true, leadId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') return { ok: false, error: 'Lead não encontrado.' };
      if (err.message === 'STAGE_NOT_FOUND') return { ok: false, error: 'Etapa inválida.' };
      if (err.message === 'SAME_STAGE') return { ok: true, leadId }; // no-op silente
    }
    reportNonFatal('leads.move-stage.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível mover o lead agora.' };
  }
}

// =============================================================================
// assignLeadAction
// =============================================================================

export async function assignLeadAction(input: AssignLeadInput): Promise<LeadActionResult> {
  const parsed = assignLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // RBAC mais restrito: Vendedor não reassigna lead de outro vendedor (evita
  // "roubo" de leads entre vendedores). Manager+ controla redistribuição.
  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem reassignar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { leadId, assignedToId } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, assignedToId: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');
      if (lead.assignedToId === assignedToId) throw new Error('SAME_ASSIGNEE');

      const assignee = await tx.workspaceMember.findFirst({
        where: {
          id: assignedToId,
          workspaceId,
          role: { in: ['Owner', 'Admin', 'Manager', 'Vendedor'] },
        },
        select: { id: true },
      });
      if (!assignee) throw new Error('ASSIGNEE_NOT_FOUND');

      const previousAssigneeId = lead.assignedToId;

      await tx.lead.update({
        where: { id: leadId },
        data: { assignedToId },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'lead_updated',
          entityType: 'lead',
          entityId: leadId,
          changes: {
            reassignedFrom: previousAssigneeId,
            reassignedTo: assignedToId,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, leadId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') return { ok: false, error: 'Lead não encontrado.' };
      if (err.message === 'ASSIGNEE_NOT_FOUND')
        return { ok: false, error: 'Vendedor não encontrado ou sem permissão.' };
      if (err.message === 'SAME_ASSIGNEE') return { ok: true, leadId };
    }
    reportNonFatal('leads.assign.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível reassignar o lead agora.' };
  }
}

// =============================================================================
// archiveLeadAction
// =============================================================================

export async function archiveLeadAction(input: ArchiveLeadInput): Promise<LeadActionResult> {
  const parsed = archiveLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem arquivar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { leadId } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');
      if (lead.status === 'arquivado') return; // no-op silente

      await tx.lead.update({
        where: { id: leadId },
        data: { status: 'arquivado' },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'lead_deleted', // mapeia "delete" lógico (status terminal) pro enum existente
          entityType: 'lead',
          entityId: leadId,
          changes: { archived: true } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, leadId };
  } catch (err) {
    if (err instanceof Error && err.message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    reportNonFatal('leads.archive.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível arquivar o lead agora.' };
  }
}
