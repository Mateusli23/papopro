/**
 * Wrapper do OpenAI embeddings SDK (M11#2) — gera vetores 1536-dim do
 * "text-embedding-3-small" pro RAG do Cérebro da Empresa (camada EMPRESA
 * da memória 3 camadas, CLAUDE.md §6).
 *
 * **Server-only.** `OPENAI_API_KEY` é secret; nunca expor pro browser.
 *
 * **Lazy singleton.** Mesma razão de `claude.ts`/`stripe/client.ts`.
 *
 * **Batch + cache local.** OpenAI aceita até 2048 inputs por request; usamos
 * 96 como bucket conservador (alinha com docs OpenAI "batch up to 96 for
 * latency-sensitive workloads"). Cache local em `Map` por sha1(text+model) —
 * evita re-embed do mesmo chunk durante re-indexação. **Não persiste entre
 * cold starts** (deliberado — versionamento real fica em `knowledge_embeddings`
 * via `upsertChunkEmbedding`).
 *
 * **`vector(1536)` via $queryRaw.** Prisma 6 não tipa pgvector nativamente
 * (decisão M11#1 — coluna `Unsupported("vector(1536)")`). Upserts via
 * `$executeRaw` casting `text → vector` no Postgres.
 */
import 'server-only';

import { createHash } from 'node:crypto';

import OpenAI from 'openai';

import { prisma } from '@papopro/db';

import { type TokenUsage, getDefaultEmbeddingModel } from './pricing';

/** Batch size pra `embeddings.create`. OpenAI aceita até 2048, mas 96 é o
 *  ponto onde latência e custo de retry balanceiam pra workloads agentic. */
const BATCH_SIZE = 96;

/** Cache local em memória — sha1(text + model) → embedding vector. Não
 *  persiste entre cold starts. Limite implícito = heap do processo (não
 *  esperamos > 10k entries em vida normal de uma instância). */
const localCache = new Map<string, number[]>();

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY ausente — configure em .env.local.');
  }

  cached = new OpenAI({
    apiKey,
    // OpenAI SDK também tem retry built-in. Default 2 → setamos 3 (mesma
    // política do Anthropic SDK em `claude.ts`).
    maxRetries: 3,
  });

  return cached;
}

/**
 * Hash determinístico (sha1) do par (text, model). Usado como chave de cache
 * local. SHA-1 escolhido por velocidade — colisão acidental não é problema
 * de segurança aqui (cache miss reembeda; pior caso é re-cost de 1 chamada).
 */
export function hashEmbeddingInput(text: string, model: string): string {
  return createHash('sha1').update(`${model}\n${text}`).digest('hex');
}

export interface EmbedTextsInput {
  workspaceId: string;
  texts: string[];
  /** Override do modelo. Default `getDefaultEmbeddingModel()`. */
  model?: string;
}

export interface EmbedTextsResult {
  /** Embeddings na MESMA ordem dos inputs (cache hits intercalados). */
  embeddings: number[][];
  /** Tokens efetivamente cobrados (cache hits NÃO contam). Caller usa pra
   *  `recordUsage(eventKind=embedding_call)`. */
  usage: TokenUsage;
  /** Modelo que de fato atendeu. */
  model: string;
  /** Quantos inputs vieram do cache (instrumentação). */
  cacheHits: number;
}

/**
 * Gera embeddings pra um array de textos. Deduplica via cache local + chama
 * OpenAI em batches.
 *
 * Retorna embeddings na **mesma ordem do input**. Caller pode `zip` com
 * `chunkIds[]` pra persistir via `upsertChunkEmbedding`.
 *
 * **Não persiste.** Caller chama `recordUsage(...)` + `upsertChunkEmbedding(...)`
 * separadamente — mesma estratégia de `claude.ts` (wrapper de API ↔ side-effects).
 */
