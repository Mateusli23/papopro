/**
 * Orquestrador da memória em 3 camadas (M11#2) — CLAUDE.md §6.
 *
 *   - **SESSÃO** — últimas N msgs de `agent_messages`. Isolada por agente:
 *     mesmo lead pode falar com agente A e B em sessões separadas, cada
 *     uma com seu histórico.
 *   - **LEAD** — resumo em `lead_summaries.summary`. Compartilhado entre
 *     agentes do workspace. Atualizado por job (background) após interação.
 *   - **EMPRESA** — top-K via pgvector cosine (`<=>`) em `knowledge_embeddings`.
 *     Compartilhado por todos os agentes do workspace.
 *
 * **Server-only.** Acesso direto a Prisma + chamada de embeddings.
 *
 * **Sem persistência aqui.** Igual `claude.ts`/`embeddings.ts`: este módulo
 * monta o contexto e retorna. Caller (Server Action de M11#3) chama
 * `claude.complete(...)` com o resultado.
 */
import 'server-only';

import { prisma } from '@papopro/db';

import { complete } from './claude';
import { embedTexts } from './embeddings';

const DEFAULT_SESSION_MESSAGES_TAKE = 20;
const DEFAULT_TOP_K = 5;

export interface KnowledgeHit {
  chunkId: string;
  content: string;
  source: 'document' | 'structured_field';
  structuredField: string | null;
  documentId: string | null;
  /** Distância cosine (0 = idêntico; 2 = oposto). Menor = mais similar. */
  distance: number;
}

export interface AssembleContextInput {
  workspaceId: string;
  agentId: string;
  /** ID da `agent_session` ativa — usado pra puxar últimas msgs (camada SESSÃO).
   *  Opcional pra cenários sem sessão criada ainda (ex: simulation primeiro turno). */
  sessionId?: string;
  /** Lead da conversa — usado pra puxar `lead_summaries` (camada LEAD). Opcional
   *  pra simulation (sem lead real). */
  leadId?: string;
  /** Mensagem do usuário (lead) que dispara a resposta. Usada como query
   *  pro top-K do Cérebro. */
  latestUserMessage: string;
  /** Override do top-K. Default 5. */
  topK?: number;
  /** Override do limite de mensagens da sessão. Default 20. */
  sessionMessagesTake?: number;
}

export interface AssembledContext {
  /** Últimas N msgs da sessão em ordem cronológica crescente — formato pronto
   *  pra alimentar `claude.complete({ messages })`. */
  sessionMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Resumo do lead (camada LEAD) ou `null` se ainda não existe. */
  leadSummary: string | null;
  /** Top-K chunks recuperados do Cérebro (camada EMPRESA). */
  knowledgeChunks: KnowledgeHit[];
  /** Blocks pré-formatados pra passar como `cacheableBlocks` em
   *  `claude.complete(...)`. Inclui chunks do Cérebro + resumo do lead,
   *  na ordem de estabilidade (mais estável primeiro). */
  cacheableBlocks: string[];
}

/**
 * Busca top-K chunks do Cérebro via pgvector. Embeda a query, faz cosine
 * search nos embeddings do workspace, retorna `KnowledgeHit[]` ordenado por
 * distância ascendente (mais similar primeiro).
 *
 * Retorna `[]` se workspace ainda não tem KB indexada (sem rows em
 * `knowledge_embeddings`).
 *
 * **Não chama `recordUsage`** — caller que disparou (Server Action) faz isso
 * usando o `embedTexts` retornado dentro de `assembleContext`. Aqui retornamos
 * apenas os hits.
 */
export async function topKKnowledge(input: {
  workspaceId: string;
  queryVector: number[];
  k?: number;
}): Promise<KnowledgeHit[]> {
  const k = input.k ?? DEFAULT_TOP_K;
  if (input.queryVector.length !== 1536) {
    throw new Error(
      `topKKnowledge: queryVector tem ${input.queryVector.length} dims, esperado 1536.`,
    );
  }
  const vectorLiteral = JSON.stringify(input.queryVector);

  // pgvector cosine distance: ke.embedding <=> ${queryVec}::vector
  // Filtra workspace_id ANTES do ORDER BY pra HNSW filtering ser eficiente
  // (decisão M11#1 — workspace_id duplicado em knowledge_embeddings).
  const rows = await prisma.$queryRaw<
    Array<{
      chunk_id: string;
      content: string;
      source: 'document' | 'structured_field';
      structured_field: string | null;
      document_id: string | null;
      distance: number;
    }>
  >`
    SELECT
      kc.id AS chunk_id,
      kc.content,
      kc.source::text AS source,
      kc.structured_field,
      kc.document_id,
      (ke.embedding <=> ${vectorLiteral}::vector)::float AS distance
    FROM knowledge_embeddings ke
    JOIN knowledge_chunks kc ON kc.id = ke.chunk_id
    WHERE ke.workspace_id = ${input.workspaceId}::uuid
    ORDER BY ke.embedding <=> ${vectorLiteral}::vector
    LIMIT ${k}
  `;

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    content: r.content,
    source: r.source,
    structuredField: r.structured_field,
    documentId: r.document_id,
    distance: r.distance,
  }));
}

/**
 * Monta o contexto completo pra uma chamada do agente. 3 chamadas em paralelo
 * (DB sessão + DB lead + embed query) — depois resolve top-K do Cérebro.
 */
