import { TooltipProvider } from '@papopro/ui';

import { CmdKPalette } from '@/components/app-shell/cmdk-palette';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { WelcomeWizardController } from '@/features/onboarding/components/welcome-wizard-controller';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWizardCookie } from '@/lib/auth/workspace-cookie';

/**
 * **`dynamic = 'force-dynamic'` (M7#4 review fix):** todas as rotas filhas
 * sob `(dashboard)/` dependem da sessão Supabase + workspace ativo (cookies
 * por-request). Sem este flag, Next 14 tenta prerender no build e crasha
 * porque o `getCurrentUserContext` abaixo invoca `createSupabaseServerClient`
 * sem env vars (CI runner não tem `.env.local`). Marcar como force-dynamic
 * documenta o invariante real: nenhuma dessas pages é cacheável estaticamente.
 *
 * Alternativa considerada: setar `NEXT_PUBLIC_SUPABASE_URL` etc. como secrets
 * no CI. Rejeitada — a key vira pública nos logs do GitHub Actions e a fix
 * estrutural é dizer "essas pages SÃO dinâmicas".
 */
export const dynamic = 'force-dynamic';

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
