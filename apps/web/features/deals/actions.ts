'use server';

/**
 * Server Actions do feature `deals` (M8#3).
 *
 * Três operações cobrem o Kanban drag-and-drop end-to-end:
 *  - `createDealAction` — modal "Adicionar negócio"
 *  - `moveDealStageAction` — drag entre colunas (muda etapa + reordena no destino)
 *  - `updateDealOrderAction` — drag dentro da mesma coluna (só reordena)
 *
 * **Padrão (espelha `features/leads/actions.ts`):**
 *  1. Zod parse (falha rápido com mensagem pt-BR)
 *  2. `requireRole([...])` — gate RBAC + extrai `{ userId, workspaceId, role }`
 *  3. `getRequestAuditContext()` — IP + UserAgent pro audit
 *  4. `withWorkspace(workspaceId, async tx => ...)` — RLS ativa + defense-in-depth
 *  5. Lógica de negócio dentro da tx (sempre filtra `where: { workspaceId }`)
 *  6. `auditLog.create({...})` na MESMA tx (semântica all-or-nothing)
 *  7. `revalidatePath('/kanban')` (+ outros paths afetados)
 *  8. Retorno `{ ok: true, dealId } | { ok: false, error }`
 *
 * **RBAC:** Owner/Admin/Manager/Vendedor podem criar e mover deals.
 * Viewer não toca. Vendedor pode mover deals de QUALQUER um (kanban é
 * artefato compartilhado do time — não tem "roubo" como em assign).
 *
 * **Status transitions automáticas em `moveDealStageAction`:**
 *  - Entrar em stage terminal (`tone='success'` ou `'destructive'`) → `status`
 *    vira `won`/`lost` + `closedAt = now()`
 *  - Sair de terminal pra etapa ativa → `status='open'` + `closedAt=null`
 *  - O `probability` é decisão de produto (não recalculamos automaticamente;
 *    fica como o vendedor configurou no momento da criação)
 *
 * **Ordering (drag-and-drop intra-coluna):**
 *  - `beforeId`/`afterId` apontam pros vizinhos imediatos no destino
 *  - `computeOrderBetween` calcula o `orderInStage` final (midpoint inteiro)
 *  - Drop em coluna vazia: `orderInStage = 0`
 *  - Drop no início: `afterId.order - ORDER_STEP`
 *  - Drop no final: `beforeId.order + ORDER_STEP`
 *  - Quando midpoint colapsa (vizinhos com gap < 2), rebalanceamos a coluna
 *    inteira em batch UPDATE — raro com `ORDER_STEP=1000`
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isPrismaErrorCode } from '@/lib/utils/prisma-errors';

import {
  dealCreateSchema,
  moveDealStageSchema,
  updateDealOrderSchema,
  updateDealSchema,
  type DealCreateInput,
  type MoveDealStageInput,
  type UpdateDealInput,
  type UpdateDealOrderInput,
} from './schemas';
import { computeOrderBetween, ORDER_STEP } from './transforms';

export type DealActionResult = { ok: true; dealId: string } | { ok: false; error: string };

// =============================================================================
// helpers
// =============================================================================

/**
 * Resolve `orderInStage` final do drop a partir de `beforeId`/`afterId`. Quando
 * os vizinhos colapsam (gap < 2), rebalanceia a coluna inteira em batch:
 * `UPDATE deals SET order_in_stage = i*ORDER_STEP` na ordem atual + recompõe
 * a posição do drop. Custo O(N) raríssimo com `ORDER_STEP=1000`.
 *
 * Retorna o novo `orderInStage` do deal sendo movido.
 */
