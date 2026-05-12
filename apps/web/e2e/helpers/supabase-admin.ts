import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase admin client dedicado aos testes Playwright (M7#6).
 *
 * **NÃO usar o projeto de produção** (`iffmjydjeukozopxxitb`). Operador
 * cria projeto separado `papopro-e2e` (sa-east-1, free tier) e popula
 * `E2E_SUPABASE_URL` + `E2E_SUPABASE_SERVICE_ROLE_KEY` em `.env.local`.
 * Ver `docs/SETUP.md` §"Rodar E2E localmente" pra script de bootstrap.
 *
 * **Por que não reusar `createSupabaseAdminClient` de `lib/supabase/admin.ts`:**
 * aquele helper lê `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (do
 * projeto de prod). Misturar projetos é receita pra acidente — um spec
 * que insere user de teste no projeto de prod pode contaminar audit_logs
 * e analytics.
 *
 * **Singleton:** cada chamada retorna a mesma instância pra evitar abrir
 * conexões a cada `beforeEach`. Auto-cleanup acontece no fim do processo.
 */

let cachedClient: SupabaseClient | null = null;

export function createE2EAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'E2E: faltam E2E_SUPABASE_URL ou E2E_SUPABASE_SERVICE_ROLE_KEY no ambiente.\n' +
        'Crie um projeto Supabase dedicado pros testes (não use o de produção) e popule\n' +
        'apps/web/.env.local. Ver docs/SETUP.md §"Rodar E2E localmente".',
    );
  }

  // Guard rail explícito contra rodar testes no projeto de produção. O ref
  // de prod é `iffmjydjeukozopxxitb` (M7#1, sa-east-1). Se alguém apontar
  // E2E_SUPABASE_URL pra ele por erro, a gente trava aqui antes do primeiro
  // INSERT.
  if (url.includes('iffmjydjeukozopxxitb')) {
    throw new Error(
      'E2E: E2E_SUPABASE_URL aponta pro projeto de PRODUÇÃO (iffmjydjeukozopxxitb).\n' +
        'Crie um projeto Supabase separado pros testes. Abortando antes de qualquer escrita.',
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
