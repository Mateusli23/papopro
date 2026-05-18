'use server';

/**
 * Server Actions de Agentes IA (M11#3).
 *
 * Substituem as mutações in-memory do store M5. Cobrem CRUD do agente,
 * versionamento (save + restore), roteamento (add/update/delete/reorder),
 * `handoff_config` JSONB, campos estruturados do Cérebro, e chat de
 * simulation chamando Claude real via `lib/ai/`.
 *
 * **Padrão idiomático M8/M9/M10:**
 *   Zod safeParse → requireRole → withWorkspace(tx) → defense-in-depth
 *   where: { workspaceId } → audit log na mesma tx → revalidatePath.
 *
 * **RBAC (CLAUDE.md §2.6):**
 *  - Criar/editar/clonar agente: Owner / Admin / Manager
 *  - Deletar agente: Owner / Admin (Manager NÃO — evita esfregar dados sem aprovação)
 *  - Editar Cérebro: Owner / Admin (impacta TODOS agentes do workspace)
 *  - Simular: qualquer membro O/A/M/Vendedor — chat de teste sem efeito colateral
 *
 * **Custo Anthropic/OpenAI começa aqui.** `simulateAgentMessageAction` chama
 * `claude.complete()` real — cada turno consome tokens contabilizados em
 * `usage_events` (M11#2). Workspaces sem `ANTHROPIC_API_KEY` vão receber
 * erro propositivo no simulation; outras actions funcionam normais.
 *
 * **Enforcement 3 agentes ativos no Pro IA**: NÃO está aqui — fica pra M11#7
 * (junto com métricas + `lib/limits.ts` billing-aware).
 *
 * **Cérebro upload de documentos** (PDF/DOC/etc): NÃO está aqui — fica pra
 * M11#4 (Edge Function de extração + chunking + embedding). M11#3 só conecta
 * os 5 campos estruturados (`about`/`products`/`faq`/`scripts`/`policy`).
 *
 * **Roteador runtime** (uazapi inbound → match → cria session production):
 * NÃO está aqui — fica pra M11#5. M11#3 só persiste as regras + faz simulation.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { AgentStatus as DbAgentStatus, type Prisma, UsageEventKind } from '@papopro/db';

import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';
import { complete } from '@/lib/ai/claude';
import { assembleContext } from '@/lib/ai/memory';
import { recordUsage } from '@/lib/ai/usage';
import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { getAgentTemplate } from '@/lib/fixtures/agent-templates';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { reindexStructuredField } from './knowledge-actions';
import {
  agentCreateSchema,
  agentUpdateSchema,
  handoffTriggerUpdateSchema,
  kbUpdateSchema,
  routeCreateSchema,
  routeUpdateSchema,
  versionCreateSchema,
} from './schemas';
import type { AgentStatus, HandoffTriggerKind } from './types';

// ─── Tipos compartilhados ───────────────────────────────────────────────────

export type AgentActionResult = { ok: true; id: string } | { ok: false; error: string };
export type RouteActionResult = { ok: true; id: string } | { ok: false; error: string };
export type VoidActionResult = { ok: true } | { ok: false; error: string };

export interface SimulationActionResult {
  ok: true;
  sessionId: string;
  /** Texto da resposta do agente (já persistido em `agent_messages`). */
  assistantText: string;
  /** Modelo que de fato atendeu (Claude pode trocar internamente). */
  model: string;
}

export type SimulationResult = SimulationActionResult | { ok: false; error: string };

// ─── Helpers internos ───────────────────────────────────────────────────────

/**
 * Materializa a v1 a partir do template — espelha o que `applyCreateAgent`
 * fazia em M5 sobre fixture. Templates ficam em `lib/fixtures/agent-templates.ts`
 * (mantido pós-M11#3 — é o seed de configuração inicial).
 */
