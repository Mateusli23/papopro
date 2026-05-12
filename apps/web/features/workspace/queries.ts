import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Queries server-only do feature `workspace` (M7#4).
 *
 * **Por que NÃO está em `actions.ts`:** `'use server'` transforma todo
 * export em Server Action callable do client. Helpers de leitura interna
 * (usados pelo middleware Edge e por Server Components) precisam ser
 * `import 'server-only'` em vez disso — caso contrário viram um endpoint
 * RPC que qualquer um pode chamar (vetor de probing de existência de
 * usuários, por exemplo).
 *
 * `getMembershipCountForUser` em particular é chamado pelo middleware no
 * cache-miss do cookie `papopro_workspace_id` — *cada* request quando o
 * cookie está ausente. A função fica curta (uma query) e cacheia o
 * resultado via o próprio cookie que o middleware popula.
 */

/**
 * `getMembershipCountForUser` — bootstrap usado pelo middleware quando
 * `papopro_workspace_id` está ausente (sessão nova, cookie expirado, etc.).
 *
 * **Service role / bypassa RLS:** o caller filtra explicitamente por
 * `user_id`, então não vaza pra outros tenants (defense-in-depth — CLAUDE.md
 * §7.2). A alternativa seria criar policy paralela `workspace_members_select_own`
 * com `user_id = auth.uid()` — adiciona migration e é redundante com o
 * filtro explícito.
 *
 * Retorna `{ count, firstWorkspaceId }`:
 *  - `count` orienta o redirect: 0 → /onboarding; ≥1 → /dashboard
 *  - `firstWorkspaceId` popula o cookie pra evitar refetch nos próximos
 *    requests da mesma sessão. Se houver múltiplos, escolhe o mais antigo
 *    (`order created_at asc`) — heurística simples até o switcher real
 *    persistir "última seleção" em Onda 3.
 *
 * **Erro silencioso retorna 0**: se a query falhar (rede, RLS quebrada), o
 * middleware manda pra /onboarding, que tenta de novo no server. Pior caso
 * é um bounce — melhor que liberar /dashboard sem garantia.
 */
export async function getMembershipCountForUser(
  userId: string,
): Promise<{ count: number; firstWorkspaceId: string | null }> {
  const admin = createSupabaseAdminClient();

  // Uma query só com `count: 'exact'` traz tanto o número quanto a primeira
  // row (data[0]). Evita o round-trip duplo do design ingênuo.
  const { data, error, count } = await admin
    .from('workspace_members')
    .select('workspace_id', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[getMembershipCountForUser] failed', error.message);
    return { count: 0, firstWorkspaceId: null };
  }

  return {
    count: count ?? 0,
    firstWorkspaceId: data?.[0]?.workspace_id ?? null,
  };
}
