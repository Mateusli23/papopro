/**
 * Queries server-only da Inbox (M9#4).
 *
 * Substituem o que `apps/web/lib/fixtures/conversations.ts` + `messages.ts` +
 * `quick-replies.ts` forneciam ao mock store em M5. Retornam os mesmos shapes
 * de `features/inbox/types.ts` (contrato fechado em M9#1) — assim o
 * `<InboxView>` continua igual, só muda a origem dos dados.
 *
 * **Server-only.** Roda em Server Components (`/inbox/page.tsx`) e em Server
 * Actions. `withWorkspace` aplica RLS — defense-in-depth filtra `workspaceId`
 * explicitamente (CLAUDE.md §7.2).
 *
 * **Lookup de phoneNumber do workspace:** `Conversation.whatsappNumber` (campo
 * do contrato) vem do `WhatsappAccount.phoneNumber` (1:1 com workspace). Quando
 * a conta ainda não tem número (sessão nunca conectou), retorno string vazia —
 * UI já lida com isso renderizando `''` no badge.
 */
import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import type { Conversation, Message, QuickReply } from './types';

const PREVIEW_FALLBACK_BY_KIND: Record<string, string> = {
  image: '[Imagem]',
  audio: '[Áudio]',
  document: '[Documento]',
  internal_note: '[Nota interna]',
};

function fallbackPreview(kind: string, body: string | null): string {
  if (body && body.trim()) return body.trim();
  return PREVIEW_FALLBACK_BY_KIND[kind] ?? '';
}

// ============================================================================
// listConversations
// ============================================================================

/**
 * Lista todas as conversas do workspace (não arquivadas + arquivadas — UI
 * filtra). Retorna shape `Conversation` do contrato fechado.
 *
 * **vendorId**: em M9#1 é nullable na DB (transfer pra agente IA em M11+).
 * Contrato `Conversation.vendorId: string` exige string — placeholder `''` se
 * null. UI mostra "Sem dono" nesse caso.
 */
export async function listConversations(workspaceId: string): Promise<Conversation[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.conversation.findMany({
      where: { workspaceId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        leadId: true,
        vendorId: true,
        contactPhone: true,
        status: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        lastMessageDirection: true,
        unreadCount: true,
        aiEnabled: true,
        archivedAt: true,
        createdAt: true,
        whatsappAccount: { select: { phoneNumber: true } },
      },
    });

    return rows.map((row): Conversation => {
      const lastDirection = row.lastMessageDirection ?? 'out';
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        leadId: row.leadId,
        vendorId: row.vendorId ?? '',
        whatsappNumber: row.whatsappAccount.phoneNumber || '',
        contactPhone: row.contactPhone,
        status: row.status,
        lastMessageAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
        lastMessagePreview: row.lastMessagePreview ?? '',
        lastMessageDirection: lastDirection,
        unreadCount: row.unreadCount,
        aiEnabled: row.aiEnabled,
        archivedAt: row.archivedAt?.toISOString(),
        createdAt: row.createdAt.toISOString(),
      };
    });
  });
}

// ============================================================================
// getMessagesForConversation
// ============================================================================

/**
 * Mensagens de uma conversa específica em ordem cronológica ASC. Limit padrão
 * 200 (cobre conversas longas sem virar gargalo). Paginação anterior fica pra
 * polimento — Inbox geral usa as últimas N mensagens visíveis.
 */
export async function getMessagesForConversation(
  workspaceId: string,
  conversationId: string,
  limit = 200,
): Promise<Message[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.message.findMany({
      where: { workspaceId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        kind: true,
        direction: true,
        body: true,
        authorId: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        mediaName: true,
        mediaSizeKb: true,
        mediaDurationSeconds: true,
      },
    });

    return rows.map(
      (row): Message => ({
        id: row.id,
        conversationId: row.conversationId,
        kind: row.kind,
        direction: row.direction,
        body: row.body ?? undefined,
        authorId: row.authorId ?? undefined,
        createdAt: row.createdAt.toISOString(),
        deliveredAt: row.deliveredAt?.toISOString(),
        readAt: row.readAt?.toISOString(),
        mediaName: row.mediaName ?? undefined,
        mediaSizeKb: row.mediaSizeKb ?? undefined,
        mediaDurationSeconds: row.mediaDurationSeconds ?? undefined,
      }),
    );
  });
}

// ============================================================================
// listMessagesForWorkspace (snapshot inicial: últimas N msgs por conv ativa)
// ============================================================================

/**
 * Hidrata o store de mensagens com as últimas N por conversa em uma só query.
 * Usado pelo Server Component `inbox/page.tsx` pra fornecer estado inicial ao
 * `<InboxView>` — depois disso o realtime mantém vivo.
 *
 * **Volume MVP**: 10-30 conversas × 50 últimas msgs = 500-1500 rows. OK pra
 * payload Server → Client. Em workspace grande, conversa selecionada carrega
 * via `getMessagesForConversation`.
 */
export async function listRecentMessages(
  workspaceId: string,
  perConversation = 50,
): Promise<Message[]> {
  return withWorkspace(workspaceId, async (tx) => {
    // Subquery aproximada: pega últimas N de cada conversa via window function.
    // Prisma 5 não suporta window functions de forma elegante — usamos raw query
    // pra evitar N+1.
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        conversation_id: string;
        kind: string;
        direction: string;
        body: string | null;
        author_id: string | null;
        external_message_id: string | null;
        delivered_at: Date | null;
        read_at: Date | null;
        media_name: string | null;
        media_size_kb: number | null;
        media_duration_seconds: number | null;
        created_at: Date;
      }>
    >`
      SELECT id, conversation_id, kind::text, direction::text, body, author_id,
             external_message_id, delivered_at, read_at, media_name,
             media_size_kb, media_duration_seconds, created_at
        FROM (
          SELECT m.*,
                 ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) AS rn
            FROM public.messages m
           WHERE m.workspace_id = ${workspaceId}::uuid
        ) ranked
       WHERE rn <= ${perConversation}
       ORDER BY conversation_id, created_at ASC
    `;

    return rows.map(
      (row): Message => ({
        id: row.id,
        conversationId: row.conversation_id,
        kind: row.kind as Message['kind'],
        direction: row.direction as Message['direction'],
        body: row.body ?? undefined,
        authorId: row.author_id ?? undefined,
        createdAt: row.created_at.toISOString(),
        deliveredAt: row.delivered_at?.toISOString(),
        readAt: row.read_at?.toISOString(),
        mediaName: row.media_name ?? undefined,
        mediaSizeKb: row.media_size_kb ?? undefined,
        mediaDurationSeconds: row.media_duration_seconds ?? undefined,
      }),
    );
  });
}

// ============================================================================
// listQuickReplies
// ============================================================================

export async function listQuickReplies(workspaceId: string): Promise<QuickReply[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.quickReply.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, workspaceId: true, label: true, body: true, order: true },
    });
    return rows.map(
      (row): QuickReply => ({
        id: row.id,
        workspaceId: row.workspaceId,
        label: row.label,
        body: row.body,
        order: row.order,
      }),
    );
  });
}

// ============================================================================
// Helper compartilhado pra evitar duplicar fallbackPreview no caller
// ============================================================================

export { fallbackPreview };
