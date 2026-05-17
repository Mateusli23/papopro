/**
 * Wrapper do Anthropic SDK (M11#2) — chamada non-streaming pra agentes.
 *
 * **Server-only.** `ANTHROPIC_API_KEY` NUNCA pode vazar pro browser. `server-only`
 * faz o Next bundler quebrar o build se algum Client Component importar daqui.
 *
 * **Lazy singleton.** Idem `lib/stripe/client.ts` — `Anthropic` instanciado na
 * primeira chamada, não no import. Build-time (Next collect page data) pode
 * importar sem `ANTHROPIC_API_KEY` setada sem crash.
 *
 * **Prompt caching obrigatório** (CLAUDE.md §6). System prompt + chunks do
 * Cérebro entram em system blocks separados com `cache_control: ephemeral`.
 * Max 4 breakpoints por request — reservamos 1 pro system, até 3 pros
 * cacheableBlocks; se vierem mais, consolidamos numa string só com 1 breakpoint.
 *
 * **Retry.** O SDK Anthropic já retry 429/5xx com backoff exponencial via
 * `maxRetries` na construction (default 2). Setamos 3. Não reimplementamos —
 * confiar no SDK é mais estável que rolar nosso loop.
 *
 * **Non-streaming.** Decisão M11#2: resposta inteira de uma vez. Agentes de
 * vendas respondem msgs WhatsApp (poucos tokens, baixa latência ≠ urgente).
 * Quando precisar streaming (M11#3 chat simulação real-time), refatora pra
 * `client.messages.stream({...}).finalMessage()`.
 *
 * **Persistência fica fora.** `complete()` retorna `{ text, usage, model }` —
 * caller chama `recordUsage()` (em `usage.ts`) + persiste `agent_message` no
 * banco separadamente. Desacopla wrapper de API ↔ side-effects de DB.
 */
import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { type TokenUsage, getDefaultAnthropicModel } from './pricing';

/** Default `max_tokens`. 4096 é confortável pra resposta de agente em chat
 *  WhatsApp (mensagem cabe em ~500 tokens; sobra muita folga). Caller pode
 *  override pra casos especiais (resumo longo, geração de roteiro). */
const DEFAULT_MAX_TOKENS = 4096;

/** Anthropic permite até 4 `cache_control` breakpoints por request.
 *  Reservamos 1 pro system, sobram 3 pros cacheableBlocks. */
const MAX_CACHEABLE_BLOCKS = 3;

let cached: Anthropic | null = null;

/**
 * Retorna o Anthropic client. Lança em falta de `ANTHROPIC_API_KEY` — sem
 * fallback silencioso (igual `lib/stripe/client.ts`).
 */
export function getAnthropic(): Anthropic {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY ausente — configure em .env.local.');
  }

  cached = new Anthropic({
    apiKey,
    // SDK retry built-in: backoff exponencial em 429/5xx. 3 tentativas total
    // (default é 2). Aumentar mais começa a virar latência pro usuário.
    maxRetries: 3,
  });

  return cached;
}

export interface CompleteInput {
  /** Workspace dono — caller usa pra `recordUsage` + persistência. Aqui só
   *  passa adiante pra debug e pra que o tipo deixe explícito o contexto. */
  workspaceId: string;
  /** ID da `agent_session` (M11#1) quando production. Opcional pra calls
   *  one-shot (ex: gerar resumo de lead em background). */
  sessionId?: string;
  /** Free-form (igual `usage_events.feature`): `agent_chat` | `lead_summary` |
   *  ... — caller usa pra recordUsage. Aqui é só pra logging. */
  feature: string;
  /** System prompt principal (persona + tom + instruções do agente).
   *  Vira o PRIMEIRO system block com cache_control ephemeral. */
  system: string;
  /** Chunks adicionais cacheáveis (top-K do Cérebro, lead summary, etc).
   *  Até 3 blocks com cache_control. Mais que isso → consolidados num único
   *  block (sacrifica granularidade de cache hit, mantém o teto Anthropic). */
  cacheableBlocks?: string[];
  /** Mensagens da conversa (sessão atual). Última deve ser `user`. */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Override do `max_tokens`. Default 4096. */
  maxTokens?: number;
  /** Override do modelo. Default vem de `getDefaultAnthropicModel()` (env
   *  `ANTHROPIC_MODEL` → fallback `claude-sonnet-4-6`). */
  model?: string;
}

