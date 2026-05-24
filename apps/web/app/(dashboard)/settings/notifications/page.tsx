import type { Metadata } from 'next';

import { loadNotificationPrefs } from '@/features/notifications/queries';

import { NotificationsView } from './notifications-view';

export const metadata: Metadata = {
  title: 'Notificações · Configurações',
  description: 'Preferências por evento × canal (in-app, push, e-mail).',
};

export default async function NotificationsSettingsPage() {
  const initialPrefs = await loadNotificationPrefs();

  return (
    <NotificationsView
      initialPrefs={initialPrefs}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
    />
  );
}
