import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Queries server-only do feature `invitations` (M7#4 Onda 2).
 *
 * **Por que NÃO está em `actions.ts`:** `'use server'` transforma todo
 * export em Server Action callable do client — `getInvitationByToken` por
 * RPC permitiria probing de tokens existentes. Aqui fica protegido pelo
 * `import 'server-only'`.
 *
 * **Acesso por admin client (bypass RLS):** o token É a autorização. A
 * policy `invitations_select` filtra por `current_workspace_id()`, que só
 * é setado quando o usuário JÁ é membro — quem está aceitando ainda não é.
 * Filtramos explicitamente por `token` (UUID single-use; ataque por
 * enumeração é impraticável — 2^122 possibilidades).
 */

export interface InvitationByToken {
  id: string;
  workspaceId: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  workspaceName: string;
  inviterName: string | null;
}

/**
 * `getInvitationByToken` — usado pela página `/invite/accept` pra renderizar
 * o card de confirmação (nome do workspace, papel, quem convidou) antes do
 * user clicar em "Aceitar".
 *
 * Retorna `null` se token inválido. Status e expiração são incluídos pra UI
 * mostrar mensagem específica (expirado, revogado, já aceito) em vez de só
 * "não encontrado".
 */
export async function getInvitationByToken(token: string): Promise<InvitationByToken | null> {
  // Validação de formato — invitation.token é UUID. Curto-circuita probing
  // com strings malformadas antes de bater no banco.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select(
      `
      id,
      workspace_id,
      email,
      role,
      status,
      expires_at,
      workspaces ( name ),
      users:created_by_id ( name, email )
    `,
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[getInvitationByToken] failed', error.message);
    return null;
  }
  if (!data) return null;

  // Supabase tipa FK relations como array sem schema generation (mesma raiz
  // do bug consertado em get-user.ts). Normalizamos.
  const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
  const inviter = Array.isArray(data.users) ? data.users[0] : data.users;

  if (!ws) {
    console.error('[getInvitationByToken] orphan invitation (workspace deleted)', data.id);
    return null;
  }

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    email: data.email,
    role: data.role,
    status: data.status,
    expiresAt: data.expires_at,
    workspaceName: ws.name,
    inviterName: inviter?.name ?? inviter?.email ?? null,
  };
}
