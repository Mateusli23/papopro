/**
 * Tipos do feature `audit` (M13#3) — viewer de `/settings/audit`.
 *
 * Shape estável que atravessa o boundary Server → Client. Nunca expõe a row
 * Prisma crua.
 */

/** Linha de auditoria já transformada pra UI. */
export interface AuditLogUI {
  id: string;
  action: string;
  /** Rótulo pt-BR de `action` (`auditActionLabel`). */
  actionLabel: string;
  /** Nome do autor — `null` para eventos de sistema ou usuário removido. */
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  /** JSON `changes` serializado e truncado pra exibição inline. */
  changesSummary: string | null;
  /** ISO 8601. */
  createdAt: string;
}

/** Opção do filtro "autor" — um membro do workspace. */
export interface AuditActorOption {
  /** `users.id` (= `audit_logs.user_id`). */
  id: string;
  name: string;
}

/** Filtros normalizados a partir dos search params da URL. */
export interface AuditFilters {
  actorId?: string;
  action?: string;
  /** `YYYY-MM-DD` — início do intervalo (interpretado em America/Sao_Paulo). */
  from?: string;
  /** `YYYY-MM-DD` — fim do intervalo (inclusive). */
  to?: string;
  /** 0-indexed. */
  page: number;
}

/** Resultado paginado de `listAuditLogs`. */
export interface AuditLogPage {
  rows: AuditLogUI[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
