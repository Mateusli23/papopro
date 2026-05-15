import { headers } from 'next/headers';

import type { Metadata } from 'next';

import { getWorkspaceConnection } from '@/features/connections/queries';
import { getWebhookSettings, listWebhookEvents } from '@/features/webhooks/queries';
import { requireRole } from '@/lib/auth/require-role';

import { ConnectionsView } from './connections-view';

export const metadata: Metadata = {
  title: 'Conexões · Configurações',
  description: 'Status do WhatsApp, health score e histórico de desconexões.',
};

/**
 * Server Component que carrega:
 *  - Status WhatsApp real (M9#2): WhatsappAccount + WhatsappInstance via Prisma.
 *  - Webhook de captura de leads (M8#5): URL atual + últimos 20 eventos.
 *
 * **RBAC:** Owner/Admin/Manager. Owner/Admin podem conectar/desconectar
 * WhatsApp e regenerar webhook token. Manager vê tudo em read-only.
 * Vendedor/Viewer pega 403 pelo gate de role abaixo.
 */
export const dynamic = 'force-dynamic';

export default async function ConnectionsSettingsPage() {
  const auth = await requireRole(['Owner', 'Admin', 'Manager'], {
    forbiddenMessage: 'Apenas Owner, Admin e Manager têm acesso a Conexões.',
  });
  if (!auth.ok) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <p>{auth.error}</p>
      </div>
    );
  }
  const { workspaceId, role } = auth.ctx;

  // Resolve origin pra montar URL completa do webhook.
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  const [{ token, fullUrl }, events, connection] = await Promise.all([
    getWebhookSettings(workspaceId, origin),
    listWebhookEvents(workspaceId, { limit: 20 }),
    getWorkspaceConnection(workspaceId),
  ]);

  const canManageWhatsapp = role === 'Owner' || role === 'Admin';
  const canRegenerate = canManageWhatsapp;

  return (
    <ConnectionsView
      whatsappConnection={connection}
      canManageWhatsapp={canManageWhatsapp}
      webhookUrl={fullUrl}
      webhookEvents={events}
      canRegenerateWebhook={canRegenerate}
      hasWebhookToken={token !== null}
    />
  );
}
