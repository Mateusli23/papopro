/**
 * Transformações puras do domínio Inbox.
 *
 * Toda função aqui é pura: recebe `Conversation[]` / `Message[]`, devolve
 * arrays/agregações novas. Sem side-effects, sem React. O store
 * (`store.ts`) é wrapper fino que aplica e dispara listeners.
 *
 * Em M9 cada uma vira input pra Server Actions / queries Prisma; o motor
 * uazapi consome `applySendMessage` antes de tocar o adapter.
 *
 * **M5#4a entregou leitura** (sort/group/filter/preview). **M5#4b adicionou
 * mutações** (`applySendMessage`, `applySendInternalNote`, `applyAttachMedia`,
 * `resolvePlaceholders`). **M5#4c adiciona** `filterConversations`,
 * `applyArchiveConversation`, `applyUnarchiveConversation`,
 * `applyReassignConversation`, `countActiveFilters`.
 */
import { differenceInDays, parseISO } from 'date-fns';

import { dayKeyBrt, dayLabelBrt } from './hooks/inbox-tz';
import type { AttachMediaInput, SendInternalNoteInput, SendTextMessageInput } from './schemas';
import type { Conversation, InboxFilters, Message, MessageKind } from './types';

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

// ─── Placeholders (quick replies) ─────────────────────────────────────────

/**
 * Contexto pra resolver placeholders de quick replies. Não importamos `Lead`
 * aqui pra manter o transform 100% puro / agnóstico de fixtures (caller
 * extrai do `getLead(leadId)` e passa só os campos relevantes).
 *
 * `produto` ainda não tem campo no `Lead` em M5; passa como `undefined` e o
 * placeholder fica literal (`{produto}`). Em M11 vem do "Cérebro da Empresa".
 */
export interface PlaceholderContext {
  nome?: string;
  empresa?: string;
  produto?: string;
}

/**
 * Substitui `{nome}`, `{empresa}`, `{produto}` no body. Tokens sem match
 * (ex: contexto sem `empresa`) ficam **literais** — facilita ver no
 * composer que faltou dado, em vez de ficar `Olá ,` silencioso.
 *
 * **Robusto a typos** (MEDIUM #3 do review M5#4b): usa regex única
 * `\{(\w+)\}` em vez de `replaceAll` por token. Isso evita que um template
 * com `{nomeempresa}` tenha o `{nome}` extraído por substring match
 * (`replaceAll('{nome}', 'João')` em `{nomeempresa}` viraria
 * `Joãoempresa}`). Tokens desconhecidos ficam literais.
 *
 * Match case-sensitive (alinhado com `placeholder-hint.tsx` de cadences).
 * Em M10 a engine usa o mesmo padrão.
 */
const PLACEHOLDER_KEYS: Record<string, keyof PlaceholderContext> = {
  nome: 'nome',
  empresa: 'empresa',
  produto: 'produto',
};

export function resolvePlaceholders(body: string, ctx: PlaceholderContext): string {
  return body.replace(/\{(\w+)\}/g, (full, key) => {
    const ctxKey = PLACEHOLDER_KEYS[key];
    if (!ctxKey) return full; // token desconhecido → mantém literal
    const value = ctx[ctxKey];
    return value ?? full;
  });
}

// ─── Mutações puras (M5#4b) ───────────────────────────────────────────────

/**
 * Resultado canônico das mutações. `conversations` e `messages` são SEMPRE
 * novas referências (nunca mutamos in-place) — isso é o que o store devolve
 * pros listeners do `useSyncExternalStore` re-renderizarem.
 */
export interface MutationResult {
  conversations: Conversation[];
  messages: Message[];
  /** A mensagem recém-criada — usada pra optimistic UI / scroll-to-bottom. */
  message: Message;
}

