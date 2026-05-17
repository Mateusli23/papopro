/**
 * Tabela de preços de IA (M11#2) + conversão tokens → microdólares.
 *
 * **Por que microdólares.** `usage_events.cost_micros` é `bigint` em USD × 10^6
 * pra evitar float drift em SUM de milhões de rows. Cálculo: tokens × preço
 * por token em integer-arithmetic = cost_micros direto, sem ponto flutuante.
 *
 * **Por que `micros per 1M tokens`, não `micros per token`.** Vendors cotam em
 * USD por 1M tokens, e alguns preços ficam abaixo de 1 micro/token (cache
 * read Anthropic $0.30/1M = 0.3 micros/token; embeddings $0.02/1M = 0.02
 * micros/token). Armazenar como micros/token truncaria pra 0. Em micros/1M
 * todos os preços viram integer perfeito (3000000, 300000, 20000) e a
 * divisão final por 1M só perde até ~1 micro por chamada — irrelevante.
 *
 * **Cache pricing (Anthropic).** Prompt caching tem dois custos:
 *   - `cacheWrite` (cache_creation_input_tokens): 25% MAIS caro que input
 *     normal — primeira chamada que cria o cache paga isso
 *   - `cacheRead` (cache_read_input_tokens): 90% MAIS BARATO que input
 *     normal — chamadas seguintes (TTL 5min) pagam isso
 *
 * Source: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 * Source: https://openai.com/api/pricing/
 *
 * Mudança de preço = atualizar constants + bumpar version no commit.
 * Modelo novo = adicionar entry; modelo desconhecido em runtime → erro
 * propositivo (não silenciar com fallback que mascararia bug).
 */

/** Divisor pra converter `micros per 1M tokens` em `cost_micros`. */
const TOKENS_PER_PRICING_UNIT = 1_000_000n;

interface AnthropicPricing {
  /** USD × 10^6 por 1M input tokens */
  input: number;
  /** USD × 10^6 por 1M output tokens */
  output: number;
  /** USD × 10^6 por 1M cache_creation_input_tokens */
  cacheWrite: number;
  /** USD × 10^6 por 1M cache_read_input_tokens */
  cacheRead: number;
}

interface OpenAIPricing {
  /** USD × 10^6 por 1M input tokens */
  input: number;
  /** Sempre 0 em embeddings (não há output cobrado) */
  output: number;
}

/**
 * Preço por modelo Anthropic em micros por 1M tokens (USD × 10^6 / 1M tokens).
 *
 * Sonnet 4.6 default ([CLAUDE.md §2 IA](../../../../CLAUDE.md), env
 * `ANTHROPIC_MODEL`). Haiku 4.5 disponível pra workspaces que querem trocar
 * qualidade por custo (~4× mais barato).
 *
 * Snapshot: 2026-05-17. Bumpar quando Anthropic alterar pricing.
 */
export const ANTHROPIC_PRICING_MICROS_PER_MILLION: Record<string, AnthropicPricing> = {
  // Sonnet 4.6: $3/1M input, $15/1M output, $3.75/1M cache write, $0.30/1M cache read
  'claude-sonnet-4-6': {
    input: 3_000_000,
    output: 15_000_000,
    cacheWrite: 3_750_000,
    cacheRead: 300_000,
  },
  // Haiku 4.5: $0.80/1M input, $4/1M output, $1/1M cache write, $0.08/1M cache read
  'claude-haiku-4-5': {
    input: 800_000,
    output: 4_000_000,
    cacheWrite: 1_000_000,
    cacheRead: 80_000,
  },
};

/**
 * Preço por modelo OpenAI em micros por 1M tokens.
 *
 * `text-embedding-3-small` é o default (PRD §3.9 + .env.local.example).
 * 1536 dimensões, $0.02/1M tokens. Suficiente pra RAG do Cérebro.
 *
 * Embedding output não existe — só input é cobrado. `output` fica 0 por contrato.
 */