export interface CompleteResult {
  /** Texto consolidado de todos os content blocks `text` da resposta.
   *  (Resposta pode ter múltiplos text blocks; juntamos sem separador). */
  text: string;
  /** Tokens normalizados pro `TokenUsage` consumido por `pricing.ts`/
   *  `usage.ts`. `cacheRead`/`cacheCreation` ≠ 0 indica caching efetivo. */
  usage: TokenUsage;
  /** Modelo que de fato atendeu (Anthropic devolve no response — útil pra
   *  audit + recordUsage). */
  model: string;
  /** `end_turn` | `max_tokens` | `tool_use` | `stop_sequence` | `refusal` |
   *  `pause_turn`. Caller pode reagir a `refusal` (esconder resposta, etc). */
  stopReason: Anthropic.Messages.Message['stop_reason'];
}

/**
 * Monta os system blocks com `cache_control: ephemeral`.
 *
 * Estratégia:
 *  - 1 block pro `input.system` (sempre cacheable)
 *  - até 3 blocks pros `cacheableBlocks` (cada um com cache_control)
 *  - se vierem >3 cacheableBlocks, junta tudo em 1 só com cache_control no
 *    fim (sacrifica granularidade do cache mas respeita o teto Anthropic
 *    de 4 breakpoints)
 *
 * **Ordem importa pro cache.** Conteúdo mais ESTÁVEL primeiro — system
 * prompt (raramente muda) → cacheableBlocks (mudam quando o KB do workspace
 * muda). Caller deve passar blocks já em ordem de estabilidade decrescente.
 */
function buildSystemBlocks(
  systemText: string,
  cacheableBlocks: string[] | undefined,
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [
    { type: 'text', text: systemText, cache_control: { type: 'ephemeral' } },
  ];

  if (!cacheableBlocks || cacheableBlocks.length === 0) {
    return blocks;
  }

  if (cacheableBlocks.length <= MAX_CACHEABLE_BLOCKS) {
    for (const text of cacheableBlocks) {
      blocks.push({ type: 'text', text, cache_control: { type: 'ephemeral' } });
    }
    return blocks;
  }

  // Mais de 3 blocks: consolida num único block. Separador legível pra
  // que Claude entenda como chunks distintos no prompt.
  blocks.push({
    type: 'text',
    text: cacheableBlocks.join('\n\n---\n\n'),
    cache_control: { type: 'ephemeral' },
  });
  return blocks;
}

/**
 * Chama Claude com prompt caching e retorna texto + usage normalizado.
 *
 * **Não persiste nada.** Caller é responsável por:
 *   - chamar `recordUsage(...)` com o `usage` retornado
 *   - persistir `agent_message` no banco com os tokens
 *
 * Esse split mantém `claude.ts` puramente um wrapper de API (testável sem
 * tocar Prisma) e centraliza side-effects em `usage.ts` + Server Actions.
 */
export async function complete(input: CompleteInput): Promise<CompleteResult> {
  const client = getAnthropic();
  const model = input.model ?? getDefaultAnthropicModel();
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;

  const systemBlocks = buildSystemBlocks(input.system, input.cacheableBlocks);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Filtra apenas text blocks. Em non-streaming sem tools, resposta sempre
  // é text — mas o tipo é `ContentBlock[]` (discriminated union), então
  // narrow explicitamente pra evitar TS error em `block.text`.
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const usage: TokenUsage = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    // Anthropic SDK retorna null/undefined quando caching não foi exercitado.
    // Normalizamos pra 0 — caller não precisa de guards.
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheCreation: response.usage.cache_creation_input_tokens ?? 0,
  };

  return {
    text,
    usage,
    model: response.model,
    stopReason: response.stop_reason,
  };
}
