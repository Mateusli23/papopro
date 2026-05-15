import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

import { toActivityUI, type ActivityWithAuthor } from './transforms';

/**
 * Queries server-only do feature `activities` (M8#4).
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** activity NÃO tem coluna direta
 * de `workspaceId` (herda via `lead.workspace_id`). RLS já resolve por
 * subquery, mas validamos `lead.workspaceId` explicitamente no `where`
 * pra dar bug-safety.
 */

export async function listActivitiesForLead(
  workspaceId: string,
  leadId: string,
): Promise<ActivityWithAuthor[]> {
  if (!isUuid(workspaceId) || !isUuid(leadId)) {
    console.error('[listActivitiesForLead] invalid ids', { workspaceId, leadId });
    return [];
  }

  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.activity.findMany({
      where: {
        leadId,
        // Defense-in-depth via relação — garante mesmo se RLS falhar.
        lead: { workspaceId },
      },
      include: {
        author: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => toActivityUI(row));
  });
}
