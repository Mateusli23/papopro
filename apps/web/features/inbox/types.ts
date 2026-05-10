/**
 * Tipos do domínio Inbox WhatsApp (PRD §3.8 — Caixa de WhatsApp).
 *
 * Em M5 a UI roda 100% sobre fixtures + store in-memory. Os tipos aqui
 * **são propositadamente o contrato** que vai virar:
 *   - tabelas Postgres `conversations`, `messages`, `quick_replies`,
 *     `whatsapp_connections` em M9
 *   - input das Server Actions / webhooks uazapi / Cloud API
 *   - payload dos eventos Realtime no canal `workspace:<id>:messages`
 *
 * Mudar a shape aqui = retrabalho em cascata. Cuidado.
 */

/**
 * Direção da mensagem em relação ao workspace.
 *  - `out`: enviada pelo vendedor / agente IA (vai pro lead)
 *  - `in`: recebida do lead (chegou no número conectado)
 */
export type MessageDirection = 'in' | 'out';

/**
 * Tipos de mensagem suportados pelo WhatsApp.
 *  - `text`: texto puro (com emoji no body)
 *  - `image`: foto enviada/recebida com `mediaName` + `mediaSizeKb`
 *  - `audio`: áudio gravado, com `mediaDurationSeconds`
 *  - `document`: PDF/DOC/etc com `mediaName` + `mediaSizeKb`
 *  - `internal_note`: NÃO vai pro lead — visível só ao time. Aparece com fundo
 *    amarelo + cadeado (PRD §3.8). Sempre `direction: 'out'`.
 */
export type MessageKind = 'text' | 'image' | 'audio' | 'document' | 'internal_note';

/**
 * Status agregado da conversa, derivado da última mensagem não-nota.
 *  - `awaiting`: vendedor mandou e aguarda resposta (última inbound? não)
 *  - `responded`: lead respondeu, vendedor precisa agir (última é inbound)
 *  - `archived`: conversa marcada como resolvida (PRD §3.8 — "marcar conversa
 *    como resolvida/arquivada")
 *
 * Em M9 esse campo deriva da query — não precisa ser denormalizado no
 * Postgres. Aqui é denormalizado pra simplificar filtros sem indexar.
 */
export type ConversationStatus = 'awaiting' | 'responded' | 'archived';

export interface Message {
  id: string;
  conversationId: string;
  kind: MessageKind;
  direction: MessageDirection;
  /**
   * Texto da mensagem (text/internal_note) ou caption opcional pra mídia.
   * Vazio se for mídia sem caption.
   */
  body?: string;
  /**
   * Quem enviou (`SalesRep.id`) ou `'system'` pra eventos automáticos.
   * `undefined` quando `direction === 'in'` — é o lead.
   */
  authorId?: string;
  createdAt: string;
  /** Quando o WhatsApp confirmou entrega. Ausente em mensagens não enviadas ainda. */
  deliveredAt?: string;
  /** Quando o lead leu (check duplo azul). Ausente se ainda não foi lida. */
  readAt?: string;
  /** Nome do arquivo (image/audio/document). */
  mediaName?: string;
  /** Tamanho em KB. */
  mediaSizeKb?: number;
  /** Duração em segundos (audio). */
  mediaDurationSeconds?: number;
}

export interface Conversation {
  id: string;
  /**
   * Workspace dono. Em M5 fixo `'ws_demo'`. Em M7 lê do contexto de auth.
   * Toda query filtra `workspaceId` no código mesmo com RLS — defense in
   * depth (CLAUDE.md §7.2).
   */
  workspaceId: string;
  /** Lead vinculado. Toda conversa tem lead em M5; captura automática vira em M9. */
  leadId: string;
  /** Vendedor responsável pela conversa (atribuição inicial; pode trocar). */
  vendorId: string;
  /**
   * Número WhatsApp conectado do workspace que envia/recebe.
   * Em M9 vem de `whatsapp_connections.number`.
   */
  whatsappNumber: string;
  /** Telefone do contato (mesmo do `lead.phone`, denormalizado pra evitar join). */
  contactPhone: string;
  status: ConversationStatus;
  /** Timestamp da última mensagem (qualquer direção) — usado pra ordenação. */
  lastMessageAt: string;
  /** Preview pré-formatado da última mensagem pra item da lista. */
  lastMessagePreview: string;
  /** Direção da última mensagem (afeta o ícone de status na lista). */
  lastMessageDirection: MessageDirection;
  /** Quantas mensagens inbound não lidas. UI mostra como badge na lista. */
  unreadCount: number;
  /** Se arquivada, ISO datetime da ação. Filtro default exclui arquivadas. */
  archivedAt?: string;
  createdAt: string;
}

export interface QuickReply {
  id: string;
  workspaceId: string;
  /** Label curto exibido no chip do composer (ex: "Bom dia"). */
  label: string;
  /**
   * Texto completo inserido no composer ao clicar. Pode conter placeholders
   * `{nome}` / `{empresa}` / `{produto}` que são resolvidos contra o lead
   * da conversa atual.
   */
  body: string;
  /** Ordem de exibição na barra. */
  order: number;
}

/**
 * Saúde da conexão WhatsApp do workspace (CLAUDE.md §9 — Health Score).
 *  - `connected` (verde): tudo OK, envios autorizados
 *  - `unstable` (amarelo): heartbeat oscilando, vendedor deve verificar
 *  - `disconnected` (vermelho): offline, envios pausados automaticamente
 *
 * Em M9 vem da Edge Function `whatsapp-heartbeat` via Realtime.
 */
export type WhatsAppHealth = 'connected' | 'unstable' | 'disconnected';

export interface WhatsAppConnection {
  id: string;
  workspaceId: string;
  number: string;
  health: WhatsAppHealth;
  /** Última ocorrência do heartbeat (ISO). */
  lastSeenAt: string;
}

/**
 * Filtros aplicados sobre a lista de conversas (PRD §3.6).
 * Combinados via AND. M5#4a só consome `search`; demais entram em M5#4c
 * mas o tipo já está completo pra evitar refatorar a interface depois.
 */
export interface InboxFilters {
  /** Busca textual em nome do lead, telefone e preview da última mensagem. */
  search?: string;
  /** Filtrar por vendedor responsável. `undefined` = todos. */
  vendorId?: string;
  /**
   * Status. `undefined` retorna **só não-arquivadas** (default da inbox).
   * Pra ver arquivadas é preciso filtrar explicitamente por `archived`.
   */
  status?: ConversationStatus;
  /** Etapa do funil do lead. Requer join com `leads`. */
  stageId?: string;
  /** "Sem resposta há ≥ X dias" — última inbound foi há ≥ X dias. */
  noReplyDays?: number;
}
