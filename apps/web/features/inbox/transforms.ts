/**
 * Transformações puras do domínio Inbox.
 *
 * Toda função aqui é pura: recebe `Conversation[]` / `Message[]`, devolve
 * arrays/agregações novas. Sem side-effects, sem React. O store
 * (`store.ts`) é wrapper fino que aplica e dispara listeners.
 *
 * Em M9 cada uma vira input pra Server Actions / queries Prisma; o motor
 * uazapi consome `applySendMessage` (M5#4b) antes de tocar o adapter.
 *
 * **M5#4a entrega só leitura** — sort/group/filter/preview. Mutações
 * (`applySendMessage`, `applyArchiveConversation`, etc) entram em M5#4b/c.
 */
import { differenceInDays, parseISO } from 'date-fns';

import { dayKeyBrt, dayLabelBrt } from './hooks/inbox-tz';
import type { Conversation, Message, MessageKind } from './types';

// ─── Sort / busca por entidade ────────────────────────────────────────────

/**
 * Ordena conversas: arquivadas no fim, ativas no topo (mais recente primeiro).
 * Estável dentro de cada bucket via comparação de string ISO (UTC).
 */
export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aArchived = !!a.archivedAt;
    const bArchived = !!b.archivedAt;
    if (aArchived !== bArchived) return aArchived ? 1 : -1;
    return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
  });
}

/** Mensagens de uma conversa, ordem cronológica crescente. */
export function messagesForConversation(messages: Message[], conversationId: string): Message[] {
  return messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

// ─── Agrupamento por dia ──────────────────────────────────────────────────

export interface DayGroup {
  /** Label localizado: "Hoje", "Ontem" ou "qua, 7 mai 2026". */
  label: string;
  /** Chave estável `yyyy-MM-dd` — usada como `key` em listas React. */
  dayKey: string;
  messages: Message[];
}

/**
 * Agrupa mensagens por dia **no fuso da workspace** (`America/Sao_Paulo`)
 * — usado pra divisores na thread. Espera entrada ordenada cronológicamente
 * (use `messagesForConversation`).
 *
 * **TZ-safe**: usa `Intl.DateTimeFormat` com `timeZone` explícito (ver
 * `hooks/inbox-tz.ts`). `date-fns` puro usaria a TZ do runtime — server
 * (UTC) e browser (BRT) gerariam dayKeys diferentes pra mensagens entre
 * 21h e 24h locais → hydration mismatch. O wrapper Intl resolve.
 *
 * `now` parametrizável pra testes; default `new Date()`. **Cuidado**:
 * o `now` é usado só pra "Hoje"/"Ontem" — agrupar messagens é
 * determinístico independente de quando rodou.
 */
export function groupMessagesByDay(messages: Message[], now: Date = new Date()): DayGroup[] {
  if (messages.length === 0) return [];
  const groups: DayGroup[] = [];
  let current: DayGroup | undefined;
  for (const msg of messages) {
    const dayKey = dayKeyBrt(msg.createdAt);
    if (!current || current.dayKey !== dayKey) {
      current = { label: dayLabelBrt(msg.createdAt, now), dayKey, messages: [] };
      groups.push(current);
    }
    current.messages.push(msg);
  }
  return groups;
}

// ─── Last message lookups ────────────────────────────────────────────────

/**
 * Última mensagem inbound (do lead) na thread — ignora notas internas, que
 * são sempre outbound mas não contam como "interação com cliente".
 */
export function getLastInboundMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.direction === 'in') return m;
  }
  return undefined;
}

/** Última mensagem outbound enviada pelo time (texto/mídia, exclui nota interna). */
export function getLastOutboundMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.direction === 'out' && m.kind !== 'internal_note') return m;
  }
  return undefined;
}

// ─── Time-based queries ──────────────────────────────────────────────────

/**
 * Quantos dias completos passaram desde a última mensagem inbound.
 *
 * Retorno:
 *  - `number`: dias completos (≥0). 0 = mesmo dia.
 *  - `undefined`: lead nunca respondeu — caller decide como filtrar.
 *
 * Em filtros "sem resposta há X dias" tratamos `undefined` como "lead silent
 * forever" (passa qualquer threshold), pra leads que receberam outbound
 * mas nunca responderam aparecerem em todos os filtros de noReplyDays.
 */
export function daysSinceLastInbound(
  messages: Message[],
  now: Date = new Date(),
): number | undefined {
  const last = getLastInboundMessage(messages);
  if (!last) return undefined;
  return differenceInDays(now, parseISO(last.createdAt));
}

// ─── Preview pra item da lista ───────────────────────────────────────────

const PREVIEW_PREFIX: Record<MessageKind, string> = {
  text: '',
  image: '📷 Imagem',
  audio: '🎤 Áudio',
  document: '📄 Documento',
  internal_note: '🔒 Nota interna',
};

/**
 * Preview compacto da mensagem pra `<ConversationListItem>`.
 *  - text/internal_note: trunca em 60 chars
 *  - image: "📷 Imagem"
 *  - audio: "🎤 Áudio (0:23)" — usa duração se disponível
 *  - document: "📄 nome-do-arquivo.pdf"
 */
export function formatMessagePreview(message: Message): string {
  if (message.kind === 'text') {
    const body = message.body ?? '';
    return body.length > 60 ? body.slice(0, 60) + '…' : body;
  }
  if (message.kind === 'audio') {
    if (message.mediaDurationSeconds && message.mediaDurationSeconds > 0) {
      const m = Math.floor(message.mediaDurationSeconds / 60);
      const s = message.mediaDurationSeconds % 60;
      return `🎤 Áudio (${m}:${s.toString().padStart(2, '0')})`;
    }
    return PREVIEW_PREFIX.audio;
  }
  if (message.kind === 'document') {
    return `📄 ${message.mediaName ?? 'Documento'}`;
  }
  if (message.kind === 'image') {
    return PREVIEW_PREFIX.image;
  }
  if (message.kind === 'internal_note') {
    const body = message.body ?? '';
    const trimmed = body.length > 50 ? body.slice(0, 50) + '…' : body;
    return `🔒 ${trimmed}`;
  }
  return '';
}

// ─── Agregações ──────────────────────────────────────────────────────────

/** Soma `unreadCount` de conversas não-arquivadas — vai pro badge da sidebar. */
export function countUnreadConversations(conversations: Conversation[]): number {
  return conversations.filter((c) => !c.archivedAt).reduce((sum, c) => sum + c.unreadCount, 0);
}

export interface InboxCounts {
  total: number;
  awaiting: number;
  responded: number;
  archived: number;
  unread: number;
}

/** Counts agregados pra cabeçalho da inbox e KPIs internos. */
export function countConversations(conversations: Conversation[]): InboxCounts {
  return conversations.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.archivedAt) acc.archived += 1;
      else if (c.status === 'awaiting') acc.awaiting += 1;
      else if (c.status === 'responded') acc.responded += 1;
      acc.unread += c.archivedAt ? 0 : c.unreadCount;
      return acc;
    },
    { total: 0, awaiting: 0, responded: 0, archived: 0, unread: 0 } as InboxCounts,
  );
}
