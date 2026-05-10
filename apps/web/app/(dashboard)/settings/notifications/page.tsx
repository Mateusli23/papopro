import type { Metadata } from 'next';

import { NotificationsView } from './notifications-view';

export const metadata: Metadata = {
  title: 'Notificações · Configurações',
  description: 'Preferências por evento × canal (in-app, push, e-mail).',
};

export default function NotificationsSettingsPage() {
  return <NotificationsView />;
}
