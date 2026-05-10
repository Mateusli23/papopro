/**
 * Workspace mockado para a tela de Configurações — uma "demonstração rica"
 * (paridade com agentes/inbox): plano Pro IA em trial, integração Google
 * Calendar já conectada, webhook gerado, métricas plausíveis.
 *
 * Em M7+ substitui por `SELECT * FROM workspaces WHERE id = ?`.
 */
import { subDays, subHours } from 'date-fns';

import type {
  Integration,
  Invoice,
  Subscription,
  WebhookConfig,
  Workspace,
} from '@/features/settings/types';

const NOW = new Date('2026-05-10T14:00:00-03:00');

export const FAKE_WORKSPACE: Workspace = {
  id: 'ws_demo',
  name: 'Imobiliária Vista Mar',
  segment: 'imobiliario',
  logo: {
    name: 'logo-vista-mar.png',
    sizeBytes: 142_336,
    uploadedAt: subDays(NOW, 18).toISOString(),
  },
  timezone: 'America/Sao_Paulo',
  locale: 'pt-BR',
  createdAt: subDays(NOW, 32).toISOString(),
};

// ─── Plano / cobrança ─────────────────────────────────────────────────────

const INVOICES: Invoice[] = [
  {
    id: 'inv_00001',
    issuedAt: subDays(NOW, 90).toISOString(),
    amount: 497,
    status: 'paid',
    pdfUrl: 'https://billing.stripe.com/invoice/mock-1',
  },
  {
    id: 'inv_00002',
    issuedAt: subDays(NOW, 60).toISOString(),
    amount: 497,
    status: 'paid',
    pdfUrl: 'https://billing.stripe.com/invoice/mock-2',
  },
  {
    id: 'inv_00003',
    issuedAt: subDays(NOW, 30).toISOString(),
    amount: 497,
    status: 'paid',
    pdfUrl: 'https://billing.stripe.com/invoice/mock-3',
  },
  {
    id: 'inv_00004',
    issuedAt: subDays(NOW, 2).toISOString(),
    amount: 497,
    status: 'pending',
    pdfUrl: 'https://billing.stripe.com/invoice/mock-4',
  },
];

export const FAKE_SUBSCRIPTION: Subscription = {
  workspaceId: FAKE_WORKSPACE.id,
  plan: 'pro_ia',
  status: 'trialing',
  /** Trial termina daqui 3 dias — alimenta o selo "Faltam 3 dias" em /billing. */
  currentPeriodEnd: subHours(NOW, -3 * 24).toISOString(),
  monthlyAmount: 497,
  paymentMethod: {
    brand: 'mastercard',
    last4: '4242',
    expiry: '12/27',
  },
  /** Limites do plano Pro IA (PRD §2.7). */
  limits: {
    users: 10,
    leads: 20_000,
    outboundMonth: 20_000,
    whatsappNumbers: 3,
    agents: 3,
  },
  /** Uso plausível pra mostrar barras de progresso úteis. */
  usage: {
    users: 8,
    leads: 4_231,
    outboundMonth: 12_847,
    whatsappNumbers: 1,
    agents: 2,
  },
  invoices: INVOICES,
};

// ─── Integrações ──────────────────────────────────────────────────────────

export const FAKE_INTEGRATIONS: Integration[] = [
  {
    key: 'google_calendar',
    label: 'Google Calendar',
    description: 'Sincroniza tarefas do CRM com o calendário do vendedor (bidirecional).',
    status: 'connected',
    connectedAt: subDays(NOW, 12).toISOString(),
    badge: 'OAuth',
  },
  {
    key: 'webhook_leads',
    label: 'Webhook de leads',
    description: 'URL única do workspace para receber leads de formulários e ads.',
    status: 'connected',
    connectedAt: subDays(NOW, 32).toISOString(),
    badge: 'Webhook',
  },
  {
    key: 'meta_ads',
    label: 'Meta Ads (Lead Ads)',
    description: 'Integração nativa com formulários do Facebook e Instagram.',
    status: 'soon',
    badge: 'Em breve',
  },
  {
    key: 'google_ads',
    label: 'Google Ads',
    description: 'Importa leads vindos de campanhas do Google.',
    status: 'soon',
    badge: 'Em breve',
  },
  {
    key: 'rd_station',
    label: 'RD Station',
    description: 'Recebe leads qualificados pelo RD Station Marketing.',
    status: 'soon',
    badge: 'Em breve',
  },
  {
    key: 'hotmart',
    label: 'Hotmart',
    description: 'Cria lead automaticamente após compra de infoproduto.',
    status: 'soon',
    badge: 'Em breve',
  },
];

export const FAKE_WEBHOOK: WebhookConfig = {
  workspaceId: FAKE_WORKSPACE.id,
  /** 32 chars hex — formato espelha `randomBytes(16).toString('hex')`. */
  token: 'a3f7c9d12e8b4f5a6c0d9e1f2a3b4c5d',
  generatedAt: subDays(NOW, 32).toISOString(),
  lastReceivedAt: subHours(NOW, 4).toISOString(),
  totalReceived: 137,
};
