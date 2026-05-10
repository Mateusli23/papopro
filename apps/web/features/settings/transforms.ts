/**
 * Transformações puras do domínio Configurações.
 *
 * Toda função aqui é pura: recebe estado + payload, devolve novo estado ou
 * agregação. Sem side-effects, sem React. O store (`store.ts`) é wrapper fino
 * que aplica essas transformações ao snapshot e dispara listeners.
 *
 * Em M7+ cada função vira core de Server Actions correspondentes
 * (`updateWorkspace`, `inviteMember`, `togglePref`, `connectWhatsApp`,
 * `regenerateWebhookToken`). Os contratos permanecem.
 *
 * Decisões de produto codificadas aqui:
 *  - **Owner é único**: `applyTransferOwnership` rebaixa o Owner anterior pra
 *    `'admin'` e promove o destinatário pra `'owner'`. `applyRemoveMember`
 *    rejeita remoção do Owner (precisa transferir antes).
 *  - **Eventos administrativos não desligam**: `applyTogglePref` ignora
 *    requests que tentam desligar `workspace_invite_received` ou
 *    `payment_failed` (PRD §3.2). Retorna o estado inalterado.
 *  - **Health score** derivado de uptime nas últimas 24h + delivery rate:
 *    `green` (≥ 99% uptime e ≥ 95% delivery) / `yellow` (≥ 95% uptime ou
 *    ≥ 85% delivery) / `red` (abaixo disso). Espelha a lógica que vai virar
 *    Edge Function em M9.
 *  - **Token de webhook**: 32 chars hex regenerado por crypto-strength
 *    randomness (browser/node compat — node uses `crypto.randomBytes`).
 */
import type {
  ChangeRoleInput,
  InviteMemberInput,
  NotificationPrefInput,
  ToggleIntegrationInput,
  TransferOwnershipInput,
  WorkspaceUpdateInput,
} from './schemas';
import type {
  Integration,
  Member,
  NotificationEventDef,
  NotificationPrefs,
  Subscription,
  WebhookConfig,
  WhatsAppConnection,
  WhatsAppHealth,
  WhatsAppOutage,
  Workspace,
} from './types';

// ─── Workspace ────────────────────────────────────────────────────────────

export function applyUpdateWorkspace(workspace: Workspace, patch: WorkspaceUpdateInput): Workspace {
  if (
    patch.name === workspace.name &&
    patch.segment === workspace.segment &&
    patch.timezone === workspace.timezone
  ) {
    return workspace;
  }
  return {
    ...workspace,
    name: patch.name,
    segment: patch.segment,
    timezone: patch.timezone,
  };
}

// ─── Membros ──────────────────────────────────────────────────────────────

/**
 * Adiciona convite pendente. Retorna `existing: true` se já existe um membro
 * (ativo ou convidado) com esse e-mail — UI mostra toast informativo.
 */
export function applyInviteMember(
  members: Member[],
  input: InviteMemberInput,
  idGen: () => string,
  now: string = new Date().toISOString(),
  workspaceId: string = members[0]?.workspaceId ?? 'ws_demo',
): { members: Member[]; created?: Member; existing?: Member } {
  const normalized = input.email.trim().toLowerCase();
  const existing = members.find((m) => m.email.toLowerCase() === normalized);
  if (existing) return { members, existing };

  const created: Member = {
    id: idGen(),
    workspaceId,
    name: normalized,
    email: normalized,
    role: input.role,
    status: 'invited',
    invitedAt: now,
    createdAt: now,
  };
  return { members: [...members, created], created };
}

export function applyChangeRole(
  members: Member[],
  input: ChangeRoleInput,
): { members: Member[]; ok: boolean; reason?: string } {
  const m = members.find((x) => x.id === input.memberId);
  if (!m) return { members, ok: false, reason: 'Membro não encontrado' };
  if (m.role === input.role) return { members, ok: true };
  // Só Owner pode promover outro Owner — usar `applyTransferOwnership`.
  if (input.role === 'owner') {
    return {
      members,
      ok: false,
      reason: 'Use "Transferir propriedade" para mudar o Owner',
    };
  }
  if (m.role === 'owner') {
    return {
      members,
      ok: false,
      reason: 'Transfira a propriedade antes de rebaixar o Owner',
    };
  }
  return {
    members: members.map((x) => (x.id === input.memberId ? { ...x, role: input.role } : x)),
    ok: true,
  };
}

