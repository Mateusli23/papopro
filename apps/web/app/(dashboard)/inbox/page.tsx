import type { Metadata } from 'next';

import { getWorkspaceConnection } from '@/features/connections/queries';
import { listConversations, listQuickReplies, listRecentMessages } from '@/features/inbox/queries';
import type { Conversation, Message, QuickReply, WhatsAppConnection } from '@/features/inbox/types';
import { requireRole } from '@/lib/auth/require-role';

import { InboxView } from './inbox-view';

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Caixa unificada de WhatsApp do workspace — todas as conversas, vinculadas ao lead.',
};

export const dynamic = 'force-dynamic';

/**
 * Server Component (M9#4) — carrega conversas, mensagens recentes, quick
 * replies e estado da conexão WhatsApp do workspace ativo. Passa tudo pra
 * `<InboxView>` que hidrata o store cliente.
 *
 * **RBAC:** qualquer membro pode abrir a Inbox (inclusive Viewer — leitura
 * só). Vendedor/Manager têm composer ativo; Viewer fica readonly por gate
 * das Server Actions.
 */
export default async function InboxPage() {
  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor', 'Viewer'], {
    forbiddenMessage: 'Você não tem acesso à Inbox deste workspace.',
  });
  if (!auth.ok) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <p>{auth.error}</p>
      </div>
    );
  }
  const { workspaceId } = auth.ctx;

  const [conversations, messages, quickReplies, connection] = await Promise.all([
    listConversations(workspaceId),
    listRecentMessages(workspaceId, 50),
    listQuickReplies(workspaceId),
    getWorkspaceConnection(workspaceId),
  ]);

  // ConnectionUI (do feature `connections`) → WhatsAppConnection (do shape Inbox).
  // Mapeamento explícito porque os contratos M5 (mock) e M9#1 (Prisma) diferem
  // de leve — `health` é `'connected'/'unstable'/'disconnected'` no Inbox vs
  // `'healthy'/'degraded'/'unhealthy'` no schema.
  const whatsappConnection: WhatsAppConnection = mapConnectionToInbox(connection, workspaceId);

  const initial: InboxInitial = {
    conversations,
    messages,
    quickReplies,
    whatsappConnection,
  };

  return <InboxView workspaceId={workspaceId} initial={initial} />;
}

export interface InboxInitial {
  conversations: Conversation[];
  messages: Message[];
  quickReplies: ReadonlyArray<QuickReply>;
  whatsappConnection: WhatsAppConnection;
}

function mapConnectionToInbox(
  connection: Awaited<ReturnType<typeof getWorkspaceConnection>>,
  workspaceId: string,
): WhatsAppConnection {
  // ConnectionUI.status (connected/connecting/disconnected) + ConnectionUI.health
  // (healthy/degraded/unhealthy) → WhatsAppConnection.health (connected/unstable/
  // disconnected) do contrato M5.
  let health: WhatsAppConnection['health'];
  if (connection.status !== 'connected') {
    health = 'disconnected';
  } else if (connection.health === 'unhealthy') {
    health = 'disconnected';
  } else if (connection.health === 'degraded') {
    health = 'unstable';
  } else {
    health = 'connected';
  }

  return {
    id: `wa-${workspaceId}`,
    workspaceId,
    number: connection.phoneNumber ?? '',
    health,
    lastSeenAt: connection.lastSeenAt ?? new Date().toISOString(),
  };
}
