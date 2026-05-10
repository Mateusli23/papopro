'use client';

import * as React from 'react';

import { Button } from '@papopro/ui';
import { ChevronLeft } from '@papopro/ui/icons';

import { ConnectionHealthIndicator } from '@/features/inbox/components/connection-health-indicator';
import { ConversationList } from '@/features/inbox/components/conversation-list';
import { LeadFichaPanel } from '@/features/inbox/components/lead-ficha-panel';
import { MessageThread } from '@/features/inbox/components/message-thread';
import { useSortedConversations } from '@/features/inbox/store';

/**
 * Container da rota `/inbox` — orquestra os 3 painéis e segura o estado
 * de seleção de conversa.
 *
 * **M5#4a entrega o layout desktop completo (3 colunas em lg+).** Mobile
 * single-pane com navegação `lista → thread → ficha (drawer)` entra em
 * M5#4c. Aqui o mobile usa fallback simples: lista colapsa pra topo, thread
 * abaixo, ficha escondida em <lg.
 *
 * Estado:
 *  - `selectedConversationId`: id da conversa aberta. Default = primeira
 *    não-arquivada da lista ordenada (`useSortedConversations`).
 *  - Em M5#4b ganha integração com `g+i` global e `↑↓` pra navegar.
 */
export function InboxView() {
  const conversations = useSortedConversations();

  // Default: primeira conversa não-arquivada (mais recente). useState com
  // lazy initializer pra evitar recompute em cada render.
  const [selectedId, setSelectedId] = React.useState<string | undefined>(() => {
    return conversations.find((c) => !c.archivedAt)?.id ?? conversations[0]?.id;
  });

  // Estado mobile: lista visível ou thread visível. Default = lista.
  const [mobileView, setMobileView] = React.useState<'list' | 'thread'>('list');

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
          />
        </div>

        {/* Painel 3: ficha do lead — só em lg+ no M5#4a (Sheet em md, Drawer em sm vem em M5#4c) */}
        <div className="hidden h-full min-h-0 flex-col lg:flex">
          <LeadFichaPanel conversationId={selectedId} />
        </div>
      </div>
    </div>
  );
}
