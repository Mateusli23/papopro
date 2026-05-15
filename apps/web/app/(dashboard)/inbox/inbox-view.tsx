'use client';

import * as React from 'react';

import { Button } from '@papopro/ui';
import { ChevronLeft } from '@papopro/ui/icons';

import { ConnectionHealthIndicator } from '@/features/inbox/components/connection-health-indicator';
import { ConversationList } from '@/features/inbox/components/conversation-list';
import { LeadFichaPanel } from '@/features/inbox/components/lead-ficha-panel';
import { MessageThread } from '@/features/inbox/components/message-thread';
import { MobileFichaDrawer } from '@/features/inbox/components/mobile-ficha-drawer';
import { useRealtimeMessages } from '@/features/inbox/hooks/use-realtime-messages';
import { hydrateInboxFromServer, useFilteredConversations } from '@/features/inbox/store';
import type {
  Conversation,
  InboxFilters,
  Message,
  QuickReply,
  WhatsAppConnection,
} from '@/features/inbox/types';

interface InboxViewProps {
  workspaceId: string;
  initial: {
    conversations: Conversation[];
    messages: Message[];
    quickReplies: ReadonlyArray<QuickReply>;
    whatsappConnection: WhatsAppConnection;
  };
}

/**
 * Container da rota `/inbox` — orquestra os 3 painéis e segura o estado
 * de seleção de conversa, filtros e drawer mobile da ficha.
 *
 * **M5#4c finaliza o flow:**
 *  - Filtros (vendedor/status/etapa/no-reply) **lifted** pra cá pra serem
 *    a única fonte de verdade que alimenta `useFilteredConversations`.
 *  - Mobile single-pane com Drawer (vaul) pra ficha — botão "Ver lead"
 *    no header da thread aciona em `lg-`.
 *
 * Estado:
 *  - `selectedConversationId`: id da conversa aberta. Default = primeira
 *    da lista filtrada (default oculta arquivadas).
 *  - `filters`: estado dos filtros do popover + busca textual.
 *  - `mobileView`: lista ↔ thread (single-pane <lg).
 *  - `mobileFichaOpen`: drawer da ficha (independente do mobileView).
 */
const EMPTY_FILTERS: InboxFilters = {};

export function InboxView({ workspaceId, initial }: InboxViewProps) {
  // M9#4: hidrata o store a cada mount/refresh do Server Component. `initial`
  // muda quando `router.refresh()` re-fetcha o page (via realtime). Sem isso
  // o store ficaria preso ao snapshot de boot.
  React.useEffect(() => {
    hydrateInboxFromServer(initial);
  }, [initial]);

  // M9#4: subscribe ao canal realtime (messages + conversations + quick_replies).
  // Cada mudança dispara router.refresh() debounced 250ms.
  useRealtimeMessages(workspaceId);

  const [filters, setFilters] = React.useState<InboxFilters>(EMPTY_FILTERS);
  const filteredConversations = useFilteredConversations(filters);

  // Default: primeira conversa da lista filtrada. Lazy initializer pra
  // evitar recompute. Se filters mudarem e o selectedId sumir, o
  // selectedId fica "órfão" — `useConversation(id)` retorna undefined e
  // a thread mostra empty state. Comportamento correto: o usuário pode
  // limpar filtros pra recuperar a conversa, ou clicar noutra.
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    () => filteredConversations[0]?.id,
  );

  // Estado mobile: lista visível ou thread visível. Default = lista.
  const [mobileView, setMobileView] = React.useState<'list' | 'thread'>('list');
  // Drawer da ficha mobile — abre por botão "Ver lead" no header da thread.
  const [mobileFichaOpen, setMobileFichaOpen] = React.useState(false);

  // Fecha o Drawer ao cruzar pra `lg+` (painel fixo da ficha já visível).
  // Sem isso, se o usuário abre o drawer em mobile e redimensiona pra desktop,
  // o vaul mantém focus trap + body-scroll-lock invisíveis. (Fix HIGH do
  // review M5#4c.)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setMobileFichaOpen(false);
    }
    onChange(mql);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Reconcilia `selectedId` quando filtros mudam: se a conversa selecionada
  // sai da lista filtrada, salta pra primeira visível. Paridade com Gmail/
  // WhatsApp Web — sem isso o usuário ficava com thread aberta de uma
  // conversa que sumiu da lista (visualmente quebrado). Fix MEDIUM do review.
  React.useEffect(() => {
    if (selectedId && !filteredConversations.some((c) => c.id === selectedId)) {
      setSelectedId(filteredConversations[0]?.id);
    }
  }, [filteredConversations, selectedId]);

  // `useCallback` mantém referência estável → preserva a `React.memo` em
  // `<ConversationListItem>`. Sem isso, o store re-emit (ex: markRead zera
  // unread) força um novo `handleSelect` em cada render do `<InboxView>`,
  // quebrando a memo e re-renderizando todos os items da lista.
  const handleSelect = React.useCallback((id: string) => {
    setSelectedId(id);
    setMobileView('thread'); // mobile: ao selecionar, vai pra thread
  }, []);

  const handleBack = React.useCallback(() => {
    setMobileView('list');
  }, []);

  const handleOpenFicha = React.useCallback(() => {
    setMobileFichaOpen(true);
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Header global da inbox: título + health indicator. Não scroll. */}
      <header className="border-border bg-card flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {mobileView === 'thread' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="size-9 shrink-0 p-0 lg:hidden"
              aria-label="Voltar para a lista"
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <div className="flex flex-col">
            <h1 className="text-title text-foreground">Inbox</h1>
            <span className="text-caption text-muted-foreground hidden sm:block">
              Caixa unificada de WhatsApp do workspace
            </span>
          </div>
        </div>
        <ConnectionHealthIndicator />
      </header>

      {/* Grid de 3 painéis. Em mobile mostra só um painel por vez (list ↔ thread). */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr_360px]">
        {/* Painel 1: lista de conversas */}
        <div
          className={
            mobileView === 'list'
              ? 'flex h-full min-h-0 flex-col lg:flex'
              : 'hidden h-full min-h-0 flex-col lg:flex'
          }
        >
          <ConversationList
            selectedConversationId={selectedId}
            onSelectConversation={handleSelect}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Painel 2: thread */}
        <div
          className={
            mobileView === 'thread'
              ? 'flex h-full min-h-0 flex-col lg:flex'
              : 'hidden h-full min-h-0 flex-col lg:flex'
          }
        >
          <MessageThread
            conversationId={selectedId}
            onBack={mobileView === 'thread' ? handleBack : undefined}
            onOpenFicha={handleOpenFicha}
          />
        </div>

        {/* Painel 3: ficha — fixo em lg+. */}
        <div className="hidden h-full min-h-0 flex-col lg:flex">
          <LeadFichaPanel conversationId={selectedId} />
        </div>
      </div>

      {/* Drawer mobile da ficha — só monta em <lg, sem overhead em desktop. */}
      <MobileFichaDrawer
        conversationId={selectedId}
        open={mobileFichaOpen}
        onOpenChange={setMobileFichaOpen}
      />
    </div>
  );
}
