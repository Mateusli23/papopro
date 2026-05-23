import 'server-only';

import type { Prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toAuditLogUI } from './transforms';
import type { AuditActorOption, AuditFilters, AuditLogPage } from './types';

/**
 * Queries server-only do feature `audit` (M13#3) — alimentam `/settings/audit`.
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** roda dentro de `withWorkspace`
 * (RLS por sessão) E filtra `workspaceId` explícito no `where`.
 *
 * **Período em America/Sao_Paulo:** o usuário escolhe datas BRT. O Brasil não
 * observa horário de verão desde 2019, então o offset fixo `-03:00` resolve
 * sem `date-fns-tz` — `from` vira `00:00:00-03:00` e `to` vira o fim do dia.
 */

export const AUDIT_PAGE_SIZE = 50;

/**
 * `listAuditActors` — membros do workspace pro `<Select>` de autor do filtro.
 * Usa `users.id` como valor (= `audit_logs.user_id`).
 */
export async function listAuditActors(workspaceId: string): Promise<AuditActorOption[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listAuditActors] invalid workspaceId', workspaceId);
    return [];
  }

  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? m.user.email,
    }));
  });
}

/**
 * `listAuditLogs` — página de eventos de auditoria do workspace, mais
 * recentes primeiro, com filtros opcionais (autor / tipo / período).
 */
export async function listAuditLogs(
  workspaceId: string,
  filters: AuditFilters,
): Promise<AuditLogPage> {
  const empty: AuditLogPage = {
    rows: [],
    total: 0,
    page: filters.page,
    pageSize: AUDIT_PAGE_SIZE,
    hasMore: false,
  };
  if (!isUuid(workspaceId)) {
    console.error('[listAuditLogs] invalid workspaceId', workspaceId);
    return empty;
  }

  const where: Prisma.AuditLogWhereInput = { workspaceId };
  if (filters.actorId && isUuid(filters.actorId)) {
    where.userId = filters.actorId;
  }
  if (filters.action) {
    // Cast: `action` é um enum Prisma; o valor já foi validado contra
    // `ALL_AUDIT_ACTIONS` no schema Zod antes de chegar aqui.
    where.action = filters.action as Prisma.AuditLogWhereInput['action'];
  }
  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) createdAt.gte = new Date(`${filters.from}T00:00:00-03:00`);
    if (filters.to) createdAt.lte = new Date(`${filters.to}T23:59:59.999-03:00`);
    where.createdAt = createdAt;
  }

  const page = Math.max(0, filters.page);

  return withWorkspace(workspaceId, async (tx) => {
    const [total, rows] = await Promise.all([
      tx.auditLog.count({ where }),
      tx.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: AUDIT_PAGE_SIZE,
        skip: page * AUDIT_PAGE_SIZE,
      }),
    ]);

    return {
      rows: rows.map(toAuditLogUI),
      total,
      page,
      pageSize: AUDIT_PAGE_SIZE,
      hasMore: (page + 1) * AUDIT_PAGE_SIZE < total,
    };
  });
}
