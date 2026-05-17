/**
 * Schemas Zod do domínio Billing (M12#1).
 *
 * Puros — sem `'server-only'`. Smoke endpoint importa pra validar contratos.
 * Server Actions usam pra validar input antes de chamar Stripe.
 */
import { z } from 'zod';

import { SubscriptionPlan } from '@papopro/db';

/**
 * Input pro `createCheckoutSessionAction`. Hoje só `pro` é aceito — schema
 * usa o enum do Prisma como source-of-truth (M12#2+ adiciona `pro_ia` e
 * `enterprise` no enum SQL/Prisma + aqui automaticamente).
 */
export const checkoutSessionInputSchema = z
  .object({
    plan: z.nativeEnum(SubscriptionPlan, { message: 'Plano inválido.' }),
  })
  .strict();

export type CheckoutSessionInput = z.infer<typeof checkoutSessionInputSchema>;

/**
 * Input pro `createPortalSessionAction`. Não recebe parâmetro — sempre opera
 * sobre o workspace ativo (cookie). Schema vazio é placeholder pra
 * extensibilidade futura (`{ returnTo?: string }` etc).
 */
export const portalSessionInputSchema = z.object({}).strict();

export type PortalSessionInput = z.infer<typeof portalSessionInputSchema>;
