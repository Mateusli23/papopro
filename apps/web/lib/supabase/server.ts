/**
 * Supabase client — **server-side**, age em nome do usuário logado.
 *
 * Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` + sessão httpOnly persistida em cookies
 * via `next/headers`. **Não usa service role** — RLS protege as queries.
 *
 * Quando usar:
 *  - Server Components que precisam do `user` (`supabase.auth.getUser()`).
 *  - Server Actions que mutam dados em nome do usuário.
 *  - Route Handlers que dependem da sessão (ex: webhooks autenticados via
 *    cookie, callbacks OAuth).
 *
 * Quando NÃO usar:
 *  - Webhooks externos (Stripe, uazapi, ads) — usar `admin.ts`.
 *  - Edge Functions agendadas (cadência, heartbeat, cold lead) — service role.
 *  - Jobs administrativos (cleanup, exportação, audit replay) — service role.
 *
 * **Compatível com cookies em Server Components.** O Next 14 só permite
 * mutar cookies em Server Actions ou Route Handlers; quando chamado de um
 * Server Component, o `set`/`remove` aqui é silenciosamente noop (em vez de
 * crashar). Isso segue o padrão recomendado em
 * `supabase.com/docs/guides/auth/server-side/nextjs`.
 *
 * Marcado `server-only`: importar este módulo de um arquivo `'use client'`
 * causa erro de build, evitando vazamento acidental.
 */
import 'server-only';

import { cookies } from 'next/headers';

import { createServerClient, type CookieOptions } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase: faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente. Verifique apps/web/.env.local.',
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components não podem mutar cookies — Next 14 lança aqui.
          // O middleware é quem renova a sessão, então engolir o erro é seguro.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // mesma razão acima.
        }
      },
    },
  });
}
