/**
 * @papopro/db — placeholder de M1.
 *
 * M7 popula com schema, migrations e o cliente Prisma + helper
 * `with-workspace.ts` que aplica `SET LOCAL app.workspace_id` a cada request
 * (ver [CLAUDE.md] §6 — Multi-tenant via Supabase RLS).
 *
 * Por enquanto exportamos só o tipo placeholder pra evitar referência quebrada.
 */
export const DB_PLACEHOLDER = true;
export type DbPlaceholder = typeof DB_PLACEHOLDER;
