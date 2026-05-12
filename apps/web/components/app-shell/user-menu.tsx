'use client';

import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@papopro/ui';
import { LifeBuoy, LogOut, Settings, User } from '@papopro/ui/icons';

import { logoutAction } from '@/features/auth/actions';
import { useUser } from '@/lib/auth/use-user';
import { FAKE_USER } from '@/lib/fixtures/user';

/**
 * Avatar do topbar com menu de perfil.
 *
 * **Identidade real (M7#3):** `useUser()` lê a sessão Supabase httpOnly via
 * `@supabase/ssr`. Enquanto `loading`, mostra `FAKE_USER` como skeleton —
 * evita o flash "Avatar?? · @??" durante hidratação. Sem dado real, segue
 * mostrando fixture (dev-only — em prod o middleware bloqueia antes).
 *
 * "Sair" chama a Server Action `logoutAction` (revalida cache + redirect
 * pra /login). Não precisa `router.push` — a action faz `redirect()` no
 * server, encerrando a navegação atual.
 */
export function UserMenu() {
  const { loading, user, displayName: real } = useUser();
  const displayName = real ?? FAKE_USER.name;
  const displayEmail = user?.email ?? FAKE_USER.email;
  const initials =
    (displayName.match(/\b([A-Za-zÀ-ÿ])/g) ?? []).slice(0, 2).join('').toUpperCase() ||
    FAKE_USER.initials;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Conta de ${displayName}`}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/15 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal normal-case tracking-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-foreground font-medium">{displayName}</span>
            <span className="text-caption text-muted-foreground truncate">{displayEmail}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings /> Configurações
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LifeBuoy /> Suporte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logoutAction();
          }}
          className="text-destructive focus:text-destructive"
          disabled={loading}
        >
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
