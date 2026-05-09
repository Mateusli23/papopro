'use client';

import * as React from 'react';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@papopro/ui';
import { Check, ChevronsUpDown, PlusCircle } from '@papopro/ui/icons';

import {
  ACTIVE_WORKSPACE_ID,
  FAKE_WORKSPACES,
  getWorkspace,
  type Workspace,
} from '@/lib/fixtures/workspaces';

const ACCENT_BG: Record<Workspace['accent'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  // `accent` agora é amarelo decorativo — usar como fundo de avatar lê
  // como warning. Aqui a key permanece (fixture compatível) mas mapeia
  // para o azul primário; quando workspaces reais vierem (M7), o tipo
  // `Workspace['accent']` é refeito sem essa colagem.
  accent: 'bg-primary/10 text-primary',
};

interface WorkspaceSwitcherProps {
  /** Versão "compacta" (só sigla) usada quando o switcher está num espaço estreito. */
  compact?: boolean;
}

/**
 * Switcher de workspace no topo da sidebar.
 *
 * Estado local até M7 — quando vier multi-tenant real, troca por server action +
 * cookie httpOnly (`active_workspace_id`) lido pelo `with-workspace.ts`.
 */
export function WorkspaceSwitcher({ compact = false }: WorkspaceSwitcherProps) {
  const [activeId, setActiveId] = React.useState(ACTIVE_WORKSPACE_ID);
  // Fallback duplo: ou achou pelo id, ou cai no primeiro fixture (sempre existe).
  const active = (getWorkspace(activeId) ?? FAKE_WORKSPACES[0]) as Workspace;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-auto w-full justify-between gap-2 rounded-md p-2 text-left',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
          aria-label={`Workspace atual: ${active.name}. Trocar`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-8 rounded-md">
              <AvatarFallback
                className={cn('text-caption rounded-md font-bold', ACCENT_BG[active.accent])}
              >
                {active.initials}
              </AvatarFallback>
            </Avatar>
            {!compact && (
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-sidebar-foreground truncate font-semibold">
                  {active.name}
                </span>
                <span className="text-caption text-muted-foreground truncate">
                  {active.plan} · {active.role}
                </span>
              </span>
            )}
          </span>
          {!compact && <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FAKE_WORKSPACES.map((ws) => {
          const isActive = ws.id === activeId;
          return (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => setActiveId(ws.id)}
              className="gap-3 py-2"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback
                  className={cn('text-caption rounded-md font-bold', ACCENT_BG[ws.accent])}
                >
                  {ws.initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body text-foreground truncate font-medium">{ws.name}</span>
                <span className="text-caption text-muted-foreground">{ws.role}</span>
              </span>
              <Badge
                variant={
                  ws.plan === 'Enterprise' ? 'info' : ws.plan === 'Pro IA' ? 'default' : 'secondary'
                }
                className="shrink-0"
              >
                {ws.plan}
              </Badge>
              {isActive && <Check className="text-primary ml-1 size-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground">
          <PlusCircle />
          Criar workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
