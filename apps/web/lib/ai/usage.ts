/**
 * `recordUsage` — persiste 1 row em `usage_events` (M11#2) por chamada Claude/
 * OpenAI/summary.
 *
 * **Server-only.** A tabela tem RLS; INSERT só do servidor via `withWorkspace`.
 *
 * **Non-fatal.** Falha em `recordUsage` NÃO deve quebrar a chamada original
 * (resposta do agente vai pro usuário mesmo se o metering falhar). Caller
 * embrulha em `.catch(reportNonFatal)` ou ignora erro propositadamente —
 * documentado em `claude.ts` e `embeddings.ts`.
 *
 * **`entityKind`/`entityId` opcionais.** Quando setados, permitem rastrear
 * "qual usage event veio de qual agent_session/agent_message/knowledge_doc".
 * Sem FK no schema (decisão M11#2) — discriminado via `entityKind` free-form.
 */
import 'server-only';

import { UsageEventKind } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import { type TokenUsage, computeCostMicros } from './pricing';

export interface RecordUsageInput {
  workspaceId: string;
  eventKind: UsageEventKind;
  /** Free-form: 'agent_chat' | 'kb_indexing' | 'lead_summary' | etc. */
  feature: string;
  /** Modelo exato (`claude-sonnet-4-6`, `text-embedding-3-small`). */
  model: string;
  usage: TokenUsage;
  /** Discriminador da entidade que originou o evento. Opcional. */
  entityKind?: string;
  /** UUID da entidade (agent_session.id, agent_message.id, etc). Opcional. */
  entityId?: string;
}

/**
 * Persiste 1 row em `usage_events`. Calcula `cost_micros` via `pricing.ts`.
 *
 * Throws apenas em modelo desconhecido (sanity check) ou erro de banco. Caller
 * deve embrulhar em try/catch + `reportNonFatal` pra preservar UX.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const costMicros = computeCostMicros(input.model, input.usage);

  await withWorkspace(input.workspaceId, async (tx) => {
    await tx.usageEvent.create({
      data: {
        workspaceId: input.workspaceId,
        eventKind: input.eventKind,
        feature: input.feature,
        model: input.model,
        inputTokens: input.usage.input,
        outputTokens: input.usage.output,
        cacheReadInputTokens: input.usage.cacheRead,
        cacheCreationInputTokens: input.usage.cacheCreation,
        costMicros,
        entityKind: input.entityKind ?? null,
        entityId: input.entityId ?? null,
      },
    });
  });
}
