/**
 * Notificações mockadas — alimentam o sino do topbar até M7/M13.
 *
 * Tipos seguem a matriz de eventos da [PRD §3.2]: queda WhatsApp, lead frio,
 * cadência pausada, etc.
 */

export type NotificationKind =
  | 'whatsapp_down'
  | 'lead_cold'
  | 'cadence_paused'
  | 'new_message'
  | 'task_due'
  | 'trial_ending';

export interface FakeNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** ISO timestamp — date-fns formata na UI. */
  createdAt: string;
  read: boolean;
}

const HOURS_AGO = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const FAKE_NOTIFICATIONS: FakeNotification[] = [
  {
    id: 'n_1',
    kind: 'lead_cold',
    title: 'Lead esfriando',
    description: 'João Silva (Imóvel Pro) está há 8 dias sem interação.',
    createdAt: HOURS_AGO(0.5),
    read: false,
  },
  {
    id: 'n_2',
    kind: 'new_message',
    title: 'Nova mensagem WhatsApp',
    description: 'Mariana respondeu à proposta enviada hoje cedo.',
    createdAt: HOURS_AGO(1.2),
    read: false,
  },
  {
    id: 'n_3',
    kind: 'whatsapp_down',
    title: 'Conexão WhatsApp instável',
    description: 'Verifique se o aparelho está online — cadências pausadas.',
    createdAt: HOURS_AGO(3),
    read: false,
  },
  {
    id: 'n_4',
    kind: 'cadence_paused',
    title: 'Cadência pausada',
    description: 'Cadência "Boas-vindas SDR" foi pausada — cliente respondeu.',
    createdAt: HOURS_AGO(8),
    read: true,
  },
  {
    id: 'n_5',
    kind: 'task_due',
    title: 'Tarefa vence amanhã',
    description: 'Ligar para Luiza Mendes sobre proposta enviada.',
    createdAt: HOURS_AGO(20),
    read: true,
  },
];

export function unreadCount(): number {
  return FAKE_NOTIFICATIONS.filter((n) => !n.read).length;
}
