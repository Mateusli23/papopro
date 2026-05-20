/**
 * Avaliação de handoffs (M11#6) — função pura, sem DB nem API.
 *
 * `handoff_config` (JSONB em `ai_agents`) carrega o estado dos 6 gatilhos.
 * Este módulo materializa esse JSONB num shape tipado e decide, dada uma
 * mensagem inbound, se algum handoff deve disparar.
 *
 * **Pura por design** (mesmo padrão de `router.ts`): testável no smoke sem
 * mocking. `runtime.ts` faz o loading do agente + a orquestração (encerrar
 * sessão, trocar agente, notificar humano); aqui só decidimos.
 *
 * **Escopo deste módulo — só os 3 gatilhos dirigidos pela mensagem inbound:**
 *   - `keyword`            → lead falou palavra configurada → humano
 *   - `commercial_intent`  → IA detectou intenção de fechar → humano
 *   - `agent_to_agent`     → lead falou palavra configurada → outro agente
 *
 * Os outros 3 disparam fora daqui:
 *   - `manual`                 → Server Action (botão "Assumir conversa")
 *   - `stage_negotiation`      → hook na mudança de etapa do lead
 *   - `outside_business_hours` → piggyback no bloqueio anti-ban do runtime
 */

import type { HandoffTriggerKind } from '@/features/agents/types';

import { matchesKeyword } from './router';

/** Os 6 gatilhos de handoff, na ordem do contrato M5 (`types.ts`). */
export const HANDOFF_KINDS: readonly HandoffTriggerKind[] = [
  'manual',
  'keyword',
  'commercial_intent',
  'stage_negotiation',
  'outside_business_hours',
  'agent_to_agent',
] as const;

/**
 * Estado de um gatilho já materializado a partir do JSONB. `config` carrega
 * os campos específicos por kind (palavras-chave, agente-alvo, etapa).
 */
export interface HandoffTriggerState {
  kind: HandoffTriggerKind;
  enabled: boolean;
  config?: {
    keywords?: string[];
    targetAgentId?: string;
    stageId?: string;
  };
}

/** Shape cru do JSONB `ai_agents.handoff_config`. */
interface HandoffConfigJson {
  [kind: string]:
    | { enabled?: boolean; keywords?: string[]; targetAgentId?: string; stageId?: string }
    | undefined;
}

/** Contexto da mensagem inbound pra avaliação. */
export interface InboundHandoffContext {
  /** Texto cru da mensagem do lead. */
  messageBody: string;
  /**
   * Resultado pré-computado do detector de intenção comercial (Haiku, roda
   * em `lib/ai/intent.ts`). `undefined` = não avaliado (gatilho desligado
   * ou detector ainda não rodou). Só `true` dispara o handoff.
   */
  commercialIntentDetected?: boolean;
}

/** Decisão de handoff dirigida pela mensagem inbound. O `keyword` e o
 *  `commercial_intent` são os únicos que `evaluateInboundHandoff` retorna pra
 *  humano — os outros 3 disparam fora deste módulo. */
export type HandoffDecision =
  | { target: 'human'; reason: 'keyword' | 'commercial_intent' }
  | { target: 'agent'; reason: 'agent_to_agent'; targetAgentId: string };

/**
 * Materializa o JSONB `handoff_config` num array fixo de 6 `HandoffTriggerState`
 * (sempre os 6 kinds, com defaults `enabled:false`). Gatilho ausente no JSONB
 * vira `{ enabled:false }`. Pura — testável no smoke.
 */
export function parseHandoffConfig(json: unknown): HandoffTriggerState[] {
  const cfg = (json ?? {}) as HandoffConfigJson;
  return HANDOFF_KINDS.map<HandoffTriggerState>((kind) => {
    const entry = cfg[kind] ?? {};
    const keywords = Array.isArray(entry.keywords)
      ? entry.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      : undefined;
    return {
      kind,
      enabled: entry.enabled === true,
      config:
        keywords?.length || entry.targetAgentId || entry.stageId
          ? {
              keywords,
              targetAgentId:
                typeof entry.targetAgentId === 'string' ? entry.targetAgentId : undefined,
              stageId: typeof entry.stageId === 'string' ? entry.stageId : undefined,
            }
          : undefined,
    };
  });
}

