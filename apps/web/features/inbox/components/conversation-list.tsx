'use client';

import * as React from 'react';

import { EmptyState, Input, ScrollArea, Separator } from '@papopro/ui';
import { Inbox, Search } from '@papopro/ui/icons';

import { getLead } from '@/lib/fixtures/leads';

import { useSortedConversations } from '../store';
import { countConversations } from '../transforms';

import { ConversationListItem } from './conversation-list-item';

/**
 * Painel esquerdo da Inbox: header com busca + counts, lista de conversas
 * agrupada implicitamente por ordem de `lastMessageAt`. Arquivadas vão pro
 * fim (sortConversations no store).
 *
 * **M5#4a entrega busca textual simples** sobre nome do lead, telefone e
 * preview da última mensagem. Filtros completos (status/vendedor/etapa/
 * sem-resposta-X-dias) entram em M5#4c — esse arquivo já está estruturado
 * pra receber `<ConversationFilters />` lado a lado quando chegar.
 */
interface ConversationListProps {
  selectedConversationId: string | undefined;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const conversations = useSortedConversations();
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const lead = getLead(c.leadId);
      const haystack = [lead?.name, lead?.company, c.contactPhone, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, search]);

  const counts = React.useMemo(() => countConversations(conversations), [conversations]);

  return (
    <aside
      aria-label="Lista de conversas"
      className="border-border bg-card flex h-full flex-col border-r"
    >
      <header className="flex flex-col gap-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-title text-foreground">Conversas</h2>
          <span className="text-caption text-muted-foreground tabular-nums">
            {counts.total} · {counts.unread} não lidas
          </span>
        </div>
        <div className="relative">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem…"
            className="pl-9"
            data-shortcut-search
            aria-label="Buscar conversas"
          />
        </div>
      </header>

      <Separator />

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          {conversations.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Sem conversas"
              description="Quando o WhatsApp do workspace começar a receber mensagens, elas aparecem aqui."
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nada bate com a busca"
              description={`Nenhuma conversa pra "${search}". Limpe a busca pra ver todas.`}
            />
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <ul role="listbox" aria-label="Conversas" className="flex flex-col">
            {filtered.map((c) => (
              <li key={c.id}>
                <ConversationListItem
                  conversation={c}
                  selected={c.id === selectedConversationId}
                  onSelect={onSelectConversation}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );
}
