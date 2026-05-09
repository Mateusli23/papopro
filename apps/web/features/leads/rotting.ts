/**
 * Cálculo do indicador "deal rotting" no card do Kanban.
 *
 * Regra (paleta Pipedrive):
 *  - Sem `lastInteractionAt` ou etapa terminal → cinza ('none')
 *  - Última interação foi hoje → 🟢 verde ('fresh')
 *  - Em até `rotDays` mas faltando ≤ 2 dias → 🟡 amarelo ('warning')
 *  - Passou de `rotDays` → 🔴 vermelho ('rotten')
 *
 * O `rotDays` por etapa vive em `pipelines.ts`. Valores default seguem
 * intuição de M10 (PLAN.md): Novo 7d, Em contato 14d, Proposta 7d, Negociação 5d.
 *
 * Em M11 podemos refinar isso com sinais de IA (ex: cliente respondeu
 * mas mostrou desinteresse → pinta vermelho mesmo dentro do prazo).
 */
import { differenceInDays, parseISO } from 'date-fns';

import type { Lead } from '@/features/leads/types';
import { getStage } from '@/lib/fixtures/pipelines';

export type RotState = 'fresh' | 'warning' | 'rotten' | 'none';

const NOW = new Date('2026-05-09T14:00:00-03:00');

export function calcRotState(lead: Lead): RotState {
  const stage = getStage(lead.stageId);
  if (!stage || stage.terminal) return 'none';
  if (!lead.lastInteractionAt) return 'rotten';

  const daysIdle = differenceInDays(NOW, parseISO(lead.lastInteractionAt));
  if (daysIdle === 0) return 'fresh';
  if (daysIdle > stage.rotDays) return 'rotten';
  if (daysIdle >= stage.rotDays - 2) return 'warning';
  return 'fresh';
}

export const ROT_META: Record<RotState, { label: string; color: string }> = {
  fresh: { label: 'Atualizado hoje', color: 'bg-success' },
  warning: { label: 'Próximo do prazo', color: 'bg-warning' },
  rotten: { label: 'Atrasado', color: 'bg-destructive' },
  none: { label: 'Sem prazo', color: 'bg-muted-foreground' },
};