export async function assembleContext(input: AssembleContextInput): Promise<AssembledContext> {
  const topK = input.topK ?? DEFAULT_TOP_K;
  const sessionTake = input.sessionMessagesTake ?? DEFAULT_SESSION_MESSAGES_TAKE;

  // 1. SESSÃO + LEAD em paralelo (independentes).
  const [sessionMessagesRaw, leadSummary, queryEmbed] = await Promise.all([
    input.sessionId
      ? prisma.agentMessage.findMany({
          where: { sessionId: input.sessionId, workspaceId: input.workspaceId },
          orderBy: { createdAt: 'desc' },
          take: sessionTake,
          select: { direction: true, body: true },
        })
      : Promise.resolve([] as Array<{ direction: 'in' | 'out'; body: string }>),
    input.leadId
      ? prisma.leadSummary.findUnique({
          where: { leadId: input.leadId },
          select: { summary: true },
        })
      : Promise.resolve(null),
    embedTexts({
      workspaceId: input.workspaceId,
      texts: [input.latestUserMessage],
    }),
  ]);

  // 2. Top-K do Cérebro — depende do embedding da query.
  const firstEmbedding = queryEmbed.embeddings[0];
  const knowledgeChunks = firstEmbedding
    ? await topKKnowledge({
        workspaceId: input.workspaceId,
        queryVector: firstEmbedding,
        k: topK,
      })
    : [];

  // 3. Normaliza sessão: vem em desc, queremos asc cronológico.
  //    Direction 'in' (do lead) → role 'user'; 'out' (do agente) → 'assistant'.
  const sessionMessages = [...sessionMessagesRaw].reverse().map((m) => ({
    role: (m.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }));

  // 4. Monta cacheableBlocks na ordem de estabilidade:
  //    - chunks do Cérebro (mudam quando KB do workspace re-indexa)
  //    - resumo do lead (muda mais frequente que o Cérebro, mas só por lead)
  const cacheableBlocks: string[] = [];

  if (knowledgeChunks.length > 0) {
    const kbBlock = formatKnowledgeBlock(knowledgeChunks);
    cacheableBlocks.push(kbBlock);
  }

  if (leadSummary?.summary) {
    cacheableBlocks.push(`<lead-summary>\n${leadSummary.summary}\n</lead-summary>`);
  }

  return {
    sessionMessages,
    leadSummary: leadSummary?.summary ?? null,
    knowledgeChunks,
    cacheableBlocks,
  };
}

/**
 * Formata os chunks do Cérebro num único bloco de texto pra entrar em
 * `cacheableBlocks`. Cada chunk anotado com source pra que o agente saiba
 * citar (ex: "conforme o FAQ", "no documento Y").
 *
 * Exportado pra ser testável em smoke (puro, sem side effects).
 */
export function formatKnowledgeBlock(chunks: KnowledgeHit[]): string {
  const sections = chunks.map((c, i) => {
    const label =
      c.source === 'structured_field' ? `[${c.structuredField ?? 'campo'}]` : '[documento]';
    return `### Fonte ${i + 1} ${label}\n${c.content}`;
  });
  return `<knowledge-base>\n${sections.join('\n\n')}\n</knowledge-base>`;
}

export interface UpdateLeadSummaryInput {
  workspaceId: string;
  leadId: string;
  /** Agente que disparou a atualização — registrado em `updated_by_agent_id`. */
  agentId: string;
  /** Mensagens recentes da conversa pra consolidar. */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Resumo existente (se houver) — usado como base do prompt. */
  existingSummary: string | null;
}

/**
 * Atualiza `lead_summaries.summary` com base nas mensagens recentes. Chama
 * Claude com prompt fixo pra consolidar — desenhado pra rodar em background
 * (não bloqueia a resposta ao usuário).
 *
 * Retorna o `usage` da chamada Claude pra que caller chame `recordUsage`
 * (feature='lead_summary'). Caller também é responsável por persistir o
 * upsert em `lead_summaries`.
 */
export async function updateLeadSummary(input: UpdateLeadSummaryInput): Promise<{
  newSummary: string;
  usage: import('./pricing').TokenUsage;
  model: string;
}> {
  const prompt = buildSummaryPrompt(input.existingSummary, input.recentMessages);

  const result = await complete({
    workspaceId: input.workspaceId,
    feature: 'lead_summary',
    system:
      'Você consolida o histórico de conversa de um lead num resumo curto, em pt-BR, focado em: perfil, demandas, preferências e próxima ação sugerida. Máximo 300 palavras. Sem placeholders, sem prefácios.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  });

  return {
    newSummary: result.text.trim(),
    usage: result.usage,
    model: result.model,
  };
}

/**
 * Exportado pra smoke — verifica que o prompt monta corretamente.
 */
export function buildSummaryPrompt(
  existing: string | null,
  recent: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  const existingBlock = existing
    ? `**Resumo atual:**\n${existing}\n\n`
    : '**Resumo atual:** (vazio — primeira consolidação)\n\n';

  const messagesBlock = recent
    .map((m) => `- **${m.role === 'user' ? 'Lead' : 'Agente'}:** ${m.content}`)
    .join('\n');

  return `${existingBlock}**Mensagens recentes:**\n${messagesBlock}\n\nConsolide tudo num resumo único, atualizado.`;
}
