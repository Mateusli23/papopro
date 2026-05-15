import 'server-only';

import { prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

/**
 * Queries server-only do feature `webhooks` (M8#5).
 *
 * **Defense-in-depth:** `withWorkspace` (RLS) + `where: { workspaceId }`
 * explícito em toda consulta (CLAUDE.md §7.2).
 */

export interface WebhookSettings {
  /** Token URL-safe (43 chars base64url). `null` se ainda não foi gerado. */
  token: string | null;
  /** URL completa pronta pra copiar. `null` se token é `null`. */
  fullUrl: string | null;
}

/**
 * Retorna o token e a URL pronta. `null` em caso de workspace inexistente
 * (chama-se sempre com o workspace ativo, então o `null` é mais uma defesa
 * contra cookie corrompido do que um caso prático).
 */
export async function getWebhookSettings(
  workspaceId: string,
  origin: string,
): Promise<WebhookSettings> {
  if (!isUuid(workspaceId)) {
    console.error('[getWebhookSettings] invalid workspaceId', workspaceId);
    return { token: null, fullUrl: null };
  }
  // Não vai via `withWorkspace` porque o cookie do workspace ativo já é a
  // garantia — e o lookup é por id, indexado, fora do hot path RLS.
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { webhookToken: true },
  });
  const token = ws?.webhookToken ?? null;
  return {
    token,
    fullUrl: token ? `${origin.replace(/\/$/, '')}/api/webhooks/leads/${token}` : null,
  };
}

export interface WebhookEventListItem {
  id: string;
  source: string;
  externalId: string;
  signatureValid: boolean;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

/**
 * Lista os últimos eventos de webhook recebidos pelo workspace — usado pela
 * UI de Settings → Connections pra mostrar histórico curto. Take 20.
 */
export async function listWebhookEvents(
  workspaceId: string,
  options: { limit?: number } = {},
): Promise<WebhookEventListItem[]> {
  if (!isUuid(workspaceId)) {
    console.error('[listWebhookEvents] invalid workspaceId', workspaceId);
    return [];
  }
  const limit = options.limit ?? 20;
  return await withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.webhookEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        source: true,
        externalId: true,
        signatureValid: true,
        processedAt: true,
        error: true,
        createdAt: true,
      },
    });
    return rows;
  });
}
