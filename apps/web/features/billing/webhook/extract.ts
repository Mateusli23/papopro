/**
 * Helpers puros pra extrair informação dos eventos Stripe (M12#1).
 *
 * Sem `'server-only'` — smoke endpoint importa pra validar contratos.
 * Sem dependência de Stripe SDK runtime: types vêm do `stripe` mas a
 * lógica é só leitura de campos.
 */
import type Stripe from 'stripe';

import type { SubscriptionStatus } from '@papopro/db';

/**
 * Stripe NÃO propaga `session.metadata` pra `subscription.metadata`
 * automaticamente — precisamos setar nos dois (vide `createCheckoutSessionAction`
 * com `metadata` + `subscription_data.metadata`).
 *
 * Helper só conferindo se a metadata está presente e válida.
 */
export function getWorkspaceIdFromMetadata(metadata: Stripe.Metadata | null): string | null {
  if (!metadata) return null;
  const id = metadata.workspace_id;
  if (typeof id !== 'string' || id.length === 0) return null;
  return id;
}

/**
 * Mapeia `Stripe.Subscription.Status` (10 valores) → nosso enum local (5).
 *
 * Decisões:
 *  - `trialing` → 'active' (MVP não tem trial — vira ativa). M12#3 separa.
 *  - `paused` → 'active' (Stripe `paused` é collection pause, não cancel).
 *  - `incomplete_expired` → 'canceled' (checkout não confirmado, vira free).
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'paused':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
      return 'incomplete';
    default: {
      // Exhaustive — TS quebra build se Stripe adicionar status novo sem cobrir aqui.
      // Em runtime trata como 'incomplete' pra ser seguro (não ativa plano por engano).
      const _exhaustive: never = status;
      void _exhaustive;
      return 'incomplete';
    }
  }
}

/**
 * Extrai o `priceId` do primeiro item da subscription. Multi-product subs
 * não são suportadas no MVP — pegamos o primeiro item. Retorna `null` se a
 * subscription não tem items (caso teórico — Stripe sempre tem ≥1).
 */
export function getFirstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  return item.price?.id ?? null;
}

/**
 * Lê `current_period_start/end` da subscription. Stripe retorna `unix`
 * timestamps em segundos — convertemos pra Date.
 *
 * Stripe `paused`/`canceled` subscriptions podem ter period_end no passado;
 * mantemos como está — o webhook tipo `customer.subscription.deleted` define
 * `canceled_at` explicitamente.
 *
 * **API 2025-09 (clover):** `current_period_start/end` migrou de root pra
 * `items.data[0]` (Stripe distribui por item desde a mudança pra
 * subscription-level price → item-level price). Pegamos do primeiro item.
 */
export function getCurrentPeriod(sub: Stripe.Subscription): { start: Date; end: Date } {
  const item = sub.items?.data?.[0];
  const startUnix = item?.current_period_start;
  const endUnix = item?.current_period_end;
  if (typeof startUnix !== 'number' || typeof endUnix !== 'number') {
    // Defesa contra mudança futura de API — usa NOW pro start, +30d pro end.
    // Webhook handler audita o evento, então não perdemos contexto.
    const now = new Date();
    const fallbackEnd = new Date(now);
    fallbackEnd.setDate(fallbackEnd.getDate() + 30);
    return { start: now, end: fallbackEnd };
  }
  return {
    start: new Date(startUnix * 1000),
    end: new Date(endUnix * 1000),
  };
}
