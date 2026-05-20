import { loadRecentNotifications } from '@/features/notifications/queries';

import { NotificationsDropdown } from './notifications-dropdown';

/**
 * Server wrapper do sino de notificações.
 *
 * **M13#2:** lê o feed real da tabela `notifications` (`loadRecentNotifications`,
 * cached por request) e injeta no Client `<NotificationsDropdown>`. Substitui
 * a mistura M10#4 de cold alerts + fixtures — agora todo evento da matriz PRD
 * §3.2 chega aqui via dispatcher (`lib/notifications/dispatch.ts`).
 *
 * O badge de "leads frios" na sidebar continua separado (`loadColdAlertsCount`)
 * — é a contagem de alertas pendentes de ack, lifecycle próprio do M10#4.
 */
export async function NotificationsButton() {
  const notifications = await loadRecentNotifications();
  return <NotificationsDropdown initialNotifications={notifications} />;
}
