import { LogoFull } from '@papopro/ui';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';
import { WorkspaceSwitcher } from './workspace-switcher';

/**
 * Sidebar fixa de 240px (CLAUDE.md §8). Visível em ≥1024px; abaixo disso vira
 * drawer no `MobileNav`.
 *
 * Estrutura: marca → workspace switcher → navegação → rodapé com status.
 */
export function Sidebar() {
  return (
    <aside
      className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-screen w-sidebar shrink-0 flex-col border-r lg:flex"
      aria-label="Barra lateral"
    >
      <div className="border-sidebar-border flex h-14 items-center px-4 border-b">
        <LogoFull />
      </div>
      <div className="border-sidebar-border border-b p-2">
        <WorkspaceSwitcher />
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}
