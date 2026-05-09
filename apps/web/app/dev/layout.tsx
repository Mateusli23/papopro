import * as React from 'react';

import { notFound } from 'next/navigation';

import { type Metadata } from 'next';

import { LogoMark, ThemeToggle } from '@papopro/ui';

import { AxeDevtools } from './axe';

/**
 * `/_dev/*` é uma área interna de desenvolvimento. Em produção, retornamos
 * 404 para que ninguém abra acidentalmente o showcase. Em dev e em previews
 * Vercel (`process.env.VERCEL_ENV !== 'production'`), o showcase fica
 * acessível para testes manuais e auditoria axe.
 *
 * Convenção: tudo embaixo de `/_dev` é "ferramenta interna" — sem header
 * do produto, sem auth, só o necessário pra navegar pelos componentes.
 */
export const metadata: Metadata = {
  title: 'Dev — PapoPro',
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <LogoMark className="size-7" />
            <div className="flex flex-col leading-tight">
              <span className="text-foreground text-body font-semibold">PapoPro · Dev</span>
              <span className="text-muted-foreground text-caption">
                Showcase de componentes — não-indexado
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <AxeDevtools />
    </div>
  );
}