function trioFromTemplate(templateKey: string): {
  prompt: string;
  persona: string;
  tone: 'consultivo' | 'amigavel' | 'direto' | 'formal';
  avatarEmoji: string;
} {
  const tpl = getAgentTemplate(templateKey);
  if (!tpl) {
    // 'blank' não tem template object — usa defaults vazios mas tom válido.
    return { prompt: '', persona: '', tone: 'consultivo', avatarEmoji: '🤖' };
  }
  return {
    prompt: tpl.defaultPrompt,
    persona: tpl.defaultPersona,
    tone: tpl.defaultTone,
    avatarEmoji: tpl.defaultAvatarEmoji,
  };
}

/**
 * Lê o agente garantindo workspace + soft-delete. Retorna `null` se não
 * existe — caller responde com `{ ok: false, error }`. Inline em vez de
 * helper exportado pra que cada action escolha o que fazer no erro.
 */
async function loadAgent(tx: Prisma.TransactionClient, workspaceId: string, agentId: string) {
  return tx.aiAgent.findFirst({
    where: { id: agentId, workspaceId, deletedAt: null },
    include: {
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
}

// ─── CRUD agente ────────────────────────────────────────────────────────────

/**
 * Cria agente com v1 inicial baseada no template + handoff_config default
 * (todos 6 triggers `enabled: false` exceto `manual` que é sempre true).
 *
 * **Status inicial `testing`** (decisão M5 — força revisão antes de soltar).
 */
export async function createAgentAction(rawInput: unknown): Promise<AgentActionResult> {
  const parsed = agentCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra criar agente.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager podem criar agentes.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };

  const { workspaceId, userId } = auth.ctx;
  const { name, templateKey, avatarEmoji } = parsed.data;
  const trio = trioFromTemplate(templateKey);

  try {
    const ctx = getRequestAuditContext();
    const agentId = await withWorkspace(workspaceId, async (tx) => {
      // 1. Cria o agente com prompt/persona/tone do template.
      const agent = await tx.aiAgent.create({
        data: {
          workspaceId,
          name,
          status: DbAgentStatus.testing,
          prompt: trio.prompt,
          persona: trio.persona,
          tone: trio.tone,
          avatarEmoji: avatarEmoji ?? trio.avatarEmoji,
          templateKey,
          handoffConfig: {
            // Manual sempre habilitado (vendedor pode assumir conversa a
            // qualquer momento). Outros triggers começam off — usuário decide
            // em Settings → Handoffs.
            manual: { enabled: true },
          },
          createdById: userId,
        },
      });

      // 2. Cria v1 com o mesmo trio. `agent_versions.created_by_id` é o
      // mesmo user. UNIQUE (agent_id, version_number) garante numeração.
      const v1 = await tx.agentVersion.create({
        data: {
          agentId: agent.id,
          versionNumber: 1,
          prompt: trio.prompt,
          persona: trio.persona,
          tone: trio.tone,
          createdById: userId,
        },
      });

      // 3. Reaponta `active_version_id` pra v1.
      await tx.aiAgent.update({
        where: { id: agent.id },
        data: { activeVersionId: v1.id },
      });

      // 4. Audit log.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'agent_created',
          entityType: 'ai_agent',
          entityId: agent.id,
          changes: { name, templateKey },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return agent.id;
    });

    revalidatePath('/agents');
    return { ok: true, id: agentId };
  } catch (err) {
    reportNonFatal('agents.create', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível criar o agente. Tente novamente.' };
  }
}

/**
 * Atualiza o DRAFT (prompt/persona/tone/name/avatar). NÃO cria versão nova —
 * `saveAgentVersionAction` faz isso explicitamente. Permite iteração rápida
 * sem versionar a cada keystroke (M5 fez certo aqui).
 *
 * `status` aceito mas roteia pra `setAgentStatusAction` semanticamente —
 * mantido aqui pra compatibilidade com a UI atual que envia status junto.
 */
export async function updateAgentDraftAction(
  agentId: string,
  rawInput: unknown,
): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const parsed = agentUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra atualizar agente.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;

      // Filtra só campos do draft que de fato chegaram. `status` separado
      // — setAgentStatusAction lida com audit `agent_activated`/`paused`.
      const { status, ...draft } = parsed.data;
      const updateData: Prisma.AiAgentUpdateInput = { ...draft };
      if (status !== undefined) {
        updateData.status = status as DbAgentStatus;
      }

      await tx.aiAgent.update({
        where: { id: agentId },
        data: updateData,
      });
      return true;
    });

    if (!ok) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath('/agents');
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.updateDraft', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível atualizar o agente.' };
  }
}

