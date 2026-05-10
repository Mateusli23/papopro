'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, Badge, cn } from '@papopro/ui';

import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { getLead } from '@/lib/fixtures/leads';
import { formatDateTime, initialsOf } from '@/lib/utils/format';

import { useRelativeListTime } from '../hooks/use-relative-list-time';
import type { Conversation } from '../types';

/**
 * Item de uma conversa na lista esquerda da inbox.
 *
 * Estrutura:
 *   ┌────────────────────────────────────────────┐
 *   │ [stripe] [avatar lead]   nome    timestamp │
 *   │           preview da última msg   [unread] │
 *   │                                  [vendor]  │
 *   └────────────────────────────────────────────┘
 *
 * Stripe lateral 3px na cor do status (success awaiting / muted responded /
 * muted archived) — sinaliza "ação esperada" sem precisar abrir cada conversa.
 *
 * Estado selecionado usa `aria-pressed` (toggle button semantics) + bg `bg-muted`.
 *
 * Performance: a lista costuma ter dezenas/centenas de conversas. O `React.memo`
 * abaixo evita re-render dos items não-selecionados quando o snapshot muda
 * (ex: typing indicator atualiza só o item ativo).
 */
const STATUS_STRIPE: Record<Conversation['status'], string> = {
  awaiting: 'bg-success',
  responded: 'bg-info',
  archived: 'bg-muted-foreground/40',
};

interface ConversationListItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: (id: string) => void;
}

function ConversationListItemImpl({ conversation, selected, onSelect }: ConversationListItemProps) {
  const lead = getLead(conversation.leadId);
  const name = lead?.name ?? 'Lead sem nome';
  const company = lead?.company;
  const stripe = STATUS_STRIPE[conversation.status];
  // Computado client-side via `useEffect` pra evitar hydration mismatch —
  // mesmo fix do `cadence-metrics-panel.tsx`.
  const time = useRelativeListTime(conversation.lastMessageAt);

  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      aria-pressed={selected}
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'group relative flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        'hover:bg-muted/40 focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        selected && 'bg-muted',
      )}
    >
      {/* Stripe lateral 3px na cor do status — alinha com a spec do PR. */}
      <span
        aria-hidden
        className={cn('absolute inset-y-2 left-0 w-[3px] rounded-r-full', stripe)}
      />

      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-primary/15 text-primary text-caption font-semibold">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-body text-foreground flex-1 truncate font-medium">{name}</span>
          <time
            className="text-caption text-muted-foreground shrink-0 tabular-nums"
            dateTime={conversation.lastMessageAt}
            title={formatDateTime(conversation.lastMessageAt)}
          >
            {time}
          </time>
        </div>

        {company && <span className="text-caption text-muted-foreground truncate">{company}</span>}

        <div className="flex items-end gap-2">
          <p
            className={cn(
              'text-caption flex-1 truncate',
              conversation.unreadCount > 0
                ? 'text-foreground font-medium'
                : 'text-muted-foreground',
            )}
          >
            {conversation.lastMessageDirection === 'out' && conversation.lastMessagePreview && (
              <span className="text-muted-foreground/80 mr-1">Você:</span>
            )}
            {conversation.lastMessagePreview || 'sem conteúdo'}
          </p>
          {conversation.unreadCount > 0 ? (
            <Badge
              variant="default"
              className="shrink-0 px-1.5 text-[10px] tabular-nums"
              aria-label={`${conversation.unreadCount} não lida${conversation.unreadCount > 1 ? 's' : ''}`}
            >
              {conversation.unreadCount}
            </Badge>
          ) : (
            <RepAvatar repId={conversation.vendorId} size="sm" className="shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}

export const ConversationListItem = React.memo(ConversationListItemImpl);
