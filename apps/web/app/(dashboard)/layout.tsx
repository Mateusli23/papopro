import { TooltipProvider } from '@papopro/ui';

import { CmdKPalette } from '@/components/app-shell/cmdk-palette';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { WelcomeWizardController } from '@/features/onboarding/components/welcome-wizard-controller';

/**
 * Layout do produto. Aplicado a TODAS as rotas dentro de `(dashboard)/` —
 * leads, kanban, inbox, agentes, etc. Sidebar à esquerda (desktop) ou drawer
 * (mobile), topbar fixa, conteúdo rolável.
 *
 * Ainda não checa auth — em M3 entra um middleware que redireciona pra
 * `/login` se não houver sessão; em M7 a sessão fica real (Supabase).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
       * quando o usuário logou mas ainda não concluiu/pulou. Lógica
       * encapsulada no controller; aqui é só ponto de montagem.
       */}
      <WelcomeWizardController />

      {/*
       * Cmd+K palette placeholder — `useGlobalShortcuts` registra o listener
       * global (`g+n`, `Ctrl/⌘+K`). Em M5 isso vira a busca global real.
       */}
      <CmdKPalette />
    </TooltipProvider>
  );
}
