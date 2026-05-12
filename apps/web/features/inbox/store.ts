'use client';

import * as React from 'react';

import { useLeads } from '@/features/leads/store';
import { FAKE_CONVERSATIONS, FAKE_WHATSAPP_CONNECTION } from '@/lib/fixtures/conversations';
import { FAKE_MESSAGES } from '@/lib/fixtures/messages';
import { FAKE_QUICK_REPLIES } from '@/lib/fixtures/quick-replies';

import {
  attachMediaSchema,
  type AttachMediaInput,
  type SendInternalNoteInput,
  type SendTextMessageInput,
} from './schemas';
import {
  applyArchiveConversation,
  applyAttachMedia,
  applyReassignConversation,
  applySendInternalNote,
  applySendMessage,
  applyUnarchiveConversation,
  countUnreadConversations,
  filterConversations,
  type InboxFilterContext,
  type InboxLeadHandle,
  messagesForConversation,
  sortConversations,
} from './transforms';
import type { Conversation, InboxFilters, Message, QuickReply, WhatsAppConnection } from './types';

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

/**
 * Lista de respostas rápidas — estática em M5; em M9 vira `useQuery` contra
 * `quick_replies` no Postgres com RLS por workspace.
 *
 * **Por que `useMemo` em vez de constante de módulo?** Quando M5#6 (settings)
 * adicionar CRUD de quick replies que mute `FAKE_QUICK_REPLIES`, a Inbox
 * precisa ver a lista atualizada. Constante avaliada no module-load
 * congela o snapshot. Custo do sort: trivial (8 itens). Fix do review M5#4b
 * (HIGH #6).
 */
export function useQuickReplies(): ReadonlyArray<QuickReply> {
  return React.useMemo(() => [...FAKE_QUICK_REPLIES].sort((a, b) => a.order - b.order), []);
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

// ─── Lookup de leads pra filtros (M5#4c) ─────────────────────────────────

/**
 * Hook composto: retorna conversas **ordenadas + filtradas** segundo `filters`.
 *
 * Combina três snapshots reativos:
 *  - `useSortedConversations()` — conversations + sort
 *  - `useSyncExternalStore` — messages (filtros de noReplyDays)
 *  - `useLeads()` — **lookup live** de leads (review M5#4c MEDIUM): mover
 *    um lead pra outra etapa via Kanban OU via quick action "Mover etapa"
 *    refleete imediatamente no filtro `stageId` da inbox. Sem isso, o map
 *    seria estático nas fixtures iniciais e o filtro mostraria estado
 *    obsoleto até full reload.
 *
 * Tudo dentro de `useMemo` com chaves estáveis — re-roda quando qualquer
 * snapshot muda, preserva referência idêntica entre renders sem mudança
 * real (essencial pro `React.memo` do `<ConversationListItem>`).
 *
 * **Default oculta arquivadas** (regra do `filterConversations`). Pra
 * mostrar arquivadas o caller passa `filters.status === 'archived'`.
 */
export function useFilteredConversations(filters: InboxFilters): Conversation[] {
  const conversations = useSortedConversations();
  const messages = React.useSyncExternalStore(
    subscribeMessages,
    getMessagesSnapshot,
    getMessagesServerSnapshot,
  );
  const leads = useLeads();

  // Map montado por render — barato (50 leads em M5; em M9 vira JOIN no
  // Postgres). `useMemo` reaproveita quando `leads` não muda referência.
  const leadById = React.useMemo<ReadonlyMap<string, InboxLeadHandle>>(
    () =>
      new Map(
        leads.map((l) => [
          l.id,
          {
            stageId: l.stageId,
            name: l.name,
            company: l.company,
            phone: l.phone,
          } satisfies InboxLeadHandle,
        ]),
      ),
    [leads],
  );

  return React.useMemo(() => {
    const ctx: InboxFilterContext = { messages, leadById };
    return filterConversations(conversations, filters, ctx);
  }, [conversations, messages, leadById, filters]);
}

// ─── Mutações ─────────────────────────────────────────────────────────────

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

// ─── Identidade do usuário logado (mock) ──────────────────────────────────

/**
 * Em M5 o "vendedor logado" é fixo. Em M7#3 a auth virou real, mas o inbox
 * ainda consome fixtures (M9 vai ligar uazapi de verdade) — quando essa
 * troca acontecer, o user_id real vem de `useUser()` (lib/auth/use-user.ts)
 * ou `getCurrentUser()` (lib/auth/get-user.ts), e o `authorId` das mensagens
 * outbound passa a casar com `auth.uid()`.
 *
 * `user_mateus` casa com o `authorId` usado nas fixtures de mensagem
 * outbound — mantém o avatar consistente com o histórico.
 */
const CURRENT_USER_ID = 'user_mateus';

// ─── ID generator para mensagens locais ──────────────────────────────────

/**
 * Gerador monotônico para mensagens criadas pelo composer. Prefixo `local_`
 * evita colisão com `msg_NNN` das fixtures e deixa fácil distinguir em
 * debug/smoke o que veio do seed vs. da sessão.
 *
 * Reset entre testes: o smoke endpoint chama os transforms diretamente com
 * seu próprio `idGen`, sem tocar este contador.
 */
let nextLocalMsgIdx = 0;
function nextLocalMessageId(): string {
  nextLocalMsgIdx += 1;
  return `msg_local_${nextLocalMsgIdx}`;
}

// ─── Mutações do composer (M5#4b) ────────────────────────────────────────

/**
 * Aplica mark-read sobre o resultado de uma mutação SEM emitir, para fazer
 * envio + auto-mark numa única transação (uma emissão de listeners apenas).
 *
 * Sem isso, `sendMessage` emitia 2x sequencialmente (envio + mark), o que
 * provoca double-render no `ScrollAnchor` e flicker no badge. Crítico
 * fixado no review do M5#4b (CRITICAL #4).
 */
function applyAutoMarkRead(
  conversations: Conversation[],
  messages: Message[],
  conversationId: string,
): { conversations: Conversation[]; messages: Message[] } {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target || target.unreadCount === 0) return { conversations, messages };
  const now = new Date().toISOString();
  return {
    conversations: conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c,
    ),
    messages: messages.map((m) => {
      if (m.conversationId !== conversationId) return m;
      if (m.direction !== 'in' || m.readAt) return m;
      return { ...m, readAt: now };
    }),
  };
}

