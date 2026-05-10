/**
 * Tipos do domínio Configurações (PRD §2.1 / §2.6 / §2.7 / §3.2 / §3.11 / §3.12).
 *
 * Em M5 a UI roda 100% sobre fixtures + store in-memory. Os tipos aqui
 * **são o contrato** que vai virar:
 *   - `workspaces`, `workspace_members`, `workspace_invites`, `notification_prefs`,
 *     `whatsapp_connections`, `connection_outages`, `integrations` em Postgres (M7+)
 *   - input de Server Actions (`updateWorkspace`, `inviteMember`, `togglePref`,
 *     `connectWhatsApp`, `regenerateWebhookToken`) em M7–M13
 *
 * Mudar a shape aqui = retrabalho em cascata.
 */

// ─── Workspace ─────────────────────────────────────────────────────────────

/**
 * Segmentos pré-definidos (PRD §3.3 — onboarding wizard).
 * Lista fechada por design — usado pra escolher templates de cadência
 * e copy do onboarding em M11.
 */
export type WorkspaceSegment = 'imobiliario' | 'b2b' | 'servicos' | 'outro';

/** Logotipo: mock leve — guarda só metadata (mesmo padrão do Cérebro). */
export interface WorkspaceLogo {
  name: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  segment: WorkspaceSegment;
  logo?: WorkspaceLogo;
  /** Fuso IANA. Default `America/Sao_Paulo` (CLAUDE.md §5). */
  timezone: string;
  /** Idioma — fixo `pt-BR` no MVP. */
  locale: 'pt-BR';
  createdAt: string;
}

// ─── Plano / Cobrança (PRD §2.7 / §3.12) ──────────────────────────────────

export type PlanTier = 'pro' | 'pro_ia' | 'enterprise';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';

export interface PlanLimits {
  /** Máximo de usuários no workspace. */
  users: number;
  /** Leads ativos. */
  leads: number;
  /** Disparos de WhatsApp por mês. */
  outboundMonth: number;
  /** Números de WhatsApp conectados. */
  whatsappNumbers: number;
  /** Agentes IA ativos (paridade com PRD §3.9 / `MAX_ACTIVE_AGENTS = 3`). */
  agents: number;
}

export interface PlanUsage {
  users: number;
  leads: number;
  outboundMonth: number;
  whatsappNumbers: number;
  agents: number;
}

export interface Invoice {
  id: string;
  /** Data de emissão (ISO). */
  issuedAt: string;
  /** Valor em BRL (decimal — não cents — mock simples). */
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  /** URL mock — em M12 vira link real do Stripe. */
  pdfUrl: string;
}

export interface PaymentMethod {
  brand: 'visa' | 'mastercard' | 'elo' | 'amex';
  last4: string;
  /** MM/AA. */
  expiry: string;
}

export interface Subscription {
  workspaceId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  /** ISO. Em trial = fim do trial; ativa = próxima cobrança. */
  currentPeriodEnd: string;
  /** Valor mensal em BRL. */
  monthlyAmount: number;
  paymentMethod?: PaymentMethod;
  limits: PlanLimits;
  usage: PlanUsage;
  invoices: Invoice[];
}

// ─── Membros / RBAC (PRD §2.6 / §4) ───────────────────────────────────────

export type MemberRole = 'owner' | 'admin' | 'manager' | 'vendedor' | 'viewer';

export type MemberStatus = 'active' | 'invited';

export interface Member {
  id: string;
  workspaceId: string;
  /** Nome completo (ou só email se invite ainda pendente). */
  name: string;
  email: string;
  /** URL/initial. Em M5 mock — emoji ou inicial. */
  avatarEmoji?: string;
  role: MemberRole;
  status: MemberStatus;
  /** Último acesso — `undefined` se status === 'invited'. */
  lastSeenAt?: string;
  /** Quando o convite foi enviado — só quando status === 'invited'. */
  invitedAt?: string;
  createdAt: string;
}

// ─── Notificações (PRD §3.2) ──────────────────────────────────────────────

