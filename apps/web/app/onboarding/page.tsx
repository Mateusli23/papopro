import Link from 'next/link';

import type { Metadata } from 'next';

import { BrandArcs, LogoFull, ThemeToggle } from '@papopro/ui';

import { OnboardingForm } from '@/features/auth/components/onboarding-form';

export const metadata: Metadata = {
  title: 'Configurar workspace',
  description: 'Dê um nome ao seu primeiro workspace.',
};

/**
 * Tela única de onboarding — pede o nome do primeiro workspace e segue para o
 * dashboard. Layout próprio (não vive sob `(dashboard)` porque ainda não tem
 * sidebar; não vive sob `(auth)` porque o usuário já está "logado").
 *
 * `BrandArcs` é permitido aqui (CLAUDE.md §8 — onboarding é uma das superfícies
 * de marketing/onboarding). Tom acolhedor, foco no campo único.
 */
export default function OnboardingPage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/" aria-label="PapoPro">
          <LogoFull />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="relative w-full max-w-md">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-12 -inset-y-16 -z-10 opacity-60"
          >
            <BrandArcs variant="empty-state" absolute={false} className="size-full" />
          </div>

          <div className="border-border bg-card relative flex flex-col gap-8 rounded-lg border p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2">
              <span className="text-primary text-caption font-semibold uppercase tracking-wide">
                Passo 1 de 1 · Vamos lá
              </span>
              <h1 className="text-foreground text-title-lg font-semibold">
                Como vamos chamar seu workspace?
              </h1>
              <p className="text-muted-foreground text-body">
                Use o nome da empresa, do time ou da operação. Aparece pra você e pra equipe que
                você convidar depois.
              </p>
            </div>

            <OnboardingForm />
          </div>
        </div>
      </main>
    </div>
  );
}