/**
 * Atualiza os agregados denormalizados da conversa após uma nova mensagem.
 *  - `lastMessageAt` / `lastMessagePreview` / `lastMessageDirection` sempre.
 *  - `status`: regra abaixo.
 *
 * **Status:**
 *  - mensagem outbound (não-nota) → `awaiting` (vendedor mandou, agora espera).
 *  - mensagem inbound → `responded` (lead respondeu, vendedor precisa agir).
 *  - **nota interna** → preserva o status atual (notas não contam como
 *    "interação com cliente" — `getLastOutboundMessage` já as exclui).
 *  - mídia outbound (image/audio/document) é tratada igual a outbound: vai
 *    pro lead → vira `awaiting`.
 *
 * Em M9 isso vira derived: `status` deriva de "última mensagem não-nota".
 * Aqui denormalizamos pra evitar recomputar em cada render da lista.
 */
function recomputeAggregates(
  conversation: Conversation,
  newMessage: Message,
  preview: string,
): Conversation {
  const isInternalNote = newMessage.kind === 'internal_note';
  const nextStatus: Conversation['status'] = isInternalNote
    ? conversation.status
    : newMessage.direction === 'out'
      ? 'awaiting'
      : 'responded';

  return {
    ...conversation,
    status: nextStatus,
    lastMessageAt: newMessage.createdAt,
    lastMessagePreview: preview,
    lastMessageDirection: newMessage.direction,
  };
}

/**
 * Cria mensagem de texto outbound. `idGen` injetável pra testes.
 *
 * Não desarquiva conversa arquivada (M5#4c traz `applyUnarchive`); a
 * mensagem fica registrada e o vendedor pode desarquivar manualmente.
 */
export function applySendMessage(
  conversations: Conversation[],
  messages: Message[],
  conversationId: string,
  input: SendTextMessageInput,
  authorId: string,
  idGen: () => string,
  now: string = new Date().toISOString(),
): MutationResult {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  const message: Message = {
    id: idGen(),
    conversationId,
    kind: 'text',
    direction: 'out',
    body: input.body,
    authorId,
    createdAt: now,
    deliveredAt: now, // mock: entrega imediata. Em M9 vem do callback uazapi.
  };
  const preview = formatMessagePreview(message);
  const updatedConversation = recomputeAggregates(target, message, preview);

  return {
    conversations: conversations.map((c) => (c.id === conversationId ? updatedConversation : c)),
    messages: [...messages, message],
    message,
  };
}

/**
 * Cria nota interna. Sempre `direction: 'out'` (PRD §3.8 — visível só ao
 * time, mas é registrada pelo workspace, não pelo lead).
 *
 * Status da conversa **não muda** — ver `recomputeAggregates`.
 */
export function applySendInternalNote(
  conversations: Conversation[],
  messages: Message[],
  conversationId: string,
  input: SendInternalNoteInput,
  authorId: string,
  idGen: () => string,
  now: string = new Date().toISOString(),
): MutationResult {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  const message: Message = {
    id: idGen(),
    conversationId,
    kind: 'internal_note',
    direction: 'out',
    body: input.body,
    authorId,
    createdAt: now,
  };
  const preview = formatMessagePreview(message);
  const updatedConversation = recomputeAggregates(target, message, preview);

  return {
    conversations: conversations.map((c) => (c.id === conversationId ? updatedConversation : c)),
    messages: [...messages, message],
    message,
  };
}

/**
 * Cria mensagem de mídia (image/audio/document). Caption opcional vira
 * `body`; sem caption fica `undefined` e a bolha mostra só a mídia.
 *
 * `mediaSizeKb` aceita 0 só pra `audio` (gravação mock não tem arquivo).
 * Validação de campo está em [./schemas.ts](./schemas.ts).
 */
