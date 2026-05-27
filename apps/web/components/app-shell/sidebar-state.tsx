'use client';

import * as React from 'react';

import { cn, LogoFull } from '@papopro/ui';
import { ChevronLeft, ChevronRight } from '@papopro/ui/icons';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';
import { WorkspaceSwitcher, type WorkspaceSwitcherItem } from './workspace-switcher';

const STORAGE_KEY = 'papopro.sidebar.collapsed';

interface SidebarStateProps {
  workspaces: WorkspaceSwitcherItem[];
  activeWorkspaceId: string | null;
  coldAlertsCount: number;
}

export function SidebarState({
  workspaces,
  activeWorkspaceId,
  coldAlertsCount,
}: SidebarStateProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
    setHydrated(true);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-sidebar',
        !hydrated && 'w-sidebar',
      )}
      aria-label="Barra lateral"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="border-sidebar-border flex h-14 items-center justify-between border-b px-3">
        {!collapsed && <LogoFull />}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="border-sidebar-border border-b p-2">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
        </div>
      )}
      <SidebarNav collapsed={collapsed} coldAlertsCount={coldAlertsCount} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
