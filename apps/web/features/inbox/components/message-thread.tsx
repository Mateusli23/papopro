'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, Button, EmptyState, ScrollArea, Separator } from '@papopro/ui';
import { ChevronLeft, MessageSquare, MoreVertical, Phone } from '@papopro/ui/icons';

import { getLead } from '@/lib/fixtures/leads';
import { initialsOf } from '@/lib/utils/format';

import { markConversationRead, useConversation, useMessages } from '../store';
import { groupMessagesByDay } from '../transforms';
import type { Conversation } from '../types';

import { DateSeparator } from './date-separator';
import { InternalNoteBubble } from './internal-note-bubble';
import { MessageBubble } from './message-bubble';
import { TypingIndicator, useSimulatedTyping } from './typing-indicator';

/**
 * Painel central da Inbox: header sticky com info do contato + thread
 * scrollável com bolhas agrupadas por dia + composer (placeholder em M5#4a;
 * funcional em M5#4b).
 *
 * Comportamento:
 *  - Quando uma conversa é selecionada e tinha unread, marca como lida
 *    via `markConversationRead` (zera unreadCount + seta readAt nas inbound).
 *  - Auto-scroll pra última mensagem ao abrir/trocar de conversa.
 *  - Typing indicator é renderizado abaixo da última bolha quando
 *    `useSimulatedTyping` retorna true (só ativa em conv_001).
 *
 * Mobile (M5#4c): botão `<` "voltar" volta pra lista. Em desktop esse
 * botão é hidden.
 */
interface MessageThreadProps {
  conversationId: string | undefined;
  /** Mobile: ao clicar em voltar, volta pra lista. Desktop ignora. */
  onBack?: () => void;
}

export function MessageThread({ conversationId, onBack }: MessageThreadProps) {
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const isTyping = useSimulatedTyping(conversationId);

  // Mark-as-read ao abrir conversa não-lida
  React.useEffect(() => {
    if (conversationId && conversation && conversation.unreadCount > 0) {
      markConversationRead(conversationId);
    }
  }, [conversationId, conversation]);

  if (!conversationId || !conversation) {
    return (
      <section
        className="flex h-full flex-col items-center justify-center p-8"
        aria-label="Selecione uma conversa"
      >
        <EmptyState
          icon={MessageSquare}
          title="Selecione uma conversa"
          description="Escolha uma conversa na lista pra ver o histórico e responder. Conversas não-lidas aparecem em destaque com badge azul."
        />
      </section>
    );
  }

  const groups = groupMessagesByDay(messages);

  return (
    <section
      aria-label={`Conversa com ${getLead(conversation.leadId)?.name ?? 'lead'}`}
      className="flex h-full flex-col"
    >
      <ThreadHeader conversation={conversation} onBack={onBack} />
      <Separator />

      <ScrollArea className="bg-background/50 flex-1">
        <div className="flex flex-col gap-1.5 px-4 py-4 sm:px-6">
          {groups.map((group) => (
            <React.Fragment key={group.dayKey}>
              <DateSeparator label={group.label} />
              {group.messages.map((m) =>
                m.kind === 'internal_note' ? (
                  <InternalNoteBubble key={m.id} message={m} />
                ) : (
                  <MessageBubble key={m.id} message={m} />
                ),
              )}
            </React.Fragment>
          ))}

          {isTyping && (
            <TypingIndicator name={getLead(conversation.leadId)?.name.split(' ')[0] ?? 'Lead'} />
          )}

          {/* Anchor: auto-scroll alvo. */}
          <ScrollAnchor messagesLength={messages.length} typing={isTyping} />
        </div>
      </ScrollArea>

      <Separator />
      <ComposerPlaceholder />
    </section>
  );
}

// ─── Header da thread ─────────────────────────────────────────────────────

interface ThreadHeaderProps {
  conversation: Conversation;
  onBack?: () => void;
}

function ThreadHeader({ conversation, onBack }: ThreadHeaderProps) {
  const lead = getLead(conversation.leadId);
  const name = lead?.name ?? 'Lead sem nome';

  return (
    <header className="bg-card flex items-center gap-3 px-4 py-3 sm:px-6">
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="size-9 shrink-0 p-0 lg:hidden"
          aria-label="Voltar para a lista de conversas"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-primary/15 text-primary text-caption font-semibold">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-foreground truncate font-semibold">{name}</span>
        <span className="text-caption text-muted-foreground truncate tabular-nums">
          {conversation.contactPhone}
          {lead?.company && <span className="text-muted-foreground/60"> · {lead.company}</span>}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-9 p-0"
          aria-label="Ligar (em breve)"
          disabled
        >
          <Phone className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-9 p-0"
          aria-label="Mais opções (em breve)"
          disabled
        >
          <MoreVertical className="size-4" />
        </Button>
      </div>
    </header>
  );
}

// ─── Composer placeholder (real em M5#4b) ─────────────────────────────────

function ComposerPlaceholder() {
  return (
    <div
      className="bg-muted/30 border-border flex items-center justify-center border-t px-4 py-4 text-center"
      role="region"
      aria-label="Composer"
    >
      <span className="text-caption text-muted-foreground max-w-md">
        Composer chega no próximo PR (M5#4b) — texto, emoji, anexo, áudio, notas internas e
        respostas rápidas.
      </span>
    </div>
  );
}

// ─── Auto-scroll anchor ───────────────────────────────────────────────────

interface ScrollAnchorProps {
  messagesLength: number;
  typing: boolean;
}

/**
 * Empty `<div>` no fim da thread que rola pra view sempre que muda. Reage a:
 *  - troca de conversa (effect roda quando conversationId muda → messagesLength)
 *  - nova mensagem (length aumenta)
 *  - typing indicator aparece/some
 *
 * `behavior: 'auto'` na primeira render (sem animação ao abrir) e
 * `'smooth'` em mudanças subsequentes.
 */
function ScrollAnchor({ messagesLength, typing }: ScrollAnchorProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollIntoView({
      behavior: isFirstRender.current ? 'auto' : 'smooth',
      block: 'end',
    });
    isFirstRender.current = false;
  }, [messagesLength, typing]);

  return <div ref={ref} aria-hidden />;
}
