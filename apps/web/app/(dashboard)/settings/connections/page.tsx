import type { Metadata } from 'next';

import { ConnectionsView } from './connections-view';

export const metadata: Metadata = {
  title: 'Conexões · Configurações',
  description: 'Status do WhatsApp, health score e histórico de desconexões.',
};

export default function ConnectionsSettingsPage() {
  return <ConnectionsView />;
}
