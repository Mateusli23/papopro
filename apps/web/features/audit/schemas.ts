import { z } from 'zod';

import { ALL_AUDIT_ACTIONS } from './labels';
import type { AuditFilters } from './types';

/**
 * Schema dos filtros da auditoria (M13#3). Valida o que vem da URL
 * (`searchParams`) — filtro por autor, tipo de evento e período.
 *
 * Tudo opcional: a página sem filtro lista os eventos mais recentes.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const auditFilterSchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z
    .string()
    .refine((a) => ALL_AUDIT_ACTIONS.includes(a), 'Tipo de evento desconhecido.')
    .optional(),
  from: z.string().regex(DATE_RE, 'Data inicial inválida.').optional(),
  to: z.string().regex(DATE_RE, 'Data final inválida.').optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** `searchParams` cru do App Router. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * `parseAuditFilters` — normaliza os `searchParams` da página em `AuditFilters`.
 * Valor inválido é descartado silenciosamente (filtro some, página continua
 * funcionando) — nunca lança. Defense-in-depth contra URL adulterada.
 */
export function parseAuditFilters(raw: RawSearchParams): AuditFilters {
  const parsed = auditFilterSchema.safeParse({
    actorId: first(raw.actorId),
    action: first(raw.action),
    from: first(raw.from),
    to: first(raw.to),
    page: first(raw.page) ?? 0,
  });
  if (!parsed.success) {
    return { page: 0 };
  }
  return {
    actorId: parsed.data.actorId,
    action: parsed.data.action,
    from: parsed.data.from,
    to: parsed.data.to,
    page: parsed.data.page,
  };
}
