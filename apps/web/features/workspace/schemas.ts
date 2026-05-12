import { z } from 'zod';

/**
 * Schemas Zod do feature `workspace` (M7#4).
 *
 * Reaproveita o shape de `onboardingSchema` em `features/auth/schemas.ts` mas
 * vive aqui porque o owner conceitual é o workspace, não a auth. Onboarding
 * page e wizard de boas-vindas vão importar deste arquivo.
 *
 * Restrições casam com `Workspace.name VARCHAR(60)` (schema.prisma).
 * Mensagens em pt-BR direto + propositivas (CLAUDE.md §5).
 */

const WORKSPACE_NAME_MAX = 60;

/**
 * `hasControlChars` — bloqueia control chars e DEL.
 *
 * Não usamos regex literal com escapes hex (`\x00-\x1f`) porque escapes
 * sobrevivem mal a tooling de copy/paste entre LLM e disco — escolhemos um
 * loop explícito sobre `charCodeAt` que tem zero ambiguidade.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Dê um nome ao workspace')
    .min(2, 'Nome muito curto')
    .max(WORKSPACE_NAME_MAX, `Nome muito longo (máx. ${WORKSPACE_NAME_MAX} caracteres)`)
    // Permite emojis, acentos e pontuação razoável — slugify normaliza pro
    // slug. Só bloqueamos control chars que não fazem sentido em um nome.
    .refine((v) => !hasControlChars(v), {
      message: 'O nome tem caracteres inválidos',
    }),
  /** Segmento opcional — default segue NULL no banco. */
  segment: z.string().max(32).optional().nullable(),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
