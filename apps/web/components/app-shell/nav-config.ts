/**
 * Configuração declarativa do menu lateral.
 *
 * Cada item vira um `<Link>` na sidebar. Dividimos em "principal" e
 * "configurações" pra renderizar com separator no meio. As rotas seguem o
 * roadmap do produto (CLAUDE.md §4 e PLAN.md M3+) — algumas ainda não existem
 * em código; os links levam pra páginas placeholder até virem em M3+.
 */
import {
  Bell,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PieChart,
  Repeat,
  Settings,
  Sparkles,
  Users,
} from '@papopro/ui/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Badge numérico opcional (ex: 12 leads novos). */
  badge?: number;
  /** Marcado como "soon" enquanto a tela ainda não foi entregue. */
  soon?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users },
      { label: 'Kanban', href: '/kanban', icon: KanbanSquare },
      // Badge fixo em 3 (= unreadCount inicial das fixtures: conv_003 + conv_006
      // + conv_007). Em M5#4c o `<SidebarNav>` consome `useUnreadCount()` e
      // atualiza ao vivo conforme o vendedor abre conversas.
      { label: 'Inbox', href: '/inbox', icon: Inbox, badge: 3 },
      { label: 'Agentes', href: '/agents', icon: Sparkles, soon: true },
      { label: 'Cadências', href: '/cadences', icon: Repeat },
      { label: 'Tarefas', href: '/tasks', icon: ListChecks },
      { label: 'Relatórios', href: '/reports', icon: PieChart },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Notificações', href: '/settings/notifications', icon: Bell, soon: true },
      { label: 'Configurações', href: '/settings', icon: Settings, soon: true },
    ],
  },
];
