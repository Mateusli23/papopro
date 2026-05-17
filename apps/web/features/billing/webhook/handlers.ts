import 'server-only';

/**
 * Handlers do webhook Stripe (M12#1).
 *
 * Cada função processa 1 tipo de evento DENTRO de uma `withWorkspace` tx
 * já aberta pelo route handler. Não fazem auth/sig verify (route handler
 * cuida) — só lógica de domínio.
 *
 * **Audit log:** cada handler grava 1 row em `audit_logs` com
 * `user_id=NULL` (eventos system-generated). `user_id` original do checkout
 * fica salvo na metadata da Stripe Subscription, recuperável via
 * `extra.metadata.user_id` se precisar.
 *
 * **Idempotência:** route handler já tratou — se o evento chega aqui é
 * porque nunca foi processado. Mesmo assim, ações são idempotentes por
 * design (upsert por `stripe_subscription_id`), então re-processar não
 * duplica subscriptions.
 */
import type Stripe from 'stripe';

import { type Prisma } from '@papopro/db';

import { priceIdToPlan } from '@/lib/stripe/plans';

import { getCurrentPeriod, getFirstPriceId, mapStripeStatus } from './extract';

interface HandlerArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any;
  workspaceId: string;
  event: Stripe.Event;
}

export type HandlerResult =
  | { ok: true; action: string }
  | { ok: false; reason: string; skipped: boolean };

// ============================================================================
// checkout.session.completed
// ============================================================================
// Stripe garante que esse evento dispara apenas em checkouts confirmados.
// Subscription real é criada num segundo evento (customer.subscription.created
// ou .updated) — aqui só auditamos a confirmação do checkout.
// ============================================================================

export async function handleCheckoutSessionCompleted({
  tx,
  workspaceId,
  event,
}: HandlerArgs): Promise<HandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId: null,
      action: 'subscription_activated',
      entityType: 'checkout_session',
      entityId: session.id,
      changes: {
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : null,
        amountTotal: session.amount_total,
        currency: session.currency,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, action: 'checkout_audited' };
}

// ============================================================================
// customer.subscription.created | customer.subscription.updated
// ============================================================================
// Upsert idempotente por `stripe_subscription_id`. Sincroniza plan/status/
// período. Reutilizado pelos dois eventos — diferença é só semântica (audit
// vê activated vs updated implicitamente pelo `status`).
// ============================================================================

export async function handleSubscriptionUpserted({
  tx,
  workspaceId,
  event,
}: HandlerArgs): Promise<HandlerResult> {
  const sub = event.data.object as Stripe.Subscription;

  const priceId = getFirstPriceId(sub);
  if (!priceId) {
    return { ok: false, reason: 'subscription_without_price', skipped: true };
  }

  const plan = priceIdToPlan(priceId);
  if (!plan) {
    // Price ID que não bate com nenhuma env var conhecida — provavelmente
    // workspace de teste com price diferente. Audita e ignora.
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: null,
        action: 'subscription_activated',
        entityType: 'subscription',
        entityId: sub.id,
        changes: {
          unmappedPriceId: priceId,
          warning: 'price_id_not_recognized',
        } as Prisma.InputJsonValue,
      },
    });
    return { ok: false, reason: 'unmapped_price_id', skipped: true };
  }

  const status = mapStripeStatus(sub.status);
  const { start, end } = getCurrentPeriod(sub);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  await tx.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      workspaceId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      priceId,
      plan,
      status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
    update: {
      priceId,
      plan,
      status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId: null,
      action: 'subscription_activated',
      entityType: 'subscription',
      entityId: sub.id,
      changes: {
        plan,
        status,
        priceId,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        eventType: event.type,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, action: `subscription_upserted_${status}` };
}

// ============================================================================
// customer.subscription.deleted
// ============================================================================
// Stripe dispara quando a subscription é deletada (cancelada definitivamente
// OU expirou no fim do período após cancel_at_period_end). Marca a row como
// canceled — query `getBillingState` filtra por status ∈ {active, past_due},
// então o workspace volta a aparecer como free na UI.
// ============================================================================

export async function handleSubscriptionDeleted({
  tx,
  workspaceId,
  event,
}: HandlerArgs): Promise<HandlerResult> {
  const sub = event.data.object as Stripe.Subscription;

  // Update + audit. Se a row não existe (caso raro — deleted antes de created
  // chegar), upsert garante consistência.
  const priceId = getFirstPriceId(sub) ?? 'unknown';
  const plan = priceIdToPlan(priceId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { start, end } = getCurrentPeriod(sub);

  // Upsert defensivo — se .deleted chegou sem .created anterior (impossível
  // em fluxo normal, mas robustez), cria a row já como canceled.
  await tx.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      workspaceId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      priceId,
      // plan precisa ser válido pro enum. Se desconhecido, default pro `pro`
      // (M12#2+ refina) — auditoria registra o priceId real.
      plan: plan ?? 'pro',
      status: 'canceled',
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
    },
    update: {
      status: 'canceled',
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId: null,
      action: 'subscription_canceled',
      entityType: 'subscription',
      entityId: sub.id,
      changes: {
        priceId,
        canceledAt: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : new Date().toISOString(),
        reason: sub.cancellation_details?.reason ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, action: 'subscription_canceled' };
}

// ============================================================================
// invoice.payment_succeeded
// ============================================================================
// Audit only. Não muda subscription state (`customer.subscription.updated`
// já tratou se houve mudança). Sentinel pro dashboard de finanças (M12#6).
// ============================================================================

export async function handleInvoicePaymentSucceeded({
  tx,
  workspaceId,
  event,
}: HandlerArgs): Promise<HandlerResult> {
  const invoice = event.data.object as Stripe.Invoice;

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId: null,
      action: 'payment_succeeded',
      entityType: 'invoice',
      entityId: invoice.id ?? null,
      changes: {
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, action: 'payment_audited' };
}

// ============================================================================
// invoice.payment_failed
// ============================================================================
// Audit only no MVP. M12#5 vai adicionar push + email "atualize cartão" + UI
// banner. Dunning (retry policy) é configurado direto no Stripe Dashboard.
// ============================================================================

export async function handleInvoicePaymentFailed({
  tx,
  workspaceId,
  event,
}: HandlerArgs): Promise<HandlerResult> {
  const invoice = event.data.object as Stripe.Invoice;

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId: null,
      action: 'payment_failed',
      entityType: 'invoice',
      entityId: invoice.id ?? null,
      changes: {
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, action: 'payment_failure_audited' };
}
