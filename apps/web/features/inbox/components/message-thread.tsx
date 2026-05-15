'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, Button, EmptyState, ScrollArea, Separator } from '@papopro/ui';
import { ChevronLeft, MessageSquare, MoreVertical, Phone, User } from '@papopro/ui/icons';

import { getLead } from '@/lib/fixtures/leads';
import { initialsOf } from '@/lib/utils/format';

import { markConversationReadAction } from '../conversation-actions';
import { useConversation, useMessages } from '../store';
import { groupMessagesByDay } from '../transforms';
import type { Conversation } from '../types';

import { DateSeparator } from './date-separator';
import { InternalNoteBubble } from './internal-note-bubble';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';
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
  /** Mobile: abre o drawer com a ficha do lead. Desktop ignora (painel fixo). */
  onOpenFicha?: () => void;
}

export function MessageThread({ conversationId, onBack, onOpenFicha }: MessageThreadProps) {
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const isTyping = useSimulatedTyping(conversationId);

  // Mark-as-read ao abrir conversa não-lida.
  // Deps usam o **primitivo** `unreadCount` (não o objeto `conversation`
  // inteiro): o `useConversation` retorna nova referência cada vez que o
  // store re-emite, mesmo que `unreadCount` não tenha mudado. Isso fazia
  // o effect rodar 2x por abertura. Travar nas primitivas evita execução
  // desnecessária e mantém o guard `> 0` funcionando.
  const unreadCount = conversation?.unreadCount ?? 0;
  React.useEffect(() => {
    if (conversationId && unreadCount > 0) {
      // Fire-and-forget: realtime atualiza o badge depois.
      void markConversationReadAction({ conversationId });
    }
  }, [conversationId, unreadCount]);

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
      <ThreadHeader conversation={conversation} onBack={onBack} onOpenFicha={onOpenFicha} />
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
      <MessageComposer
        conversationId={conversation.id}
        leadId={conversation.leadId}
        archived={Boolean(conversation.archivedAt)}
      />
    </section>
  );
}

// ─── Header da thread ─────────────────────────────────────────────────────

interface ThreadHeaderProps {
  conversation: Conversation;
  onBack?: () => void;
  onOpenFicha?: () => void;
}

function ThreadHeader({ conversation, onBack, onOpenFicha }: ThreadHeaderProps) {
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
        {/* Botão "Ver lead" — só em <lg, abre o drawer da ficha. Em lg+ o
         * painel da ficha já está visível à direita.
         */}
        {onOpenFicha && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenFicha}
            className="size-9 p-0 lg:hidden"
            aria-label="Ver ficha do lead"
          >
            <User className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden size-9 p-0 sm:inline-flex"
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
 * **Por que `scrollTop` direto e não `scrollIntoView`?** O `scrollIntoView`
 * walks up the DOM e alinha o elemento em **todo ancestral scrollável**,
 * incluindo o `<main className="overflow-y-auto">` do dashboard layout —
 * em viewports baixas isso empurra o header da inbox pra fora da tela. Subir
 * o `scrollTop` do viewport do Radix ScrollArea explicitamente mantém o
 * scroll local sem afetar a página.
 */
function ScrollAnchor({ messagesLength, typing }: ScrollAnchorProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    const anchor = ref.current;
    if (!anchor) return;
    // Subir até o viewport do Radix ScrollArea (data attribute estável da
    // lib). Fallback: ancestral scrollável mais próximo.
    const viewport = anchor.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    if (isFirstRender.current) {
      viewport.scrollTop = viewport.scrollHeight;
      isFirstRender.current = false;
    } else {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messagesLength, typing]);

  return <div ref={ref} aria-hidden />;
}
