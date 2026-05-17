import { Input, KbdShortcut, ThemeToggle } from '@papopro/ui';
import { Search } from '@papopro/ui/icons';

import { loadColdAlertsCount } from '@/lib/cold-alerts/load-count';

import { MobileNav } from './mobile-nav';
import { NotificationsButton } from './notifications-button';
import { loadSwitcherData } from './sidebar';
import { UserMenu } from './user-menu';

/**
 * Topbar fixa de 56px no topo do conteúdo:
 *  - mobile (<lg): hamburger à esquerda + ações à direita;
 *  - desktop (≥lg): busca expandida + ações.
 *
 * **M7#4 Onda 3:** Server Component async pra carregar workspaces e passar
 * pro `<MobileNav>` (client). React `cache()` em `getCurrentUserContext`
 * garante que Sidebar + Topbar compartilham o mesmo round-trip.
 *
 * Busca é placeholder visual até M3+ (CommandMenu/Cmd+K vem depois).
 */
export async function Topbar() {
  // `loadColdAlertsCount` é cached por request — `Sidebar` (desktop) chama
  // antes, então aqui só hit no cache. Mantemos chamada explícita pra que o
  // mobile-nav receba o número quando Sidebar não está montada (<lg).
  const [{ workspaces, activeWorkspaceId }, coldAlertsCount] = await Promise.all([
    loadSwitcherData(),
    loadColdAlertsCount(),
  ]);

  return (
    <header
      className="bg-background/80 supports-[backdrop-filter]:bg-background/60 border-border sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md sm:px-6"
      role="banner"
    >
      <MobileNav
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        coldAlertsCount={coldAlertsCount}
      />

      <div className="relative hidden max-w-md flex-1 md:flex">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Buscar leads, conversas, tarefas…"
          className="pl-9 pr-16"
          aria-label="Busca global"
        />
        <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2">
          <KbdShortcut keys={['Ctrl', 'K']} />
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  );
}
