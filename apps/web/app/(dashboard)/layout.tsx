import { TooltipProvider } from '@papopro/ui';

import { CmdKPalette } from '@/components/app-shell/cmdk-palette';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { WelcomeWizardController } from '@/features/onboarding/components/welcome-wizard-controller';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWizardCookie } from '@/lib/auth/workspace-cookie';

/**
 * Layout do produto. Aplicado a TODAS as rotas dentro de `(dashboard)/` —
 * leads, kanban, inbox, agentes, etc. Sidebar à esquerda (desktop) ou drawer
 * (mobile), topbar fixa, conteúdo rolável.
 *
 * **M7#4 Onda 1+3:** o middleware já garante que quem chega aqui tem
 * workspace. Derivamos `hasWorkspace` do `getCurrentUserContext` (cached por
 * request) + `wizardCompleted` do cookie httpOnly server-side e passamos
 * pro `WelcomeWizardController` — substitui o `useWorkspaceMock` legacy.
 *
 * Server Component por default (CLAUDE.md §5). Filhos (Sidebar/Topbar) são
 * server também e fetcham os mesmos dados com cache compartilhado.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUserContext();
  const hasWorkspace = (context?.memberships.length ?? 0) > 0;
  const wizardCompleted = readWizardCookie();

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
       * após o user criar workspace. Cookie `papopro_wizard_completed=1`
       * fecha pra sempre depois do user concluir/pular.
       */}
      <WelcomeWizardController hasWorkspace={hasWorkspace} wizardCompleted={wizardCompleted} />

      {/*
       * Cmd+K palette placeholder — `useGlobalShortcuts` registra o listener
       * global (`g+n`, `Ctrl/⌘+K`). Em M5 isso vira a busca global real.
       */}
      <CmdKPalette />
    </TooltipProvider>
  );
}
