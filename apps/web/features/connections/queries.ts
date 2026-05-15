/**
 * Queries do feature Connections (M9#2).
 *
 * `getWorkspaceConnection` lê o estado persistido (`WhatsappAccount` +
 * `WhatsappInstance` — 1:1 com workspace via decisão M9#1) e devolve no
 * formato `ConnectionUI` consumido pelo card.
 *
 * **Server-only.** Roda em Server Components (`/settings/connections/page.tsx`)
 * e em Server Actions (sincronização pós-`adapter.getInstanceStatus`).
 *
 * **`withWorkspace`** ativa RLS — defense-in-depth filtra `workspaceId`
 * explicitamente mesmo com policy aplicada (CLAUDE.md §7.2).
 */
import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import { toConnectionUI } from './transforms';
import type { ConnectionUI } from './types';

export async function getWorkspaceConnection(workspaceId: string): Promise<ConnectionUI> {
  return withWorkspace(workspaceId, async (tx) => {
    const account = await tx.whatsappAccount.findUnique({
      where: { workspaceId },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
      },
    });

    if (!account) {
      return toConnectionUI(null, null);
    }

    const instance = await tx.whatsappInstance.findUnique({
      where: { accountId: account.id },
      select: {
        id: true,
        externalInstanceId: true,
        status: true,
        healthScore: true,
        qrCode: true,
        qrExpiresAt: true,
        connectedAt: true,
        disconnectedAt: true,
        lastSeenAt: true,
        messagesSent24h: true,
        pausedUntil: true,
      },
    });

    return toConnectionUI(account, instance);
  });
}
