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

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { serializeLeadsCsv, type LeadCsvRow } from '@/lib/exports/csv';
import { findDuplicates } from '@/lib/leads/dedupe';
import { pickNextAssignee } from '@/lib/leads/pick-assignee';
import { canAddLead, limitReachedMessage } from '@/lib/limits';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isPrismaErrorCode } from '@/lib/utils/prisma-errors';

import {
  archiveLeadSchema,
  assignLeadSchema,
  EXPORT_MAX_ROWS,
  exportLeadsSchema,
  importLeadsSchema,
  leadCreateSchema,
  moveStageSchema,
  previewImportSchema,
  updateLeadSchema,
  type ArchiveLeadInput,
  type AssignLeadInput,
  type ExportLeadsInput,
  type ImportLeadsInput,
  type LeadCreateInput,
  type MoveStageInput,
  type PreviewImportInput,
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
      // M12#4 — enforcement de limite por plano. Dentro da tx pra ficar
      // atômico com o INSERT: bloqueia race "2 cliques simultâneos com 49
      // leads → 51 leads".
      const limit = await canAddLead(workspaceId, { tx });
      if (!limit.ok) {
        throw new Error(`PLAN_LIMIT_REACHED:${limitReachedMessage('leads', limit.state)}`);
      }

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
      if (err.message.startsWith('PLAN_LIMIT_REACHED:')) {
        return { ok: false, error: err.message.slice('PLAN_LIMIT_REACHED:'.length) };
      }
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

// =============================================================================
// M8#5 — CSV import: previewImportAction + importLeadsAction
// =============================================================================

export interface ImportRowError {
  /** Linha 1-indexed visível pro usuário (header é linha 1, primeira data é linha 2). */
  line: number;
  reason: string;
}

export interface ImportDuplicateInfo {
  line: number;
  matchedBy: 'phone' | 'email';
  existingLeadId: string;
  existingLeadName: string;
}

export interface PreviewImportSummary {
  total: number;
  willCreate: number;
  willSkip: number;
  errors: ImportRowError[];
  duplicates: ImportDuplicateInfo[];
}

export type PreviewImportResult =
  | { ok: true; summary: PreviewImportSummary }
  | { ok: false; error: string };

/**
 * `previewImportAction` — dry-run da importação. Roda os mesmos validadores
 * do `importLeadsAction` mas SEM persistir; devolve as duplicatas detectadas
 * + erros de schema linha-a-linha. Usado pela UI pra mostrar
 * "40 criar / 10 skip" antes da confirmação LGPD.
 */
export async function previewImportAction(input: PreviewImportInput): Promise<PreviewImportResult> {
  const parsed = previewImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem importar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  const { rows } = parsed.data;

  try {
    const summary = await withWorkspace<PreviewImportSummary>(workspaceId, async (tx) => {
      const dups = await findDuplicates(
        tx,
        workspaceId,
        rows.map((r) => ({ phone: r.phone, email: r.email })),
      );

      const errors: ImportRowError[] = [];
      const duplicates: ImportDuplicateInfo[] = [];

      for (const row of rows) {
        const phoneMatch = dups.get(row.phone.trim());
        const emailMatch = row.email ? dups.get(row.email.toLowerCase().trim()) : undefined;
        const match = phoneMatch ?? emailMatch;
        if (match) {
          duplicates.push({
            line: row.line,
            matchedBy: phoneMatch ? 'phone' : 'email',
            existingLeadId: match.id,
            existingLeadName: match.name,
          });
        }
      }

      const willCreate = rows.length - duplicates.length - errors.length;

      return {
        total: rows.length,
        willCreate,
        willSkip: duplicates.length,
        errors,
        duplicates,
      };
    });

    return { ok: true, summary };
  } catch (err) {
    reportNonFatal('leads.preview-import.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível preparar a prévia agora.' };
  }
}

export interface ImportSummary {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
}

export type ImportLeadsResult =
  | { ok: true; summary: ImportSummary; importBatchId: string }
  | { ok: false; error: string };

/**
 * `importLeadsAction` — cria leads em massa a partir do CSV mapeado.
 *
 * **Fluxo dentro da tx:**
 *  1. Resolve pipeline default + 1ª etapa pra `stageId` (caso row não traga).
 *  2. Busca duplicatas via `findDuplicates` num único batch query.
 *  3. Pra cada linha: skip se duplicada; senão cria lead + activity
 *     `lead_created` (com `meta.via='csv_import', meta.importBatchId,
 *     meta.consentConfirmed`) + audit `lead_created`.
 *  4. `assignedToId` resolvido via `pickNextAssignee` round-robin.
 *
 * **RBAC:** Owner/Admin/Manager. Vendedor não importa em massa (evita base
 * poluída). Viewer obviamente também não.
 *
 * **LGPD:** `consentConfirmed: true` literal exigido pelo Zod (CLAUDE.md §7.5).
 * Audit log grava `consentConfirmed: true` em `changes`.
 */
export async function importLeadsAction(input: ImportLeadsInput): Promise<ImportLeadsResult> {
  const parsed = importLeadsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem importar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { rows } = parsed.data;
  const importBatchId = randomUUID();

  try {
    const summary = await withWorkspace<ImportSummary>(workspaceId, async (tx) => {
      // Resolve pipeline default + primeira etapa.
      const pipeline = await tx.pipeline.findFirst({
        where: { workspaceId, isDefault: true, deletedAt: null },
        select: {
          id: true,
          stages: {
            orderBy: { order: 'asc' },
            take: 1,
            select: { id: true },
          },
        },
      });
      const firstStageId = pipeline?.stages[0]?.id;
      if (!firstStageId) throw new Error('PIPELINE_NOT_FOUND');

      // Round-robin de assignee. Pegamos uma única vez antes do loop —
      // distribuição uniforme acontece via Lead.assignedToId update em
      // produção via volume real. Pra um batch pontual, o pri vendedor com
      // menor count leva tudo (decisão aceitável).
      const fallbackAssignee = await pickNextAssignee(tx, workspaceId);
      if (!fallbackAssignee) throw new Error('NO_ASSIGNEE');

      // Dedup batch.
      const dups = await findDuplicates(
        tx,
        workspaceId,
        rows.map((r) => ({ phone: r.phone, email: r.email })),
      );

      // M12#4 — enforcement de limite. Conta quantas linhas vão DE FATO criar
      // (descontando duplicatas) e bloqueia se estoura o slot do plano. Sem
      // isso, import CSV de 200 linhas no Free fura o gate do `createLead`.
      const willCreateCount = rows.filter((row) => {
        const phoneKey = row.phone.trim();
        const emailKey = row.email?.toLowerCase().trim();
        const isDup = dups.has(phoneKey) || (emailKey ? dups.has(emailKey) : false);
        return !isDup;
      }).length;

      if (willCreateCount > 0) {
        const limit = await canAddLead(workspaceId, { tx, increment: willCreateCount });
        if (!limit.ok) {
          throw new Error(`PLAN_LIMIT_REACHED:${limitReachedMessage('leads', limit.state)}`);
        }
      }

      let created = 0;
      let skipped = 0;
      const errors: ImportRowError[] = [];

      for (const row of rows) {
        const phoneKey = row.phone.trim();
        const emailKey = row.email?.toLowerCase().trim();
        const isDup = dups.has(phoneKey) || (emailKey ? dups.has(emailKey) : false);
        if (isDup) {
          skipped += 1;
          continue;
        }

        try {
          const lead = await tx.lead.create({
            data: {
              workspaceId,
              name: row.name.trim(),
              email: row.email ?? null,
              phone: phoneKey,
              company: row.company ?? null,
              position: row.position ?? null,
              origin: 'csv_import',
              status: 'ativo',
              stageId: firstStageId,
              assignedToId: fallbackAssignee,
              valueCents: 0,
              notes: row.notes ?? null,
              createdById: userId,
            },
            select: { id: true },
          });

          await tx.activity.create({
            data: {
              workspaceId,
              leadId: lead.id,
              type: 'lead_created',
              authorId: fallbackAssignee,
              meta: {
                via: 'csv_import',
                importBatchId,
                consentConfirmed: true,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.auditLog.create({
            data: {
              workspaceId,
              userId,
              action: 'lead_created',
              entityType: 'lead',
              entityId: lead.id,
              changes: {
                via: 'csv_import',
                importBatchId,
                consentConfirmed: true,
                line: row.line,
              } as Prisma.InputJsonValue,
              ipAddress,
              userAgent,
            },
          });

          created += 1;
        } catch (rowErr) {
          // Falha em linha individual não aborta o batch — registra e segue.
          // Em produção esperaria-se que duplicate keys aparecessem (race
          // condition entre threads), mas o batch grande não pode quebrar.
          reportNonFatal('leads.import.row', rowErr, { workspaceId, line: row.line });
          errors.push({
            line: row.line,
            reason: 'Não foi possível criar essa linha — registrada e ignorada.',
          });
        }
      }

      return {
        total: rows.length,
        created,
        skipped,
        errors,
      };
    });

    revalidatePath('/leads');
    return { ok: true, summary, importBatchId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith('PLAN_LIMIT_REACHED:')) {
        return { ok: false, error: err.message.slice('PLAN_LIMIT_REACHED:'.length) };
      }
      if (err.message === 'PIPELINE_NOT_FOUND') {
        return {
          ok: false,
          error: 'Funil padrão não encontrado no workspace. Configure antes de importar.',
        };
      }
      if (err.message === 'NO_ASSIGNEE') {
        return {
          ok: false,
          error: 'Nenhum vendedor ativo no workspace. Convide alguém antes de importar.',
        };
      }
    }
    reportNonFatal('leads.import.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível importar agora. Tente em instantes.' };
  }
}

// =============================================================================
// M8#7 — Export CSV de leads
// =============================================================================

export interface ExportLeadsSuccess {
  ok: true;
  csv: string;
  fileName: string;
  rowCount: number;
}

export type ExportLeadsResult = ExportLeadsSuccess | { ok: false; error: string };

/**
 * `exportLeadsAction` (M8#7) — gera CSV dos leads do workspace ativo
 * respeitando filtros + RBAC + soft-delete. Retorna string CSV pra que o
 * Route Handler envolva em `Content-Disposition: attachment`.
 *
 * **RBAC:** Owner/Admin/Manager. Vendedor não exporta base inteira (vetor
 * de vazamento; LGPD §7.5).
 *
 * **Hard limit:** `EXPORT_MAX_ROWS` (5k). Workspaces maiores precisam de
 * Edge Function + email link 7d (V2 — bloqueado em dev local por
 * antivírus/TLS, memória `dev-local-windows-antivirus-tls`).
 *
 * **Audit log:** `export_started` com `changes.format='csv'`, `rowCount`,
 * `filters` e IP/UA pra LGPD §3.4 (toda exportação registrada).
 *
 * **Sort:** `createdAt desc` (mesmo de `/leads` lista).
 */
export async function exportLeadsAction(input: ExportLeadsInput): Promise<ExportLeadsResult> {
  const parsed = exportLeadsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Filtros inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem exportar leads.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const filters = parsed.data;

  try {
    const result = await withWorkspace<{ rows: LeadCsvRow[]; total: number }>(
      workspaceId,
      async (tx) => {
        const where: Prisma.LeadWhereInput = { workspaceId, deletedAt: null };

        // Default oculta arquivados — caller passa `statuses=['ativo','arquivado',...]`
        // pra incluir tudo. Espelha lógica de `listLeads` (M8#2).
        if (filters.statuses === undefined) {
          where.status = 'ativo';
        } else if (filters.statuses.length > 0) {
          where.status = { in: filters.statuses };
        }

        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          where.OR = [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
            { company: { contains: term, mode: 'insensitive' } },
          ];
        }
        if (filters.stageIds && filters.stageIds.length > 0) {
          where.stageId = { in: filters.stageIds };
        }
        if (filters.assigneeIds && filters.assigneeIds.length > 0) {
          where.assignedToId = { in: filters.assigneeIds };
        }
        if (filters.origins && filters.origins.length > 0) {
          where.origin = { in: filters.origins };
        }
        if (filters.tagNames && filters.tagNames.length > 0) {
          where.tags = { some: { tag: { name: { in: filters.tagNames } } } };
        }

        // Conta antes pra decidir se passa do limite.
        const total = await tx.lead.count({ where });
        if (total > EXPORT_MAX_ROWS) {
          throw new Error('TOO_MANY_ROWS');
        }

        const rows = await tx.lead.findMany({
          where,
          include: {
            tags: { include: { tag: { select: { name: true } } } },
            stage: { select: { name: true } },
            assignedTo: { include: { user: { select: { name: true, email: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: EXPORT_MAX_ROWS,
        });

        const csvRows: LeadCsvRow[] = rows.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          company: r.company,
          position: r.position,
          origin: r.origin,
          status: r.status,
          stageName: r.stage.name,
          assignedToName: r.assignedTo.user.name ?? r.assignedTo.user.email?.split('@')[0] ?? null,
          valueCents: r.valueCents,
          tags: r.tags.map((t) => t.tag.name),
          notes: r.notes,
          lastInteractionAt: r.lastInteractionAt,
          nextActionAt: r.nextActionAt,
          createdAt: r.createdAt,
        }));

        // **LGPD §3.4 (CLAUDE.md §7.5):** audit log gravado na MESMA tx do
        // select. Se audit falhar, o export inteiro é abortado — não pode
        // sair dado pessoal sem registro de quem exportou e quando. M8#7
        // original tinha audit best-effort fora da tx — corrigido em M8#7p.
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId,
            action: 'export_started',
            entityType: 'lead',
            entityId: null,
            changes: {
              format: 'csv',
              rowCount: total,
              filters,
            } as Prisma.InputJsonValue,
            ipAddress,
            userAgent,
          },
        });

        return { rows: csvRows, total };
      },
    );

    const csv = serializeLeadsCsv(result.rows);
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `leads-${ts}.csv`;

    return { ok: true, csv, fileName, rowCount: result.total };
  } catch (err) {
    if (err instanceof Error && err.message === 'TOO_MANY_ROWS') {
      return {
        ok: false,
        error: `Sua busca tem mais de ${EXPORT_MAX_ROWS} leads. Aplique filtros pra reduzir antes de exportar.`,
      };
    }
    reportNonFatal('leads.export.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível exportar agora. Tente em instantes.' };
  }
}
