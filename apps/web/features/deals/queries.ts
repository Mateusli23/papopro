import 'server-only';

import type { Prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toDealUI } from './transforms';
import type { Deal, DealStatus } from './types';

/**
 * Queries server-only do feature `deals` (M8#3).
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** TODA query roda dentro de
 * `withWorkspace` (RLS por sessão) E filtra `where: { workspaceId }`
 * explicitamente. Bug de policy não vaza tenant cross-workspace.
 *
 * **Sort canônico do Kanban:** `(stage.order ASC, orderInStage ASC,
 * createdAt DESC)` — etapa visual primeiro, posição manual depois,
 * desempate por mais novo. Tie-break por `createdAt` cobre fixtures /
 * deals legacy que ainda têm `orderInStage = 0`.
 */

// =============================================================================
// listDeals
// =============================================================================

export interface ListDealsFilters {
  /**
   * Filtra por status; default omitido = mostra TODOS (incluindo ganho/perdido,
   * que aparecem nas colunas terminais do Kanban).
   */
  statuses?: DealStatus[];
  /** Filtra por etapa (uso futuro — `/reports` por exemplo). */
  stageIds?: string[];
  /** Filtra por vendedor. */
  ownerIds?: string[];
  /** Paginação. Default: 500 (Kanban precisa ver tudo do workspace). */
  take?: number;
  skip?: number;
}

export async function listDeals(
  workspaceId: string,
  filters: ListDealsFilters = {},
): Promise<Deal[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listDeals] invalid workspaceId', workspaceId);
    return [];
  }

  const where: Prisma.DealWhereInput = {
    workspaceId,
    deletedAt: null,
  };

  if (filters.statuses && filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }
  if (filters.stageIds && filters.stageIds.length > 0) {
    where.stageId = { in: filters.stageIds };
  }
  if (filters.ownerIds && filters.ownerIds.length > 0) {
    where.ownerId = { in: filters.ownerIds };
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.deal.findMany({
      where,
      include: {
        stage: { select: { slug: true, name: true, order: true } },
        lead: { select: { id: true, name: true, company: true } },
      },
      orderBy: [{ stage: { order: 'asc' } }, { orderInStage: 'asc' }, { createdAt: 'desc' }],
      take: filters.take ?? 500,
      skip: filters.skip ?? 0,
    });
    return rows.map((row) => toDealUI(row));
  });
}

// =============================================================================
// listLeadsForCombobox
// =============================================================================

/**
 * Subset de leads pra alimentar o combobox "Lead vinculado" do
 * `DealCreateDialog`. Volume MVP: até 200 leads ativos por workspace
 * (raro chegar perto). Polimento posterior migra pra search server-side
 * via `useDeferredValue` + searchParams.
 */
export interface LeadComboboxOption {
  id: string;
  name: string;
  company: string | null;
}

export async function listLeadsForCombobox(workspaceId: string): Promise<LeadComboboxOption[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listLeadsForCombobox] invalid workspaceId', workspaceId);
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.lead.findMany({
      where: { workspaceId, status: 'ativo', deletedAt: null },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows;
  });
}
