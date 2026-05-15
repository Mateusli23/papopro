'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';

import { WhatsAppConnectionCard } from '@/features/connections/components/whatsapp-connection-card';
import type { ConnectionUI } from '@/features/connections/types';
import { DisconnectionHistory } from '@/features/settings/components/disconnection-history';
import type { WebhookEventListItem } from '@/features/webhooks/queries';
import { WebhookSettingsCard } from '@/features/workspace/components/webhook-settings-card';

/**
 * `/settings/connections` — em M5 o único canal era WhatsApp via uazapi
 * (mockada). M9#2 conecta com a uazapi de verdade. M14 (V2) adiciona Cloud
 * API Meta como segundo card aqui mesmo.
 *
 * **M8#5:** adicionou `WebhookSettingsCard` (captura inbound de leads).
 * **M9#2:** `WhatsAppConnectionCard` server-fed via `getWorkspaceConnection`.
 */

interface ConnectionsViewProps {
  whatsappConnection: ConnectionUI;
  canManageWhatsapp: boolean;
  webhookUrl: string | null;
  webhookEvents: WebhookEventListItem[];
  canRegenerateWebhook: boolean;
  hasWebhookToken: boolean;
}

export function ConnectionsView({
  whatsappConnection,
  canManageWhatsapp,
  webhookUrl,
  webhookEvents,
  canRegenerateWebhook,
  hasWebhookToken,
}: ConnectionsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conexões"
        description="WhatsApp, webhook de captura de leads e histórico de quedas."
      />

      <WhatsAppConnectionCard initial={whatsappConnection} canConnect={canManageWhatsapp} />

      {hasWebhookToken && (
        <WebhookSettingsCard
          webhookUrl={webhookUrl}
          events={webhookEvents}
          canRegenerate={canRegenerateWebhook}
        />
      )}

      <DisconnectionHistory />
    </div>
  );
}
