/**
 * `with-workspace` — helper crítico de multi-tenant.
 *
 * **Por que existe.** As policies RLS do PapoPro decidem visibilidade lendo
 * `current_setting('app.workspace_id')`. Esse setting é por sessão Postgres
 * e precisa ser aplicado *dentro da mesma transação* da query, senão o
 * Prisma reaproveita a conexão do pool com o setting do request anterior
 * — vazamento direto de dados entre tenants.
 *
 * **Como usar.** Toda Server Action / Route Handler que toca tabela com
 * RLS deve embrulhar suas queries assim:
 *
 *     await withWorkspace(ctx.workspaceId, async (tx) => {
 *       const lead = await tx.lead.findFirst({
 *         where: { id, workspaceId: ctx.workspaceId }, // defense-in-depth
 *       });
 *       return lead;
 *     });
 *
 * **Defense-in-depth.** O helper só aplica `SET LOCAL` — o callback ainda
 * deve filtrar `workspaceId` explicitamente no `where` (CLAUDE.md §7.2).
 * Isso protege contra bug de policy: mesmo se a RLS for desabilitada por
 * acidente numa migration, o código continua filtrando.
 *
 * **Segurança do parâmetro.** Usa `$executeRaw\`SET LOCAL app.workspace_id
 * = ${workspaceId}\``, que o Prisma parametriza via prepared statement —
 * NÃO interpolação de string. Mesmo assim, validamos no início que o
 * workspaceId é uma string não-vazia, sem caracteres de controle.
 *
 * **Transação.** Tudo dentro do callback roda na mesma transação. Erro =
 * rollback automático = `app.workspace_id` volta a `null` na conexão
 * (porque `SET LOCAL` só vive até `COMMIT`/`ROLLBACK`). Isso é o que o
 * smoke test em `/api/smoke-test/supabase` valida.
 *
 * **Em M7#1.** O schema ainda é placeholder; este helper é usado só pelo
 * smoke endpoint via `$queryRaw`. Em M7#2+, conforme tabelas reais entram,
 * `tx` ganha métodos tipados (tx.workspace, tx.lead, etc.) automaticamente
 * pelo `prisma generate`.
 */
import 'server-only';

import { prisma, type Prisma } from '@papopro/db';

const WORKSPACE_ID_REGEX = /^[\w-]{1,64}$/;

export async function withWorkspace<T>(
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (typeof workspaceId !== 'string' || !WORKSPACE_ID_REGEX.test(workspaceId)) {
    throw new Error(
      `withWorkspace: workspaceId inválido (${JSON.stringify(workspaceId)}). Esperado string [A-Za-z0-9_-]{1,64}.`,
    );
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Parametrizado via prepared statement. O Prisma escapa o valor; mesmo
    // assim, o regex acima já restringe o domínio a id-like strings.
    await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
    return fn(tx);
  });
}
