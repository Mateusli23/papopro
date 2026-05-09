'use client';

import * as React from 'react';

import { useTheme } from 'next-themes';

import { Monitor, Moon, Sun } from '../icons';
import { cn } from '../utils/cn';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

/**
 * Toggle de tema acessível. Usa `next-themes` por baixo (com defaultTheme="dark"
 * vindo do `ThemeProvider`). Mostra ícone do tema atual + menu com 3 opções.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Evita hydration mismatch — `theme` só fica disponível depois do mount.
  React.useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn(className)} aria-label="Alternar tema">
          {mounted && theme === 'light' ? (
            <Sun className="size-4" />
          ) : mounted && theme === 'system' ? (
            <Monitor className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme('light')}>
          <Sun /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>
          <Moon /> Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>
          <Monitor /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