export function applyResendInvite(
  members: Member[],
  memberId: string,
  now: string = new Date().toISOString(),
): { members: Member[]; ok: boolean } {
  const m = members.find((x) => x.id === memberId);
  if (!m || m.status !== 'invited') return { members, ok: false };
  return {
    members: members.map((x) => (x.id === memberId ? { ...x, invitedAt: now } : x)),
    ok: true,
  };
}

export function applyRemoveMember(
  members: Member[],
  memberId: string,
): { members: Member[]; ok: boolean; reason?: string } {
  const m = members.find((x) => x.id === memberId);
  if (!m) return { members, ok: false, reason: 'Membro não encontrado' };
  if (m.role === 'owner') {
    return {
      members,
      ok: false,
      reason: 'Transfira a propriedade antes de remover o Owner',
    };
  }
  return { members: members.filter((x) => x.id !== memberId), ok: true };
}

export function applyTransferOwnership(
  members: Member[],
  input: TransferOwnershipInput,
): { members: Member[]; ok: boolean; reason?: string } {
  const currentOwner = members.find((m) => m.role === 'owner');
  const target = members.find((m) => m.id === input.newOwnerId);
  if (!currentOwner) return { members, ok: false, reason: 'Workspace sem Owner' };
  if (!target) return { members, ok: false, reason: 'Membro não encontrado' };
  if (target.id === currentOwner.id) {
    return { members, ok: false, reason: 'Você já é o Owner' };
  }
  if (target.status !== 'active') {
    return {
      members,
      ok: false,
      reason: 'O novo Owner precisa ter aceitado o convite primeiro',
    };
  }
  return {
    members: members.map((m) => {
      if (m.id === currentOwner.id) return { ...m, role: 'admin' };
      if (m.id === target.id) return { ...m, role: 'owner' };
      return m;
    }),
    ok: true,
  };
}

// ─── Notificações ─────────────────────────────────────────────────────────

/**
 * Toggle preferência respeitando:
 *  - canal precisa estar na lista de canais permitidos do evento
 *  - eventos administrativos não podem ser desligados
 */
export function applyTogglePref(
  prefs: NotificationPrefs,
  events: NotificationEventDef[],
  input: NotificationPrefInput,
): { prefs: NotificationPrefs; ok: boolean; reason?: string } {
  const def = events.find((e) => e.key === input.event);
  if (!def) return { prefs, ok: false, reason: 'Evento inválido' };
  if (!def.channels.includes(input.channel)) {
    return { prefs, ok: false, reason: 'Canal não disponível para este evento' };
  }
  if (def.isAdministrative && !input.enabled) {
    return {
      prefs,
      ok: false,
      reason: 'Evento administrativo — não pode ser desligado',
    };
  }
  const eventPrefs = prefs[def.key as keyof NotificationPrefs] ?? {};
  const next: NotificationPrefs = {
    ...prefs,
    [def.key]: { ...eventPrefs, [input.channel]: input.enabled },
  };
  return { prefs: next, ok: true };
}

// ─── Conexão WhatsApp ─────────────────────────────────────────────────────

/**
 * Health derivado de uptime das últimas 24h + delivery rate. Valores espelham
 * defaults da Edge Function de heartbeat que entra em M9.
 */
export function computeHealthScore(
  conn: Pick<WhatsAppConnection, 'outages' | 'deliveryRate' | 'status'>,
  nowMs: number = Date.now(),
): WhatsAppHealth {
  if (conn.status !== 'connected') return 'red';
  const cutoff = nowMs - 24 * 60 * 60 * 1000;
  const downMin = conn.outages.reduce((sum, o) => {
    const startMs = new Date(o.startedAt).getTime();
    if (startMs < cutoff) return sum;
    return sum + (o.durationMin ?? 0);
  }, 0);
  const uptimePct = Math.max(0, 1 - downMin / (24 * 60));
  if (uptimePct >= 0.99 && conn.deliveryRate >= 0.95) return 'green';
  if (uptimePct >= 0.95 || conn.deliveryRate >= 0.85) return 'yellow';
  return 'red';
}

