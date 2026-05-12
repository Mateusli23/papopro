import 'server-only';

import type { WorkspaceSwitcherItem } from '@/components/app-shell/workspace-switcher';
import type { MembershipSummary } from '@/lib/auth/get-user';

/**
 * Adaptadores de apresentação do feature `workspace` (M7#4 Onda 3).
 *
 * Centralizamos aqui as derivações cosméticas (iniciais do avatar, accent
 * color) pra:
 *  1. Não duplicar lógica entre Sidebar (server) e MobileNav (server).
 *  2. Manter `WorkspaceSwitcher` (client) puramente de renderização.
 *  3. Quando `Workspace.accent` virar coluna real no banco (M8 ou Onda 4),
 *     trocar só este arquivo.
 */

const ACCENT_BY_INDEX: ReadonlyArray<WorkspaceSwitcherItem['accent']> = [
  'primary',
  'success',
  'info',
  'warning',
];

/**
 * Extrai 2 letras pra usar como fallback do avatar. Pega a primeira letra
 * de cada uma das duas primeiras palavras; se só tem uma palavra, pega as
 * duas primeiras letras dela. Sempre maiúscula.
 *
 * Exemplos: "Imóvel Pro" → "IP", "Acme" → "AC", "x" → "X".
 */
export function workspaceInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * Converte um `MembershipSummary` em `WorkspaceSwitcherItem`.
 *
 * `accent` é determinístico por índice — mesmo workspace sempre cor igual no
 * mesmo posicionamento. Em Onda 4+ quando `workspaces.accent` virar coluna,
 * trocamos esse mapa pelo valor persistido.
 */
export function toSwitcherItem(
  membership: MembershipSummary,
  index: number,
): WorkspaceSwitcherItem {
  return {
    workspaceId: membership.workspaceId,
    name: membership.workspace.name,
    initials: workspaceInitials(membership.workspace.name),
    plan: membership.workspace.plan,
    role: membership.role,
    accent: ACCENT_BY_INDEX[index % ACCENT_BY_INDEX.length]!,
  };
}