/**
 * Toggle simples ativo↔pausado. `testing → active` também passa por aqui
 * (transição implícita "soltar o agente em produção").
 *
 * **Sem enforcement de 3 ativos no Pro IA** — M11#7 vai injetar isso via
 * `lib/limits.ts:canActivateAgent({ tx })` aqui.
 */
export async function toggleAgentStatusAction(agentId: string): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ctx = getRequestAuditContext();
    const result = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return { ok: false as const, reason: 'not_found' as const };

      // Lógica de toggle: testing/paused → active; active → paused.
      const nextStatus: DbAgentStatus =
        agent.status === DbAgentStatus.active ? DbAgentStatus.paused : DbAgentStatus.active;

      await tx.aiAgent.update({ where: { id: agentId }, data: { status: nextStatus } });
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: nextStatus === DbAgentStatus.active ? 'agent_activated' : 'agent_paused',
          entityType: 'ai_agent',
          entityId: agentId,
          changes: { from: agent.status, to: nextStatus },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
      return { ok: true as const };
    });

    if (result.ok === false) {
      return { ok: false, error: 'Agente não encontrado.' };
    }
    revalidatePath('/agents');
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.toggleStatus', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível alterar o status.' };
  }
}

/**
 * Set explícito de status (testing/active/paused) — usado pelo undo do toggle
 * e por contextos onde a UI sabe o status alvo (ex: pause antes de editar
 * roteamento). Distinto de `toggle` pra rastrear no audit.
 */
export async function setAgentStatusAction(
  agentId: string,
  status: AgentStatus,
): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };
  if (status !== 'active' && status !== 'paused' && status !== 'testing') {
    return { ok: false, error: 'Status inválido.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ctx = getRequestAuditContext();
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;
      await tx.aiAgent.update({
        where: { id: agentId },
        data: { status: status as DbAgentStatus },
      });
      // Só registra audit se transição é semanticamente "ligar/desligar".
      if (status === 'active' || status === 'paused') {
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId,
            action: status === 'active' ? 'agent_activated' : 'agent_paused',
            entityType: 'ai_agent',
            entityId: agentId,
            changes: { from: agent.status, to: status },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        });
      }
      return true;
    });

    if (!ok) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath('/agents');
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.setStatus', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível alterar o status.' };
  }
}

/**
 * Duplica agente (config + routes + v1 com o trio atual do original).
 * Força status `testing` no clone — força revisão antes de soltar.
 */
