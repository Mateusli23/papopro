import Link from 'next/link';

import { Button } from '@papopro/ui';
import { AlertTriangle, Sparkles } from '@papopro/ui/icons';

import type { LimitStateUI } from '@/lib/limits';

interface Props {
  /** Estado do limite `activeAgents` — vem de `getWorkspaceUsage`. */
  state: LimitStateUI;
  /** Owner vê o CTA "Assinar Pro" (só no Free). Outros papéis veem o aviso. */
  isOwner: boolean;
}

/**
 * Banner inline do limite de agentes ativos por plano (M11#7).
 *
 * **Renderiza só em `atLimit`** — diferente do `<PlanLimitBanner>` de
 * leads/membros (que tem faixa amarela de 90%). O cap de agentes é pequeno
 * (Free 1 / Pro 3); 90% de 1 seria sempre verdade — a faixa intermediária
 * vira ruído. Mostramos apenas quando o teto foi de fato atingido.
 *
 * **Copy plan-aware**: leads/membros têm o Pro como saída (uso ilimitado);
 * agentes têm teto nos dois planos. No Free o caminho é assinar o Pro (3
 * slots); no Pro, pausar um agente.
 *
 * **Server-safe** (sem `'use client'`, sem hooks).
 */
export function AgentLimitBanner({ state, isOwner }: Props) {
  if (!state.atLimit) return null;

  const isFree = state.plan === 'free';

  return (
    <div
      className="border-destructive/30 bg-destructive/5 text-destructive flex flex-wrap items-start gap-3 rounded-md border px-4 py-3"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="text-body flex-1">
        {isFree ? (
          <>
            <strong>Limite de agentes do plano Free atingido</strong> — {state.current}/
            {state.limit} agente ativo. Pause o agente atual ou assine o Pro pra rodar até 3 ao
            mesmo tempo.
          </>
        ) : (
          <>
            <strong>Limite de agentes ativos atingido</strong> — {state.current}/{state.limit}{' '}
            ativos. Pause um agente antes de ativar outro.
          </>
        )}
      </div>
      {isFree && isOwner && (
        <Button asChild size="sm" variant="destructive" className="gap-1">
          <Link href="/settings/billing">
            <Sparkles className="size-3.5" />
            Assinar Pro
          </Link>
        </Button>
      )}
    </div>
  );
}
