import { PageHeader } from '@papopro/ui';

import { NotificationMatrix } from '@/features/settings/components/notification-matrix';
import { PushPermissionBlock } from '@/features/settings/components/push-permission-block';
import type { NotificationPrefs } from '@/features/settings/types';

/**
 * `/settings/notifications` — matriz exata do PRD §3.2 (10 eventos × 3 canais)
 * + bloco de permissão push. Real desde M13#2: a matriz persiste em
 * `notification_preferences` e o bloco de push assina/dispara Web Push de
 * verdade.
 *
 * Server Component — recebe as preferências já carregadas e a chave VAPID
 * pública do `page.tsx`, e só compõe os dois componentes client.
 */

interface NotificationsViewProps {
  initialPrefs: NotificationPrefs | null;
  vapidPublicKey: string;
}

export function NotificationsView({ initialPrefs, vapidPublicKey }: NotificationsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description="Escolha em quais canais receber cada evento. Eventos administrativos não podem ser desligados."
      />

      <PushPermissionBlock vapidPublicKey={vapidPublicKey} />
      <NotificationMatrix initialPrefs={initialPrefs} />
    </div>
  );
}