export async function duplicateAgentAction(agentId: string): Promise<AgentActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ctx = getRequestAuditContext();
    const newId = await withWorkspace(workspaceId, async (tx) => {
      const original = await tx.aiAgent.findFirst({
        where: { id: agentId, workspaceId, deletedAt: null },
        include: { routingRules: true },
      });
      if (!original) return null;

      const clone = await tx.aiAgent.create({
        data: {
          workspaceId,
          name: `${original.name} (cópia)`,
          status: DbAgentStatus.testing,
          prompt: original.prompt,
          persona: original.persona,
          tone: original.tone,
          avatarEmoji: original.avatarEmoji,
          templateKey: original.templateKey,
          handoffConfig: original.handoffConfig as Prisma.InputJsonValue,
          createdById: userId,
        },
      });

      // Clone das rotas mantendo priority.
      for (const r of original.routingRules) {
        await tx.agentRoutingRule.create({
          data: {
            agentId: clone.id,
            kind: r.kind,
            value: r.value,
            priority: r.priority,
          },
        });
      }

      // v1 do clone com o trio atual (não o histórico do original — clone
      // começa "do zero" no versionamento).
      const v1 = await tx.agentVersion.create({
        data: {
          agentId: clone.id,
          versionNumber: 1,
          prompt: original.prompt,
          persona: original.persona,
          tone: original.tone,
          createdById: userId,
        },
      });

      await tx.aiAgent.update({
        where: { id: clone.id },
        data: { activeVersionId: v1.id },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'agent_created',
          entityType: 'ai_agent',
          entityId: clone.id,
          changes: { duplicatedFrom: agentId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return clone.id;
    });

    if (!newId) return { ok: false, error: 'Agente original não encontrado.' };
    revalidatePath('/agents');
    return { ok: true, id: newId };
  } catch (err) {
    reportNonFatal('agents.duplicate', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível duplicar o agente.' };
  }
}

/**
 * Soft delete — set `deletedAt`. Mantém histórico pra audit. M11.x ou M13
 * pode adicionar job que hard-deletes após 30d (igual `attachments`).
 *
 * Owner/Admin apenas — Manager NÃO pode deletar (decisão M10: dados
 * agregados, prevenção de erro).
 */
export async function deleteAgentAction(agentId: string): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem deletar agentes.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ctx = getRequestAuditContext();
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;

      await tx.aiAgent.update({
        where: { id: agentId },
        data: { deletedAt: new Date(), status: DbAgentStatus.paused },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'agent_deleted',
          entityType: 'ai_agent',
          entityId: agentId,
          changes: { name: agent.name },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
      return true;
    });

    if (!ok) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath('/agents');
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.delete', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível deletar o agente.' };
  }
}

// ─── Versionamento ──────────────────────────────────────────────────────────

/**
 * Promove o draft atual em versão imutável + reaponta `active_version_id`.
 * UI permite anotar o que mudou (`notes`, opcional).
 */
export async function saveAgentVersionAction(
  agentId: string,
  rawInput: unknown,
): Promise<AgentActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const parsed = versionCreateSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra salvar versão.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ctx = getRequestAuditContext();
    const versionId = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return null;

      const lastVersionNumber = agent.versions[0]?.versionNumber ?? 0;
      const newVersion = await tx.agentVersion.create({
        data: {
          agentId,
          versionNumber: lastVersionNumber + 1,
          prompt: agent.prompt,
          persona: agent.persona,
          tone: agent.tone,
          notes: parsed.data.notes,
          createdById: userId,
        },
      });

      await tx.aiAgent.update({
        where: { id: agentId },
        data: { activeVersionId: newVersion.id },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'agent_version_saved',
          entityType: 'ai_agent',
          entityId: agentId,
          changes: { versionNumber: newVersion.versionNumber, notes: parsed.data.notes },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return newVersion.id;
    });

    if (!versionId) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true, id: versionId };
  } catch (err) {
    reportNonFatal('agents.saveVersion', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível salvar a versão.' };
  }
}

/**
 * Restaura versão antiga: copia trio (prompt+persona+tone) pro draft +
 * reaponta `active_version_id`. NÃO cria versão nova (decisão M5 — restore
 * é "volta ao estado anterior", não "nova mudança").
 */
export async function restoreAgentVersionAction(
  agentId: string,
  versionId: string,
): Promise<VoidActionResult> {
  if (!isUuid(agentId) || !isUuid(versionId)) {
    return { ok: false, error: 'IDs inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const version = await tx.agentVersion.findFirst({
        where: { id: versionId, agentId },
      });
      if (!version) return false;

      // Defense-in-depth: confirma que o agente pertence ao workspace.
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;

      await tx.aiAgent.update({
        where: { id: agentId },
        data: {
          prompt: version.prompt,
          persona: version.persona,
          tone: version.tone,
          activeVersionId: version.id,
        },
      });
      return true;
    });

    if (!ok) return { ok: false, error: 'Versão ou agente não encontrado.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.restoreVersion', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível restaurar a versão.' };
  }
}