/**
 * Envia mensagem de texto. Após persistir, marca a conversa como lida —
 * espelha WhatsApp Web: vendedor responder ⇒ leu tudo (decisão UX M5#4b).
 *
 * Retorna a `Message` criada pra que o caller possa fazer optimistic UX
 * (highlight, scroll-to-bottom imediato) sem ter que reler o snapshot.
 *
 * Em M9 `applySendMessage` é chamado pela Server Action que primeiro passa
 * pelo `lib/whatsapp/anti-ban.ts`; aqui é direto porque tudo é mock.
 */
export function sendMessage(conversationId: string, input: SendTextMessageInput): Message {
  const sendResult = applySendMessage(
    conversationsState,
    messagesState,
    conversationId,
    input,
    CURRENT_USER_ID,
    nextLocalMessageId,
  );
  // Combina mark-read na mesma transação — uma emissão final apenas.
  const marked = applyAutoMarkRead(sendResult.conversations, sendResult.messages, conversationId);
  conversationsState = marked.conversations;
  messagesState = marked.messages;
  emitConversations();
  emitMessages();
  return sendResult.message;
}

/**
 * Salva nota interna (visível só ao time, fundo amarelo + cadeado na thread).
 * **Não** mexe em `status` da conversa nem aciona auto-mark-read — nota
 * interna não é interação com cliente.
 */
export function sendInternalNote(conversationId: string, input: SendInternalNoteInput): Message {
  const result = applySendInternalNote(
    conversationsState,
    messagesState,
    conversationId,
    input,
    CURRENT_USER_ID,
    nextLocalMessageId,
  );
  conversationsState = result.conversations;
  messagesState = result.messages;
  emitConversations();
  emitMessages();
  return result.message;
}

/**
 * Anexa mídia (image/audio/document) à conversa. Auto-mark-read igual a
 * `sendMessage` — anexar mídia é mandar pro lead, conta como resposta.
 *
 * Em M5 é mock: `mediaSizeKb` vem do `File.size` mas o arquivo não vai
 * pra Storage. Em M9 a Server Action upload via Supabase Storage e troca
 * o `mediaName` pelo `storage_path`.
 *
 * Validação Zod aplicada antes de mutar — protege invariantes do schema
 * (ex: `kind: 'audio'` sem `mediaDurationSeconds` quebra aqui em dev).
 * Crítico fixado no review do M5#4b (CRITICAL #3).
 */
export function attachMedia(conversationId: string, input: AttachMediaInput): Message {
  // Validação inline pra blindar contra callers que não fizeram parse
  // antes (ex: file picker do composer pegando arquivos sem duração).
  const parsed = attachMediaSchema.parse(input);
  const sendResult = applyAttachMedia(
    conversationsState,
    messagesState,
    conversationId,
    parsed,
    CURRENT_USER_ID,
    nextLocalMessageId,
  );
  const marked = applyAutoMarkRead(sendResult.conversations, sendResult.messages, conversationId);
  conversationsState = marked.conversations;
  messagesState = marked.messages;
  emitConversations();
  emitMessages();
  return sendResult.message;
}

// ─── Mutações: archive / unarchive / reassign (M5#4c) ────────────────────

/**
 * Arquiva conversa. Toast com "Desfazer" no caller chama `unarchiveConversation`
 * pra reverter — ver `<LeadFichaQuickActions>`. Idempotente.
 */
export function archiveConversation(conversationId: string): void {
  const next = applyArchiveConversation(conversationsState, conversationId);
  if (next === conversationsState) return; // já arquivada → no-op silencioso
  conversationsState = next;
  emitConversations();
}

/**
 * Desarquiva conversa, recalculando `status` a partir da última mensagem
 * não-nota. Idempotente — conversa já ativa retorna sem emitir.
 */
export function unarchiveConversation(conversationId: string): void {
  const next = applyUnarchiveConversation(conversationsState, messagesState, conversationId);
  if (next === conversationsState) return;
  conversationsState = next;
  emitConversations();
}

/**
 * Reatribui a conversa a outro vendedor. **Não toca leads** — decisão de
 * design: a conversa carrega seu próprio dono, separado do `assignedRepId`
 * do lead. Ver `applyReassignConversation`.
 */
export function reassignConversation(conversationId: string, vendorId: string): void {
  const next = applyReassignConversation(conversationsState, conversationId, vendorId);
  if (next === conversationsState) return;
  conversationsState = next;
  emitConversations();
}
