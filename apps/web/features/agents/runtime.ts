/**
 * Runtime de Agentes IA (M11#5) — produção: lead manda msg no WhatsApp →
 * webhook persiste inbound → este handler decide se algum agente atende →
 * monta contexto (memória 3 camadas) → chama Claude → envia resposta via M9
 * adapter passando por anti-ban.
 *
 * **Chamado depois** que `handleMessageReceived` (M9) terminou a tx do
 * webhook. Reusa: `assembleContext` (M11#2), `complete` (M11#2),
 * `buildSystemPrompt` (M11#3), `assertCanSend` + `applyJitter` + `recordSent`
 * + `getWhatsAppAdapter` (M9 anti-ban + adapter).
 *
 * **Não é Server Action** — chamado server-to-server pelo route handler do
 * webhook. Sem `'use server'`; é módulo server-only puro.
 *
 * **Order matters:**
 *   1. tx #1 — load agent + instance snapshot + create/find production session
 *      + persist `agent_message direction='in'` (entra na memória sessão).
 *   2. anti-ban check (separate tx pra fechar transação curta).
 *      Bloqueado → audit log + return (sem chamada Claude, sem custo).
 *   3. assembleContext (memória 3 camadas) — fora de tx.
 *   4. complete (Claude API) — fora de tx.
 *   5. tx #2 — persist `agent_message direction='out'` com tokens.
 *   6. recordUsage (best-effort, catch isolado).
 *   7. applyJitter 30-50s (anti-ban CLAUDE.md §6).
 *   8. adapter.sendText — fora de tx (chamada externa).
 *   9. tx #3 — persist Message (whatsapp out) + Activity + recordSent + audit.
 *
 * **Mensagem out tem `authorId=null`**: distingue IA de vendedor humano (que
 * tem `authorId = workspaceMember.id`). Activity `meta.agentId/via='agent'`
 * permite timeline render "Agente Sofia respondeu".
 *
 * **Sessão production por conversation:** `(workspaceId, agentId, conversationId,
 * endedAt IS NULL)`. Mesma conversa + mesmo agente reusa entre turnos. Handoff
 * pra outro agente (M11#6) fecha a sessão atual + abre nova com `agentId` novo.
 *
 * **Falha de envio (adapter ou tx final) NÃO faz rollback da resposta Claude.**
 * `agent_message out` já está persistido; o lead ouvirá "fantasma" — fica
 * registrado em `usage_events` + agent_message mas nunca chegou no WhatsApp.
 * Operador vê pelo audit `whatsapp_message_sent` ausente. M11#6+ adiciona
 * retry inteligente; em M11#5 logamos e seguimos.
 */
import 'server-only';

import { type Prisma, UsageEventKind } from '@papopro/db';

import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';
import { complete } from '@/lib/ai/claude';
import { assembleContext } from '@/lib/ai/memory';
import { recordUsage } from '@/lib/ai/usage';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import {
  applyJitter,
  assertCanSend,
  recordSent,
  type AntiBanReason,
  type InstanceSnapshot,
} from '@/lib/whatsapp/anti-ban';
import { getWhatsAppAdapter } from '@/lib/whatsapp/factory';

import type { AgentTone } from './types';

const PREVIEW_LIMIT = 280;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export interface RunAgentInput {
  workspaceId: string;
  agentId: string;
  leadId: string;
  /** Telefone E.164 do lead — pra anti-ban + adapter.sendText. */
  leadPhone: string;
  conversationId: string;
  /** ID interno da `WhatsappInstance` (não o externalInstanceId). */
  instanceId: string;
  /** ID do `WhatsappAccount` — vai pra `Conversation.whatsappAccountId` no upsert
   *  (já existe row, mas mantém parity de schema). */
  whatsappAccountId: string;
  /** Texto da mensagem do lead. Empty/null não deveria chegar — caller filtra
   *  (rules `kind=keyword` exigem texto). */
  latestUserMessage: string;
}

export type RunAgentResult =
  | { ok: true; agentMessageId: string; whatsappMessageId: string }
  | { ok: false; reason: 'agent_not_found' | 'agent_not_active' | 'agent_deleted' }
  | { ok: false; reason: 'blocked'; antiBanReason: AntiBanReason; message: string }
  | { ok: false; reason: 'claude_error' | 'adapter_error' | 'persist_error'; message: string };

