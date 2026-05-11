'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import toast from 'react-hot-toast';

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

import { setActiveWorkspaceAction } from '@/features/workspace/actions';
import type { MembershipSummary } from '@/lib/auth/get-user';

export interface WorkspaceSwitcherItem {
  workspaceId: string;
  name: string;
  /** Sigla 2 letras pra avatar fallback (gerada server-side em `toSwitcherItem`). */
  initials: string;
  /** Plano do workspace (Pro / Pro IA / Enterprise). */
  plan: string;
  /** Papel do user no workspace. */
  role: MembershipSummary['role'];
  /** Cor de marca (semântica baseada no índice + plano — vira coluna real em M8). */
  accent: 'primary' | 'success' | 'info' | 'warning';
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSwitcherItem[];
  activeWorkspaceId: string | null;
  /** Versão "compacta" (só sigla) usada quando o switcher está num espaço estreito. */
  compact?: boolean;
}

const ACCENT_BG: Record<WorkspaceSwitcherItem['accent'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
};

/**
 * Switcher de workspace no topo da sidebar (M7#4 Onda 3 — agora real).
 *
 * **Antes (M3/M7#3):** consumia `useWorkspaceMock()` com fixtures hardcoded.
 * **Agora:** recebe `workspaces` + `activeWorkspaceId` via prop do Server
 * Component pai (Sidebar/MobileNav), que fazem fetch de `getCurrentUserContext`.
 * Troca chama `setActiveWorkspaceAction(id)` que valida membership e seta o
 * cookie httpOnly `papopro_workspace_id`. `router.refresh()` re-roda o
 * middleware/Server Components com o cookie novo.
 *
 * **Otimismo controlado:** mantemos `pendingId` em state durante a transição
 * pra feedback visual imediato (Check muda de lugar enquanto a action roda).
 * Se action falhar, voltamos pro ID atual + toast com mensagem da action.
 *
 * **"Criar workspace"** continua placeholder por enquanto — fluxo de criar
 * 2º+ workspace pelo switcher é Onda 4+ (vai precisar de modal + reuso de
 * `createWorkspaceAction` permitindo múltiplos).
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  compact = false,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Workspace ativo: cookie > primeiro da lista. Cobre caso raro de cookie
  // apontar pra workspace que o user não tem mais acesso (foi removido).
  const activeFromCookie = workspaces.find((w) => w.workspaceId === activeWorkspaceId);
  const active = pendingId
    ? (workspaces.find((w) => w.workspaceId === pendingId) ?? activeFromCookie ?? workspaces[0])
    : (activeFromCookie ?? workspaces[0]);

  // Sem workspaces: middleware deveria ter redirecionado pra /onboarding —
  // mas defensivamente render placeholder pra não crashar.
  if (!active) {
    return (
      <Button variant="ghost" disabled className="h-auto w-full justify-start gap-2 p-2">
        <span className="text-caption text-muted-foreground">Sem workspace</span>
      </Button>
    );
  }

  async function handleSelect(workspaceId: string) {
    if (workspaceId === active!.workspaceId) return;
    setPendingId(workspaceId);
    const result = await setActiveWorkspaceAction(workspaceId);
    if (!result.ok) {
      setPendingId(null);
      toast.error(result.error);
      return;
    }
    startTransition(() => {
      // `router.refresh()` força server components dependentes (layout,
      // dashboard) a re-renderizar com a workspace nova. Topbar/sidebar
      // mostram o estado atualizado sem reload completo.
      router.refresh();
      setPendingId(null);
    });
  }

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
          disabled={isPending}
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
        {workspaces.map((ws) => {
          const isActive = ws.workspaceId === active.workspaceId;
          return (
            <DropdownMenuItem
              key={ws.workspaceId}
              onSelect={(event) => {
                event.preventDefault();
                void handleSelect(ws.workspaceId);
              }}
              className="gap-3 py-2"
              disabled={isPending}
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
        <DropdownMenuItem className="text-muted-foreground" disabled>
          <PlusCircle />
          Criar workspace
          <span className="text-caption ml-auto">Em breve</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