async function resolveOrderInStage(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  stageId: string,
  movedDealId: string,
  beforeId?: string,
  afterId?: string,
): Promise<number> {
  // Carrega só os vizinhos relevantes — economiza round-trip.
  const neighbors = await tx.deal.findMany({
    where: {
      workspaceId,
      stageId,
      deletedAt: null,
      id: { in: [beforeId, afterId].filter((x): x is string => Boolean(x)) },
    },
    select: { id: true, orderInStage: true },
  });

  const beforeOrder = beforeId
    ? (neighbors.find((n) => n.id === beforeId)?.orderInStage ?? null)
    : null;
  const afterOrder = afterId
    ? (neighbors.find((n) => n.id === afterId)?.orderInStage ?? null)
    : null;

  const candidate = computeOrderBetween(beforeOrder, afterOrder);

  // Colisão: midpoint ficou igual a um dos vizinhos (gap < 2). Rebalanceia.
  const collides =
    (beforeOrder !== null && candidate <= beforeOrder) ||
    (afterOrder !== null && candidate >= afterOrder);

  if (!collides) return candidate;

  // Rebalanceamento: relê coluna inteira em ordem atual, reescreve em
  // múltiplos de ORDER_STEP, e retorna a posição alvo (depois de `before`,
  // ou antes de `after`, ou inserção no fim como fallback).
  const stageDeals = await tx.deal.findMany({
    where: { workspaceId, stageId, deletedAt: null, id: { not: movedDealId } },
    select: { id: true, orderInStage: true, createdAt: true },
    orderBy: [{ orderInStage: 'asc' }, { createdAt: 'desc' }],
  });

  // Reescreve em múltiplos de ORDER_STEP.
  for (let i = 0; i < stageDeals.length; i += 1) {
    const d = stageDeals[i];
    if (!d) continue;
    const newOrder = (i + 1) * ORDER_STEP;
    if (d.orderInStage !== newOrder) {
      await tx.deal.update({
        where: { id: d.id },
        data: { orderInStage: newOrder },
      });
    }
  }

  // Posição alvo após rebalance: insere imediatamente depois de `before` ou
  // antes de `after`. Sem nenhum dos dois, vai pro fim.
  if (beforeId) {
    const beforeIdx = stageDeals.findIndex((d) => d.id === beforeId);
    if (beforeIdx >= 0) return (beforeIdx + 1) * ORDER_STEP + Math.floor(ORDER_STEP / 2);
  }
  if (afterId) {
    const afterIdx = stageDeals.findIndex((d) => d.id === afterId);
    if (afterIdx >= 0) return (afterIdx + 1) * ORDER_STEP - Math.floor(ORDER_STEP / 2);
  }
  return (stageDeals.length + 1) * ORDER_STEP;
}

/** Etapa terminal — derivar status do tone (success → won, destructive → lost). */
function statusFromStageTone(tone: string): 'open' | 'won' | 'lost' {
  if (tone === 'success') return 'won';
  if (tone === 'destructive') return 'lost';
  return 'open';
}

// =============================================================================
// createDealAction
// =============================================================================

