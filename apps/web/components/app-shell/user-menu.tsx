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

import { FAKE_USER } from '@/lib/fixtures/user';

/**
 * Avatar do topbar com menu de perfil. Hoje os itens não têm rota real —
 * substituído em M3 (perfil/settings) e M7 (logout via Supabase Auth).
 */
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Conta de ${FAKE_USER.name}`}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/15 text-primary">
              {FAKE_USER.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal normal-case tracking-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-foreground font-medium">{FAKE_USER.name}</span>
            <span className="text-caption text-muted-foreground truncate">{FAKE_USER.email}</span>
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
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
