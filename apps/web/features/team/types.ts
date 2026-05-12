/**
 * Types do feature `team` (M7#5) — espelham o shape que a UI de
 * `/settings/team` consome.
 *
 * **Convenção de datas:** strings ISO 8601. As queries fazem `toISOString()`
 * antes de devolver, pra que a serialização entre Server Component e Client
 * Component seja trivial (sem `Date` no boundary que vira `{}` na hidratação).
 */

import type { Role } from '@/lib/auth/require-role';

export type { Role };

/**
 * Membro ativo do workspace — join de `workspace_members` + `users`.
 */
export interface TeamMemberRow {
  /** `workspace_members.id` — usado nas Server Actions `changeRole`/`remove`. */
  id: string;
  /** `users.id` — usado pra detectar self-edit no caller. */
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  /** ISO 8601. `null` se o membro nunca aceitou (ex: dados legacy). */
  joinedAt: string | null;
  /** ISO 8601. `null` se o membro nunca acessou após convite. */
  lastSeenAt: string | null;
}

/**
 * Convite pending — `invitations.status = 'pending'`. Convites accepted/expired/
 * revoked não entram aqui (a lista é "trabalho ativo").
 */
export interface PendingInviteRow {
  id: string;
  email: string;
  role: Role;
  /** ISO 8601 — quando o convite foi emitido (alimenta "enviado há X"). */
  createdAt: string;
  /** ISO 8601 — TTL de 7 dias após o último envio. */
  expiresAt: string;
  /** `users.id` do Owner/Admin que disparou o convite. */
  createdById: string;
}
