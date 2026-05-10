'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge, cn } from '@papopro/ui';

import { SETTINGS_NAV } from './settings-nav-config';

/**
 * Sub-nav lateral de `/settings` (desktop only — `lg:`).
 *
 * Mesmo padrão visual da `<SidebarNav>` principal: ícone + label, item ativo
 * com a barra azul de 2px à esquerda e fundo `bg-sidebar-accent`. Largura
 * fixa 220px — escolhida pra deixar o conteúdo principal amplo nos formulários
 * de Workspace e Cobrança.
 *
 * Em mobile/tablet o `<SettingsMobileSelect>` assume o lugar.
 */
export function SettingsSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Configurações"
      className="border-border hidden w-[220px] shrink-0 flex-col gap-1 border-r px-3 py-6 lg:flex"
    >
      <div className="text-caption text-muted-foreground px-3 pb-2 font-semibold uppercase tracking-wide">
        Configurações
      </div>
      {SETTINGS_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'text-body group relative flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="bg-primary absolute inset-y-1.5 left-0 w-0.5 rounded-r-full"
              />
            )}
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.ownerOnly && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Owner
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