export function applyAttachMedia(
  conversations: Conversation[],
  messages: Message[],
  conversationId: string,
  input: AttachMediaInput,
  authorId: string,
  idGen: () => string,
  now: string = new Date().toISOString(),
): MutationResult {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  const message: Message = {
    id: idGen(),
    conversationId,
    kind: input.kind,
    direction: 'out',
    body: input.caption,
    authorId,
    createdAt: now,
    deliveredAt: now,
    mediaName: input.mediaName,
    mediaSizeKb: input.mediaSizeKb,
    mediaDurationSeconds: input.mediaDurationSeconds,
  };
  const preview = formatMessagePreview(message);
  const updatedConversation = recomputeAggregates(target, message, preview);

  return {
    conversations: conversations.map((c) => (c.id === conversationId ? updatedConversation : c)),
    messages: [...messages, message],
    message,
  };
}

// ─── Filtros (M5#4c) ──────────────────────────────────────────────────────

/**
 * Snapshot mínimo do lead que `filterConversations` precisa pra resolver
 * busca textual e filtro por etapa. Definido aqui (não importado de
 * `features/leads/types`) pra manter o transform 100% pure / testável sem
 * depender do shape completo de `Lead`. Caller monta o map a partir das
 * fixtures (M5) ou da query Prisma (M9).
 */
export interface InboxLeadHandle {
  stageId: string;
  name?: string;
  company?: string;
  phone?: string;
}

/** Contexto pra resolver filtros que dependem de dados fora da `Conversation`. */
export interface InboxFilterContext {
  /** Snapshot global de mensagens — usado pra calcular `noReplyDays`. */
  messages: Message[];
  /** Lookup `leadId → handle` pra resolver `stageId` e search por nome/empresa. */
  leadById: ReadonlyMap<string, InboxLeadHandle>;
}

/**
 * Aplica todos os filtros sobre uma lista de conversas, combinados via AND.
 *
 * **Default oculta arquivadas** quando `filters.status` é `undefined`. Pra
 * ver arquivadas, o caller precisa passar `filters.status === 'archived'`
 * explicitamente. Decisão UX: paridade com WhatsApp Web — arquivada some.
 *
 * **Search**: case-insensitive, casa em `nome do lead | empresa | telefone |
 * preview da última mensagem`. Trim aplicado; string vazia ignora o filtro.
 *
 * **Sem resposta há ≥ N dias**: usa `daysSinceLastInbound`; se `undefined`
 * (lead nunca respondeu), cai pra **idade da conversa** — assim conversas
 * onde o lead nunca escreveu também aparecem em "≥ 7 dias" depois de 7+
 * dias da abertura. Documentado na decisão de design da PLAN.md.
 *
 * **Etapa**: requer match em `leadById` — conversa com `leadId` órfão
 * (lead deletado / fixture inconsistente) é **excluída** quando o filtro
 * está ativo, pra evitar surpresas visuais.
 */