export async function embedTexts(input: EmbedTextsInput): Promise<EmbedTextsResult> {
  const model = input.model ?? getDefaultEmbeddingModel();
  const texts = input.texts;

  if (texts.length === 0) {
    return {
      embeddings: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      model,
      cacheHits: 0,
    };
  }

  const hashes = texts.map((t) => hashEmbeddingInput(t, model));
  const embeddings: Array<number[] | null> = hashes.map((h) => localCache.get(h) ?? null);

  // Coleta apenas índices que precisam embed (cache miss).
  const missIndices: number[] = [];
  const missTexts: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (embeddings[i] === null) {
      missIndices.push(i);
      const textValue = texts[i];
      // Sanity check pra TS strict — texts[i] está garantido por bounds checking
      // do for loop, mas TS quer prova explícita.
      missTexts.push(textValue ?? '');
    }
  }

  const cacheHits = texts.length - missIndices.length;

  if (missIndices.length === 0) {
    return {
      embeddings: embeddings as number[][], // todos preenchidos via cache
      usage: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      model,
      cacheHits,
    };
  }

  const client = getOpenAI();
  let totalInputTokens = 0;
  let lastModel = model;

  // Processa em batches de BATCH_SIZE pra ficar dentro dos limites da API.
  for (let start = 0; start < missTexts.length; start += BATCH_SIZE) {
    const batch = missTexts.slice(start, start + BATCH_SIZE);
    const batchIndices = missIndices.slice(start, start + BATCH_SIZE);

    const response = await client.embeddings.create({
      model,
      input: batch,
    });

    // OpenAI retorna na mesma ordem do input do batch.
    for (let j = 0; j < response.data.length; j++) {
      const dataItem = response.data[j];
      const targetIdx = batchIndices[j];
      if (!dataItem || targetIdx === undefined) continue;
      const vec = dataItem.embedding;
      embeddings[targetIdx] = vec;

      // Persiste no cache local — texts[targetIdx] é o original (não missTexts).
      const targetText = texts[targetIdx];
      if (typeof targetText === 'string') {
        const hash = hashEmbeddingInput(targetText, model);
        localCache.set(hash, vec);
      }
    }

    totalInputTokens += response.usage.prompt_tokens;
    lastModel = response.model;
  }

  return {
    embeddings: embeddings as number[][],
    usage: {
      input: totalInputTokens,
      output: 0, // Embeddings não têm output tokens.
      cacheRead: 0,
      cacheCreation: 0,
    },
    model: lastModel,
    cacheHits,
  };
}

export interface UpsertChunkEmbeddingInput {
  workspaceId: string;
  chunkId: string;
  vector: number[];
  model: string;
}

/**
 * Persiste embedding em `knowledge_embeddings` (M11#1) via `$executeRaw`.
 *
 * **Por que raw.** `embedding vector(1536)` é `Unsupported` no Prisma (decisão
 * M11#1) — só lemos/escrevemos via SQL bruto. ON CONFLICT (chunk_id) DO UPDATE
 * implementa o re-embed (mudou modelo → reescreve vetor mantendo chunk).
 *
 * **Caller deve estar dentro de `withWorkspace(tx)`** quando possível pra
 * RLS proteger por workspace_id. Pra background jobs que rodam fora de
 * request context (ex: Edge Function), usar `prisma.$executeRaw` direto
 * com workspace_id explícito no payload (RLS via current_workspace_id()
 * só funciona com SET LOCAL).
 *
 * Por simplicidade, esse helper usa `prisma` global (sem RLS). Caller que
 * precisar RLS deve replicar o $executeRaw dentro de `withWorkspace`.
 */
export async function upsertChunkEmbedding(input: UpsertChunkEmbeddingInput): Promise<void> {
  if (input.vector.length !== 1536) {
    throw new Error(
      `upsertChunkEmbedding: vector tem ${input.vector.length} dims, esperado 1536 (text-embedding-3-small).`,
    );
  }

  // pgvector aceita `'[v1,v2,...,vN]'::vector`. JSON.stringify produz o
  // formato exato (já com colchetes), só precisamos castar pra vector.
  const vectorLiteral = JSON.stringify(input.vector);

  await prisma.$executeRaw`
    INSERT INTO knowledge_embeddings (chunk_id, workspace_id, embedding, model)
    SELECT ${input.chunkId}::uuid, kc.workspace_id, ${vectorLiteral}::vector, ${input.model}
    FROM knowledge_chunks kc
    WHERE kc.id = ${input.chunkId}::uuid
    ON CONFLICT (chunk_id) DO UPDATE
      SET embedding = EXCLUDED.embedding,
          model = EXCLUDED.model,
          created_at = NOW()
  `;
}

/** Limpa o cache local — útil em tests + também se houver evidência de
 *  pressão de memória em produção (PostHog event futuro). */
export function clearEmbeddingCache(): void {
  localCache.clear();
}

/** Tamanho atual do cache — útil pra smoke + observability. */
export function getEmbeddingCacheSize(): number {
  return localCache.size;
}
