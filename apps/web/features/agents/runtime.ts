/**
 * Runtime de Agentes IA (M11#5 + handoffs M11#6) — produção: lead manda msg
 * no WhatsApp → webhook persiste inbound → este handler decide se algum
 * agente atende → avalia handoffs → monta contexto (memória 3 camadas) →
 * chama Claude → envia resposta via M9 adapter passando por anti-ban.
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
 *   1.   tx #1 — load agent (+handoffConfig) + instance snapshot + create/find
 *        production session + persist `agent_message direction='in'`.
 *   1.5  handoff inbound (M11#6) — keyword/intenção comercial → humano;
 *        agent_to_agent → re-despacha o agente de destino. Pode encerrar aqui.
 *   2.   anti-ban check. Bloqueio `outside_business_hours` + gatilho ligado
 *        vira handoff agente→humano (M11#6). Outros bloqueios → return.
 *   3.   assembleContext (memória 3 camadas) — fora de tx.
 *   4.   complete (Claude API) — fora de tx.
 *   5.   tx #2 — persist `agent_message direction='out'` com tokens.
 *   6.   recordUsage (best-effort, catch isolado).
 *   7.   applyJitter 30-50s (anti-ban CLAUDE.md §6).
 *   8.   adapter.sendText — fora de tx (chamada externa).
 *   9.   tx #3 — persist Message (whatsapp out) + Activity + recordSent + audit.
 *   10.  job de lead_summary (M11#6) — throttled, pós-envio, best-effort.
 *
 * **Sessão production por conversation:** `(workspaceId, agentId, conversationId,
 * endedAt IS NULL)`. Handoff agente→agente (M11#6) encerra a sessão atual e o
 * agente de destino abre a sua na re-invocação. Handoff agente→humano encerra
 * a sessão e seta `conversation.ai_enabled=false`.
 */
import 'server-only';

import { type Prisma, prisma, UsageEventKind } from '@papopro/db';

import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';
import { complete } from '@/lib/ai/claude';
import {
  evaluateInboundHandoff,
  isHandoffTriggerEnabled,
  parseHandoffConfig,
} from '@/lib/ai/handoff';
import { detectCommercialIntent } from '@/lib/ai/intent';
import { assembleContext, updateLeadSummary } from '@/lib/ai/memory';
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

import {
  applyAgentHandoffTx,
  applyHumanHandoffTx,
  type HumanHandoffReason,
} from './handoff-runtime';
import type { AgentTone } from './types';

const PREVIEW_LIMIT = 280;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** Profundidade máxima de handoff agente→agente por mensagem inbound. Cap em 1
 *  hop — A pode passar pra B, mas B não re-passa pra C (evita loop A→B→A). */
const MAX_HANDOFF_DEPTH = 1;

/** Quantos `agent_messages` novos a sessão precisa acumular desde o último
 *  resumo pra disparar a regeneração do `lead_summary` (job M11#6). */
const LEAD_SUMMARY_REFRESH_THRESHOLD = 6;

/** Mínimo de mensagens na sessão pra valer a pena resumir. */
const LEAD_SUMMARY_MIN_MESSAGES = 2;

/** Quantas mensagens recentes da sessão alimentam a consolidação do resumo. */
const LEAD_SUMMARY_TAKE = 20;

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
  | { ok: true; handoff: 'human'; reason: HumanHandoffReason }
  | { ok: true; handoff: 'agent'; targetAgentId: string }
  | { ok: false; reason: 'agent_not_found' | 'agent_not_active' | 'agent_deleted' }
  | { ok: false; reason: 'blocked'; antiBanReason: AntiBanReason; message: string }
  | { ok: false; reason: 'claude_error' | 'adapter_error' | 'persist_error'; message: string };

/**
 * Despacha o agente pra responder à última mensagem inbound do lead.
 *
 * **Pré-condições (responsabilidade do caller):**
 *   - lead, conversation e Message inbound já persistidos (M9 handleMessageReceived)
 *   - lead NÃO está em opt-out (handler já filtrou)
 *   - `conversation.ai_enabled = true` (webhook checa antes — M11#6)
 *   - agentId resolvido pela sessão sticky OU pelo roteador (`pickAgentForInbound`)
 *
 * `handoffDepth` controla a recursão de handoff agente→agente — o caller
 * externo (webhook) sempre passa 0; só `performHandoffToAgent` incrementa.
 */