export function filterConversations(
  conversations: Conversation[],
  filters: InboxFilters,
  ctx: InboxFilterContext,
  now: Date = new Date(),
): Conversation[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const hasSearch = search.length > 0;

  // Pré-agrupa mensagens por conversa pra evitar O(N²) em listas grandes
  // — O(M) onde M = total de mensagens, com `noReplyDays` ativo.
  const messagesByConversation =
    filters.noReplyDays !== undefined ? groupMessagesByConversation(ctx.messages) : undefined;

  return conversations.filter((c) => {
    // Status: undefined = oculta arquivadas; valor explícito = match exato.
    if (filters.status === undefined) {
      if (c.archivedAt) return false;
    } else if (filters.status !== c.status) {
      return false;
    }

    // Vendedor
    if (filters.vendorId && c.vendorId !== filters.vendorId) return false;

    // Etapa do lead
    const lead = ctx.leadById.get(c.leadId);
    if (filters.stageId) {
      if (!lead || lead.stageId !== filters.stageId) return false;
    }

    // Sem resposta há ≥ N dias
    if (filters.noReplyDays !== undefined && messagesByConversation) {
      const convMessages = messagesByConversation.get(c.id) ?? [];
      const days = daysSinceLastInbound(convMessages, now);
      const silentDays = days ?? differenceInDays(now, parseISO(c.createdAt));
      if (silentDays < filters.noReplyDays) return false;
    }

    // Busca textual
    if (hasSearch) {
      const haystack = [lead?.name, lead?.company, c.contactPhone, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

/** Agrupa mensagens por `conversationId` num único pass — helper de filterConversations. */
function groupMessagesByConversation(messages: Message[]): Map<string, Message[]> {
  const map = new Map<string, Message[]>();
  for (const m of messages) {
    const arr = map.get(m.conversationId);
    if (arr) arr.push(m);
    else map.set(m.conversationId, [m]);
  }
  return map;
}

/**
 * Quantos filtros estão ativos pra exibir no badge do botão "Filtros".
 *
 * **Não conta `search`** — a busca já tem feedback visual no próprio input
 * (clear button + foco) e mora num campo separado do popover. Misturar
 * confunde: um usuário com busca digitada e nenhum filtro veria "Filtros · 1"
 * sem entender o porquê.
 */
export function countActiveFilters(filters: InboxFilters): number {
  let count = 0;
  if (filters.vendorId) count += 1;
  if (filters.status) count += 1;
  if (filters.stageId) count += 1;
  if (filters.noReplyDays !== undefined) count += 1;
  return count;
}

// ─── Mutações: archive / unarchive / reassign (M5#4c) ─────────────────────

/**
 * Marca conversa como arquivada — seta `archivedAt` (ISO) e `status='archived'`.
 *
 * Idempotente: se já arquivada, retorna o mesmo array (referência preservada,
 * sem emitir listeners desnecessariamente no store). Mensagens não mudam.
 *
 * Em M9 vira UPDATE em `conversations` + soft-delete via `archived_at`,
 * com índice parcial pra acelerar `WHERE archived_at IS NULL`.
 */
export function applyArchiveConversation(
  conversations: Conversation[],
  conversationId: string,
  now: string = new Date().toISOString(),
): Conversation[] {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  if (target.archivedAt) return conversations;
  return conversations.map((c) =>
    c.id === conversationId ? { ...c, archivedAt: now, status: 'archived' as const } : c,
  );
}

/**
 * Desarquiva conversa — limpa `archivedAt` e recalcula `status` baseado na
 * última mensagem não-nota: outbound → `awaiting`, inbound → `responded`.
 *
 * `messages` é necessário pra recalcular o status; sem ele cairíamos em
 * `awaiting` por default e potencialmente esconderíamos uma resposta do
 * lead que ficou pendurada quando a conversa foi arquivada.
 *
 * Idempotente: conversa já ativa retorna o array original.
 */
export function applyUnarchiveConversation(
  conversations: Conversation[],
  messages: Message[],
  conversationId: string,
): Conversation[] {
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  if (!target.archivedAt) return conversations;

  const convMessages = messagesForConversation(messages, conversationId);
  const lastNonNote = [...convMessages].reverse().find((m) => m.kind !== 'internal_note');
  const nextStatus: Conversation['status'] =
    lastNonNote && lastNonNote.direction === 'in' ? 'responded' : 'awaiting';

  return conversations.map((c) =>
    c.id === conversationId ? { ...c, archivedAt: undefined, status: nextStatus } : c,
  );
}

/**
 * Atribui a conversa a outro vendedor. **Não toca `lead.assignedRepId`** —
 * decisão de design (confirmada com o usuário): "esta conversa específica
 * vai com outra pessoa", sem efeito no Kanban / dashboard. Em M9 a Server
 * Action escreve só em `conversations.vendor_id`.
 *
 * Idempotente em vendor igual; rejeita string vazia.
 */
export function applyReassignConversation(
  conversations: Conversation[],
  conversationId: string,
  vendorId: string,
): Conversation[] {
  if (!vendorId) {
    throw new Error('vendorId obrigatório pra reatribuir conversa');
  }
  const target = conversations.find((c) => c.id === conversationId);
  if (!target) {
    throw new Error(`Conversa não encontrada: ${conversationId}`);
  }
  if (target.vendorId === vendorId) return conversations;
  return conversations.map((c) => (c.id === conversationId ? { ...c, vendorId } : c));
}
