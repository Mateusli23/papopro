/**
 * Métricas reais de agente IA (M11#7) — agregação de `agent_sessions` +
 * `agent_messages`.
 *
 * Substitui o `emptyMetrics()` placeholder de M11#3 (`{0,0,0,0}`). Os 4
 * campos do contrato `AgentMetrics` (M5) viram números reais.
 *
 * **Server-only.** Roda em Server Components (`/agents`, `/agents/[id]`,
 * `/reports`) e nos queries de `queries.ts`. `withWorkspace` aplica RLS;
 * defense-in-depth filtra `workspace_id` em todo `WHERE` (CLAUDE.md §7.2).
 *
 * **Query SQL, não VIEW Postgres.** O contrato M5 falava em "VIEW Postgres",
 * mas M10#5 (reports de cadência) já estabeleceu o padrão de agregação via
 * `$queryRaw` dentro de `withWorkspace` — sem migration, sem precisar de
 * `security_invoker` na view pra respeitar RLS. Seguimos o precedente.
 *
 * As convenções das 4 métricas estão documentadas em `metrics.helpers.ts`.
 */
import 'server-only';

import { type Prisma } from '@papopro/db';

import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import {
  type AgentMetricsRow,
  type AgentReports,
  computeAgentMetrics,
  sortAgentReportRows,
  summarizeAgentReports,
} from './metrics.helpers';
import type { AgentMetrics, AgentStatus } from './types';

/**
 * Shape cru do `$queryRaw`. Colunas `::bigint` voltam como `bigint` no
 * driver; `double precision` como `number`. Normalizado em
 * `queryAgentMetricsRows`.
 */
interface MetricsSqlRow {
  agent_id: string;
  name: string;
  status: string;
  total_conversations: bigint;
  human_handoff_conversations: bigint;
  response_turn_count: bigint;
  total_response_seconds: number;
}

/**
 * Roda a agregação e normaliza pro shape `AgentMetricsRow`. Uma linha por
 * agente não-deletado do workspace (mesmo agentes sem nenhuma sessão —
 * `LEFT JOIN` garante a linha zerada).
 *
 * **Tempo de resposta** via window function: dentro de cada sessão, pra
 * cada mensagem olha a anterior (`LAG`); quando o par é `in → out`, o gap
 * em segundos entra na média.
 */
async function queryAgentMetricsRows(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<AgentMetricsRow[]> {
  const rows = await tx.$queryRaw<MetricsSqlRow[]>`
    WITH prod_sessions AS (
      SELECT id, agent_id, ended_reason
      FROM public.agent_sessions
      WHERE workspace_id = ${workspaceId}::uuid
        AND kind = 'production'
    ),
    session_agg AS (
      SELECT
        agent_id,
        COUNT(*) AS total_conversations,
        -- Handoff p/ humano = ended_reason 'handoff_*' exceto agent_to_agent
        -- (esse continua atendido por IA). starts_with é prefixo literal —
        -- LIKE trataria o '_' como curinga.
        COUNT(*) FILTER (
          WHERE starts_with(ended_reason, 'handoff_')
            AND ended_reason <> 'handoff_agent_to_agent'
        ) AS human_handoff_conversations
      FROM prod_sessions
      GROUP BY agent_id
    ),
    turn_gaps AS (
      SELECT
        ps.agent_id,
        m.direction AS direction,
        LAG(m.direction) OVER w AS prev_direction,
        EXTRACT(EPOCH FROM (m.created_at - LAG(m.created_at) OVER w)) AS gap_sec
      FROM public.agent_messages m
      JOIN prod_sessions ps ON ps.id = m.session_id
      WHERE m.workspace_id = ${workspaceId}::uuid
      WINDOW w AS (PARTITION BY m.session_id ORDER BY m.created_at, m.id)
    ),
    response_agg AS (
      SELECT
        agent_id,
        COUNT(*) AS response_turn_count,
        COALESCE(SUM(gap_sec), 0) AS total_response_seconds
      FROM turn_gaps
      WHERE direction = 'out'
        AND prev_direction = 'in'
        AND gap_sec >= 0
      GROUP BY agent_id
    )
    SELECT
      a.id::text                                              AS agent_id,
      a.name                                                  AS name,
      a.status::text                                          AS status,
      COALESCE(sa.total_conversations, 0)::bigint              AS total_conversations,
      COALESCE(sa.human_handoff_conversations, 0)::bigint      AS human_handoff_conversations,
      COALESCE(ra.response_turn_count, 0)::bigint              AS response_turn_count,
      COALESCE(ra.total_response_seconds, 0)::double precision AS total_response_seconds
    FROM public.ai_agents a
    LEFT JOIN session_agg sa ON sa.agent_id = a.id
    LEFT JOIN response_agg ra ON ra.agent_id = a.id
    WHERE a.workspace_id = ${workspaceId}::uuid
      AND a.deleted_at IS NULL
    ORDER BY total_conversations DESC, a.name ASC
  `;

  return rows.map((r) => ({
    id: r.agent_id,
    name: r.name,
    status: r.status as AgentStatus,
    totalConversations: Number(r.total_conversations),
    humanHandoffConversations: Number(r.human_handoff_conversations),
    responseTurnCount: Number(r.response_turn_count),
    totalResponseSeconds: Number(r.total_response_seconds),
  }));
}

/**
 * Mapa `agentId → AgentMetrics` pra hidratar o serializer de `queries.ts`.
 * Abre `withWorkspace` próprio (transação isolada da carga dos agentes).
 *
 * **Tolerante a falha**: métricas são decoração da lista de agentes — um
 * erro de agregação NÃO pode derrubar `/agents`. Degrada pra mapa vazio
 * (`serializeAgent` cai no `emptyMetrics()`). `/reports` tem o próprio
 * fallback via `Promise.allSettled` no `page.tsx`.
 */
export async function getAgentMetricsMap(workspaceId: string): Promise<Map<string, AgentMetrics>> {
  try {
    const rows = await withWorkspace(workspaceId, (tx) => queryAgentMetricsRows(tx, workspaceId));
    return new Map(rows.map((r) => [r.id, computeAgentMetrics(r)]));
  } catch (err) {
    reportNonFatal('agents.metricsMap', err, { workspaceId });
    return new Map();
  }
}

/**
 * Payload do bloco "Agentes" de `/reports` — KPIs agregados + tabela por
 * agente. Abre `withWorkspace` próprio (caller é o Server Component da
 * página, fora de qualquer tx).
 */
export async function getAgentReports(workspaceId: string): Promise<AgentReports> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await queryAgentMetricsRows(tx, workspaceId);
    return {
      summary: summarizeAgentReports(rows),
      byAgent: sortAgentReportRows(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          metrics: computeAgentMetrics(r),
        })),
      ),
    };
  });
}
