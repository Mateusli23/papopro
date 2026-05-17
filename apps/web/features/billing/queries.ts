/**
 * Queries server-only de Billing (M12#1).
 *
 * `getBillingState` é a única função pública daqui — abastece a página
 * `/settings/billing` (Server Component) com tudo que ela precisa pra
 * decidir entre "Plano Free + botão Assinar Pro" e "Plano Pro ativo +
 * botão Gerenciar assinatura".
 *
 * **Source of truth do plano:** ausência de Subscription com status active/
 * past_due → plano free. Não há row placeholder pra free.
 */
import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import type { BillingStateUI, SubscriptionUI } from './types';

/**
 * Estado completo de billing do workspace pra render do `/settings/billing`.
 *
 * Faz 2 queries em paralelo na mesma tx:
 *  1. Subscription ativa (status active OR past_due, ordenada DESC pra pegar
 *     a mais recente — defesa contra race conditions improváveis com 2 rows ativas)
 *  2. StripeCustomer (pra saber se podemos abrir Portal)
 */
export async function getBillingState(workspaceId: string): Promise<BillingStateUI> {
  return withWorkspace(workspaceId, async (tx) => {
    const [subscription, customer] = await Promise.all([
      tx.subscription.findFirst({
        where: { workspaceId, status: { in: ['active', 'past_due'] } },
        orderBy: { createdAt: 'desc' },
      }),
      tx.stripeCustomer.findUnique({
        where: { workspaceId },
        select: { workspaceId: true },
      }),
    ]);

    const hasStripeCustomer = customer !== null;

    if (!subscription) {
      return {
        plan: 'free',
        subscription: null,
        hasStripeCustomer,
      };
    }

    const subUI: SubscriptionUI = {
      id: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
    };

    return {
      plan: subscription.plan,
      subscription: subUI,
      hasStripeCustomer,
    };
  });
}
