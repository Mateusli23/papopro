'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge, cn, ScrollArea } from '@papopro/ui';

import { NAV_GROUPS } from './nav-config';

interface SidebarNavProps {
  /** Chamado ao clicar num item — usado no mobile pra fechar o drawer. */
  onNavigate?: () => void;
}

/**
 * Lista de navegação principal. Estilo "denso e elegante" (HubSpot × Attico):
 * ícone + label, item ativo destacado com cor de marca + barra à esquerda.
 *
 * Os itens marcados como `soon` não têm rota implementada ainda — clicar leva
 * pro placeholder /dashboard. Em M3+ as rotas viram reais.
 */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <ScrollArea className="flex-1 px-3 py-4">
      <nav aria-label="Navegação principal" className="flex flex-col gap-6">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.title && (
              <div className="text-caption text-muted-foreground px-3 pb-1 font-semibold uppercase tracking-wide">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              // Itens "soon" levam pro dashboard até M3+ entregar a tela real.
              const href = item.soon ? '/dashboard' : item.href;
              return (
                <Link
                  key={item.label}
                  href={href}
                  onClick={onNavigate}
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
                  {item.badge !== undefined && (
                    <Badge variant="default" className="h-5 px-1.5">
                      {item.badge}
                    </Badge>
                  )}
                  {item.soon && (
                    <span className="text-muted-foreground/70 text-caption opacity-0 transition-opacity group-hover:opacity-100">
                      em breve
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}
