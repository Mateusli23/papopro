import { loadActiveColdAlerts } from '@/lib/cold-alerts/load-count';

import { NotificationsDropdown } from './notifications-dropdown';

/**
 * Server wrapper do sino de notificações (M10#4).
 *
 * Carrega `loadActiveColdAlerts` (cached por request — mesmo round-trip do
 * badge sidebar) e injeta como prop no Client `<NotificationsDropdown>`.
 *
 * **Por que Server wrapper:** cold alerts precisam respeitar RBAC fino
 * (Vendedor só dos próprios leads) — não dá pra fazer no client sem expor
 * lógica de role. Server resolve uma vez por request.
 *
 * **Fixture legacy continua viva** no dropdown — só os cold alerts são reais
 * em M10#4. Full migração in-app pra tabela `notifications` real fica pra M13
 * junto com push (PRD §3.2 matriz completa).
 */
export async function NotificationsButton() {
  const coldAlerts = await loadActiveColdAlerts();
  return <NotificationsDropdown initialColdAlerts={coldAlerts} />;
}
