import { TooltipProvider } from '@papopro/ui';

import { CmdKPalette } from '@/components/app-shell/cmdk-palette';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { WelcomeWizardController } from '@/features/onboarding/components/welcome-wizard-controller';
import { getCurrentUserContext } from '@/lib/auth/get-user';

/**
 * Layout do produto. Aplicado a TODAS as rotas dentro de `(dashboard)/` —
 * leads, kanban, inbox, agentes, etc. Sidebar à esquerda (desktop) ou drawer
 * (mobile), topbar fixa, conteúdo rolável.
 *
 * **M7#4 Onda 1:** o middleware já garante que quem chega aqui tem workspace.
 * Mesmo assim derivamos `hasWorkspace` do `getCurrentUserContext` (cached por
 * request via `cache()`) pra alimentar o `WelcomeWizardController` — quando
 * `hasWorkspace=false` (caso impossível em prod, mas defensivo) o controller
 * mantém o wizard fechado e a UI vazia até o middleware recarregar.
 *
 * Não há `'use client'` — é Server Component por default (CLAUDE.md §5). Os
 * filhos (Sidebar/Topbar) são client porque tem interação local.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUserContext();
  const hasWorkspace = (context?.memberships.length ?? 0) > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background text-foreground flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="conteudo-principal" className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      {/*
       * Wizard de boas-vindas — auto-abre na primeira visita ao dashboard
       * após o user criar workspace. Controller recebe `hasWorkspace` do
       * server (em M7#4 isso é a fonte de verdade; em M3 vinha do mock).
       */}
      <WelcomeWizardController hasWorkspace={hasWorkspace} />

      {/*
       * Cmd+K palette placeholder — `useGlobalShortcuts` registra o listener
       * global (`g+n`, `Ctrl/⌘+K`). Em M5 isso vira a busca global real.
       */}
      <CmdKPalette />
    </TooltipProvider>
  );
}
