/**
 * Helpers transacionais de handoff (M11#6) — camada de DB, SEM Claude.
 *
 * Separado de `runtime.ts` de propósito: `runtime.ts` importa `lib/ai/claude`
 * (SDK Anthropic pesado). Estes helpers são puro Prisma e precisam ser
 * importáveis de Server Actions leves (`handoff-actions.ts`, `leads/actions.ts`)
 * sem arrastar o SDK de IA pro bundle daquelas features.
 *
 * Três operações:
 *   - `applyHumanHandoffTx`   — encerra sessões + `conversation.ai_enabled=false`
 *     + Activity + audit. Usada por todos os 5 gatilhos agente→humano.
 *   - `applyAgentHandoffTx`   — encerra a sessão do agente A + Activity + audit
 *     (o `runtime.ts` re-despacha o agente B em seguida).
 *   - `maybeHandoffOnStageChange` — hook chamado de dentro da tx de
 *     `moveLeadToStageAction`/`updateLeadAction`: se o lead entrou na etapa
 *     configurada no gatilho `stage_negotiation`, dispara o handoff humano.
 *
 * **Server-only.** Toca DB direto via `Prisma.TransactionClient` passado pelo
 * caller — sempre roda dentro de uma tx `withWorkspace` (RLS ativa).
 */
import 'server-only';

import { type Prisma } from '@papopro/db';

import {
  endedReasonForHandoff,
  findHandoffTrigger,
  handoffReasonLabel,
  parseHandoffConfig,
} from '@/lib/ai/handoff';

import type { HandoffTriggerKind } from './types';

/** Motivos válidos de handoff agente→humano (exclui `agent_to_agent`). */
export type HumanHandoffReason = Exclude<HandoffTriggerKind, 'agent_to_agent'>;

export interface ApplyHumanHandoffInput {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  reason: HumanHandoffReason;
  /** Agente que estava atendendo. `null` quando a conversa não tinha agente
   *  (ex: handoff manual numa conversa que nunca teve IA). */
  agentId?: string | null;
  /** User que disparou o handoff (handoff manual via botão). `null` nos
   *  handoffs automáticos disparados pelo runtime/job. */
  userId?: string | null;
}

export interface ApplyHumanHandoffResult {
  endedSessionCount: number;
  /** `true` se a conversa já estava em mãos humanas — handoff é no-op. */
  alreadyHumanHandled: boolean;
}

/**
 * Executa o handoff agente→humano dentro da tx do caller:
 *   1. encerra todas as `agent_sessions` production ativas da conversa
 *   2. `conversation.ai_enabled = false` (roteador passa a pular a conversa)
 *   3. Activity `note` na timeline do lead
 *   4. audit `handoff_triggered`
 *
 * **Idempotente** — se a conversa já está com `ai_enabled=false`, não
 * re-registra Activity/audit (evita ruído quando 2 gatilhos batem juntos).
 */
export async function applyHumanHandoffTx(
  tx: Prisma.TransactionClient,
  input: ApplyHumanHandoffInput,
): Promise<ApplyHumanHandoffResult> {
  const conv = await tx.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    select: { aiEnabled: true },
  });
  if (!conv) return { endedSessionCount: 0, alreadyHumanHandled: false };
  if (!conv.aiEnabled) return { endedSessionCount: 0, alreadyHumanHandled: true };

  const ended = await tx.agentSession.updateMany({
    where: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      kind: 'production',
      endedAt: null,
    },
    data: { endedAt: new Date(), endedReason: endedReasonForHandoff(input.reason) },
  });

  await tx.conversation.update({
    where: { id: input.conversationId },
    data: { aiEnabled: false },
  });

  await tx.activity.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      type: 'note',
      // authorId=null: handoff é evento de sistema (mesmo o manual — quem
      // clicou fica registrado no audit `userId`, não na timeline).
      authorId: null,
      body: handoffReasonLabel(input.reason),
      meta: {
        handoff: true,
        direction: 'human',
        reason: input.reason,
        agentId: input.agentId ?? null,
        conversationId: input.conversationId,
      } as Prisma.InputJsonValue,
    },
  });

  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      action: 'handoff_triggered',
      entityType: 'conversation',
      entityId: input.conversationId,
      changes: {
        direction: 'human',
        reason: input.reason,
        agentId: input.agentId ?? null,
        leadId: input.leadId,
        endedSessions: ended.count,
      } as Prisma.InputJsonValue,
    },
  });

  return { endedSessionCount: ended.count, alreadyHumanHandled: false };
}

