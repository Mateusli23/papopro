import 'server-only';

import type { Prisma } from '@papopro/db';

/**
 * Encontra leads existentes no workspace que casam com qualquer um dos
 * `phone` ou `email` dos candidatos. Usado pra deduplicação em bulk import
 * (M8#5 CSV) e no webhook handler (`POST /api/webhooks/leads/[token]`).
 *
 * **Match policy:** `phone` exato ou `email` exato (citext faz
 * case-insensitive automaticamente no Postgres). Match parcial ou fuzzy fica
 * pra futuro (pg_trgm já está habilitado).
 *
 * **Retorno:** `Map<string, { id, name }>` onde a key é o phone OU email
 * (normalizados — phone com `.trim()`, email com `.toLowerCase().trim()`).
 * Caller faz lookup O(1) no loop:
 *   ```ts
 *   const dups = await findDuplicates(tx, workspaceId, rows);
 *   for (const row of rows) {
 *     const existing = dups.get(row.phone) ?? dups.get(row.email?.toLowerCase());
 *     if (existing) skip();
 *   }
 *   ```
 *
 * **Defense-in-depth:** filtra `workspaceId` explicitamente (CLAUDE.md §7.2).
 * Roda dentro de `withWorkspace` tx — caller garante o setting RLS.
 */
export interface DedupeCandidate {
  phone?: string | null;
  email?: string | null;
}

export interface DedupeMatch {
  id: string;
  name: string;
}

export async function findDuplicates(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  candidates: readonly DedupeCandidate[],
): Promise<Map<string, DedupeMatch>> {
  const phones = new Set<string>();
  const emails = new Set<string>();

  for (const c of candidates) {
    const p = c.phone?.trim();
    if (p) phones.add(p);
    const e = c.email?.toLowerCase().trim();
    if (e) emails.add(e);
  }

  if (phones.size === 0 && emails.size === 0) return new Map();

  const ors: Prisma.LeadWhereInput[] = [];
  if (phones.size > 0) ors.push({ phone: { in: Array.from(phones) } });
  if (emails.size > 0) ors.push({ email: { in: Array.from(emails) } });

  const existing = await tx.lead.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: ors,
    },
    select: { id: true, name: true, phone: true, email: true },
  });

  const matches = new Map<string, DedupeMatch>();
  for (const lead of existing) {
    if (lead.phone) matches.set(lead.phone.trim(), { id: lead.id, name: lead.name });
    if (lead.email) matches.set(lead.email.toLowerCase().trim(), { id: lead.id, name: lead.name });
  }
  return matches;
}

// ─── Versão pura pra smoke test ────────────────────────────────────────────

export interface ExistingLeadRef {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

/**
 * Versão pura — recebe lista de leads existentes (mock) e candidatos, devolve
 * Map<key, match>. Usado pelo smoke test pra validar a estratégia de match
 * sem subir banco.
 */
export function findDuplicatesPure(
  existing: readonly ExistingLeadRef[],
  candidates: readonly DedupeCandidate[],
): Map<string, DedupeMatch> {
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const c of candidates) {
    const p = c.phone?.trim();
    if (p) phones.add(p);
    const e = c.email?.toLowerCase().trim();
    if (e) emails.add(e);
  }
  const matches = new Map<string, DedupeMatch>();
  for (const lead of existing) {
    const p = lead.phone?.trim();
    const e = lead.email?.toLowerCase().trim();
    if (p && phones.has(p)) matches.set(p, { id: lead.id, name: lead.name });
    if (e && emails.has(e)) matches.set(e, { id: lead.id, name: lead.name });
  }
  return matches;
}
