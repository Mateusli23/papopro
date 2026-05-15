'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * `useRealtimeMessages` (M9#4) — subscribe em 3 canais Realtime relacionados
 * à Inbox:
 *   - `workspace:<id>:messages` → INSERT/UPDATE em `public.messages`
 *   - `workspace:<id>:conversations` → UPDATE em `public.conversations`
 *     (status, lastMessage*, unreadCount, archivedAt)
 *   - `workspace:<id>:quick_replies` → CRUD em `public.quick_replies`
 *
 * Cada mudança dispara `router.refresh()` debounced 250ms — Server Component
 * pai (`/inbox/page.tsx`) re-fetcha e propaga via prop pro `<InboxView>`. Sem
 * merge manual, sem race entre inbound webhook + outbound action + ACK.
 *
 * **RLS automática**: Supabase Realtime aplica policies SELECT — cliente só
 * recebe rows do `current_workspace_id()`. Filtro `workspace_id=eq.<id>` é
 * defense-in-depth (CLAUDE.md §7.2).
 *
 * **Debounce maior que M8#7 deals (200ms)**: 250ms cobre webhook inbound +
 * conversation update no mesmo tx (2-3 eventos por mensagem chegando).
 */
export function useRealtimeMessages(workspaceId: string): void {
  const router = useRouter();

  React.useEffect(() => {
    if (!workspaceId) return;

    const supabase = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, 250);
    }

    const messagesChannel = supabase
      .channel(`workspace:${workspaceId}:messages`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`workspace:${workspaceId}:conversations`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    const quickRepliesChannel = supabase
      .channel(`workspace:${workspaceId}:quick_replies`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_replies',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(quickRepliesChannel);
    };
  }, [workspaceId, router]);
}
