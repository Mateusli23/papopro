/**
 * Duck-type check pra códigos de erro do Prisma (M7#4 — extraído após review
 * apontar duplicação entre `features/workspace/actions.ts` e
 * `features/invitations/actions.ts`).
 *
 * **Por que duck-typing e não `instanceof Prisma.PrismaClientKnownRequestError`:**
 * a classe não está exportada no client placeholder gerado sem `prisma generate`
 * (cenário documentado em M7#1 — TLS strict bloqueia `binaries.prisma.sh`). Os
 * códigos `Pxxxx` são parte do contrato público estável do Prisma — checagem por
 * código funciona em qualquer versão do client.
 *
 * Códigos comuns:
 *  - P2002: unique constraint violation
 *  - P2003: foreign key constraint failed
 *  - P2025: record to update/delete not found
 *
 * Lista completa: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function isPrismaErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === code
  );
}
