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
      // Badge **dinâmico**: o `<SidebarNav>` mescla `useUnreadCount()` neste
      // item antes de renderizar (M5#4c). `badge` fica `undefined` aqui pra
      // que sem mensagens não-lidas o número simplesmente some — o componente
      // só pinta o `<Badge>` quando `item.badge !== undefined`.
      { label: 'Inbox', href: '/inbox', icon: Inbox },
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
