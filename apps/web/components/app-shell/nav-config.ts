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
      { label: 'Inbox', href: '/inbox', icon: Inbox, soon: true, badge: 4 },
      { label: 'Agentes', href: '/agents', icon: Sparkles, soon: true },
      { label: 'Cadências', href: '/cadences', icon: Repeat, soon: true },
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