export async function runAgentForInboundMessage(
  input: RunAgentInput,
  handoffDepth = 0,
): Promise<RunAgentResult> {
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
    agent: {
      name: string;
      prompt: string;
      persona: string;
      tone: AgentTone;
      handoffConfig: unknown;
    };
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
          handoffConfig: true,
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
          handoffConfig: agent.handoffConfig,
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

  // ─── Step 1.5: handoff dirigido pela mensagem inbound (M11#6) ─────────────
  const triggers = parseHandoffConfig(session.agent.handoffConfig);

  // commercial_intent — roda o classificador Haiku só quando o gatilho está
  // ligado (custo zero pra workspaces que não usam). Falha do detector é
  // fail-safe: trata como "sem intenção" (não escala por engano).
  let commercialIntentDetected: boolean | undefined;
  if (isHandoffTriggerEnabled(triggers, 'commercial_intent')) {
    try {
      const intent = await detectCommercialIntent({
        workspaceId,
        sessionId: session.sessionId,
        latestUserMessage,
      });
      commercialIntentDetected = intent.detected;
      void recordUsage({
        workspaceId,
        eventKind: UsageEventKind.agent_call,
        feature: 'intent_detection',
        model: intent.model,
        usage: intent.usage,
        entityKind: 'agent_session',
        entityId: session.sessionId,
      }).catch((err) =>
        reportNonFatal('agents.runtime.intent_usage', err, { workspaceId, agentId, leadId }),
      );
    } catch (err) {
      reportNonFatal('agents.runtime.intent', err, { workspaceId, agentId, leadId });
      commercialIntentDetected = false;
    }
  }

  const decision = evaluateInboundHandoff(triggers, {
    messageBody: latestUserMessage,
    commercialIntentDetected,
  });

  if (decision?.target === 'human') {
    try {
      await performHandoffToHuman({
        workspaceId,
        conversationId,
        leadId,
        agentId,
        sessionId: session.sessionId,
        reason: decision.reason,
      });
    } catch (err) {
      reportNonFatal('agents.runtime.handoff_human', err, { workspaceId, agentId, leadId });
      return { ok: false, reason: 'persist_error', message: (err as Error).message };
    }
    return { ok: true, handoff: 'human', reason: decision.reason };
  }

  if (decision?.target === 'agent' && handoffDepth < MAX_HANDOFF_DEPTH) {
    const handoff = await performHandoffToAgent({
      input,
      fromAgentId: agentId,
      fromSessionId: session.sessionId,
      targetAgentId: decision.targetAgentId,
      handoffDepth,
    });
    if (handoff.handedOff) {
      return { ok: true, handoff: 'agent', targetAgentId: decision.targetAgentId };
    }
    // Agente de destino inválido (pausado/deletado) — segue o fluxo normal:
    // o agente atual (A) responde a mensagem.
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
    // Gatilho `outside_business_hours` ligado + bloqueio por horário → handoff
    // agente→humano (M11#6). Operador assume quando voltar ao expediente.
    if (
      antiBan.reason === 'outside_business_hours' &&
      isHandoffTriggerEnabled(triggers, 'outside_business_hours')
    ) {
      try {
        await performHandoffToHuman({
          workspaceId,
          conversationId,
          leadId,
          agentId,
          sessionId: session.sessionId,
          reason: 'outside_business_hours',
        });
      } catch (err) {
        reportNonFatal('agents.runtime.handoff_hours', err, { workspaceId, agentId, leadId });
        return { ok: false, reason: 'persist_error', message: (err as Error).message };
      }
      return { ok: true, handoff: 'human', reason: 'outside_business_hours' };
    }

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

  // ─── Step 10: job de lead_summary (M11#6) ────────────────────────────────
  // Pós-envio — a resposta ao lead já saiu (Step 8/9), então a latência da
  // consolidação não afeta a conversa. Throttled + best-effort.
  try {
    await maybeRefreshLeadSummary({
      workspaceId,
      leadId,
      agentId,
      sessionId: session.sessionId,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.lead_summary', err, { workspaceId, agentId, leadId });
  }

  return { ok: true, agentMessageId, whatsappMessageId };
}

// ════════════════════════════════════════════════════════════════════════════
// Handoffs (M11#6)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Handoff agente→humano disparado pelo runtime (gatilhos keyword /
 * commercial_intent / outside_business_hours). Gera um resumo fresco do lead
 * (pro humano ter contexto) e aplica o handoff transacional.
 *
 * O resumo é best-effort — se a chamada Claude falhar, o handoff acontece
 * mesmo assim (estado correto > resumo perfeito).
 */
async function performHandoffToHuman(params: {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  agentId: string;
  sessionId: string;
  reason: HumanHandoffReason;
}): Promise<void> {
  try {
    await refreshLeadSummary({
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      agentId: params.agentId,
      sessionId: params.sessionId,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.handoff_summary', err, {
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      leadId: params.leadId,
    });
  }

  await withWorkspace(params.workspaceId, async (tx) => {
    await applyHumanHandoffTx(tx, {
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      leadId: params.leadId,
      reason: params.reason,
      agentId: params.agentId,
      userId: null,
    });
  });
}

/**
 * Handoff agente→agente. Valida o agente de destino, gera resumo do lead
 * (pra que o agente B já tenha contexto via camada LEAD), encerra a sessão
 * de A e re-despacha o runtime pro agente B responder a mesma mensagem.
 *
 * Retorna `{ handedOff: false }` quando o destino é inválido (pausado /
 * deletado) — nesse caso o caller deixa o agente A responder normalmente.
 */
async function performHandoffToAgent(params: {
  input: RunAgentInput;
  fromAgentId: string;
  fromSessionId: string;
  targetAgentId: string;
  handoffDepth: number;
}): Promise<{ handedOff: true } | { handedOff: false }> {
  const { input, fromAgentId, fromSessionId, targetAgentId, handoffDepth } = params;

  // Valida o agente de destino ANTES de encerrar a sessão de A — destino
  // inválido não pode deixar a conversa órfã.
  const target = await withWorkspace(input.workspaceId, async (tx) =>
    tx.aiAgent.findFirst({
      where: { id: targetAgentId, workspaceId: input.workspaceId, deletedAt: null },
      select: { id: true, status: true },
    }),
  );
  if (!target || target.status !== 'active') {
    reportNonFatal('agents.runtime.handoff_agent_invalid', new Error('TARGET_AGENT_NOT_ACTIVE'), {
      workspaceId: input.workspaceId,
      fromAgentId,
      targetAgentId,
    });
    return { handedOff: false };
  }

  // Resumo do lead pela sessão de A — alimenta a camada LEAD que o agente B
  // lê no `assembleContext`. Best-effort.
  try {
    await refreshLeadSummary({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      agentId: fromAgentId,
      sessionId: fromSessionId,
    });
  } catch (err) {
    reportNonFatal('agents.runtime.handoff_agent_summary', err, {
      workspaceId: input.workspaceId,
      fromAgentId,
      targetAgentId,
    });
  }

  await withWorkspace(input.workspaceId, async (tx) => {
    await applyAgentHandoffTx(tx, {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      leadId: input.leadId,
      fromAgentId,
      toAgentId: targetAgentId,
    });
  });

  // Re-despacha o agente de destino pra responder a MESMA mensagem inbound.
  // handoffDepth+1 — o cap MAX_HANDOFF_DEPTH impede B re-passar pra C.
  const nested = await runAgentForInboundMessage(
    { ...input, agentId: targetAgentId },
    handoffDepth + 1,
  );
  if (!nested.ok) {
    reportNonFatal('agents.runtime.handoff_agent_nested_failed', new Error(nested.reason), {
      workspaceId: input.workspaceId,
      targetAgentId,
    });
  }

  return { handedOff: true };
}

// ════════════════════════════════════════════════════════════════════════════
// Job de lead_summary (M11#6)
// ════════════════════════════════════════════════════════════════════════════

interface RefreshLeadSummaryInput {
  workspaceId: string;
  leadId: string;
  agentId: string;
  /** Sessão de onde puxar as mensagens recentes pra consolidar. */
  sessionId: string;
}

/**
 * Regenera `lead_summaries.summary` (sem throttle — chamada forçada). Puxa as
 * mensagens recentes da sessão, consolida via Claude (`updateLeadSummary`) e
 * faz upsert. Registra o uso em `usage_events feature='lead_summary'`.
 */
export async function refreshLeadSummary(input: RefreshLeadSummaryInput): Promise<void> {
  const messages = await prisma.agentMessage.findMany({
    where: { sessionId: input.sessionId, workspaceId: input.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: LEAD_SUMMARY_TAKE,
    select: { direction: true, body: true },
  });
  if (messages.length < LEAD_SUMMARY_MIN_MESSAGES) return;

  const recentMessages = [...messages].reverse().map((m) => ({
    role: (m.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }));

  const existing = await prisma.leadSummary.findUnique({
    where: { leadId: input.leadId },
    select: { summary: true },
  });

  const result = await updateLeadSummary({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    agentId: input.agentId,
    recentMessages,
    existingSummary: existing?.summary ?? null,
  });

  await withWorkspace(input.workspaceId, async (tx) => {
    await tx.leadSummary.upsert({
      where: { leadId: input.leadId },
      create: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        summary: result.newSummary,
        updatedByAgentId: input.agentId,
      },
      update: {
        summary: result.newSummary,
        updatedByAgentId: input.agentId,
      },
    });
  });

  void recordUsage({
    workspaceId: input.workspaceId,
    eventKind: UsageEventKind.agent_call,
    feature: 'lead_summary',
    model: result.model,
    usage: result.usage,
    entityKind: 'lead',
    entityId: input.leadId,
  }).catch((err) =>
    reportNonFatal('agents.runtime.lead_summary_usage', err, {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
    }),
  );
}

/**
 * Versão throttled de `refreshLeadSummary` — usada no Step 10 de cada turno.
 * Regenera o resumo só quando a sessão acumulou ≥ `LEAD_SUMMARY_REFRESH_THRESHOLD`
 * mensagens novas desde a última atualização (ou quando ainda não há resumo).
 * Evita gastar tokens de consolidação a cada turno.
 */
export async function maybeRefreshLeadSummary(input: RefreshLeadSummaryInput): Promise<void> {
  const existing = await prisma.leadSummary.findUnique({
    where: { leadId: input.leadId },
    select: { updatedAt: true },
  });

  if (existing) {
    const newSince = await prisma.agentMessage.count({
      where: {
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        createdAt: { gt: existing.updatedAt },
      },
    });
    if (newSince < LEAD_SUMMARY_REFRESH_THRESHOLD) return;
  }

  await refreshLeadSummary(input);
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers de dispatch (chamados pelo webhook)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estado de dispatch da conversa pro webhook decidir (M11#6):
 *   - `aiEnabled=false` → handoff agente→humano ativo, NÃO despacha agente.
 *   - `stickyAgentId` → conversa já tem agente dono (sessão production aberta);
 *     o webhook pula o roteador e continua com esse agente entre turnos.
 *
 * Server-only. Read-only via `withWorkspace` (RLS + defense-in-depth).
 */
export async function loadConversationDispatchState(
  workspaceId: string,
  conversationId: string,
): Promise<{ aiEnabled: boolean; stickyAgentId: string | null }> {
  return withWorkspace(workspaceId, async (tx) => {
    const conv = await tx.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: { aiEnabled: true },
    });
    if (!conv || !conv.aiEnabled) {
      return { aiEnabled: false, stickyAgentId: null };
    }

    // Sessão aberta cujo agente ainda está ativo. Filtra `agent.status` no
    // `where`: se o agente dono foi pausado/deletado, a sessão sticky é
    // ignorada e o webhook cai pro roteador (outro agente ativo pode assumir),
    // em vez de a conversa ficar presa num agente que não responde mais.
    const openSession = await tx.agentSession.findFirst({
      where: {
        workspaceId,
        conversationId,
        kind: 'production',
        endedAt: null,
        agent: { status: 'active', deletedAt: null },
      },
      orderBy: { startedAt: 'desc' },
      select: { agentId: true },
    });

    return { aiEnabled: true, stickyAgentId: openSession?.agentId ?? null };
  });
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
