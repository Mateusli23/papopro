/**
 * App Shell — esqueleto de produto reutilizado em toda rota dentro de
 * (dashboard). Componentes vivem em `components/` (transversais), não em
 * `features/`, porque servem todas as features e não têm domínio próprio.
 */
export { MobileNav } from './mobile-nav';
export { NAV_GROUPS, type NavGroup, type NavItem } from './nav-config';
export { NotificationsButton } from './notifications-button';
export { Sidebar } from './sidebar';
export { SidebarFooter } from './sidebar-footer';
export { SidebarNav } from './sidebar-nav';
export { Topbar } from './topbar';
export { UserMenu } from './user-menu';
export { WorkspaceSwitcher } from './workspace-switcher';
