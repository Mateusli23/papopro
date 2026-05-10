/**
 * Matriz exata de eventos × canais do PRD §3.2.
 *
 * Cada evento declara em quais canais pode ser entregue + se é administrativo
 * (Convite e Pagamento — não podem ser desligados; UI marca switch disabled).
 *
 * Em M13 essa matriz vira a fonte da verdade pro motor de envio real
 * (web push, Resend, in-app). O shape **não muda** quando isso acontecer —
 * só ganhamos persistência via Postgres ao invés de in-memory.
 */
import type {
  NotificationEventDef,
  NotificationEventKey,
  NotificationPrefs,
} from '@/features/settings/types';

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  {
    key: 'new_lead_assigned',
    label: 'Novo lead atribuído ao vendedor',
    description: 'Quando um lead é atribuído a você manualmente ou por regra.',
    channels: ['inapp', 'push'],
    isAdministrative: false,
  },
  {
    key: 'whatsapp_message_received',
    label: 'Cliente respondeu mensagem WhatsApp',
    description: 'Mensagem nova de um lead seu na caixa.',
    channels: ['inapp', 'push'],
    isAdministrative: false,
  },
  {
    key: 'lead_cooling',
    label: 'Lead esfriando (atingiu prazo da etapa)',
    description: 'Lead passou do prazo configurado na etapa atual.',
    channels: ['inapp', 'push'],
    isAdministrative: false,
  },
  {
    key: 'task_due',
    label: 'Tarefa programada chegou na hora',
    description: 'Lembrete da tarefa no horário agendado.',
    channels: ['inapp', 'push'],
    isAdministrative: false,
  },
  {
    key: 'whatsapp_connection_down',
    label: 'Conexão WhatsApp caiu',
    description: 'O número do workspace ficou offline — cadências em fila pausadas.',
    channels: ['inapp', 'push', 'email'],
    isAdministrative: false,
  },
  {
    key: 'workspace_invite_received',
    label: 'Convite para workspace recebido',
    description: 'Você foi convidado para um workspace — evento administrativo.',
    channels: ['email'],
    isAdministrative: true,
  },
  {
    key: 'trial_expiring',
    label: 'Trial expirando em 2 dias',
    description: 'Seu período de teste acaba em breve — adicione um cartão.',
    channels: ['inapp', 'push', 'email'],
    isAdministrative: false,
  },
  {
    key: 'payment_failed',
    label: 'Pagamento falhou ou próximo do vencimento',
    description: 'Cobrança recusada ou cartão expirando — evento administrativo.',
    channels: ['inapp', 'email'],
    isAdministrative: true,
  },
  {
    key: 'agent_handoff_to_human',
    label: 'Agente IA fez handoff para humano',
    description: 'Um agente IA pediu intervenção humana numa conversa.',
    channels: ['inapp', 'push'],
    isAdministrative: false,
  },
  {
    key: 'bulk_send_finished',
    label: 'Disparo em massa terminou',
    description: 'Sua campanha de disparo terminou de processar.',
    channels: ['inapp'],
    isAdministrative: false,
  },
];

export const NOTIFICATION_EVENT_KEYS: NotificationEventKey[] = NOTIFICATION_EVENTS.map(
  (e) => e.key,
);

/**
 * Default = todos os canais permitidos `on`. Vendedor desliga aos poucos
 * conforme descobre o que cansa.
 */
export const FAKE_NOTIFICATION_PREFS: NotificationPrefs = NOTIFICATION_EVENTS.reduce((acc, e) => {
  acc[e.key] = e.channels.reduce<Partial<Record<(typeof e.channels)[number], boolean>>>(
    (channelAcc, c) => {
      channelAcc[c] = true;
      return channelAcc;
    },
    {},
  );
  return acc;
}, {} as NotificationPrefs);
