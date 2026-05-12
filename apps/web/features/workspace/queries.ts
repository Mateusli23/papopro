import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Queries server-only do feature `workspace` (M7#4 + M7#5).
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
 *
 * **In-memory cache (M7#5 fix MEDIUM #20):** o middleware atinge essas
 * funções em cold-start sem nada cacheado. Mapas no module scope sobrevivem
 * dentro da mesma worker instance do Edge runtime — popular um cache com
 * TTL curto (60s) reduz dramaticamente a pressão no Supabase REST. TTL curto
 * porque membership pode mudar (remove member, troca workspace) e a UX de
 * "mudei e o middleware ainda acha que sou membro" não deve durar mais que
 * 1 minuto.
 */

type MembershipCountResult = { count: number; firstWorkspaceId: string | null };

const MEMBERSHIP_TTL_MS = 60_000;
const membershipCountCache = new Map<string, { value: MembershipCountResult; expires: number }>();
const membershipCheckCache = new Map<string, { value: boolean; expires: number }>();

function cacheGet<T>(cache: Map<string, { value: T; expires: number }>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet<T>(
  cache: Map<string, { value: T; expires: number }>,
  key: string,
  value: T,
): void {
  cache.set(key, { value, expires: Date.now() + MEMBERSHIP_TTL_MS });
}

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
 *
 * **Cached por 60s** (M7#5 fix MEDIUM #20) — module-scope Map. Aceita stale
 * data dentro da janela; mudanças de membership (aceitar convite, ser
 * removido) propagam no próximo TTL.
 */
export async function getMembershipCountForUser(userId: string): Promise<MembershipCountResult> {
  const cached = cacheGet(membershipCountCache, userId);
  if (cached) return cached;

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

  const result: MembershipCountResult = {
    count: count ?? 0,
    firstWorkspaceId: data?.[0]?.workspace_id ?? null,
  };
  cacheSet(membershipCountCache, userId, result);
  return result;
}

/**
 * `isUserMemberOfWorkspace` — usado pelo middleware (M7#5 fix MEDIUM #17)
 * pra validar que o cookie `papopro_workspace_id` aponta pra um workspace
 * que o caller realmente é membro.
 *
 * **Por que isso é necessário.** O cookie tem TTL de 30 dias; a sessão
 * Supabase refresh token pode expirar antes (default 1h, com refresh
 * automático até 30 dias). Cenário: Owner removeu o user, ou o user logou
 * com outra conta no mesmo browser sem sair primeiro — cookie stale aponta
 * pra workspace que o user não pode mais acessar. Antes, o middleware
 * confiava no cookie e o user via 403 nas queries downstream; agora o
 * mismatch limpa o cookie e cai pro slow path (`getMembershipCountForUser`).
 *
 * **Cached por 60s** — mesmo padrão de cima. UX "mudei papel e o middleware
 * ainda valida o anterior" dura 1 minuto, aceitável.
 */
export async function isUserMemberOfWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const key = `${userId}|${workspaceId}`;
  const cached = cacheGet(membershipCheckCache, key);
  if (cached !== null) return cached;

  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) {
    // Erro de rede / DB: log mas não trava — middleware decide via slow path.
    console.error('[isUserMemberOfWorkspace] failed', error.message);
    return false;
  }

  const isMember = (count ?? 0) > 0;
  cacheSet(membershipCheckCache, key, isMember);
  return isMember;
}