export async function createDealAction(input: DealCreateInput): Promise<DealActionResult> {
  const parsed = dealCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para criar negócios.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  try {
    const dealId = await withWorkspace<string>(workspaceId, async (tx) => {
      // Defense-in-depth: FK refs precisam pertencer ao workspace ativo.
      const [lead, stage, owner] = await Promise.all([
        tx.lead.findFirst({
          where: { id: parsed.data.leadId, workspaceId, deletedAt: null },
          select: { id: true },
        }),
        tx.pipelineStage.findFirst({
          where: { id: parsed.data.stageId, pipeline: { workspaceId } },
          select: { id: true, tone: true },
        }),
        tx.workspaceMember.findFirst({
          where: { id: parsed.data.ownerId, workspaceId },
          select: { id: true },
        }),
      ]);
      if (!lead) throw new Error('LEAD_NOT_FOUND');
      if (!stage) throw new Error('STAGE_NOT_FOUND');
      if (!owner) throw new Error('OWNER_NOT_FOUND');

      // Append no final da coluna alvo: pega o maior `orderInStage` atual e soma ORDER_STEP.
      const last = await tx.deal.findFirst({
        where: { workspaceId, stageId: parsed.data.stageId, deletedAt: null },
        orderBy: { orderInStage: 'desc' },
        select: { orderInStage: true },
      });
      const orderInStage = (last?.orderInStage ?? 0) + ORDER_STEP;

      // Status automático se nasce direto em stage terminal.
      const initialStatus = statusFromStageTone(stage.tone);
      const closedAt = initialStatus === 'open' ? null : new Date();

      const deal = await tx.deal.create({
        data: {
          workspaceId,
          title: parsed.data.title.trim(),
          leadId: parsed.data.leadId,
          stageId: parsed.data.stageId,
          valueCents: parsed.data.valueCents,
          ownerId: parsed.data.ownerId,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          description: parsed.data.description ?? null,
          status: initialStatus,
          orderInStage,
          closedAt,
          createdById: userId,
        },
        select: { id: true },
      });

      // Activity `lead_created` não cabe aqui (é do lead, não do deal).
      // Não temos `deal_created` em activity_type ainda (M8#1 só adicionou em
      // audit_action) — fica como audit log puro.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'deal_created',
          entityType: 'deal',
          entityId: deal.id,
          changes: {
            title: parsed.data.title,
            stageId: parsed.data.stageId,
            valueCents: parsed.data.valueCents,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return deal.id;
    });

    revalidatePath('/kanban');
    revalidatePath('/leads');
    return { ok: true, dealId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LEAD_NOT_FOUND') {
        return { ok: false, error: 'Lead não encontrado. Recarregue a página.' };
      }
      if (err.message === 'STAGE_NOT_FOUND') {
        return { ok: false, error: 'Etapa do funil não encontrada. Recarregue a página.' };
      }
      if (err.message === 'OWNER_NOT_FOUND') {
        return { ok: false, error: 'Vendedor não pertence ao workspace. Recarregue a página.' };
      }
    }
    if (isPrismaErrorCode(err, 'P2003')) {
      return { ok: false, error: 'Lead, etapa ou vendedor inválidos.' };
    }
    reportNonFatal('deals.create.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível criar o negócio agora. Tente em instantes.' };
  }
}

// =============================================================================
// moveDealStageAction
// =============================================================================

