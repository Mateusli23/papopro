'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * `useRealtimeDeals` (M8#7) — subscreve ao canal `workspace:<id>:deals`
 * e dispara `router.refresh()` em qualquer mudança (INSERT/UPDATE/DELETE).
 *
 * **Por que `router.refresh()` em vez de mergear o payload no estado local:**
 *  - Server Component pai (`kanban/page.tsx`) já tem a query Prisma + RLS;
 *    re-fetchar é a fonte da verdade e mantém consistência com o optimistic
 *    do `useOptimistic` (React reconcilia sozinho).
 *  - Evita lógica de merge sutil (UPDATE veio antes do INSERT? race?).
 *  - O custo de uma query Prisma extra é trivial pra volume MVP (~50-500 deals).
 *
 * **RLS automática:** Supabase Realtime aplica as policies SELECT da tabela
 * `deals`. Mesmo que outro workspace dispare events, o JWT do anon key
 * filtra na ponta — o cliente só recebe rows do `current_workspace_id()` dele.
 *
 * **Filter `workspace_id=eq.<id>`:** redundante com RLS (defense-in-depth),
 * mas economiza serialização Realtime em workspaces grandes.
 *
 * **Lifecycle:** subscribe no mount, unsubscribe no unmount. Reaproveita
 * o mesmo client browser (sem singleton custom — Supabase JS já cuida).
 *
 * **Debounce:** múltiplos events na mesma janela (200ms) → 1 só refresh.
 * Evita refresh storm quando um Server Action gera 2-3 INSERTs (Lead +
 * Deal + Activity).
 */
export function useRealtimeDeals(workspaceId: string): void {
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
      }, 200);
    }

    const channel = supabase
      .channel(`workspace:${workspaceId}:deals`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);
}
