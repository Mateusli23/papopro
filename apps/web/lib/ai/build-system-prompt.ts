/**
 * Monta o system prompt do agente IA a partir do trio configurado (M11#3).
 *
 * Função pura — testável no smoke sem hit em API. Concatena persona + prompt
 * + tom num formato consistente que entra como 1º system block (cacheable
 * ephemeral) na chamada `claude.complete(...)`.
 *
 * **Ordem importa pro caching.** Conteúdo estável vem primeiro:
 *   1. Identificador do agente (nome) — raramente muda
 *   2. Persona — muda quando admin edita
 *   3. Tom — muda quando admin edita
 *   4. Prompt (instruções) — muda mais frequente (draft em edição)
 *
 * **Anti-overtrigger.** Opus 4.6+ segue instruções mais literalmente que
 * 4.5. Evitamos linguagem "CRITICAL: YOU MUST" — usamos imperativos diretos
 * em pt-BR (CLAUDE.md §5 microcopy).
 */

import type { AgentTone } from '@/features/agents/types';

const TONE_DESCRIPTIONS: Record<AgentTone, string> = {
  consultivo:
    'consultivo e analítico — faça perguntas estratégicas, traga insights, evite dar resposta pronta antes de entender o contexto',
  amigavel:
    'amigável e próximo — use linguagem cordial, demonstre empatia, mantenha leveza sem perder objetividade',
  direto:
    'direto e objetivo — respostas curtas, sem rodeios, foco no que importa pra fechar negócio',
  formal:
    'formal e institucional — tratamento por "senhor(a)", português correto, posture profissional',
};

export interface BuildSystemPromptInput {
  /** Nome do agente — usado pra ele se apresentar quando perguntado. */
  name: string;
  /** Persona livre (cargo, especialidade, contexto). Pode ser vazia. */
  persona: string;
  /** Instruções/comportamento principal. Pode ser vazia (template 'blank'). */
  prompt: string;
  /** Um dos 4 tons fechados (CLAUDE.md §9 glossário). */
  tone: AgentTone;
  /** Nome do workspace (opcional — usado pra que o agente saiba "onde trabalha"). */
  workspaceName?: string;
}

export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const lines: string[] = [];

  // 1. Identidade
  lines.push(
    `Você é ${input.name}, um agente de vendas atuando${
      input.workspaceName ? ` na empresa ${input.workspaceName}` : ''
    }.`,
  );

  // 2. Persona (se houver)
  if (input.persona.trim()) {
    lines.push('');
    lines.push(`**Sua persona:** ${input.persona.trim()}`);
  }

  // 3. Tom de voz
  lines.push('');
  lines.push(`**Tom de voz:** ${TONE_DESCRIPTIONS[input.tone]}.`);

  // 4. Instruções (prompt configurado)
  if (input.prompt.trim()) {
    lines.push('');
    lines.push('**Instruções:**');
    lines.push(input.prompt.trim());
  }

  // 5. Guardrails fixos — fim do prompt, não cacheável (na prática fica
  // no mesmo block mas é texto estável que sempre acompanha).
  lines.push('');
  lines.push('**Diretrizes gerais:**');
  lines.push('- Responda sempre em português brasileiro.');
  lines.push('- Quando não tiver informação suficiente, pergunte ao lead em vez de inventar.');
  lines.push('- Se o lead pedir pra falar com humano, sinalize com clareza que vai transferir.');
  lines.push('- Use as informações do <knowledge-base> e do <lead-summary> quando disponíveis.');

  return lines.join('\n');
}
