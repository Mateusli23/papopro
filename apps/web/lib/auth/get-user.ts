import 'server-only';

import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * `getCurrentUser` — fonte canônica do usuário autenticado no server.
 *
 * **Por que `supabase.auth.getUser()` e não `.getSession()`:** getSession lê
 * só do cookie local — basta forjar o cookie pra "logar". getUser bate no
 * Supabase pra validar o JWT antes de retornar — autenticação real. Custo
 * extra de 1 round-trip mitigado pelo `cache()` do React abaixo.
 *
 * **Cache por request via React `cache()`:** 5 Server Components no mesmo
 * request → 1 chamada Supabase. Resetado entre requests.
 *
 * Retorna `null` se não logado (não joga erro) — chamadores decidem o que
 * fazer (middleware redireciona, Server Component renderiza empty state).
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

export interface MembershipSummary {
  workspaceId: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';
  joinedAt: string | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    segment: string | null;
  };
}

export interface UserContext {
  user: User;
  /** Email confirmado? Reflete `auth.users.email_confirmed_at` (espelhado em `public.users.email_verified_at` pelo trigger M7#2). */
  emailVerified: boolean;
  memberships: MembershipSummary[];
}

/**
 * `getCurrentUserContext` — user + memberships pra orquestrar middleware e UI.
 *
 * **Por que admin client (service role) pra ler memberships:** a policy RLS
 * `workspace_members_select` filtra por `current_workspace_id()` — setting
 * de transação que só é setado depois que o user "escolhe" um workspace.
 * Chicken-and-egg: o middleware precisa listar workspaces ANTES de escolher
 * um. Solução: query bootstrap via service role, filtrando explicitamente
 * por `user_id = user.id` (defense-in-depth — não vaza pra outros tenants
 * porque o filtro é no `where`, não na policy).
 *
 * Alternativa considerada: criar policy paralela `workspace_members_select_own`
 * com `user_id = auth.uid()`. Mais elegante, mas adiciona migration e a
 * convenção do CLAUDE.md §7.2 ("filtrar no código também") já cobre.
 *
 * Cached por request — mesmo padrão de `getCurrentUser`.
 */
export const getCurrentUserContext = cache(async (): Promise<UserContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id, role, joined_at, workspaces(id, name, slug, plan, segment)')
    .eq('user_id', user.id);

  if (error) {
    // Não bloqueamos a sessão por causa disso — middleware decide o redirect
    // com base em memberships vazias (= /onboarding).
    console.error('[getCurrentUserContext] memberships query failed', error.message);
    return {
      user,
      emailVerified: Boolean(user.email_confirmed_at),
      memberships: [],
    };
  }

  // Supabase tipa relação FK aninhada como **array** quando não há
  // `generate types` rodado contra a DB (caso atual em M7 — geração via MCP
  // depende de `binaries.prisma.sh` que TLS strict bloqueia). Normalizamos
  // pegando o primeiro elemento; em runtime a FK é 1:1 (workspace_members →
  // workspaces) e Supabase devolve um objeto único, mas o TypeScript precisa
  // do guard.
  const memberships: MembershipSummary[] = (data ?? [])
    .map((row) => {
      const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
      if (!ws) return null;
      return {
        workspaceId: row.workspace_id,
        role: row.role,
        joinedAt: row.joined_at,
        workspace: {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          plan: ws.plan,
          segment: ws.segment,
        },
      } satisfies MembershipSummary;
    })
    .filter((m): m is MembershipSummary => m !== null);

  return {
    user,
    emailVerified: Boolean(user.email_confirmed_at),
    memberships,
  };
});