export const OPENAI_PRICING_MICROS_PER_MILLION: Record<string, OpenAIPricing> = {
  'text-embedding-3-small': { input: 20_000, output: 0 }, // $0.02/1M
  'text-embedding-3-large': { input: 130_000, output: 0 }, // $0.13/1M
};

/**
 * Token usage retornado pelos SDKs Anthropic/OpenAI, normalizado.
 *
 * Anthropic: `usage.input_tokens`, `usage.output_tokens`,
 *            `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens`.
 * OpenAI:    `usage.prompt_tokens` (mapeamos pra `input`; cache fields zeram
 *            porque OpenAI embeddings não suporta caching).
 */
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

/**
 * Custo da chamada em microdollars (USD × 10^6).
 *
 * **Lança em modelo desconhecido.** Sem fallback silencioso — caller que
 * passar `model='claude-foo'` precisa explicitar suporte (adicionar entrada
 * na constante ou ajustar config). Igual `lib/stripe/client.ts` lança em
 * falta de `STRIPE_SECRET_KEY`.
 *
 * **Retorna `bigint`** pra evitar overflow em SUM agregado. JavaScript Number
 * só vai até 2^53 = ~9 × 10^15 — agregação de microdollars de muitos workspaces
 * pode passar disso. bigint é seguro até 2^63 ≈ 9.2 × 10^18.
 */
export function computeCostMicros(model: string, usage: TokenUsage): bigint {
  const anth = ANTHROPIC_PRICING_MICROS_PER_MILLION[model];
  const oai = OPENAI_PRICING_MICROS_PER_MILLION[model];
  const pricing = anth ?? oai;
  if (!pricing) {
    throw new Error(
      `computeCostMicros: modelo "${model}" sem pricing configurado. Adicione em apps/web/lib/ai/pricing.ts.`,
    );
  }

  // Sanity check de input — bate-pronto pra evitar negativo virar billable.
  if (usage.input < 0 || usage.output < 0 || usage.cacheRead < 0 || usage.cacheCreation < 0) {
    throw new Error(
      `computeCostMicros: usage com valor negativo (${JSON.stringify(usage)}). Tokens devem ser ≥ 0.`,
    );
  }

  // Anthropic tem 4 categorias; OpenAI só input/output (cache fields zerados
  // pelo caller pra embeddings). Narrow explícito via type guard.
  const isAnthropic = (p: AnthropicPricing | OpenAIPricing): p is AnthropicPricing =>
    'cacheWrite' in p;
  const cacheWrite: number = isAnthropic(pricing) ? pricing.cacheWrite : 0;
  const cacheRead: number = isAnthropic(pricing) ? pricing.cacheRead : 0;

  const totalMicrosPerMillion =
    BigInt(usage.input) * BigInt(pricing.input) +
    BigInt(usage.output) * BigInt(pricing.output) +
    BigInt(usage.cacheCreation) * BigInt(cacheWrite) +
    BigInt(usage.cacheRead) * BigInt(cacheRead);

  // Divisão por 1M com truncamento — perda máxima de ~1 micro por chamada,
  // que somado em 10k calls/mês dá ~$0.01 de drift. Aceitável.
  return totalMicrosPerMillion / TOKENS_PER_PRICING_UNIT;
}

/**
 * Modelo default Anthropic. Permite override via env `ANTHROPIC_MODEL`.
 * Decisão fechada em M11#2: Sonnet 4.6 — qualidade alta, custo aceitável.
 * Haiku 4.5 disponível pra workspaces que aceitem qualidade menor por
 * 4× custo a menos.
 */
export function getDefaultAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
}

/**
 * Modelo default OpenAI embeddings. Permite override via env
 * `OPENAI_EMBEDDING_MODEL`. Decisão M11#2: `text-embedding-3-small` — 1536
 * dimensões, custo baixo, qualidade suficiente pra Cérebro do MVP.
 */
export function getDefaultEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
}
