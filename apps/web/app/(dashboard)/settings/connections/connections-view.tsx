'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';

import { DisconnectionHistory } from '@/features/settings/components/disconnection-history';
import { WhatsAppConnectionCard } from '@/features/settings/components/whatsapp-connection-card';

/**
 * `/settings/connections` — em M5 o único canal é WhatsApp via uazapi
 * (mockada). M9 conecta com a uazapi de verdade. M14 (V2) adiciona Cloud API
 * Meta como segundo card aqui mesmo.
 */
export function ConnectionsView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conexões"
        description="Status do WhatsApp, saúde do número e histórico de quedas."
      />

      <WhatsAppConnectionCard />
      <DisconnectionHistory />
    </div>
  );
}
