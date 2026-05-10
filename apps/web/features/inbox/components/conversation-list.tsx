'use client';

import * as React from 'react';

import { EmptyState, Input, ScrollArea, Separator } from '@papopro/ui';
import { Filter, Inbox, Search } from '@papopro/ui/icons';

import { useConversationListKeyboardNav } from '../hooks/use-conversation-list-keyboard-nav';
import { useConversations, useFilteredConversations } from '../store';
import { countActiveFilters, countConversations } from '../transforms';
import type { InboxFilters } from '../types';

import { ConversationListItem } from './conversation-list-item';
import { InboxFiltersPopover } from './inbox-filters-popover';

/**
 * Painel esquerdo da Inbox: header com busca + popover de filtros + counts,
 * lista de conversas agrupada implicitamente por ordem de `lastMessageAt`.
 *
 * **Entrega M5#4c:**
 *  - Filtros: vendedor, status, etapa, sem resposta há X dias (popover).
 *  - Listbox ARIA com navegação `↑↓` (`aria-activedescendant`).
 *  - Default oculta arquivadas — chip "Arquivadas" no popover pra ver.
 *
 * **Levantamos os filtros pra props** porque `<InboxView>` precisa conhecer
 * o estado pra alimentar o `useFilteredConversations` numa única fonte de
 * verdade — search + filtros entram juntos no transform, sem race.
 */
interface ConversationListProps {
  selectedConversationId: string | undefined;
  onSelectConversation: (id: string) => void;
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
  filters,
  onFiltersChange,
}: ConversationListProps) {
  // Lista filtrada (já considera search + vendedor + status + etapa + noReply).
  const filtered = useFilteredConversations(filters);

  // Counts globais pra header — snapshot **bruto** (inclui arquivadas no total).
  // Antes chamávamos `useFilteredConversations({})` aqui, mas isso (1) faz uma
  // segunda subscrição + sort + filter desnecessários (perf) e (2) o default
  // do filterConversations exclui arquivadas, então `counts.total` ficaria
  // sem elas — confunde a label "X · Y não lidas". Usar `useConversations`
  // direto resolve perf e semântica numa só. (Fix MEDIUM do review M5#4c.)
  const all = useConversations();
  const counts = React.useMemo(() => countConversations(all), [all]);

  const search = filters.search ?? '';
  const setSearch = (v: string) => onFiltersChange({ ...filters, search: v });

  const activeFilterCount = countActiveFilters(filters);
  const hasSearch = search.trim().length > 0;

  // Keyboard nav: ↑↓ no listbox.
  const listRef = React.useRef<HTMLUListElement | null>(null);
  useConversationListKeyboardNav({
    listRef,
    items: filtered,
    selectedId: selectedConversationId,
    onSelect: onSelectConversation,
  });

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
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
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
          <InboxFiltersPopover filters={filters} onChange={onFiltersChange} />
        </div>
      </header>

      <Separator />

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          {hasSearch || activeFilterCount > 0 ? (
            <EmptyState
              icon={Filter}
              title="Nenhuma conversa nos filtros"
              description="Ajuste ou limpe pra ver todas."
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Sem conversas"
              description="Quando o WhatsApp do workspace começar a receber mensagens, elas aparecem aqui."
            />
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {/*
           * Listbox ARIA com `aria-activedescendant`. O `<ul>` é focável
           * (tabindex=0); itens internos NÃO recebem tabindex — quem governa
           * o foco visível é o `aria-activedescendant` + estilo `selected`.
           * Padrão WAI-ARIA Listbox 1.2.
           */}
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-label="Conversas — use as setas para navegar, Enter para abrir"
            aria-activedescendant={
              selectedConversationId ? `conv-${selectedConversationId}` : undefined
            }
            // Focus indicator (WCAG 2.4.7): ring sutil no listbox quando recebe
            // foco por teclado. Sem isso, usuário keyboard-only não sabe que o
            // ↑↓ vai funcionar — o item highlight é o mesmo focado ou não.
            // (Fix HIGH do review M5#4c.)
            className="focus-visible:ring-primary/40 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            {filtered.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                selected={c.id === selectedConversationId}
                onSelect={onSelectConversation}
              />
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );
}