// ─── Roteamento ─────────────────────────────────────────────────────────────

/**
 * Adiciona regra de roteamento. Priority recebe `max(priority) + 1` — nova
 * regra entra no fim da lista. UI pode reordenar via `reorderRoutesAction`.
 */
export async function addRouteAction(
  agentId: string,
  rawInput: unknown,
): Promise<RouteActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const parsed = routeCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra criar regra.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const routeId = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return null;

      const max = await tx.agentRoutingRule.aggregate({
        where: { agentId },
        _max: { priority: true },
      });
      const nextPriority = (max._max.priority ?? -1) + 1;

      const created = await tx.agentRoutingRule.create({
        data: {
          agentId,
          kind: parsed.data.kind,
          value: parsed.data.value,
          priority: nextPriority,
        },
      });
      return created.id;
    });

    if (!routeId) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true, id: routeId };
  } catch (err) {
    reportNonFatal('agents.addRoute', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível adicionar a regra.' };
  }
}

export async function updateRouteAction(
  agentId: string,
  routeId: string,
  rawInput: unknown,
): Promise<VoidActionResult> {
  if (!isUuid(agentId) || !isUuid(routeId)) {
    return { ok: false, error: 'IDs inválidos.' };
  }

  const parsed = routeUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra atualizar regra.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const route = await tx.agentRoutingRule.findFirst({
        where: { id: routeId, agentId },
      });
      if (!route) return false;

      // Defense-in-depth: confirma agente do workspace.
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;

      await tx.agentRoutingRule.update({
        where: { id: routeId },
        data: parsed.data,
      });
      return true;
    });

    if (!ok) return { ok: false, error: 'Regra ou agente não encontrado.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.updateRoute', err, { workspaceId, userId, agentId, routeId });
    return { ok: false, error: 'Não foi possível atualizar a regra.' };
  }
}

export async function deleteRouteAction(
  agentId: string,
  routeId: string,
): Promise<VoidActionResult> {
  if (!isUuid(agentId) || !isUuid(routeId)) {
    return { ok: false, error: 'IDs inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;
      const r = await tx.agentRoutingRule.deleteMany({
        where: { id: routeId, agentId },
      });
      return r.count > 0;
    });

    if (!ok) return { ok: false, error: 'Regra não encontrada.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.deleteRoute', err, { workspaceId, userId, agentId, routeId });
    return { ok: false, error: 'Não foi possível deletar a regra.' };
  }
}

// ─── Handoff config (JSONB merge) ───────────────────────────────────────────

/**
 * Merge incremental no JSONB `handoff_config`. UI envia toggle de 1 trigger
 * por vez; merge preserva os outros 5.
 */
export async function updateHandoffTriggerAction(
  agentId: string,
  rawInput: unknown,
): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const parsed = handoffTriggerUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra atualizar gatilho.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  const { kind, enabled, config } = parsed.data;

  try {
    const ok = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return false;

      const current = (agent.handoffConfig ?? {}) as Record<
        string,
        { enabled?: boolean; keywords?: string[]; targetAgentId?: string }
      >;
      const next = {
        ...current,
        [kind]: {
          enabled,
          ...(config?.keywords ? { keywords: config.keywords } : {}),
          ...(config?.targetAgentId ? { targetAgentId: config.targetAgentId } : {}),
        },
      };

      await tx.aiAgent.update({
        where: { id: agentId },
        data: { handoffConfig: next as Prisma.InputJsonValue },
      });
      return true;
    });

    if (!ok) return { ok: false, error: 'Agente não encontrado.' };
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.updateHandoff', err, { workspaceId, userId, agentId, kind });
    return { ok: false, error: 'Não foi possível atualizar o gatilho.' };
  }
}

// ─── Cérebro da Empresa (5 campos estruturados) ─────────────────────────────

