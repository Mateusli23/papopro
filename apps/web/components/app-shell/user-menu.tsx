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

import { useAuthMock } from '@/lib/auth/auth-mock-provider';
import { FAKE_USER } from '@/lib/fixtures/user';

/**
 * Avatar do topbar com menu de perfil.
 *
 * Identidade exibida: prioriza o `AuthMockProvider` (email digitado no
 * login/signup) e cai pro `FAKE_USER` se a sessão ainda não hidratou ou
 * se algum dev forçou estado vazio. Em M7 troca por `useUser()` Supabase.
 *
 * O item "Sair" chama `signOut` — limpa cookies, manda pra `/login`. O
 * middleware impede revisita ao dashboard sem novo login.
 */
export function UserMenu() {
  const { user, signOut } = useAuthMock();
  const displayName = user?.name ?? FAKE_USER.name;
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
        <DropdownMenuItem onSelect={signOut} className="text-destructive focus:text-destructive">
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
