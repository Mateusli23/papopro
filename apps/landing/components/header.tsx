'use client';

import * as React from 'react';

import {
  Button,
  LogoFull,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  ThemeToggle,
} from '@papopro/ui';
import { Menu } from '@papopro/ui/icons';

/**
 * Header fixo da landing. Versão desktop mostra links âncora + CTAs alinhados.
 * Versão mobile (< md) colapsa em um botão hambúrguer que abre um `Sheet`
 * lateral com os mesmos itens — usar `Sheet` do design system mantém a UX
 * familiar (mesma animação do app) e zero CSS custom.
 *
 * Por que `'use client'`: o `Sheet` controla estado de aberto/fechado e o
 * `ThemeToggle` lê tema atual via `useTheme()`. Tudo o resto da landing
 * permanece Server Component.
 */

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#roi', label: 'Calculadora de ROI' },
  { href: '#planos', label: 'Planos' },
  { href: '#faq', label: 'FAQ' },
];

export function Header() {
  return (
    <header className="bg-background/80 border-border supports-[backdrop-filter]:bg-background/60 fixed inset-x-0 top-0 z-40 h-16 border-b backdrop-blur">
      <div className="container mx-auto flex h-full items-center justify-between gap-4">
        <a
          href="#hero"
          className="focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Voltar ao topo"
        >
          <LogoFull size={24} />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-body font-medium transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <a href="https://app.pipeflow.com.br/login">Entrar</a>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <a href="#cta-final">Começar grátis</a>
          </Button>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Abrir menu de navegação"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-6 p-6">
              <div className="pt-2">
                <LogoFull size={22} />
              </div>
              <nav className="flex flex-col gap-3" aria-label="Navegação mobile">
                {NAV_ITEMS.map((item) => (
                  <SheetClose key={item.href} asChild>
                    <a
                      href={item.href}
                      className="text-foreground hover:text-primary text-body-lg font-medium transition-colors"
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2">
                <SheetClose asChild>
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://app.pipeflow.com.br/login">Entrar</a>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <a href="#cta-final">Começar grátis</a>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
