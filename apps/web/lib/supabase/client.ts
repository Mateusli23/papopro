/**
 * Supabase client — **browser-safe**.
 *
 * Usa a `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pública por design) e confia em
 * **Row Level Security** para proteger os dados. Nada que dependa de
 * `SUPABASE_SERVICE_ROLE_KEY` pode passar por aqui — service role é
 * server-only (ver `admin.ts`).
 *
 * Padrão Next.js 14 App Router: `@supabase/ssr` cuida do storage de sessão
 * via cookies httpOnly. Componentes client (`'use client'`) usam este
 * factory; Server Components e Server Actions usam `server.ts`.
 *
 * Em M7#3 o hook `useUser()` em [`lib/auth/use-user.ts`] consome este factory
 * pra ler a sessão httpOnly do browser + reagir a `onAuthStateChange`. O
 * antigo `AuthMockProvider` foi deletado nessa onda.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase: faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente. Verifique apps/web/.env.local.',
    );
  }

  return createBrowserClient(url, anonKey);
}
