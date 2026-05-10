'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';

import { NotificationMatrix } from '@/features/settings/components/notification-matrix';
import { PushPermissionBlock } from '@/features/settings/components/push-permission-block';

/**
 * `/settings/notifications` — matriz exata do PRD §3.2 (10 eventos × 3 canais)
 * + bloco de permissão push. Eventos administrativos (Convite, Pagamento)
 * vêm com switch desabilitado e tooltip explicativo.
 *
 * Em M13 entra a integração real com Service Worker + Resend.
 */
export function NotificationsView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description="Escolha em quais canais receber cada evento. Eventos administrativos não podem ser desligados."
      />

      <PushPermissionBlock />
      <NotificationMatrix />
    </div>
  );
}