/**
 * Upsert dos 5 campos. Campos não enviados ficam inalterados. Owner/Admin
 * apenas — Cérebro afeta todos os agentes do workspace.
 *
 * **Upload de documentos** (PDF/DOC/etc.): M11#4 entrega via Edge Function
 * separada (extração + chunking + embedding em background).
 */
export async function updateKnowledgeBaseAction(rawInput: unknown): Promise<VoidActionResult> {
  const parsed = kbUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos pra atualizar Cérebro.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem editar o Cérebro da Empresa.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const existing = await tx.knowledgeBaseField.findUnique({ where: { workspaceId } });
      if (existing) {
        await tx.knowledgeBaseField.update({
          where: { workspaceId },
          data: parsed.data,
        });
      } else {
        await tx.knowledgeBaseField.create({
          data: {
            workspaceId,
            about: parsed.data.about ?? '',
            products: parsed.data.products ?? '',
            faq: parsed.data.faq ?? '',
            scripts: parsed.data.scripts ?? '',
            policy: parsed.data.policy ?? '',
          },
        });
      }
    });

    // M11#4: re-indexa apenas os campos que vieram no patch (Zod `.optional()`
    // — campo ausente = inalterado, não re-chunkear). Roda em paralelo via
    // `Promise.allSettled` pra que falha em embedding de 1 campo não bloqueie
    // os outros. Erros logam non-fatal — campo fica com chunks antigos até
    // próximo save.
    const FIELDS = ['about', 'products', 'faq', 'scripts', 'policy'] as const;
    const reindexTasks = FIELDS.filter((f) => parsed.data[f] !== undefined).map((field) =>
      reindexStructuredField({ workspaceId, field, content: parsed.data[field] ?? '' }).catch(
        (err) => reportNonFatal(`agents.updateKb.reindex.${field}`, err, { workspaceId, userId }),
      ),
    );
    await Promise.allSettled(reindexTasks);

    revalidatePath('/agents');
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.updateKb', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível atualizar o Cérebro.' };
  }
}

// ─── Simulation chat (Claude real) ──────────────────────────────────────────

const simulationInputSchema = z.object({
  /** Mensagem do usuário no chat de simulação. 1..2000 chars. */
  userMessage: z
    .string()
    .trim()
    .min(1, 'Mensagem vazia')
    .max(2000, 'Mensagem muito longa (máx 2000)'),
});

/**
 * Envia mensagem no chat de simulação do agente. Cria/reusa
 * `agent_session kind='simulation'` (sem `conversation_id`/`lead_id` —
 * CHECK constraint M11#1 garante isolamento de leads reais). Chama Claude
 * via `lib/ai/claude.complete()` com prompt caching, persiste mensagens em
 * `agent_messages`, registra `usage_events`.
 *
 * **Custo começa aqui** — cada turno consome tokens Sonnet 4.6 (~$0.05-$0.30
 * por turno típico). Caller deve apresentar disclaimer na UI.
 *
 * **Memória 3 camadas:** simulation NÃO tem `leadId` então `assembleContext`
 * retorna `leadSummary: null` (camada LEAD vazia); session messages e Cérebro
 * funcionam normal.
 *
 * **Sem efeito colateral em leads/conversations.** Simulation = sandbox. UI
 * deixa claro no header da aba: "Conversa de teste — não vai pro WhatsApp".
 */
