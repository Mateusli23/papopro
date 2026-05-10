'use client';

import * as React from 'react';

import { FAKE_CONVERSATIONS, FAKE_WHATSAPP_CONNECTION } from '@/lib/fixtures/conversations';
import { FAKE_MESSAGES } from '@/lib/fixtures/messages';
import { FAKE_QUICK_REPLIES } from '@/lib/fixtures/quick-replies';

import { countUnreadConversations, messagesForConversation, sortConversations } from './transforms';
import type { Conversation, Message, QuickReply, WhatsAppConnection } from './types';

/**
 * Store in-memory client-side da Inbox — mesmo padrão de `features/cadences/store.ts`.
 * Toda lógica de leitura usa transforms puras de [./transforms.ts](./transforms.ts);
 * este arquivo só gerencia snapshots + listeners.
 *
 * **M5#4a entrega só leitura** + `markConversationRead` (zera unread quando
 * vendor abre a thread). As mutações de envio (`sendMessage`,
 * `addInternalNote`, `archiveConversation`, etc) entram em M5#4b/c.
 *
 * Em M9 cada hook migra pra TanStack Query (`useQuery`) sem mudar a
 * assinatura pública — componentes não precisam saber.
 */

// ─── Snapshots mutáveis ──────────────────────────────────────────────────

let conversationsState: Conversation[] = [...FAKE_CONVERSATIONS];
let messagesState: Message[] = [...FAKE_MESSAGES];

// Listeners separados pra evitar re-render dos painéis sem mudança neles.
const conversationListeners = new Set<() => void>();
const messageListeners = new Set<() => void>();

function emitConversations() {
  for (const fn of conversationListeners) fn();
}
function emitMessages() {
  for (const fn of messageListeners) fn();
}

function subscribeConversations(fn: () => void) {
  conversationListeners.add(fn);
  return () => conversationListeners.delete(fn);
}
function subscribeMessages(fn: () => void) {
  messageListeners.add(fn);
  return () => messageListeners.delete(fn);
}

function getConversationsSnapshot() {
  return conversationsState;
}
function getMessagesSnapshot() {
  return messagesState;
}

function getConversationsServerSnapshot() {
  return FAKE_CONVERSATIONS;
}
function getMessagesServerSnapshot() {
  return FAKE_MESSAGES;
}

// ─── Hooks de leitura ────────────────────────────────────────────────────

/** Lista crua de conversas (sem ordenação aplicada). Use `useSortedConversations` na lista. */
export function useConversations(): Conversation[] {
  return React.useSyncExternalStore(
    subscribeConversations,
    getConversationsSnapshot,
    getConversationsServerSnapshot,
  );
}

export function useSortedConversations(): Conversation[] {
  const all = useConversations();
  return React.useMemo(() => sortConversations(all), [all]);
}

export function useConversation(id: string | undefined): Conversation | undefined {
  const all = useConversations();
  return React.useMemo(() => (id ? all.find((c) => c.id === id) : undefined), [all, id]);
}

/**
 * Mensagens de uma conversa, ordenadas crescente. Filtra do snapshot global.
 *
 * Aceita `undefined` pra simplificar o caso "nenhuma conversa selecionada"
 * sem precisar render condicional na chamada.
 */
export function useMessages(conversationId: string | undefined): Message[] {
  const all = React.useSyncExternalStore(
    subscribeMessages,
    getMessagesSnapshot,
    getMessagesServerSnapshot,
  );
  return React.useMemo(
    () => (conversationId ? messagesForConversation(all, conversationId) : []),
    [all, conversationId],
  );
}

const QUICK_REPLIES: ReadonlyArray<QuickReply> = [...FAKE_QUICK_REPLIES].sort(
  (a, b) => a.order - b.order,
);

/** Lista de respostas rápidas — estática em M5; em M9 vira useQuery contra `quick_replies`. */
export function useQuickReplies(): ReadonlyArray<QuickReply> {
  return QUICK_REPLIES;
}

/**
 * Conexão WhatsApp do workspace. Em M5 estado fixo `connected`; em M9 lê do
 * Realtime canal `workspace:<id>:whatsapp_connection`.
 */
export function useWhatsAppConnection(): WhatsAppConnection {
  return FAKE_WHATSAPP_CONNECTION;
}

/** Total de mensagens não lidas (para badge da sidebar). */
export function useUnreadCount(): number {
  const conversations = useConversations();
  return React.useMemo(() => countUnreadConversations(conversations), [conversations]);
}

// ─── Mutações disponíveis em M5#4a ───────────────────────────────────────

/**
 * Marca uma conversa como lida — zera `unreadCount` e seta `readAt` em todas
 * as mensagens inbound não-lidas. Chamado quando o vendedor abre a thread.
 *
 * Em M9 também atualiza `messages.read_at` via batch update + dispatch
 * Realtime pro celular do lead receber o "check duplo azul".
 */
export function markConversationRead(conversationId: string): void {
  const target = conversationsState.find((c) => c.id === conversationId);
  if (!target || target.unreadCount === 0) return;

  const now = new Date().toISOString();

  conversationsState = conversationsState.map((c) =>
    c.id === conversationId ? { ...c, unreadCount: 0 } : c,
  );

  messagesState = messagesState.map((m) => {
    if (m.conversationId !== conversationId) return m;
    if (m.direction !== 'in' || m.readAt) return m;
    return { ...m, readAt: now };
  });

  emitConversations();
  emitMessages();
}
