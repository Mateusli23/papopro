/**
 * Fixtures de workspaces — usadas pelo `WorkspaceSwitcher` enquanto não temos
 * Supabase Auth (M3+ continua mockado, M7 substitui por dados reais).
 *
 * Estrutura espelha o que vai virar a tabela `workspaces` em M7.
 */

export type WorkspaceRole = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

export type WorkspacePlan = 'Pro' | 'Pro IA' | 'Enterprise';

export interface Workspace {
  id: string;
  name: string;
  /** Sigla 2-letras pra avatar fallback. */
  initials: string;
  plan: WorkspacePlan;
  role: WorkspaceRole;
  /** Cor de marca do workspace (token semântico, não hex). */
  accent: 'primary' | 'success' | 'warning' | 'info' | 'accent';
}

export const FAKE_WORKSPACES: Workspace[] = [
  {
    id: 'ws_imovel_pro',
    name: 'Imóvel Pro Vendas',
    initials: 'IP',
    plan: 'Pro IA',
    role: 'Owner',
    accent: 'primary',
  },
  {
    id: 'ws_alta_perform',
    name: 'Alta Performance B2B',
    initials: 'AP',
    plan: 'Pro',
    role: 'Manager',
    accent: 'info',
  },
  {
    id: 'ws_consult_x',
    name: 'Consultoria X',
    initials: 'CX',
    plan: 'Enterprise',
    role: 'Vendedor',
    accent: 'accent',
  },
];

/** Workspace ativo "default" enquanto não há sessão real. */
// `as` é seguro: o array é literal e não-vazio acima.
export const ACTIVE_WORKSPACE_ID: string = (FAKE_WORKSPACES[0] as Workspace).id;

export function getWorkspace(id: string): Workspace | undefined {
  return FAKE_WORKSPACES.find((w) => w.id === id);
}