export async function simulateAgentMessageAction(
  agentId: string,
  rawInput: unknown,
): Promise<SimulationResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const parsed = simulationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Mensagem inválida.',
    };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  const { userMessage } = parsed.data;

  try {
    // 1. Resolve/cria sessão de simulation + persiste mensagem do user.
    const session = await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return null;

      let s = await tx.agentSession.findFirst({
        where: { workspaceId, agentId, kind: 'simulation', endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (!s) {
        s = await tx.agentSession.create({
          data: {
            workspaceId,
            agentId,
            kind: 'simulation',
            versionId: agent.activeVersionId,
          },
        });
      }

      await tx.agentMessage.create({
        data: {
          workspaceId,
          sessionId: s.id,
          direction: 'in',
          body: userMessage,
        },
      });

      return {
        sessionId: s.id,
        agent: {
          name: agent.name,
          prompt: agent.prompt,
          persona: agent.persona,
          tone: agent.tone,
        },
      };
    });

    if (!session) return { ok: false, error: 'Agente não encontrado.' };

    // 2. Monta contexto (memória 3 camadas) — leadId undefined em simulation.
    const context = await assembleContext({
      workspaceId,
      agentId,
      sessionId: session.sessionId,
      latestUserMessage: userMessage,
    });

    // 3. Monta system prompt + chama Claude.
    const systemPrompt = buildSystemPrompt({
      name: session.agent.name,
      persona: session.agent.persona,
      prompt: session.agent.prompt,
      tone: session.agent.tone as 'consultivo' | 'amigavel' | 'direto' | 'formal',
    });

    const messages = [...context.sessionMessages, { role: 'user' as const, content: userMessage }];

    const result = await complete({
      workspaceId,
      sessionId: session.sessionId,
      feature: 'agent_chat',
      system: systemPrompt,
      cacheableBlocks: context.cacheableBlocks,
      messages,
    });

    // 4. Persiste resposta + tokens em agent_messages + recordUsage (em
    //    transações separadas porque envolve chamadas externas concluídas).
    await withWorkspace(workspaceId, async (tx) => {
      await tx.agentMessage.create({
        data: {
          workspaceId,
          sessionId: session.sessionId,
          direction: 'out',
          body: result.text,
          model: result.model,
          inputTokens: result.usage.input,
          outputTokens: result.usage.output,
          cacheReadInputTokens: result.usage.cacheRead,
          cacheCreationInputTokens: result.usage.cacheCreation,
        },
      });
    });

    // recordUsage com try/catch isolado — falha aqui não pode quebrar a
    // resposta pro usuário (já temos o texto).
    await recordUsage({
      workspaceId,
      eventKind: UsageEventKind.agent_call,
      feature: 'agent_chat',
      model: result.model,
      usage: result.usage,
      entityKind: 'agent_session',
      entityId: session.sessionId,
    }).catch((err) =>
      reportNonFatal('agents.simulate.recordUsage', err, {
        workspaceId,
        userId,
        agentId,
        sessionId: session.sessionId,
      }),
    );

    revalidatePath(`/agents/${agentId}`);
    return {
      ok: true,
      sessionId: session.sessionId,
      assistantText: result.text,
      model: result.model,
    };
  } catch (err) {
    reportNonFatal('agents.simulate', err, { workspaceId, userId, agentId });
    // Erro mais comum: ANTHROPIC_API_KEY ausente. Microcopy propositiva.
    const message = (err as Error).message ?? '';
    if (message.includes('ANTHROPIC_API_KEY')) {
      return {
        ok: false,
        error: 'IA não configurada — verifique a chave Anthropic em Configurações.',
      };
    }
    return {
      ok: false,
      error: 'Não foi possível obter resposta do agente. Tente novamente.',
    };
  }
}

/**
 * Encerra a sessão de simulation atual (`ended_at = NOW()`) — UI chama isso
 * quando o usuário clica em "Nova simulação".
 */
export async function endSimulationSessionAction(agentId: string): Promise<VoidActionResult> {
  if (!isUuid(agentId)) return { ok: false, error: 'ID de agente inválido.' };

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor']);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    await withWorkspace(workspaceId, async (tx) => {
      const agent = await loadAgent(tx, workspaceId, agentId);
      if (!agent) return;
      await tx.agentSession.updateMany({
        where: { workspaceId, agentId, kind: 'simulation', endedAt: null },
        data: { endedAt: new Date(), endedReason: 'simulation_closed' },
      });
    });
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (err) {
    reportNonFatal('agents.endSimulation', err, { workspaceId, userId, agentId });
    return { ok: false, error: 'Não foi possível encerrar a simulação.' };
  }
}

// Re-export do shape pra TypeScript types.ts (mantém type-only).
export type { HandoffTriggerKind };
