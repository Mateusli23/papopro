/**
 * Detector de intenção comercial (M11#6) — gatilho de handoff `commercial_intent`.
 *
 * Classifica se a última mensagem do lead indica que ele quer FECHAR negócio
 * agora (contratar, comprar, assinar, pedir proposta pra fechar, perguntar
 * como pagar). Quando positivo, o runtime faz handoff agente→humano — o
 * vendedor assume a etapa de fechamento.
 *
 * **Modelo Haiku, não Sonnet.** Classificação binária não precisa do modelo
 * caro. Haiku 4.5 é ~4× mais barato (`pricing.ts`) e responde em <1s — roda
 * a cada turno quando o gatilho está ligado. Override via `ANTHROPIC_INTENT_MODEL`.
 *
 * **Não persiste.** Igual `claude.ts`: retorna `{ detected, usage, model }`;
 * caller (`runtime.ts`) chama `recordUsage` separado.
 */
import 'server-only';

import { complete } from './claude';
import type { TokenUsage } from './pricing';

/** Haiku 4.5 — barato + rápido pra classificação binária. */
const INTENT_MODEL = process.env.ANTHROPIC_INTENT_MODEL || 'claude-haiku-4-5';

/** Resposta curta — só precisa de "sim"/"nao". */
const INTENT_MAX_TOKENS = 16;

const INTENT_SYSTEM =
  'Você classifica mensagens de leads num CRM de vendas. Decida se a ÚLTIMA mensagem do lead ' +
  'indica intenção comercial de fechar negócio agora — quer contratar, comprar, assinar, ' +
  'pedir proposta/orçamento para fechar, ou perguntar como pagar. Dúvida geral, pesquisa de ' +
  'preço sem compromisso ou conversa inicial NÃO contam. Responda APENAS com "sim" ou "nao", ' +
  'sem pontuação nem explicação.';

export interface DetectCommercialIntentInput {
  workspaceId: string;
  /** ID da `agent_session` ativa — só pra logging em `claude.complete`. */
  sessionId?: string;
  /** Mensagem inbound do lead a classificar. */
  latestUserMessage: string;
  /** Algumas mensagens recentes da conversa pra dar contexto (opcional). */
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface DetectCommercialIntentResult {
  /** `true` = intenção de fechar detectada. */
  detected: boolean;
  usage: TokenUsage;
  model: string;
}

/**
 * Monta o prompt do classificador. Pura — exportada pro smoke.
 *
 * Inclui até as últimas mensagens da conversa como contexto e destaca a
 * mensagem a classificar no fim.
 */
export function buildIntentPrompt(
  latestUserMessage: string,
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): string {
  const lines: string[] = [];

  if (recentMessages.length > 0) {
    lines.push('**Conversa recente:**');
    for (const m of recentMessages) {
      lines.push(`- ${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`);
    }
    lines.push('');
  }

  lines.push('**Mensagem a classificar (última do lead):**');
  lines.push(latestUserMessage.trim());
  lines.push('');
  lines.push('Há intenção comercial de fechar agora? Responda só "sim" ou "nao".');

  return lines.join('\n');
}

/**
 * Interpreta a resposta do modelo. Pura — exportada pro smoke. Procura "sim"
 * como primeira palavra; qualquer outra coisa (inclusive resposta vazia ou
 * inesperada) é tratada como `false` — fail-safe: na dúvida, não escala.
 */
export function parseIntentAnswer(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return /^sim\b/.test(normalized);
}

/**
 * Classifica intenção comercial via Haiku. Lança se `ANTHROPIC_API_KEY`
 * estiver ausente (igual `claude.complete`) — caller deve tratar.
 */
export async function detectCommercialIntent(
  input: DetectCommercialIntentInput,
): Promise<DetectCommercialIntentResult> {
  const result = await complete({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    feature: 'intent_detection',
    system: INTENT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildIntentPrompt(input.latestUserMessage, input.recentMessages),
      },
    ],
    model: INTENT_MODEL,
    maxTokens: INTENT_MAX_TOKENS,
  });

  return {
    detected: parseIntentAnswer(result.text),
    usage: result.usage,
    model: result.model,
  };
}
