/**
 * Shapes UI do domínio Billing (M12#1).
 *
 * Sem `'server-only'` — UI Server/Client Components importam.
 */
import type { SubscriptionPlan, SubscriptionStatus } from '@papopro/db';

/**
 * Estado de billing do workspace consumido pela UI de `/settings/billing`.
 *
 * `null` quando o workspace está no plano free (não há subscription
 * ativa). `subscription` populado quando há row ativa em `subscriptions`
 * (status `active` ou `past_due`).
 */
export interface BillingStateUI {
  /** Plano BILLADO derivado da subscription (ou 'free' quando null). NÃO
   *  reflete o trial — durante o trial isto é 'free' e `trial` carrega o
   *  estado. Para limites, o plano efetivo é `getActivePlan` (trial → pro). */
  plan: SubscriptionPlan | 'free';
  /** Subscription ativa — `null` no plano free. */
  subscription: SubscriptionUI | null;
  /** Tem customer Stripe registrado? Determina se podemos abrir Portal. */
  hasStripeCustomer: boolean;
  /** Estado do trial 7d sem cartão (M12#2). `null` = workspace nunca teve trial. */
  trial: TrialStateUI | null;
}

/**
 * Trial 7d sem cartão exposto pra UI (M12#2). `endsAt` em ISO pra atravessar
 * o boundary RSC → Client. Não-`null` quando o workspace tem trial (ativo ou
 * já expirado).
 */
export interface TrialStateUI {
  /** `active` = em andamento; `expired` = acabou (workspace caiu pra Free). */
  status: 'active' | 'expired';
  /** ISO. Fim do trial. */
  endsAt: string;
  /** Dias inteiros restantes — `≥1` enquanto ativo, `0` quando expirado. */
  daysLeft: number;
}

export interface SubscriptionUI {
  id: string;
  stripeSubscriptionId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** ISO. Próxima cobrança (ou data final se cancel_at_period_end). */
  currentPeriodEnd: string;
  /** Cancelamento agendado pro fim do período atual? */
  cancelAtPeriodEnd: boolean;
  /** ISO. Quando foi cancelada (null se ainda ativa). */
  canceledAt: string | null;
}
