'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge, cn, ScrollArea } from '@papopro/ui';

import { useUnreadCount } from '@/features/inbox/store';

import { NAV_GROUPS, type NavItem } from './nav-config';

interface SidebarNavProps {
  /** Chamado ao clicar num item — usado no mobile pra fechar o drawer. */
  onNavigate?: () => void;
  /**
   * Contagem de cold alerts não-acknowledged visíveis pro caller (M10#4).
   * RBAC fino aplicado no Server (Vendedor só dos próprios leads); o componente
   * só renderiza o número. `0` = sem badge.
   */
  coldAlertsCount?: number;
}

/**
 * Lista de navegação principal. Estilo "denso e elegante" (HubSpot × Attico):
 * ícone + label, item ativo destacado com cor de marca + barra à esquerda.
 *
 * Os itens marcados como `soon` não têm rota implementada ainda — clicar leva
 * pro placeholder /dashboard. Em M3+ as rotas viram reais.
 *
 * **Badges ao vivo (M5#4c):** o item `/inbox` recebe o `unreadCount` direto
 * do store da Inbox via `useUnreadCount()`. Quando o número é 0, `badge` fica
 * `undefined` e o `<Badge>` simplesmente não pinta — paridade com WhatsApp Web.
 * Outras features podem seguir o mesmo padrão (ex: tarefas atrasadas) sem
 * mudar a shape do `NavItem`.
 *
 * **M10#4:** item `/leads` recebe `coldAlertsCount` via prop (Server-fetched
 * em `Sidebar`/`Topbar` com RBAC fino). Mesma técnica do inbox. Quando 0,
 * badge some.
 */
export function SidebarNav({ onNavigate, coldAlertsCount = 0 }: SidebarNavProps) {
  const pathname = usePathname();
  const inboxUnread = useUnreadCount();

  // Mescla counters live nos items declarativos. Memoizamos pra preservar
  // a referência dos arrays quando os contadores não mudam — evita rerender
  // dos `<Link>` por causa de identity miss.
  const groups = React.useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        if (item.href === '/inbox') {
          return {
            ...item,
            badge: inboxUnread > 0 ? inboxUnread : undefined,
          } satisfies NavItem;
        }
        if (item.href === '/leads') {
          return {
            ...item,
            badge: coldAlertsCount > 0 ? coldAlertsCount : undefined,
          } satisfies NavItem;
        }
        return item;
      }),
    }));
  }, [inboxUnread, coldAlertsCount]);

  // Item mais específico (href mais longo) que casa com o pathname atual.
  // Sem isso, dois itens com hrefs aninhados (`/settings` e
  // `/settings/notifications`) ficariam ambos ativos quando o usuário está
  // dentro do filho — review M5#6 CRITICAL #1.
  const activeHref = React.useMemo(() => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    let best = '';
    for (const href of allHrefs) {
      if (pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))) {
        if (href.length > best.length) best = href;
      }
    }
    return best;
  }, [pathname]);

  return (
    <ScrollArea className="flex-1 px-3 py-4">
      <nav aria-label="Navegação principal" className="flex flex-col gap-6">
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.title && (
              <div className="text-caption text-muted-foreground px-3 pb-1 font-semibold uppercase tracking-wide">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === activeHref;
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
