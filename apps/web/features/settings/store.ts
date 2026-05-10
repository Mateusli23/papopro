'use client';

import * as React from 'react';

import { FAKE_MEMBERS } from '@/lib/fixtures/members';
import { FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS } from '@/lib/fixtures/notification-prefs';
import { FAKE_WHATSAPP_CONNECTION } from '@/lib/fixtures/whatsapp-connection';
import {
  FAKE_INTEGRATIONS,
  FAKE_SUBSCRIPTION,
  FAKE_WEBHOOK,
  FAKE_WORKSPACE,
} from '@/lib/fixtures/workspace-settings';

import type {
  ChangeRoleInput,
  InviteMemberInput,
  NotificationPrefInput,
  ToggleIntegrationInput,
  TransferOwnershipInput,
  WorkspaceUpdateInput,
} from './schemas';
import {
  applyChangeRole,
  applyConnect,
  applyDisconnect,
  applyInviteMember,
  applyRegenerateWebhookToken,
  applyRemoveMember,
  applyResendInvite,
  applyToggleIntegration,
  applyTogglePref,
  applyTransferOwnership,
  applyUpdateWorkspace,
  computeHealthScore,
} from './transforms';
import type {
  Integration,
  Member,
  NotificationPrefs,
  Subscription,
  WebhookConfig,
  WhatsAppConnection,
  Workspace,
} from './types';

/**
 * Store in-memory client-side de Configurações — mesmo padrão de
 * `features/agents/store.ts`. Toda lógica de mutação vive nas transforms
 * puras; este arquivo gerencia snapshots + listeners + ID counters.
 *
 * **5 snapshots independentes** — workspace, members, notification prefs,
 * WhatsApp connection e integrações/webhook. Frequências de mudança bem
 * diferentes, então separamos pra evitar re-render desnecessário (mudou nome
 * do workspace, painel de notificações não rerenderiza).
 *
 * Em M7+ cada mutação vira Server Action com input validado por Zod;
 * `useWorkspaceSettings` etc migram pra TanStack Query (`useQuery`) sem mudar
 * a API pública dos hooks.
 *
 * Workspace fixo `'ws_demo'` — em M7 lê do contexto de auth.
 */

// ─── Snapshots ─────────────────────────────────────────────────────────────

let workspaceState: Workspace = FAKE_WORKSPACE;
const workspaceListeners = new Set<() => void>();
const emitWorkspace = () => workspaceListeners.forEach((fn) => fn());
const subscribeWorkspace = (fn: () => void) => {
  workspaceListeners.add(fn);
  return () => workspaceListeners.delete(fn);
};
const getWorkspaceSnapshot = () => workspaceState;
const getWorkspaceServerSnapshot = () => FAKE_WORKSPACE;

let membersState: Member[] = [...FAKE_MEMBERS];
const membersListeners = new Set<() => void>();
const emitMembers = () => membersListeners.forEach((fn) => fn());
const subscribeMembers = (fn: () => void) => {
  membersListeners.add(fn);
  return () => membersListeners.delete(fn);
};
const getMembersSnapshot = () => membersState;
const getMembersServerSnapshot = () => FAKE_MEMBERS;

let prefsState: NotificationPrefs = { ...FAKE_NOTIFICATION_PREFS };
const prefsListeners = new Set<() => void>();
const emitPrefs = () => prefsListeners.forEach((fn) => fn());
const subscribePrefs = (fn: () => void) => {
  prefsListeners.add(fn);
  return () => prefsListeners.delete(fn);
};
const getPrefsSnapshot = () => prefsState;
const getPrefsServerSnapshot = () => FAKE_NOTIFICATION_PREFS;

let connectionState: WhatsAppConnection = FAKE_WHATSAPP_CONNECTION;
const connectionListeners = new Set<() => void>();
const emitConnection = () => connectionListeners.forEach((fn) => fn());
const subscribeConnection = (fn: () => void) => {
  connectionListeners.add(fn);
  return () => connectionListeners.delete(fn);
};
const getConnectionSnapshot = () => connectionState;
const getConnectionServerSnapshot = () => FAKE_WHATSAPP_CONNECTION;

let integrationsState: Integration[] = [...FAKE_INTEGRATIONS];
let webhookState: WebhookConfig = FAKE_WEBHOOK;
const integrationsListeners = new Set<() => void>();
const emitIntegrations = () => integrationsListeners.forEach((fn) => fn());
const subscribeIntegrations = (fn: () => void) => {
  integrationsListeners.add(fn);
  return () => integrationsListeners.delete(fn);
};
const getIntegrationsSnapshot = () => integrationsState;
const getIntegrationsServerSnapshot = () => FAKE_INTEGRATIONS;
const getWebhookSnapshot = () => webhookState;
const getWebhookServerSnapshot = () => FAKE_WEBHOOK;

const subscriptionState: Subscription = FAKE_SUBSCRIPTION;
// Subscription é **read-only em M5** — UI mostra cards e Dialog de "Mudar plano"
// é mock-only sem persistir mudança. Em M12 isso muda via webhook Stripe.

