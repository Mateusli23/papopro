/**
 * Supabase client — **service role**. Bypass total de RLS.
 *
 * ⚠️ **NUNCA importar de código client** (CLAUDE.md §7.1). Marcado
 * `server-only`: qualquer `'use client'` que importar aqui falha o build.
 *
 * Quando usar:
 *  - Webhooks externos (Stripe, uazapi, leads ads) que precisam escrever em
 *    qualquer workspace.
 *  - Edge Functions agendadas (cadência runner, cold lead detector,
 *    heartbeat) que rodam em nome do sistema.
 *  - Jobs administrativos (cleanup, exportação em massa, audit replay).
 *  - Migrações de dados que precisam atravessar tenants.
 *
 * Quando NÃO usar:
 *  - Qualquer Server Action disparada pelo usuário (usar `server.ts` +
 *    `with-workspace.ts` em vez disso).
 *  - Qualquer caminho que possa ser confundido com ação do usuário —
 *    auditoria fica errada se ações administrativas vazarem como
 *    "usuário fez X".
 *
 * Por design não persiste sessão (`persistSession: false`) — cada chamada
 * é stateless, sem refresh token, sem cookies. Isso é o esperado de
 * service role: ele não "loga", ele autoriza.
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin: faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente. Verifique apps/web/.env.local.',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
