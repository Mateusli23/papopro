import Link from 'next/link';

import { Button } from '@papopro/ui';
import { Clock, Sparkles } from '@papopro/ui/icons';

import { getTrialState } from '../queries';

interface Props {
  /** Workspace ativo — vem do cookie `papopro_workspace_id` no layout. */
  workspaceId: string;
}

/**
 * Banner de trial no topo do dashboard (M12#2).
 *
 * Server Component **async** — resolve o próprio estado via `getTrialState`.
 * Renderiza `null` quando o workspace não está em trial ativo (workspace
 * pago, Free, ou trial já expirado) — então fica invisível pra maioria.
 *
 * Tom escala perto do fim: ≤2 dias → `warning` (amarelo); senão `info`.
 * Os avisos D-2/D-1 por email (job `cron/trial-warnings`) são o canal
 * "ativo"; este banner é a superfície in-app passiva. Push real → M13.
 */
export async function TrialBanner({ workspaceId }: Props) {
  const trial = await getTrialState(workspaceId);
  if (trial.status !== 'active') return null;

  const urgent = trial.daysLeft <= 2;
  const tone = urgent
    ? 'border-warning/40 bg-warning/10 text-warning'
    : 'border-info/30 bg-info/[0.06] text-info';
  const daysLabel = trial.daysLeft === 1 ? 'termina amanhã' : `faltam ${trial.daysLeft} dias`;

  return (
    <div className="container mx-auto px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-2.5 ${tone}`}
        role="status"
      >
        <Clock className="size-4 shrink-0" />
        <span className="text-body flex-1">
          <strong>Teste grátis ativo</strong> — {daysLabel}. Você pode revisar os planos quando
          quiser.
        </span>
        <Button asChild size="sm" variant={urgent ? 'default' : 'outline'} className="gap-1">
          <Link href="/settings/billing">
            <Sparkles className="size-3.5" />
            Ver planos
          </Link>
        </Button>
      </div>
    </div>
  );
}