/**
 * Despacha o agente pra responder à última mensagem inbound do lead.
 *
 * **Pré-condições (responsabilidade do caller):**
 *   - lead, conversation e Message inbound já persistidos (M9 handleMessageReceived)
 *   - lead NÃO está em opt-out (handler já filtrou)
 *   - agentId resolvido pelo roteador (`pickAgentForInbound`)
 */
export async function runAgentForInboundMessage(input: RunAgentInput): Promise<RunAgentResult> {
  const {
    workspaceId,
    agentId,
    leadId,
    leadPhone,
    conversationId,
    instanceId,
    whatsappAccountId,
    latestUserMessage,
  } = input;

  // ─── Step 1: preflight + session + persist user message ──────────────────
  let session: {
    sessionId: string;
    agent: { name: string; prompt: string; persona: string; tone: AgentTone };
    instance: InstanceSnapshot;
    workspaceTimezone: string;
  };
  try {
    const result = await withWorkspace(workspaceId, async (tx) => {
      const agent = await tx.aiAgent.findFirst({
        where: { id: agentId, workspaceId, deletedAt: null },
        select: {
          name: true,
          status: true,
          prompt: true,
          persona: true,
          tone: true,
          activeVersionId: true,
        },
      });
      if (!agent) return { kind: 'agent_not_found' as const };
      if (agent.status !== 'active') return { kind: 'agent_not_active' as const };

      const instance = await tx.whatsappInstance.findUnique({
        where: { id: instanceId },
        select: {
          status: true,
          healthScore: true,
          pausedUntil: true,
          messagesSent24h: true,
          externalInstanceId: true,
        },
      });
      if (!instance) return { kind: 'agent_not_found' as const };

      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { timezone: true },
      });

      // Reusa sessão production aberta (mesma conversation, mesmo agente).
      let s = await tx.agentSession.findFirst({
        where: {
          workspaceId,
          agentId,
          conversationId,
          kind: 'production',
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });

      if (!s) {
        s = await tx.agentSession.create({
          data: {
            workspaceId,
            agentId,
            versionId: agent.activeVersionId,
            conversationId,
            leadId,
            kind: 'production',
          },
          select: { id: true },
        });
      }

      // Persiste 'in' antes de assembleContext — sessionMessages já inclui essa
      // mensagem como último item (assembleContext faz findMany ordenado desc).
      await tx.agentMessage.create({
        data: {
          workspaceId,
          sessionId: s.id,
          direction: 'in',
          body: latestUserMessage,
        },
      });

      return {
        kind: 'ok' as const,
        sessionId: s.id,
        agent: {
          name: agent.name,
          prompt: agent.prompt,
          persona: agent.persona,
          tone: agent.tone as AgentTone,
        },
        instance: {
          status: instance.status,
          healthScore: instance.healthScore,
          pausedUntil: instance.pausedUntil,
          messagesSent24h: instance.messagesSent24h,
          externalInstanceId: instance.externalInstanceId,
        },
        workspaceTimezone: workspace?.timezone ?? DEFAULT_TIMEZONE,
      };
    });

    if (result.kind === 'agent_not_found') {
      return { ok: false, reason: 'agent_not_found' };
    }
    if (result.kind === 'agent_not_active') {
      return { ok: false, reason: 'agent_not_active' };
    }

    session = {
      sessionId: result.sessionId,
      agent: result.agent,
      instance: result.instance,
      workspaceTimezone: result.workspaceTimezone,
    };
  } catch (err) {
    reportNonFatal('agents.runtime.preflight', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'persist_error', message: (err as Error).message };
  }

  // ─── Step 2: anti-ban (skip Claude tokens se vai falhar mesmo) ───────────
  let antiBan;
  try {
    antiBan = await withWorkspace(workspaceId, async (tx) =>
      assertCanSend(tx, workspaceId, session.workspaceTimezone, leadPhone, session.instance),
    );
  } catch (err) {
    reportNonFatal('agents.runtime.antiban', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'persist_error', message: (err as Error).message };
  }

  if (!antiBan.ok) {
    // Audit log + return. Não fecha sessão — próximo turno (anti-ban resolvido)
    // pode reusar.
    try {
      await withWorkspace(workspaceId, async (tx) => {
        await tx.auditLog.create({
          data: {
            workspaceId,
            action: 'whatsapp_blocked_optout',
            entityType: 'lead',
            entityId: leadId,
            changes: {
              phone: leadPhone,
              source: 'agent_runtime_blocked',
              agentId,
              antiBanReason: antiBan.reason,
              message: antiBan.message,
            } as Prisma.InputJsonValue,
          },
        });
      });
    } catch (err) {
      reportNonFatal('agents.runtime.audit_blocked', err, { workspaceId, agentId, leadId });
    }
    return {
      ok: false,
      reason: 'blocked',
      antiBanReason: antiBan.reason,
      message: antiBan.message,
    };
  }

  // ─── Step 3: assembleContext (memória 3 camadas) ─────────────────────────
  let context;
  try {
    context = await assembleContext({
      workspaceId,
      agentId,
      sessionId: session.sessionId,
      leadId,
      latestUserMessage,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.context', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'claude_error', message: (err as Error).message };
  }

  // ─── Step 4: Claude (custos $ começam aqui) ──────────────────────────────
  const systemPrompt = buildSystemPrompt({
    name: session.agent.name,
    persona: session.agent.persona,
    prompt: session.agent.prompt,
    tone: session.agent.tone,
  });

  let claudeResult;
  try {
    claudeResult = await complete({
      workspaceId,
      sessionId: session.sessionId,
      feature: 'agent_chat',
      system: systemPrompt,
      cacheableBlocks: context.cacheableBlocks,
      // sessionMessages já inclui o `in` persistido em step 1 (último item).
      // Não appenda latestUserMessage de novo — evita duplicar turno.
      messages: context.sessionMessages,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.claude', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'claude_error', message: (err as Error).message };
  }

  // ─── Step 5: persist agent_message out + tokens ──────────────────────────
  let agentMessageId: string;
  try {
    agentMessageId = await withWorkspace(workspaceId, async (tx) => {
      const msg = await tx.agentMessage.create({
        data: {
          workspaceId,
          sessionId: session.sessionId,
          direction: 'out',
          body: claudeResult.text,
          model: claudeResult.model,
          inputTokens: claudeResult.usage.input,
          outputTokens: claudeResult.usage.output,
          cacheReadInputTokens: claudeResult.usage.cacheRead,
          cacheCreationInputTokens: claudeResult.usage.cacheCreation,
        },
        select: { id: true },
      });
      return msg.id;
    });
  } catch (err) {
    reportNonFatal('agents.runtime.persist_out', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'persist_error', message: (err as Error).message };
  }

  // ─── Step 6: recordUsage (best-effort) ───────────────────────────────────
  void recordUsage({
    workspaceId,
    eventKind: UsageEventKind.agent_call,
    feature: 'agent_chat',
    model: claudeResult.model,
    usage: claudeResult.usage,
    entityKind: 'agent_session',
    entityId: session.sessionId,
  }).catch((err) =>
    reportNonFatal('agents.runtime.recordUsage', err, {
      workspaceId,
      agentId,
      sessionId: session.sessionId,
    }),
  );

  // ─── Step 7: jitter 30-50s ───────────────────────────────────────────────
  await applyJitter();

  // ─── Step 8: adapter.sendText (chamada externa, fora de tx) ──────────────
  const adapter = getWhatsAppAdapter();
  let sendResult;
  try {
    if (!session.instance.externalInstanceId) {
      throw new Error('NO_EXTERNAL_INSTANCE');
    }
    sendResult = await adapter.sendText({
      workspaceId,
      externalInstanceId: session.instance.externalInstanceId,
      to: leadPhone,
      body: claudeResult.text,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.adapter', err, {
      workspaceId,
      agentId,
      leadId,
      externalInstanceId: session.instance.externalInstanceId,
    });
    return { ok: false, reason: 'adapter_error', message: (err as Error).message };
  }

  // ─── Step 9: persist Message (whatsapp) + Activity + recordSent + audit ──
  let whatsappMessageId: string;
  try {
    whatsappMessageId = await withWorkspace(workspaceId, async (tx) => {
      const preview = claudeResult.text.trim().slice(0, PREVIEW_LIMIT);

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'awaiting',
          lastMessageAt: sendResult.sentAt,
          lastMessagePreview: preview,
          lastMessageDirection: 'out',
          archivedAt: null,
          whatsappAccountId,
        },
      });

      const message = await tx.message.create({
        data: {
          workspaceId,
          conversationId,
          kind: 'text',
          direction: 'out',
          body: claudeResult.text,
          // authorId=null marca "mensagem da IA" (vendedor humano sempre tem
          // authorId=member.id). Distingue na timeline e nos relatórios.
          authorId: null,
          externalMessageId: sendResult.externalMessageId,
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { lastInteractionAt: sendResult.sentAt },
      });

      await tx.activity.create({
        data: {
          workspaceId,
          leadId,
          type: 'whatsapp_out',
          body: claudeResult.text,
          authorId: null,
          meta: {
            messageId: message.id,
            conversationId,
            externalMessageId: sendResult.externalMessageId,
            via: 'agent',
            agentId,
            agentSessionId: session.sessionId,
            agentMessageId,
          } as Prisma.InputJsonValue,
        },
      });

      await recordSent(tx, instanceId, sendResult.sentAt);

      await tx.auditLog.create({
        data: {
          workspaceId,
          action: 'whatsapp_message_sent',
          entityType: 'message',
          entityId: message.id,
          changes: {
            leadId,
            conversationId,
            externalMessageId: sendResult.externalMessageId,
            bodyLength: claudeResult.text.length,
            via: 'agent',
            agentId,
            agentSessionId: session.sessionId,
          } as Prisma.InputJsonValue,
        },
      });

      return message.id;
    });
  } catch (err) {
    reportNonFatal('agents.runtime.persist_send', err, { workspaceId, agentId, leadId });
    return { ok: false, reason: 'persist_error', message: (err as Error).message };
  }

  return { ok: true, agentMessageId, whatsappMessageId };
}

/**
 * Carrega regras de roteamento "achatadas" prontas pro `pickAgentForInbound`.
 * Filtra agentes `status='active'` + `deletedAt IS NULL` no SQL — router não
 * precisa re-verificar.
 *
 * Server-only. Chamado pelo webhook depois de `handleMessageReceived`.
 *
 * **Performance:** 1 query com JOIN. Tipicamente 0-3 agentes ativos por
 * workspace (PRD limit Pro IA), ~5-10 rules cada → <50 rows. Não há issue.
 */
export async function loadActiveRoutingRules(workspaceId: string): Promise<
  Array<{
    ruleId: string;
    agentId: string;
    agentCreatedAt: Date;
    kind: 'stage' | 'tag' | 'whatsapp_number' | 'keyword';
    value: string;
    priority: number;
    ruleCreatedAt: Date;
  }>
> {
  return withWorkspace(workspaceId, async (tx) => {
    const rules = await tx.agentRoutingRule.findMany({
      where: {
        agent: {
          workspaceId,
          status: 'active',
          deletedAt: null,
        },
      },
      include: {
        agent: { select: { createdAt: true } },
      },
    });

    return rules.map((r) => ({
      ruleId: r.id,
      agentId: r.agentId,
      agentCreatedAt: r.agent.createdAt,
      kind: r.kind as 'stage' | 'tag' | 'whatsapp_number' | 'keyword',
      value: r.value,
      priority: r.priority,
      ruleCreatedAt: r.createdAt,
    }));
  });
}

/**
 * Helper composto pro webhook: dado o ID do lead, retorna o contexto
 * mínimo (`leadStageId`, `leadTags`) pra alimentar o roteador. Server-only.
 *
 * Read-only via `withWorkspace` (RLS + defense-in-depth `workspaceId` no
 * `where`). Query única — sem o `Promise.all` paralelo que faz `memory.ts`
 * usar `prisma` direto.
 */
export async function loadLeadContextForRouter(
  workspaceId: string,
  leadId: string,
): Promise<{ leadStageId: string; leadTags: string[] } | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      select: {
        stageId: true,
        tags: {
          select: { tag: { select: { name: true } } },
        },
      },
    });
    if (!lead) return null;
    return {
      leadStageId: lead.stageId,
      leadTags: lead.tags.map((t) => t.tag.name),
    };
  });
}
