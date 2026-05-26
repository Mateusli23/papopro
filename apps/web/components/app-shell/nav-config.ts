/**
 * Configuração declarativa do menu lateral.
 *
 * Grupos organizados por valor para o usuário:
 * - Principal: operação diária do CRM.
 * - Automação: recursos avançados que ampliam o atendimento.
 * - Gestão: análise e configuração.
 */
import {
  Bot,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PieChart,
  Repeat,
  Settings,
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
    title: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users },
      { label: 'Kanban', href: '/kanban', icon: KanbanSquare },
      { label: 'Tarefas', href: '/tasks', icon: ListChecks },
      // Badge **dinâmico**: o `<SidebarNav>` mescla `useUnreadCount()` neste
      // item antes de renderizar (M5#4c). `badge` fica `undefined` aqui pra
      // que sem mensagens não-lidas o número simplesmente some — o componente
      // só pinta o `<Badge>` quando `item.badge !== undefined`.
      { label: 'Inbox', href: '/inbox', icon: Inbox },
    ],
  },
  {
    title: 'Automação',
    items: [
      // Ícone Bot (não Sparkles) — alinhado com cmdk-palette, editor e
      // empty state da lista (review MEDIUM M5#5: visual consistency).
      { label: 'Cadências', href: '/cadences', icon: Repeat },
      { label: 'Agentes IA', href: '/agents', icon: Bot },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Relatórios', href: '/reports', icon: PieChart },
      { label: 'Configurações', href: '/settings', icon: Settings },
    ],
  },
];
