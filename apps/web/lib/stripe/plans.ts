/**
 * Mapping `Stripe.Price.id → SubscriptionPlan` (M12#1).
 *
 * **Puro** — sem `'server-only'`, sem chamadas Stripe. Smoke endpoint
 * importa pra validar contratos.
 *
 * Mapping é baseado em **env vars** porque os price IDs mudam entre
 * test/prod e não podem ser hardcoded:
 *
 *   STRIPE_PRICE_PRO_MONTHLY=price_xxx → 'pro'
 *
 * M12#2+ adiciona PRO_IA_MONTHLY → 'pro_ia' etc.
 */
import type { SubscriptionPlan } from '@papopro/db';

/**
 * Resolve `Stripe.Price.id → SubscriptionPlan` consultando as env vars conhecidas.
 *
 * Retorna `null` se o price não é reconhecido (configuração quebrada ou price
 * criado fora do nosso scope). Webhook handler trata `null` como "ignorar
 * subscription" pra evitar gravar plano inválido.
 */
export function priceIdToPlan(priceId: string): SubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return 'pro';
  }
  // M12#2+ adiciona aqui:
  // if (priceId === process.env.STRIPE_PRICE_PRO_IA_MONTHLY) return 'pro_ia';
  return null;
}

/**
 * Resolve `SubscriptionPlan → Stripe.Price.id`. Usado pelo
 * `createCheckoutSessionAction` pra montar `line_items`.
 *
 * Lança em plano sem env var configurada — checkout nunca pode prosseguir
 * com price inválido (Stripe rejeita silenciosamente ou cria session com
 * line_item órfão).
 */
export function planToPriceId(plan: SubscriptionPlan): string {
  if (plan === 'pro') {
    const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!id) {
      throw new Error(
        'STRIPE_PRICE_PRO_MONTHLY ausente — configure em .env.local com o price ID do Stripe Dashboard.',
      );
    }
    return id;
  }
  // exhaustive — TS sinaliza se SubscriptionPlan ganhar novo valor sem mapping
  throw new Error(`Plano sem price configurado: ${plan as string}`);
}

/**
 * Label human-readable do plano (pt-BR). Usado em audit logs + UI.
 */
export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  pro: 'Pro',
};
