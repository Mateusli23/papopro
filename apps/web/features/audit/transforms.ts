import { auditActionLabel } from './labels';
import type { AuditLogUI } from './types';

/**
 * Transforms do feature `audit` (M13#3) — row Prisma → `AuditLogUI`.
 *
 * Puro (sem `server-only`) pra ser testável no smoke `/api/smoke-test/lgpd`.
 */

/** Subconjunto da row `audit_logs` + autor que o transform consome. */
export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  changes: unknown;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
}

/** Limite de caracteres do resumo de `changes` exibido inline na tabela. */
const CHANGES_SUMMARY_MAX = 120;

/** Serializa `changes` (JSON) num resumo curto pra coluna da tabela. */
export function summarizeChanges(changes: unknown): string | null {
  if (changes === null || changes === undefined) return null;
  let text: string;
  try {
    text = typeof changes === 'string' ? changes : JSON.stringify(changes);
  } catch {
    return null;
  }
  if (!text || text === '{}' || text === 'null') return null;
  return text.length > CHANGES_SUMMARY_MAX ? `${text.slice(0, CHANGES_SUMMARY_MAX)}…` : text;
}

export function toAuditLogUI(row: AuditLogRow): AuditLogUI {
  return {
    id: row.id,
    action: row.action,
    actionLabel: auditActionLabel(row.action),
    actorName: row.user?.name ?? null,
    actorEmail: row.user?.email ?? null,
    entityType: row.entityType,
    entityId: row.entityId,
    ipAddress: row.ipAddress,
    changesSummary: summarizeChanges(row.changes),
    createdAt: row.createdAt.toISOString(),
  };
}
