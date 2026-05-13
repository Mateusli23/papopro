import 'server-only';

import type { Prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toLeadUI } from './transforms';
import type { Lead, LeadOrigin, LeadStatus, Pipeline, SalesRep } from './types';

/**
 * Queries server-only do feature `leads` (M8#2).
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** TODAS as queries rodam dentro de
 * `withWorkspace(workspaceId, …)` (ativa RLS por sessão) E filtram
 * `where: { workspaceId }` explicitamente. Bug de policy não vaza tenant
 * cross-workspace; bug no app + RLS ativa também não.
 *
 * **Filtros server-side:** `listLeads` aceita filtros opcionais (search,
 * status, stage, assignee, origem, tags) e transforma em `where` Postgres.
 * Search usa `mode: 'insensitive'` (ILIKE no Postgres) em `name`, `email`,
 * `phone`, `company` — pg_trgm real fica pra otimização se virar gargalo
 * (volume MVP de 50-500 leads não exige).
 *
 * **Transforms:** toda row sai por `toLeadUI` (`transforms.ts`) — UI
 * recebe shape estável `Lead` que existe desde M4, sem expor Prisma cru
 * pro Client Component.
 */

// =============================================================================
// listLeads
// =============================================================================

export interface ListLeadsFilters {
  /** Substring busca em name/email/phone/company (case-insensitive). */
  search?: string;
  /** Filtra por status; default omitido = só `ativo`. Passar `[]` mostra TUDO. */
  statuses?: LeadStatus[];
  /** IDs de pipeline_stages. */
  stageIds?: string[];
  /** IDs de workspace_members (vendedores). */
  assigneeIds?: string[];
  /** Origens. */
  origins?: LeadOrigin[];
  /** Nomes de tags (case-insensitive via citext). */
  tagNames?: string[];
  /** Paginação. Default: 100 (volume MVP). */
  take?: number;
  skip?: number;
}

export async function listLeads(
  workspaceId: string,
  filters: ListLeadsFilters = {},
): Promise<Lead[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listLeads] invalid workspaceId', workspaceId);
    return [];
  }

  const where: Prisma.LeadWhereInput = {
    workspaceId,
    deletedAt: null, // soft-delete invisível por default
  };

  // Default: oculta arquivados. Caller pode passar `statuses: ['ativo','arquivado']` pra ver tudo.
  if (filters.statuses === undefined) {
    where.status = 'ativo';
  } else if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { company: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (filters.stageIds && filters.stageIds.length > 0) {
    where.stageId = { in: filters.stageIds };
  }
  if (filters.assigneeIds && filters.assigneeIds.length > 0) {
    where.assignedToId = { in: filters.assigneeIds };
  }
  if (filters.origins && filters.origins.length > 0) {
    where.origin = { in: filters.origins };
  }
  if (filters.tagNames && filters.tagNames.length > 0) {
    where.tags = {
      some: {
        tag: { name: { in: filters.tagNames } },
      },
    };
  }

  const referenceDate = new Date();

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.lead.findMany({
      where,
      include: {
        tags: { include: { tag: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 100,
      skip: filters.skip ?? 0,
    });
    return rows.map((row) => toLeadUI(row, { referenceDate }));
  });
}

// =============================================================================
// getLead
// =============================================================================

export interface LeadWithRelations extends Lead {
  /** Deals abertos do lead. Vazio se não houver. Timeline + tasks ficam mock até M8#4. */
  openDeals: LeadOpenDeal[];
}

export interface LeadOpenDeal {
  id: string;
  title: string;
  valueCents: number;
  stageId: string;
  stageName: string;
  probability: number | null;
  dueAt: string | null;
  createdAt: string;
}

export async function getLead(
  workspaceId: string,
  leadId: string,
): Promise<LeadWithRelations | null> {
  if (!isUuid(workspaceId) || !isUuid(leadId)) {
    console.error('[getLead] invalid id', { workspaceId, leadId });
    return null;
  }

  const referenceDate = new Date();

  return await withWorkspace(workspaceId, async (tx) => {
    const row = await tx.lead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        deals: {
          where: { status: 'open', deletedAt: null },
          select: {
            id: true,
            title: true,
            valueCents: true,
            stageId: true,
            probability: true,
            dueAt: true,
            createdAt: true,
            stage: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) return null;

    const lead = toLeadUI(row, { referenceDate });
    const openDeals: LeadOpenDeal[] = row.deals.map((d) => ({
      id: d.id,
      title: d.title,
      valueCents: d.valueCents,
      stageId: d.stageId,
      stageName: d.stage.name,
      probability: d.probability,
      dueAt: d.dueAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }));

    return { ...lead, openDeals };
  });
}

// =============================================================================
// listSalesReps
// =============================================================================

/**
 * Membros do workspace que aparecem como "vendedor responsável" em formulários
 * de lead (Owner, Admin, Manager, Vendedor — Viewer não aparece porque não
 * pode atribuir leads). Devolve `SalesRep[]` no shape que `LeadCreateDialog`,
 * `LeadFilters`, `LeadDetailCard` já consomem.
 *
 * **Accent cycling:** cada rep recebe um `accent` por índice (primary →
 * success → warning → info → accent → primary...). Cosmético — em
 * polimento M8 posterior, vira coluna `users.accent` configurável.
 */
const ACCENT_CYCLE = ['primary', 'success', 'warning', 'info', 'accent'] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return (
    ((parts[0] ?? '?')[0] ?? '?').toUpperCase() +
    ((parts[parts.length - 1] ?? '?')[0] ?? '?').toUpperCase()
  );
}

export async function listSalesReps(workspaceId: string): Promise<SalesRep[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listSalesReps] invalid workspaceId', workspaceId);
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.workspaceMember.findMany({
      where: {
        workspaceId,
        role: { in: ['Owner', 'Admin', 'Manager', 'Vendedor'] },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m, idx) => {
      const fallbackName = m.user.email.split('@')[0] ?? 'Sem nome';
      const name = m.user.name ?? fallbackName;
      return {
        id: m.id,
        name,
        email: m.user.email,
        initials: getInitials(name),
        accent: ACCENT_CYCLE[idx % ACCENT_CYCLE.length] ?? 'primary',
      };
    });
  });
}

// =============================================================================
// listLeadTags
// =============================================================================

/**
 * Tags em uso no workspace — alimenta autocomplete do filtro de tags.
 * Retorna nomes únicos ordenados alfabeticamente. Tag sem nenhum lead
 * vinculado não aparece (`_count.leadTags > 0`).
 */
export async function listLeadTags(workspaceId: string): Promise<string[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listLeadTags] invalid workspaceId', workspaceId);
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.tag.findMany({
      where: {
        workspaceId,
        leadTags: { some: {} },
      },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => r.name);
  });
}

// =============================================================================
// listDefaultPipeline
// =============================================================================

/**
 * Pipeline default do workspace + stages ordenadas. Todo workspace nasce com
 * 1 (`createWorkspaceAction` semeia em M8#1). Se por alguma razão não houver
 * pipeline default (estado corrupto), retorna `null` — caller decide UX.
 */
export async function listDefaultPipeline(workspaceId: string): Promise<Pipeline | null> {
  if (!isUuid(workspaceId)) {
    console.error('[listDefaultPipeline] invalid workspaceId', workspaceId);
    return null;
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const row = await tx.pipeline.findFirst({
      where: { workspaceId, isDefault: true, deletedAt: null },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      stages: row.stages.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        rotDays: s.rotDays,
        terminal: s.terminal,
        tone: s.tone,
      })),
    };
  });
}
