import type { TeamMemberRow } from './types';

/**
 * Adaptadores de apresentação do feature `team` (M7#5).
 *
 * Helpers cosméticos usados por `team-view.tsx` (Client Component) e
 * eventualmente por superfícies adjacentes (notificações de "fulano entrou
 * no time"). Manter aqui evita lógica duplicada.
 *
 * **Sem `import 'server-only'`** — diferente de `features/workspace/presentation.ts`
 * (consumido só por Server Components). `team-view.tsx` é Client e precisa
 * destes helpers; todos são puros (sem fetch, sem cookies, sem env), seguro
 * empacotar no bundle do browser.
 */

/**
 * Extrai 2 letras pra usar como fallback do avatar do membro. Mesmo algoritmo
 * de `workspaceInitials` ([features/workspace/presentation.ts]) mas opera sobre
 * `name | email` — para convites pendentes que ainda não viraram User, só
 * existe email.
 *
 * Exemplos: "Maria Souza" → "MS", "joao@empresa.com" → "JO", "" → "?".
 */
export function memberInitials(member: { name?: string | null; email: string }): string {
  const base = (member.name ?? '').trim() || member.email.trim();
  if (!base) return '?';
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

/**
 * Nome de display: prefere `name`, cai pro local-part do email (antes do @).
 * Usado quando o convite ainda não foi aceito (não há `User.name`).
 */
export function memberDisplayName(member: { name?: string | null; email: string }): string {
  const trimmed = member.name?.trim();
  if (trimmed) return trimmed;
  const at = member.email.indexOf('@');
  return at > 0 ? member.email.slice(0, at) : member.email;
}

/** Tipo guard útil para a UI distinguir membros ativos de convites pendentes. */
export function isActiveMember(item: TeamMemberRow | unknown): item is TeamMemberRow {
  return (
    typeof item === 'object' &&
    item !== null &&
    'userId' in item &&
    typeof (item as TeamMemberRow).userId === 'string'
  );
}