/** Acha o estado de um gatilho específico (ou `undefined` se não materializado). */
export function findHandoffTrigger(
  triggers: HandoffTriggerState[],
  kind: HandoffTriggerKind,
): HandoffTriggerState | undefined {
  return triggers.find((t) => t.kind === kind);
}

/** `true` se o gatilho existe e está ligado. */
export function isHandoffTriggerEnabled(
  triggers: HandoffTriggerState[],
  kind: HandoffTriggerKind,
): boolean {
  return findHandoffTrigger(triggers, kind)?.enabled === true;
}

/**
 * `true` se a mensagem contém qualquer uma das palavras como palavra inteira
 * (case-insensitive, boundary Unicode-aware — reusa `matchesKeyword` do
 * roteador M11#5). Lista vazia/ausente → `false` (sem palavras, não casa).
 */
export function matchesAnyKeyword(messageBody: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  return keywords.some((kw) => matchesKeyword(messageBody, kw));
}

/**
 * Decide se a mensagem inbound dispara um handoff. `null` = segue o fluxo
 * normal (o agente responde).
 *
 * **Precedência** (handoff pra humano ganha de handoff pra agente — escalar
 * pra humano é a opção conservadora):
 *   1. `keyword`            (lead pediu humano explicitamente)
 *   2. `commercial_intent`  (lead quer fechar — vendedor assume)
 *   3. `agent_to_agent`     (roteia pra agente especialista)
 */
export function evaluateInboundHandoff(
  triggers: HandoffTriggerState[],
  ctx: InboundHandoffContext,
): HandoffDecision | null {
  // 1. keyword → humano
  const keyword = findHandoffTrigger(triggers, 'keyword');
  if (keyword?.enabled && matchesAnyKeyword(ctx.messageBody, keyword.config?.keywords)) {
    return { target: 'human', reason: 'keyword' };
  }

  // 2. commercial_intent → humano
  const intent = findHandoffTrigger(triggers, 'commercial_intent');
  if (intent?.enabled && ctx.commercialIntentDetected === true) {
    return { target: 'human', reason: 'commercial_intent' };
  }

  // 3. agent_to_agent → outro agente (exige targetAgentId + keyword match)
  const a2a = findHandoffTrigger(triggers, 'agent_to_agent');
  if (
    a2a?.enabled &&
    a2a.config?.targetAgentId &&
    matchesAnyKeyword(ctx.messageBody, a2a.config?.keywords)
  ) {
    return {
      target: 'agent',
      reason: 'agent_to_agent',
      targetAgentId: a2a.config.targetAgentId,
    };
  }

  return null;
}

/** String pra `agent_sessions.ended_reason` (varchar 64) — padroniza o motivo. */
export function endedReasonForHandoff(reason: HandoffTriggerKind): string {
  return `handoff_${reason}`;
}

/** Microcopy pt-BR do motivo do handoff — usado na Activity timeline + audit. */
const HANDOFF_REASON_LABEL: Record<HandoffTriggerKind, string> = {
  manual: 'Conversa assumida manualmente por um humano.',
  keyword: 'Handoff para humano — o lead pediu atendimento humano.',
  commercial_intent: 'Handoff para humano — intenção comercial de fechar detectada.',
  stage_negotiation: 'Handoff para humano — lead avançou para a etapa Negociação.',
  outside_business_hours: 'Handoff para humano — mensagem recebida fora do horário comercial.',
  agent_to_agent: 'Handoff para outro agente IA.',
};

export function handoffReasonLabel(reason: HandoffTriggerKind): string {
  return HANDOFF_REASON_LABEL[reason];
}
