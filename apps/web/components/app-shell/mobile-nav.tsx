'use client';

import * as React from 'react';

import {
  Button,
  LogoFull,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@papopro/ui';
import { Menu } from '@papopro/ui/icons';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';
import { WorkspaceSwitcher, type WorkspaceSwitcherItem } from './workspace-switcher';

interface MobileNavProps {
  workspaces: WorkspaceSwitcherItem[];
  activeWorkspaceId: string | null;
  /** Cold alerts não-acknowledged visíveis pro caller (M10#4). */
  coldAlertsCount?: number;
}

/**
 * Hamburger + drawer lateral pra telas <1024px.
 *
 * Reusa SidebarNav/SidebarFooter/WorkspaceSwitcher — o mesmo conteúdo da
 * sidebar fixa fica "guardado" atrás do botão. `onNavigate` fecha o sheet
 * automaticamente ao clicar num link.
 *
 * **M7#4 Onda 3:** workspaces vêm via prop do Topbar (server) em vez de
 * fixtures via `useWorkspaceMock`.
 */
export function MobileNav({ workspaces, activeWorkspaceId, coldAlertsCount }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-72 flex-col p-0"
      >
        {/* Title/Description são exigidos pelo Radix Dialog para acessibilidade.
            Escondemos visualmente, mas leitores de tela leem. */}
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SheetDescription className="sr-only">
          Acesso rápido a leads, kanban, inbox, agentes e configurações.
        </SheetDescription>

        <div className="border-sidebar-border flex h-14 items-center border-b px-4">
          <LogoFull />
        </div>
        <div className="border-sidebar-border border-b p-2">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} coldAlertsCount={coldAlertsCount} />
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
