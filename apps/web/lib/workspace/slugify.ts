/**
 * Slugify pra `workspaces.slug` (M7#4).
 *
 * Função pura, sem dependência externa, exercitável em smoke test. Recebe o
 * nome do workspace e devolve um slug seguro pra URL:
 *
 *  - normaliza Unicode (NFKD) e remove combining marks → "Café" → "cafe"
 *  - troca tudo que não é `[a-z0-9]` por hífen
 *  - colapsa múltiplos hífens
 *  - corta hífens de borda
 *  - trunca em 64 chars (limite confortável pra coluna VARCHAR(80))
 *  - lowercase no fim
 *
 * O caller é responsável por garantir unicidade — em `createWorkspaceAction`
 * tentamos o slug base e, em caso de colisão, adicionamos sufixo numérico
 * (`acme`, `acme-2`, `acme-3`…) via `ensureUniqueSlug` abaixo.
 */
export function slugify(input: string): string {
  if (typeof input !== 'string') return '';
  const normalized = input
    .normalize('NFKD')
    // Remove combining marks (acentos) — `\p{Diacritic}` exige flag `u`.
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.slice(0, 64);
}

/**
 * Resolve unicidade de slug iterando com sufixo numérico.
 *
 * `isTaken(slug)` é injetável pra ficar testável sem DB. Em produção, o
 * caller passa uma função que checa `workspaces.slug` no Prisma.
 *
 * Limite de tentativas: 50 — depois disso, lança erro. 50 colisões no mesmo
 * nome base sinaliza algo errado (ataque ou bug) — falhar barulhento.
 */
export async function ensureUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const safeBase = base || 'workspace';
  if (!(await isTaken(safeBase))) return safeBase;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${safeBase}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`ensureUniqueSlug: esgotado após 50 tentativas para "${base}"`);
}
