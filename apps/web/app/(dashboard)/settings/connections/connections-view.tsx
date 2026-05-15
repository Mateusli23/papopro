'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';

import { DisconnectionHistory } from '@/features/settings/components/disconnection-history';
import { WhatsAppConnectionCard } from '@/features/settings/components/whatsapp-connection-card';
import type { WebhookEventListItem } from '@/features/webhooks/queries';
import { WebhookSettingsCard } from '@/features/workspace/components/webhook-settings-card';

/**
 * `/settings/connections` — em M5 o único canal é WhatsApp via uazapi
 * (mockada). M9 conecta com a uazapi de verdade. M14 (V2) adiciona Cloud API
 * Meta como segundo card aqui mesmo.
 *
 * **M8#5:** adicionou `WebhookSettingsCard` (captura inbound de leads).
 */

interface ConnectionsViewProps {
  webhookUrl: string | null;
  webhookEvents: WebhookEventListItem[];
  canRegenerateWebhook: boolean;
  hasWebhookToken: boolean;
}

export function ConnectionsView({
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

      <WhatsAppConnectionCard />

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
