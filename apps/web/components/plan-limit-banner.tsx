import Link from 'next/link';

import { Button } from '@papopro/ui';
import { AlertTriangle, Sparkles } from '@papopro/ui/icons';

import type { LimitStateUI } from '@/lib/limits';

interface Props {
  /** Tipo de recurso pra montar a cópia ("leads ativos" / "membros do time"). */
  kind: 'leads' | 'members';
  state: LimitStateUI;
  /** Owner vê o CTA "Assinar Pro". Outros papéis veem só o aviso. */
  isOwner: boolean;
}

/**
 * Banner inline mostrando proximidade/atingimento de limite por plano (M12#4).
 *
 * **Não renderiza nada quando**:
 *  - plano Pro (ilimitado)
 *  - uso < 90% do limite
 *
 * **Variantes**:
 *  - 90-99%: amarelo, "X de Y usados — N restantes"
 *  - 100%: vermelho, "Limite atingido. Crie X precisa do Pro" + CTA Owner
 *
 * **Componente Server-safe** (sem `'use client'`, sem hooks). Renderiza
 * `<Link>` Next pra `/settings/billing` — Owner clica e cai direto na
 * página de cobrança.
 */
export function PlanLimitBanner({ kind, state, isOwner }: Props) {
  if (state.isUnlimited || !state.nearLimit) return null;

  const resourceLabel = kind === 'leads' ? 'leads ativos' : 'membros do time';
  const remaining = state.limit !== null ? state.limit - state.current : 0;
  const isAt = state.atLimit;

  const tone = isAt
    ? 'bg-destructive/5 border-destructive/30 text-destructive'
    : 'bg-warning/10 border-warning/40 text-warning';

  return (
    <div
      className={`flex flex-wrap items-start gap-3 rounded-md border px-4 py-3 ${tone}`}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="text-body flex-1">
        {isAt ? (
          <>
            <strong>Limite do plano Free atingido</strong> — {state.current}/{state.limit}{' '}
            {resourceLabel}.{' '}
            {kind === 'leads'
              ? 'Você não pode adicionar mais leads'
              : 'Você não pode convidar mais membros'}{' '}
            até liberar uso ilimitado no Pro.
          </>
        ) : (
          <>
            <strong>Você está perto do limite</strong> — {state.current}/{state.limit}{' '}
            {resourceLabel} ({remaining} {remaining === 1 ? 'slot restante' : 'slots restantes'}).
            Considere assinar o Pro pra liberar uso ilimitado.
          </>
        )}
      </div>
      {isOwner && (
        <Button asChild size="sm" variant={isAt ? 'destructive' : 'default'} className="gap-1">
          <Link href="/settings/billing">
            <Sparkles className="size-3.5" />
            {isAt ? 'Assinar Pro' : 'Ver planos'}
          </Link>
        </Button>
      )}
    </div>
  );
}
