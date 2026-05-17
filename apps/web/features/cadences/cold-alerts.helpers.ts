import { z } from 'zod';

import { type Prisma } from '@papopro/db';

/**
 * Helpers puros de cold-lead-alerts (M10#4) — extraídos pra que vitest
 * possa importar sem cair em `server-only` (queries.ts) ou no Supabase
 * runtime (actions.ts).
 *
 * Mesma lógica usada por queries.ts (`coldAlertWhereByRole`) e actions.ts
 * (`acknowledgeColdAlertAction`).
 */

/**
 * RBAC fino: Vendedor só vê alerts dos próprios leads; Owner/Admin/Manager
 * veem todos. Viewer cai no caminho default mas a UI esconde a entrada,
 * então defesa-em-profundidade do servidor é suficiente.
 */
export function ackColdAlertWhereForRole(
  workspaceId: string,
  userId: string,
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer',
): Prisma.ColdLeadAlertWhereInput {
  const base: Prisma.ColdLeadAlertWhereInput = { workspaceId, acknowledgedAt: null };
  if (role === 'Vendedor') {
    return { ...base, lead: { assignedTo: { userId } } };
  }
  return base;
}

/**
 * Zod schema do payload de `acknowledgeColdAlertAction`. Validação na borda
 * + tipo interno (CLAUDE.md §5).
 */
export const acknowledgeColdAlertSchema = z.object({
  alertId: z.string().uuid({ message: 'Alerta inválido.' }),
});
export type AcknowledgeColdAlertInput = z.infer<typeof acknowledgeColdAlertSchema>;
