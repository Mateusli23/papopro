/**
 * @papopro/db — cliente Prisma compartilhado do monorepo.
 *
 * **Lazy singleton.** A instância só é criada na *primeira propriedade
 * acessada* (`prisma.$transaction`, `prisma.workspace`, etc.) — não no
 * import. Isso resolve o "Failed to collect page data" do Next 14: o
 * coletor de metadados importa rotas em build-time, e instanciar
 * `PrismaClient` ali (sem `prisma generate` ter rodado, ou sem
 * `DATABASE_URL` no ambiente) crasha o build.
 *
 * **Cache em dev.** O HMR do Next recarrega módulos a cada mudança;
 * sem o cache via `globalThis`, cada reload abre uma conexão nova e
 * esgota o pool do Postgres em minutos. Padrão recomendado pela docs
 * do Prisma para Next.js (`/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices`).
 *
 * **Multi-tenant.** Este módulo NÃO aplica `SET LOCAL app.workspace_id`
 * sozinho. Toda Server Action / Route Handler que toca tabela com RLS
 * deve passar pelo helper `apps/web/lib/supabase/with-workspace.ts`, que
 * abre transação, faz o `set_config('app.workspace_id', …, true)`
 * parametrizado e roda o callback nessa transação. Defense-in-depth
 * (CLAUDE.md §7.2): além disso, toda query deve incluir
 * `where: { workspaceId }` no código também.
 *
 * **Schema.** Em M7#1 (este sub-PR) o schema ainda é placeholder — não
 * há `model` declarado. `prisma generate` produz um client funcional
 * para `$queryRaw` / `$executeRaw` / `$transaction`, suficiente para o
 * smoke test do helper de tenant. O schema real (`workspaces`, `users`,
 * `workspace_members`, …) chega em M7#2.
 */
import { PrismaClient } from '@prisma/client';

declare global {
  var __papoproPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function getPrisma(): PrismaClient {
  if (globalThis.__papoproPrisma) return globalThis.__papoproPrisma;
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__papoproPrisma = client;
  }
  return client;
}

/**
 * Proxy lazy: cada acesso a uma propriedade do `prisma` dispara
 * `getPrisma()`, que materializa a instância só na primeira chamada.
 * Build-time `import { prisma }` continua barato — não cria conexão.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export type { Prisma } from '@prisma/client';
