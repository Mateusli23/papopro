'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';

import { IntegrationCard } from '@/features/settings/components/integration-card';
import { WebhookCard } from '@/features/settings/components/webhook-card';
import { useIntegrations } from '@/features/settings/store';

/**
 * `/settings/integrations` — webhook de leads ganha card "alto" no topo
 * (URL + stats); demais integrações ficam num grid 3xN.
 *
 * Em M5 Google Calendar é mock conectado pra mostrar o card "ativo"; ads
 * estão `'soon'`. Em M8 Calendar vira OAuth real.
 */
export function IntegrationsView() {
  const integrations = useIntegrations();
  const others = integrations.filter((i) => i.key !== 'webhook_leads');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Conecte calendário, formulários externos, ads e CRMs."
      />

      <WebhookCard />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((integration) => (
          <IntegrationCard key={integration.key} integration={integration} />
        ))}
      </div>
    </div>
  );
}
