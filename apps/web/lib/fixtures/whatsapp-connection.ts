/**
 * Conexão WhatsApp mockada — estado `connected` com health verde + 5 quedas
 * históricas distribuídas nos últimos 30 dias (cobre todos os motivos do
 * `WhatsAppOutage.reason`).
 *
 * Em M9 substituído por leitura do heartbeat real + tabela `connection_outages`.
 */
import { subDays, subHours, subMinutes } from 'date-fns';

import type { WhatsAppConnection, WhatsAppOutage } from '@/features/settings/types';

const NOW = new Date('2026-05-10T14:00:00-03:00');
const WORKSPACE = 'ws_demo';

const OUTAGES: WhatsAppOutage[] = [
  {
    id: 'out_00001',
    startedAt: subDays(NOW, 1).toISOString(),
    durationMin: 8,
    reason: 'celular_offline',
    action: 'Reconectou automaticamente após o celular voltar.',
  },
  {
    id: 'out_00002',
    startedAt: subDays(NOW, 5).toISOString(),
    durationMin: 42,
    reason: 'rede',
    action: 'Pausou 12 cadências em fila — processou após reconexão.',
  },
  {
    id: 'out_00003',
    startedAt: subDays(NOW, 12).toISOString(),
    durationMin: 6,
    reason: 'manutencao',
    action: 'Manutenção planejada do provedor — sem impacto em envios.',
  },
  {
    id: 'out_00004',
    startedAt: subDays(NOW, 18).toISOString(),
    durationMin: 124,
    reason: 'ban_temporario',
    action: 'Health caiu pra vermelho — envios pausados até reativação manual.',
  },
  {
    id: 'out_00005',
    startedAt: subDays(NOW, 26).toISOString(),
    durationMin: 3,
    reason: 'celular_offline',
    action: 'Reconectou automaticamente.',
  },
];

export const FAKE_WHATSAPP_CONNECTION: WhatsAppConnection = {
  workspaceId: WORKSPACE,
  status: 'connected',
  health: 'green',
  phoneNumber: '+55 11 99876-5432',
  displayName: 'Vista Mar Atendimento',
  connectedAt: subDays(NOW, 32).toISOString(),
  lastHeartbeatAt: subMinutes(NOW, 1).toISOString(),
  messagesLast24h: 287,
  deliveryRate: 0.984,
  outages: OUTAGES,
};

/** Quando precisar simular estado vazio (nunca conectou) — usado por testes. */
export const FAKE_WHATSAPP_DISCONNECTED: WhatsAppConnection = {
  workspaceId: WORKSPACE,
  status: 'disconnected',
  health: 'green',
  messagesLast24h: 0,
  deliveryRate: 0,
  outages: [],
};

/** Reuso pra simulação de health amarelo nos testes de transforms. */
export const FAKE_WHATSAPP_YELLOW: WhatsAppConnection = {
  ...FAKE_WHATSAPP_CONNECTION,
  health: 'yellow',
  deliveryRate: 0.84,
  lastHeartbeatAt: subHours(NOW, 1).toISOString(),
};