export function applyConnect(
  conn: WhatsAppConnection,
  now: string = new Date().toISOString(),
): WhatsAppConnection {
  if (conn.status === 'connected') return conn;
  return {
    ...conn,
    status: 'connected',
    health: 'green',
    phoneNumber: conn.phoneNumber ?? '+55 11 99999-9999',
    displayName: conn.displayName ?? 'Atendimento',
    connectedAt: conn.connectedAt ?? now,
    lastHeartbeatAt: now,
  };
}

export function applyDisconnect(
  conn: WhatsAppConnection,
  reason: WhatsAppOutage['reason'] = 'manual',
  idGen: () => string = () => `out_${Date.now()}`,
  now: string = new Date().toISOString(),
): WhatsAppConnection {
  if (conn.status === 'disconnected') return conn;
  const outage: WhatsAppOutage = {
    id: idGen(),
    startedAt: now,
    reason,
    action:
      reason === 'manual'
        ? 'Desconexão manual a partir das Configurações.'
        : 'Aguardando reconexão automática.',
  };
  return {
    ...conn,
    status: 'disconnected',
    outages: [outage, ...conn.outages],
  };
}

export function applyAddDisconnection(
  conn: WhatsAppConnection,
  outage: Omit<WhatsAppOutage, 'id'>,
  idGen: () => string,
): WhatsAppConnection {
  return {
    ...conn,
    outages: [{ id: idGen(), ...outage }, ...conn.outages],
  };
}

// ─── Integrações / Webhook ────────────────────────────────────────────────

export function applyToggleIntegration(
  integrations: Integration[],
  input: ToggleIntegrationInput,
  now: string = new Date().toISOString(),
): { integrations: Integration[]; ok: boolean; reason?: string } {
  const i = integrations.find((x) => x.key === input.key);
  if (!i) return { integrations, ok: false, reason: 'Integração não encontrada' };
  if (i.status === 'soon') {
    return { integrations, ok: false, reason: 'Integração indisponível no momento' };
  }
  const next: Integration = input.connect
    ? { ...i, status: 'connected', connectedAt: now }
    : { ...i, status: 'disconnected', connectedAt: undefined };
  return {
    integrations: integrations.map((x) => (x.key === input.key ? next : x)),
    ok: true,
  };
}

/**
 * Gera token 32 hex chars. Em ambiente node usa `crypto.randomBytes`; no
 * browser cai pra `crypto.getRandomValues`. Pure-ish — recebe a fonte de
 * entropia injetada pelos testes via `randomHex`.
 */
export function generateWebhookToken(
  randomHex: (bytes: number) => string = defaultRandomHex,
): string {
  return randomHex(16);
}

export function applyRegenerateWebhookToken(
  webhook: WebhookConfig,
  randomHex: (bytes: number) => string = defaultRandomHex,
  now: string = new Date().toISOString(),
): WebhookConfig {
  return {
    ...webhook,
    token: generateWebhookToken(randomHex),
    generatedAt: now,
  };
}

function defaultRandomHex(bytes: number): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback determinístico-ish — só usado em SSR antigo sem WebCrypto.
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

// ─── Helpers / agregações ─────────────────────────────────────────────────

export function countMembers(members: Member[]) {
  return {
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    invited: members.filter((m) => m.status === 'invited').length,
    byRole: {
      owner: members.filter((m) => m.role === 'owner').length,
      admin: members.filter((m) => m.role === 'admin').length,
      manager: members.filter((m) => m.role === 'manager').length,
      vendedor: members.filter((m) => m.role === 'vendedor').length,
      viewer: members.filter((m) => m.role === 'viewer').length,
    },
  };
}

/**
 * Percentual de uso `[0,1]` por dimensão pra alimentar barras de progresso.
 * Não satura em 1 — overflow visível na UI ("110% do limite") é deliberado.
 */
export function computeUsageRatios(sub: Subscription) {
  return {
    users: sub.limits.users === 0 ? 0 : sub.usage.users / sub.limits.users,
    leads: sub.limits.leads === 0 ? 0 : sub.usage.leads / sub.limits.leads,
    outbound:
      sub.limits.outboundMonth === 0 ? 0 : sub.usage.outboundMonth / sub.limits.outboundMonth,
    whatsappNumbers:
      sub.limits.whatsappNumbers === 0 ? 0 : sub.usage.whatsappNumbers / sub.limits.whatsappNumbers,
    agents: sub.limits.agents === 0 ? 0 : sub.usage.agents / sub.limits.agents,
  };
}
