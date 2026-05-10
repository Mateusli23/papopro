import type { Metadata } from 'next';

import { InboxView } from './inbox-view';

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Caixa unificada de WhatsApp do workspace — todas as conversas, vinculadas ao lead.',
};

/**
 * Server Component fino — a UI inteira é client (`InboxView`) porque depende
 * de `useSyncExternalStore`, atalhos de teclado e auto-scroll na thread.
 * Em M9 esse arquivo passa a buscar dados do Supabase via Prisma + RLS e
 * hidrata o store, mantendo a parte client praticamente igual.
 */
export default function InboxPage() {
  return <InboxView />;
}
