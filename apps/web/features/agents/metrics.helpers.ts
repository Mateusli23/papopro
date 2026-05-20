/**
 * Helpers puros das métricas de agente (M11#7).
 *
 * Sem `'server-only'` nem dependência de Prisma — importáveis em smoke
 * endpoint, vitest e Server Components. A query SQL que alimenta esses
 * helpers vive em `metrics.ts` (server-only).
 *
 * **Convenções das métricas** (UI mockada M5 → real M11#7):
 *  - Uma "conversa" = uma `agent_session kind='production'`. Simulações
 *    (`kind='simulation'`) ficam de fora — são sandbox do editor.
 *  - `resolutionRate` = `1 − (sessões com handoff p/ humano / total)`.
 *    Handoff p/ humano = `ended_reason` começa com `handoff_` EXCETO
 *    `handoff_agent_to_agent` (esse continua atendido por IA). Sessão aberta
 *    (`ended_reason` NULL) conta como resolvida-até-agora.
 *  - `avgResponseTimeSec` = latência média entre uma mensagem `in` e a `out`
 *    seguinte na mesma sessão. Mede o processamento do Claude — o `out` é
 *    persistido ANTES do jitter anti-ban (M11#5), então não inclui a fila.
 *  - `inferredSatisfaction` fica `0` — satisfação via sentimento precisa de
 *    classificador dedicado; adiada pra V2 (M11#7 não-objetivo).
 *
 * **Handoff agente→agente infla `totalConversations`**: quando A passa pra
 * B, a sessão de A fecha e B abre outra — a mesma conversa do lead vira 2
 * sessões. Aproximação aceitável: "sessão ≈ atendimento-por-um-agente".
 */
import type { AgentMetrics, AgentStatus } from './types';

/** Clamp pro intervalo [0, 1] — protege taxas de `NaN`/overflow. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Linha crua de agregação (já normalizada de `bigint` → `number` pela query).
 * `computeAgentMetrics` consome só os 4 contadores; `id`/`name`/`status`
 * carregam a identidade do agente pro relatório.
 */
export interface AgentMetricsRow {
  id: string;
  name: string;
  status: AgentStatus;
  /** Sessões `kind='production'` do agente (acumulado). */
  totalConversations: number;
  /** Subconjunto que terminou com handoff pra humano. */
  humanHandoffConversations: number;
  /** Pares `in→out` que entraram no cálculo de tempo de resposta. */
  responseTurnCount: number;
  /** Soma dos gaps `in→out` em segundos. */
  totalResponseSeconds: number;
}

/**
 * `computeAgentMetrics` — materializa os 4 campos do contrato `AgentMetrics`
 * a partir da linha crua. Puro: mesma entrada → mesma saída, sem DB.
 */
export function computeAgentMetrics(row: AgentMetricsRow): AgentMetrics {
  const resolutionRate =
    row.totalConversations > 0
      ? clamp01(1 - row.humanHandoffConversations / row.totalConversations)
      : 0;

  const avgResponseTimeSec =
    row.responseTurnCount > 0 ? Math.round(row.totalResponseSeconds / row.responseTurnCount) : 0;

  return {
    totalConversations: row.totalConversations,
    resolutionRate,
    avgResponseTimeSec,
    // M11#7 adia satisfação inferida — precisa de classificador de
    // sentimento (V2). Painel/relatório renderizam 0 como "—".
    inferredSatisfaction: 0,
  };
}

/** Linha da tabela "Performance por agente" em `/reports`. */
export interface AgentReportRow {
  id: string;
  name: string;
  status: AgentStatus;
  metrics: AgentMetrics;
}

/** KPIs agregados do bloco "Agentes" em `/reports`. */
export interface AgentReportsSummary {
  /** Agentes com `status='active'`. */
  activeAgentsCount: number;
  /** Total de agentes não-deletados do workspace. */
  totalAgentsCount: number;
  /** Soma de conversas atendidas (todos os agentes). */
  totalConversations: number;
  /** Resolução sem handoff agregada do workspace [0–1]. */
  overallResolutionRate: number;
  /** Tempo médio de resposta agregado, em segundos. */
  avgResponseTimeSec: number;
}

/** Payload completo do bloco "Agentes" de `/reports`. */
export interface AgentReports {
  summary: AgentReportsSummary;
  byAgent: AgentReportRow[];
}

/**
 * `summarizeAgentReports` — rollup do workspace. Agrega pelos **contadores
 * crus** (não pela média das médias) — `overallResolutionRate` e
 * `avgResponseTimeSec` ficam corretamente ponderados por volume.
 */
export function summarizeAgentReports(rows: readonly AgentMetricsRow[]): AgentReportsSummary {
  let totalConversations = 0;
  let totalHumanHandoffs = 0;
  let totalResponseTurns = 0;
  let totalResponseSeconds = 0;
  let activeAgentsCount = 0;

  for (const r of rows) {
    totalConversations += r.totalConversations;
    totalHumanHandoffs += r.humanHandoffConversations;
    totalResponseTurns += r.responseTurnCount;
    totalResponseSeconds += r.totalResponseSeconds;
    if (r.status === 'active') activeAgentsCount += 1;
  }

  return {
    activeAgentsCount,
    totalAgentsCount: rows.length,
    totalConversations,
    overallResolutionRate:
      totalConversations > 0 ? clamp01(1 - totalHumanHandoffs / totalConversations) : 0,
    avgResponseTimeSec:
      totalResponseTurns > 0 ? Math.round(totalResponseSeconds / totalResponseTurns) : 0,
  };
}

/**
 * Ordena a tabela "Performance por agente" por conversas desc, com tiebreak
 * alfabético em `name` pra estabilidade entre refreshes.
 */
export function sortAgentReportRows(rows: readonly AgentReportRow[]): AgentReportRow[] {
  return [...rows].sort((a, b) => {
    if (b.metrics.totalConversations !== a.metrics.totalConversations) {
      return b.metrics.totalConversations - a.metrics.totalConversations;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Formata taxa [0,1] como percentual inteiro pt-BR ("85%"). Sempre formata
 * — quem decide mostrar "—" por falta de volume é o componente.
 */
export function formatMetricRate(rate: number): string {
  return `${Math.round(clamp01(rate) * 100)}%`;
}

/**
 * Formata segundos como "12s" / "3min" / "2m 30s". Sempre formata — "—" por
 * ausência de volume é decisão do componente.
 */
export function formatResponseTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${min}min` : `${min}m ${rem}s`;
}
