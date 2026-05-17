/**
 * Verificação de assinatura de webhook Stripe (M12#1).
 *
 * **Server-only.** Wrapper de `stripe.webhooks.constructEvent` que padroniza
 * o retorno `{ ok: true, event } | { ok: false, error }` — caller não precisa
 * try/catch + parser de tipo de erro.
 *
 * **CRÍTICO (CLAUDE.md §7.4):** webhook Stripe SEM signature válida → 401
 * imediato. Falha aberta = atacante envia eventos forjados (fake
 * "subscription.created") e ativa plano sem pagar.
 *
 * **Body cru obrigatório.** `stripe.webhooks.constructEvent` calcula HMAC do
 * raw bytes — JSON.parse + re-serialize quebra a verificação. Webhook route
 * usa `await req.text()` antes de qualquer parse.
 */
import 'server-only';

import type Stripe from 'stripe';

import { getStripe } from './client';

export type VerifyResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; code: 'no_secret' | 'no_signature' | 'invalid_signature'; message: string };

/**
 * Verifica `Stripe-Signature` contra o raw body usando `STRIPE_WEBHOOK_SECRET`.
 *
 * **Dev sem secret** retorna erro explícito — diferente do uazapi webhook
 * (M9#3) que tem fallback "skipped" pra desenvolvimento. Stripe é mais
 * sensível: nunca processa um evento sem verificar.
 */
export function verifyStripeSignature(rawBody: string, signature: string | null): VerifyResult {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return {
      ok: false,
      code: 'no_secret',
      message: 'STRIPE_WEBHOOK_SECRET ausente — configure em .env.local.',
    };
  }

  if (!signature) {
    return {
      ok: false,
      code: 'no_signature',
      message: 'Header Stripe-Signature ausente na requisição.',
    };
  }

  try {
    const event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (err) {
    return {
      ok: false,
      code: 'invalid_signature',
      message: `Assinatura inválida: ${(err as Error).message}`,
    };
  }
}
