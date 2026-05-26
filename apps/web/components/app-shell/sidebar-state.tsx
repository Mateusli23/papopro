'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

const STORAGE_KEY = 'papopro.sidebar.collapsed';

interface SidebarStateProps {
  children: (state: { collapsed: boolean; toggleCollapsed: () => void }) => React.ReactNode;
}

export function SidebarState({ children }: SidebarStateProps) {
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
      {children({ collapsed, toggleCollapsed })}
    </aside>
  );
}