export async function moveDealStageAction(input: MoveDealStageInput): Promise<DealActionResult> {
  const parsed = moveDealStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para mover negócios.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { dealId, stageId: newStageId, beforeId, afterId } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const deal = await tx.deal.findFirst({
        where: { id: dealId, workspaceId, deletedAt: null },
        select: { id: true, stageId: true, status: true },
      });
      if (!deal) throw new Error('DEAL_NOT_FOUND');

      const newStage = await tx.pipelineStage.findFirst({
        where: { id: newStageId, pipeline: { workspaceId } },
        select: { id: true, tone: true },
      });
      if (!newStage) throw new Error('STAGE_NOT_FOUND');

      const orderInStage = await resolveOrderInStage(
        tx,
        workspaceId,
        newStageId,
        dealId,
        beforeId,
        afterId,
      );

      // Status automático: entrar em terminal → won/lost; sair de terminal → open.
      const newStatus = statusFromStageTone(newStage.tone);
      const wasTerminal = deal.status === 'won' || deal.status === 'lost';
      const isNowTerminal = newStatus !== 'open';

      const data: Prisma.DealUpdateInput = {
        stage: { connect: { id: newStageId } },
        orderInStage,
      };
      if (deal.status !== newStatus) {
        data.status = newStatus;
        if (isNowTerminal && !wasTerminal) data.closedAt = new Date();
        if (!isNowTerminal && wasTerminal) data.closedAt = null;
      }

      await tx.deal.update({
        where: { id: dealId },
        data,
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'deal_stage_changed',
          entityType: 'deal',
          entityId: dealId,
          changes: {
            fromStageId: deal.stageId,
            toStageId: newStageId,
            statusChange: deal.status !== newStatus ? `${deal.status} → ${newStatus}` : null,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/kanban');
    revalidatePath('/leads');
    return { ok: true, dealId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'DEAL_NOT_FOUND') {
        return { ok: false, error: 'Negócio não encontrado.' };
      }
      if (err.message === 'STAGE_NOT_FOUND') {
        return { ok: false, error: 'Etapa inválida.' };
      }
    }
    reportNonFatal('deals.move-stage.tx', err, { workspaceId, userId, dealId });
    return { ok: false, error: 'Não foi possível mover o negócio agora. Tente de novo.' };
  }
}

// =============================================================================
// updateDealAction (edição de campos do deal — title, valor, prazo, etc.)
// =============================================================================

export async function updateDealAction(input: UpdateDealInput): Promise<DealActionResult> {
  const parsed = updateDealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para editar negócios.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  const { dealId, ...patch } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const deal = await tx.deal.findFirst({
        where: { id: dealId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!deal) throw new Error('DEAL_NOT_FOUND');

      // Defense-in-depth: se troca ownerId, valida membership.
      if (patch.ownerId) {
        const owner = await tx.workspaceMember.findFirst({
          where: { id: patch.ownerId, workspaceId },
          select: { id: true },
        });
        if (!owner) throw new Error('OWNER_NOT_FOUND');
      }

      // Monta `data` só com campos presentes no patch — não sobrescreve
      // com undefined (mantém o que tava no banco).
      const data: Prisma.DealUpdateInput = {};
      if (patch.title !== undefined) data.title = patch.title.trim();
      if (patch.valueCents !== undefined) data.valueCents = patch.valueCents;
      if (patch.ownerId !== undefined) data.owner = { connect: { id: patch.ownerId } };
      if (patch.probability !== undefined) data.probability = patch.probability;
      if (patch.dueAt !== undefined) {
        // String vazia limpa o prazo; ISO válido seta a data.
        data.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
      }
      if (patch.description !== undefined) data.description = patch.description || null;
      if (patch.lostReason !== undefined) data.lostReason = patch.lostReason || null;

      await tx.deal.update({
        where: { id: dealId },
        data,
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'deal_updated',
          entityType: 'deal',
          entityId: dealId,
          changes: patch as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });
    });

    revalidatePath('/kanban');
    revalidatePath('/leads');
    return { ok: true, dealId };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'DEAL_NOT_FOUND') return { ok: false, error: 'Negócio não encontrado.' };
      if (err.message === 'OWNER_NOT_FOUND')
        return { ok: false, error: 'Vendedor não pertence ao workspace.' };
    }
    reportNonFatal('deals.update.tx', err, { workspaceId, userId, dealId });
    return { ok: false, error: 'Não foi possível atualizar o negócio agora.' };
  }
}

// =============================================================================
// updateDealOrderAction
// =============================================================================

export async function updateDealOrderAction(
  input: UpdateDealOrderInput,
): Promise<DealActionResult> {
  const parsed = updateDealOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para reordenar negócios.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  const { dealId, beforeId, afterId } = parsed.data;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const deal = await tx.deal.findFirst({
        where: { id: dealId, workspaceId, deletedAt: null },
        select: { id: true, stageId: true },
      });
      if (!deal) throw new Error('DEAL_NOT_FOUND');

      const orderInStage = await resolveOrderInStage(
        tx,
        workspaceId,
        deal.stageId,
        dealId,
        beforeId,
        afterId,
      );

      await tx.deal.update({
        where: { id: dealId },
        data: { orderInStage },
      });

      // Audit "deal_updated" curto — reorder é evento de baixa relevância,
      // mas mantemos rastro pra LGPD/diagnóstico.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'deal_updated',
          entityType: 'deal',
          entityId: dealId,
          changes: { reorderedInStage: deal.stageId, orderInStage } as Prisma.InputJsonValue,
        },
      });
    });

    revalidatePath('/kanban');
    return { ok: true, dealId };
  } catch (err) {
    if (err instanceof Error && err.message === 'DEAL_NOT_FOUND') {
      return { ok: false, error: 'Negócio não encontrado.' };
    }
    reportNonFatal('deals.reorder.tx', err, { workspaceId, userId, dealId });
    return { ok: false, error: 'Não foi possível reordenar agora. Tente de novo.' };
  }
}
