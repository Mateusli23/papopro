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
  /** Plano efetivo derivado da subscription (ou 'free' quando null). */
  plan: SubscriptionPlan | 'free';
  /** Subscription ativa — `null` no plano free. */
  subscription: SubscriptionUI | null;
  /** Tem customer Stripe registrado? Determina se podemos abrir Portal. */
  hasStripeCustomer: boolean;
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
