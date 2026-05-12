import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/utils/uuid';

import type { PendingInviteRow, Role, TeamMemberRow } from './types';

/**
 * Queries server-only do feature `team` (M7#5).
 *
 * **Por que admin client (bypass RLS):** a tela `/settings/team` carrega no
 * Server Component **antes** do `withWorkspace` ser aplicado em alguma
 * Server Action — o Server Component não roda em tx Prisma. Tentamos via
 * Supabase SDK (não via Prisma) pela mesma razão de `getCurrentUserContext`:
 * o SDK aceita bypass via service role com filtro explícito por
 * `workspace_id` (defense-in-depth — CLAUDE.md §7.2).
 *
 * **Alternativa considerada:** chamar `withWorkspace` em Server Component
 * direto pra setar app.workspace_id e usar Prisma normal. Não faz porque
 * Server Component roda em runtime mais leve do Next; abrir tx Prisma só pra
 * fazer 2 SELECTs é desperdício. A política RLS continua ativa — admin client
 * só bypassa pra ESSA leitura específica, com filtro explícito.
 */

export interface TeamData {
  members: TeamMemberRow[];
  pendingInvitations: PendingInviteRow[];
}

export async function getTeamMembersAndInvitations(workspaceId: string): Promise<TeamData> {
  if (!isUuid(workspaceId)) {
    console.error('[getTeamMembersAndInvitations] invalid workspaceId', workspaceId);
    return { members: [], pendingInvitations: [] };
  }

  const admin = createSupabaseAdminClient();

  const [membersRes, invitationsRes] = await Promise.all([
    admin
      .from('workspace_members')
      .select('id, user_id, role, joined_at, last_seen_at, users(id, email, name, avatar_url)')
      .eq('workspace_id', workspaceId),
    admin
      .from('invitations')
      .select('id, email, role, status, expires_at, created_at, created_by_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  if (membersRes.error) {
    console.error('[getTeamMembersAndInvitations] members query failed', membersRes.error.message);
    return { members: [], pendingInvitations: [] };
  }

  // Invitations falha não bloqueia members — tela ainda mostra lista de membros
  // ativos com bloco "Convites pendentes" vazio + sinal de erro no console.
  if (invitationsRes.error) {
    console.error(
      '[getTeamMembersAndInvitations] invitations query failed',
      invitationsRes.error.message,
    );
  }

  const members: TeamMemberRow[] = (membersRes.data ?? [])
    .map((row) => {
      // Mesmo guard de `getCurrentUserContext`: Supabase tipa FK relations como
      // array quando o schema TS não foi gerado (caso atual em M7).
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!u) return null;
      return {
        id: row.id,
        userId: row.user_id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: row.role as Role,
        joinedAt: row.joined_at,
        lastSeenAt: row.last_seen_at,
      } satisfies TeamMemberRow;
    })
    .filter((m): m is TeamMemberRow => m !== null);

  const pendingInvitations: PendingInviteRow[] = (invitationsRes.data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as Role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    createdById: row.created_by_id,
  }));

  return { members, pendingInvitations };
}
