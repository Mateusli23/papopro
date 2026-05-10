import type { Metadata } from 'next';

import { IntegrationsView } from './integrations-view';

export const metadata: Metadata = {
  title: 'Integrações · Configurações',
  description: 'Google Calendar, webhooks de leads e CRMs externos.',
};

export default function IntegrationsSettingsPage() {
  return <IntegrationsView />;
}