/**
 * 10 eventos da matriz do PRD §3.2 — ordem deliberada (mais frequentes no topo).
 * Renomear breakaria a UI E o storage; mudar só em M13.
 */
export type NotificationEventKey =
  | 'new_lead_assigned'
  | 'whatsapp_message_received'
  | 'lead_cooling'
  | 'task_due'
  | 'whatsapp_connection_down'
  | 'workspace_invite_received'
  | 'trial_expiring'
  | 'payment_failed'
  | 'agent_handoff_to_human'
  | 'bulk_send_finished';

export type NotificationChannel = 'inapp' | 'push' | 'email';

/**
 * Default + admin flag por evento. Carregado em paralelo com `notificationPrefs`
 * pra que a UI saiba qual switch desabilitar e qual ✅ está "marcado por padrão".
 */
export interface NotificationEventDef {
  key: NotificationEventKey;
  label: string;
  description: string;
  /** Quais canais o evento pode usar (matriz PRD §3.2). */
  channels: NotificationChannel[];
  /**
   * Eventos administrativos — Convite e Pagamento (PRD §3.2 explícito). UI
   * desabilita os switches; transforms ignoram tentativa de desligar.
   */
  isAdministrative: boolean;
}

/**
 * Preferência efetiva: para cada evento × canal possível, `on` / `off`.
 * Default = todos `on` para os canais permitidos no PRD.
 */
export type NotificationPrefs = Record<
  NotificationEventKey,
  Partial<Record<NotificationChannel, boolean>>
>;

// ─── Conexão WhatsApp (PRD §2.4 / §3.3) ───────────────────────────────────

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected';

/** Health score derivado de uptime + entrega + warnings (CLAUDE.md §9). */
export type WhatsAppHealth = 'green' | 'yellow' | 'red';

export interface WhatsAppOutage {
  id: string;
  /** Início da queda (ISO). */
  startedAt: string;
  /** Duração em minutos — undefined se ainda em andamento. */
  durationMin?: number;
  reason: 'celular_offline' | 'rede' | 'ban_temporario' | 'manutencao' | 'manual';
  /** O que o sistema fez (auto-reconectou, pausou cadências, etc). */
  action: string;
}

export interface WhatsAppConnection {
  workspaceId: string;
  status: WhatsAppStatus;
  health: WhatsAppHealth;
  /** Número conectado — formato BR `+55 11 99999-9999`. */
  phoneNumber?: string;
  /** Nome exibido no perfil do WhatsApp. */
  displayName?: string;
  /** Quando conectou pela última vez (ISO). */
  connectedAt?: string;
  /** Último heartbeat OK (ISO). */
  lastHeartbeatAt?: string;
  /** Mensagens enviadas nas últimas 24h. */
  messagesLast24h: number;
  /** Taxa de entrega [0–1]. */
  deliveryRate: number;
  /** Histórico de quedas — ordenado mais recente primeiro. */
  outages: WhatsAppOutage[];
}

// ─── Integrações (PRD §2.3 / §3.7) ────────────────────────────────────────

export type IntegrationKey =
  | 'google_calendar'
  | 'webhook_leads'
  | 'meta_ads'
  | 'google_ads'
  | 'rd_station'
  | 'hotmart';

export type IntegrationStatus = 'connected' | 'disconnected' | 'soon';

export interface Integration {
  key: IntegrationKey;
  /** Nome curto pra UI. */
  label: string;
  /** 1 linha — propósito da integração. */
  description: string;
  status: IntegrationStatus;
  /** ISO — quando foi conectada (só se status === 'connected'). */
  connectedAt?: string;
  /** Hint pro card explicar a categoria — "OAuth" / "Webhook" / "Em breve". */
  badge?: string;
}

export interface WebhookConfig {
  workspaceId: string;
  /** Token único — 32 chars hex. Webhook URL = `/api/webhooks/leads/<token>`. */
  token: string;
  /** Quando o token foi gerado (regenerar troca isso). */
  generatedAt: string;
  /** Última requisição recebida — `undefined` se nunca. */
  lastReceivedAt?: string;
  /** Total de leads inbound recebidos (mock). */
  totalReceived: number;
}