export interface ApplyAgentHandoffInput {
  workspaceId: string;
  conversationId: string;
  leadId: string;
  fromAgentId: string;
  toAgentId: string;
}

/**
 * Encerra a sessão do agente de origem num handoff agente→agente + registra
 * Activity/audit. `conversation.ai_enabled` continua `true` — a conversa
 * segue com IA, só troca de agente. O caller (`runtime.ts`) re-despacha o
 * agente de destino logo após.
 */
export async function applyAgentHandoffTx(
  tx: Prisma.TransactionClient,
  input: ApplyAgentHandoffInput,
): Promise<{ endedSessionCount: number }> {
  const ended = await tx.agentSession.updateMany({
    where: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      agentId: input.fromAgentId,
      kind: 'production',
      endedAt: null,
    },
    data: { endedAt: new Date(), endedReason: endedReasonForHandoff('agent_to_agent') },
  });

  await tx.activity.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      type: 'note',
      authorId: null,
      body: handoffReasonLabel('agent_to_agent'),
      meta: {
        handoff: true,
        direction: 'agent',
        reason: 'agent_to_agent',
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        conversationId: input.conversationId,
      } as Prisma.InputJsonValue,
    },
  });

  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: 'handoff_triggered',
      entityType: 'conversation',
      entityId: input.conversationId,
      changes: {
        direction: 'agent',
        reason: 'agent_to_agent',
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        leadId: input.leadId,
      } as Prisma.InputJsonValue,
    },
  });

  return { endedSessionCount: ended.count };
}

export interface MaybeHandoffOnStageChangeInput {
  workspaceId: string;
  leadId: string;
  /** Etapa pra qual o lead acabou de ser movido. */
  newStageId: string;
  /** User que moveu o lead (vai pro audit). */
  userId?: string | null;
}

/**
 * Hook do gatilho `stage_negotiation`. Chamado de dentro da tx de
 * `moveLeadToStageAction`/`updateLeadAction` quando o `stageId` do lead muda.
 *
 * Para cada conversa do lead ainda com IA ativa: se o agente que a atende
 * tem o gatilho `stage_negotiation` ligado e o `config.stageId` casa com a
 * etapa nova, dispara o handoff agente→humano.
 *
 * **Sem chamada Claude** — roda numa Server Action voltada ao usuário
 * (Kanban drag). O resumo do lead fica a cargo do job de background; aqui só
 * o estado muda. Falha não deve quebrar o move do lead — caller decide se
 * envolve em try/catch (recomendado).
 */
export async function maybeHandoffOnStageChange(
  tx: Prisma.TransactionClient,
  input: MaybeHandoffOnStageChangeInput,
): Promise<void> {
  const conversations = await tx.conversation.findMany({
    where: { workspaceId: input.workspaceId, leadId: input.leadId, aiEnabled: true },
    select: { id: true },
  });
  if (conversations.length === 0) return;

  for (const conv of conversations) {
    const session = await tx.agentSession.findFirst({
      where: {
        workspaceId: input.workspaceId,
        conversationId: conv.id,
        kind: 'production',
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
      select: { agentId: true, agent: { select: { handoffConfig: true } } },
    });
    if (!session) continue;

    const trigger = findHandoffTrigger(
      parseHandoffConfig(session.agent.handoffConfig),
      'stage_negotiation',
    );
    if (!trigger?.enabled) continue;
    if (!trigger.config?.stageId || trigger.config.stageId !== input.newStageId) continue;

    await applyHumanHandoffTx(tx, {
      workspaceId: input.workspaceId,
      conversationId: conv.id,
      leadId: input.leadId,
      reason: 'stage_negotiation',
      agentId: session.agentId,
      userId: input.userId ?? null,
    });
  }
}
