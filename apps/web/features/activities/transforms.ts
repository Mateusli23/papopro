/**
 * Transformações puras do domínio Activities (M8#4 — server-fed timeline).
 *
 * Activities são append-only (RLS permite só SELECT/INSERT), então não
 * temos mutadores puros como em tasks/deals — só conversão Prisma → UI
 * + enrichment de `meta` (resolver IDs em nomes).
 */

import type { Activity, ActivityType, PipelineStage } from '@/features/leads/types';

// =============================================================================
// Prisma row → UI shape
// =============================================================================

/**
 * Shape mínima de `Activity` row + author/lead opcionais via include. Definida
 * aqui pra desacoplar transforms de runtime Prisma.
 */
export interface PrismaActivityRow {
  id: string;
  leadId: string;
  type: ActivityType;
  body: string | null;
  authorId: string | null;
  meta: unknown;
  createdAt: Date;
  /** Quando carregado via include, traz nome do autor pra exibir "por X". */
  author?: { id: string; user: { name: string | null; email: string } } | null;
}

/**
 * Activity UI estendida que carrega `authorName` pré-resolvido (timeline
 * mostra "por Mateus" sem fetch adicional).
 */
export interface ActivityWithAuthor extends Activity {
  authorName?: string;
}

function safeMeta(meta: unknown): Activity['meta'] | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  return meta as Activity['meta'];
}

export function toActivityUI(row: PrismaActivityRow): ActivityWithAuthor {
  const authorName = row.author
    ? (row.author.user.name ?? row.author.user.email.split('@')[0] ?? 'Sistema')
    : undefined;
  return {
    id: row.id,
    leadId: row.leadId,
    type: row.type,
    body: row.body ?? undefined,
    authorId: row.authorId ?? 'system',
    createdAt: row.createdAt.toISOString(),
    meta: safeMeta(row.meta),
    authorName,
  };
}

// =============================================================================
// Stage change meta enrichment
// =============================================================================

/**
 * Resolve `meta.fromStageId/toStageId` em nomes legíveis pra renderizar
 * "Em contato → Proposta" na timeline. Quando a stage saiu do pipeline
 * (ex: foi deletada ou veio de outro pipeline), cai pro fallback `'?'`.
 *
 * Função pura — não depende de Prisma. UI passa `stages` via prop.
 */
export interface EnrichedStageChange {
  fromStageName: string;
  toStageName: string;
}

export function enrichStageChangeMeta(
  meta: Activity['meta'] | undefined,
  stages: readonly PipelineStage[],
): EnrichedStageChange | null {
  if (!meta || !meta.fromStageId || !meta.toStageId) return null;
  const byId = new Map(stages.map((s) => [s.id, s.name]));
  return {
    fromStageName: byId.get(meta.fromStageId) ?? '?',
    toStageName: byId.get(meta.toStageId) ?? '?',
  };
}
