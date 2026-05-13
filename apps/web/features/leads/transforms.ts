/**
 * Transforms puros — converte `Prisma.Lead` (com relações) na shape `Lead`
 * que a UI já consome desde M4. Mantém o tipo do client estável e isola a
 * lógica de derivação (temperatura, tags achatadas) em funções testáveis
 * sem banco (smoke test em `/api/smoke-test/leads` cobre).
 *
 * **Princípio CLAUDE.md §5:** `now()` injetável — `referenceDate` default
 * `new Date()` permite testar derivação de temperatura com data fixa.
 *
 * **Sobre `temperature`:** NÃO é coluna persistida (decisão M8#1, ver
 * `schema.prisma:Lead`). Derivada de `lastInteractionAt`:
 *  - <3 dias → `hot`
 *  - 3–10 dias → `warm`
 *  - >10 dias ou null → `cold`
 *
 * Mesma regra de `apps/web/lib/fixtures/leads.ts:temperatureFromLastInteraction`.
 */

import { differenceInDays } from 'date-fns';

import type { LeadTemperature } from '@papopro/ui';

import type { Lead, LeadOrigin, LeadStatus } from './types';

/**
 * Shape mínimo do `Prisma.Lead` que `toLeadUI` espera. Definido aqui (e não
 * importado de `@papopro/db`) pra desacoplar transforms de dependências
 * runtime — assim qualquer arquivo (server, client, smoke test) pode usar
 * sem puxar Prisma engine.
 *
 * Em produção, `queries.ts` faz `findMany({ include: { tags: { include: {
 * tag: true } } } })` e o resultado bate exatamente nessa interface.
 */
export interface PrismaLeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  position: string | null;
  origin: LeadOrigin;
  status: LeadStatus;
  stageId: string;
  assignedToId: string;
  valueCents: number;
  notes: string | null;
  lastInteractionAt: Date | null;
  nextActionAt: Date | null;
  nextActionLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: PrismaLeadTagRow[];
}

export interface PrismaLeadTagRow {
  tag: { name: string };
}

/**
 * Deriva a temperatura a partir de `lastInteractionAt`. Função separada
 * pra ser testável isoladamente (smoke test cobre 3 janelas).
 */
export function deriveLeadTemperature(
  lastInteractionAt: Date | null,
  referenceDate: Date = new Date(),
): LeadTemperature {
  if (!lastInteractionAt) return 'cold';
  const days = differenceInDays(referenceDate, lastInteractionAt);
  if (days < 3) return 'hot';
  if (days <= 10) return 'warm';
  return 'cold';
}

/**
 * Achata `lead_tags` (junction m:n) em `string[]`. UI espera lista plana
 * de strings (ex: `['imobiliário', 'lançamento']`); o banco guarda em
 * `Tag` + `LeadTag` com FKs. Transform isola essa adaptação.
 */
export function flattenLeadTags(rows: PrismaLeadTagRow[] | undefined): string[] {
  if (!rows || rows.length === 0) return [];
  return rows.map((r) => r.tag.name);
}

export interface ToLeadUIOptions {
  /** Data de referência pra derivação de temperatura. Default: `new Date()`. */
  referenceDate?: Date;
}

/**
 * Converte uma row Prisma `Lead` (com `tags` opcional via `include`) na
 * shape `Lead` que a UI consome. Toda Server Component / Server Action
 * que devolve lead pro client passa por aqui.
 */
export function toLeadUI(row: PrismaLeadRow, options: ToLeadUIOptions = {}): Lead {
  const referenceDate = options.referenceDate ?? new Date();
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone,
    company: row.company ?? undefined,
    position: row.position ?? undefined,
    origin: row.origin,
    status: row.status,
    stageId: row.stageId,
    assignedTo: row.assignedToId,
    temperature: deriveLeadTemperature(row.lastInteractionAt, referenceDate),
    valueCents: row.valueCents,
    tags: flattenLeadTags(row.tags),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastInteractionAt: row.lastInteractionAt?.toISOString(),
    nextActionAt: row.nextActionAt?.toISOString(),
    nextActionLabel: row.nextActionLabel ?? undefined,
  };
}