// ─── Hooks de leitura ──────────────────────────────────────────────────────

export function useWorkspaceSettings(): Workspace {
  return React.useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getWorkspaceServerSnapshot,
  );
}

export function useMembers(): Member[] {
  return React.useSyncExternalStore(subscribeMembers, getMembersSnapshot, getMembersServerSnapshot);
}

export function useNotificationPrefs(): NotificationPrefs {
  return React.useSyncExternalStore(subscribePrefs, getPrefsSnapshot, getPrefsServerSnapshot);
}

export function useWhatsAppConnection(): WhatsAppConnection {
  return React.useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    getConnectionServerSnapshot,
  );
}

export function useIntegrations(): Integration[] {
  return React.useSyncExternalStore(
    subscribeIntegrations,
    getIntegrationsSnapshot,
    getIntegrationsServerSnapshot,
  );
}

export function useWebhookConfig(): WebhookConfig {
  return React.useSyncExternalStore(
    subscribeIntegrations,
    getWebhookSnapshot,
    getWebhookServerSnapshot,
  );
}

export function useSubscription(): Subscription {
  // Read-only em M5 — não precisa de listener.
  return subscriptionState;
}

// ─── ID generators ─────────────────────────────────────────────────────────

let memberCounter = membersState.length;
const nextMemberId = () => `mb_${(++memberCounter).toString().padStart(5, '0')}`;

let outageCounter = connectionState.outages.length;
const nextOutageId = () => `out_${(++outageCounter).toString().padStart(5, '0')}`;

// ─── Mutações: workspace ───────────────────────────────────────────────────

export function updateWorkspace(patch: WorkspaceUpdateInput): Workspace {
  const next = applyUpdateWorkspace(workspaceState, patch);
  if (next === workspaceState) return workspaceState;
  workspaceState = next;
  emitWorkspace();
  return workspaceState;
}

// ─── Mutações: membros ─────────────────────────────────────────────────────

export function inviteMember(input: InviteMemberInput): {
  member?: Member;
  alreadyExists?: Member;
} {
  const r = applyInviteMember(membersState, input, nextMemberId);
  if (r.existing) return { alreadyExists: r.existing };
  membersState = r.members;
  emitMembers();
  return { member: r.created };
}

export function changeRole(input: ChangeRoleInput): { ok: boolean; reason?: string } {
  const r = applyChangeRole(membersState, input);
  if (r.members !== membersState) {
    membersState = r.members;
    emitMembers();
  }
  return { ok: r.ok, reason: r.reason };
}

export function resendInvite(memberId: string): boolean {
  const r = applyResendInvite(membersState, memberId);
  if (r.members !== membersState) {
    membersState = r.members;
    emitMembers();
  }
  return r.ok;
}

export function removeMember(memberId: string): { ok: boolean; reason?: string } {
  const r = applyRemoveMember(membersState, memberId);
  if (r.members !== membersState) {
    membersState = r.members;
    emitMembers();
  }
  return { ok: r.ok, reason: r.reason };
}

export function transferOwnership(input: TransferOwnershipInput): {
  ok: boolean;
  reason?: string;
} {
  const r = applyTransferOwnership(membersState, input);
  if (r.members !== membersState) {
    membersState = r.members;
    emitMembers();
  }
  return { ok: r.ok, reason: r.reason };
}

// ─── Mutações: notificações ───────────────────────────────────────────────

export function togglePref(input: NotificationPrefInput): { ok: boolean; reason?: string } {
  const r = applyTogglePref(prefsState, NOTIFICATION_EVENTS, input);
  if (r.prefs !== prefsState) {
    prefsState = r.prefs;
    emitPrefs();
  }
  return { ok: r.ok, reason: r.reason };
}

// ─── Mutações: conexão WhatsApp ───────────────────────────────────────────

export function setConnectingState() {
  if (connectionState.status === 'connecting') return;
  connectionState = { ...connectionState, status: 'connecting' };
  emitConnection();
}

export function connectWhatsApp(): WhatsAppConnection {
  connectionState = applyConnect(connectionState);
  connectionState = {
    ...connectionState,
    health: computeHealthScore(connectionState),
  };
  emitConnection();
  return connectionState;
}

export function disconnectWhatsApp(): WhatsAppConnection {
  connectionState = applyDisconnect(connectionState, 'manual', nextOutageId);
  connectionState = {
    ...connectionState,
    health: computeHealthScore(connectionState),
  };
  emitConnection();
  return connectionState;
}

// ─── Mutações: integrações / webhook ──────────────────────────────────────

export function toggleIntegration(input: ToggleIntegrationInput): {
  ok: boolean;
  reason?: string;
} {
  const r = applyToggleIntegration(integrationsState, input);
  if (r.integrations !== integrationsState) {
    integrationsState = r.integrations;
    emitIntegrations();
  }
  return { ok: r.ok, reason: r.reason };
}

export function regenerateWebhookToken(): WebhookConfig {
  webhookState = applyRegenerateWebhookToken(webhookState);
  emitIntegrations();
  return webhookState;
}
