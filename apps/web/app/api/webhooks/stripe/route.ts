/**
 * `POST /api/webhooks/stripe` — webhook do Stripe (M12#1).
 *
 * **Única exceção arquitetural:** todo o resto do billing usa Server Action
 * (`createCheckoutSessionAction`, `createPortalSessionAction`). Esta rota
 * existe porque:
 *  1. Stripe POSTa eventos cross-origin — não há sessão Supabase + cookie
 *     pra middleware/Server Action validarem.
 *  2. Assinatura HMAC precisa do **raw body** literal — Server Action recebe
 *     o objeto JSON já parseado, perdemos os bytes.
 *
 * **Sequência (segue padrão M9#3 uazapi inbound):**
 *  1. Read raw body (sem JSON.parse — HMAC precisa dos bytes literais)
 *  2. Verify `Stripe-Signature` via `stripe.webhooks.constructEvent` → 401 se inválida
 *  3. Resolve workspace_id (metadata da subscription/session OU lookup via stripe_customers)
 *  4. Idempotência via `WebhookEvent (source='stripe', externalId=event.id)`
 *  5. `withWorkspace(tx)` → dispatch pro handler do tipo → marca processedAt
 *  6. Sempre 200 (Stripe re-entrega em 4xx/5xx — não queremos isso se já processamos)
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** lookup cross-tenant `findFirst` com
 * select estreito; toda mutação subsequente passa por `withWorkspace` (RLS).
 *
 * **GET:** 405 explícito (Stripe só envia POST).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { prisma, type Prisma } from '@papopro/db';

import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpserted,
} from '@/features/billing/webhook/handlers';
import { reportNonFatal } from '@/lib/observability/report';
import { verifyStripeSignature } from '@/lib/stripe/verify-signature';
import { withWorkspace } from '@/lib/supabase/with-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

interface ErrorBody {
  ok: false;
  code: string;
  message: string;
}

interface SuccessBody {
  ok: true;
  idempotent?: boolean;
  skipped?: boolean;
  action?: string;
}

function ok(body: SuccessBody, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function err(code: string, message: string, status: number): NextResponse {
  const body: ErrorBody = { ok: false, code, message };
  return NextResponse.json(body, { status });
}

export async function GET(): Promise<NextResponse> {
  return err('method_not_allowed', 'Webhook Stripe aceita apenas POST.', 405);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Raw body (antes de JSON.parse — HMAC precisa dos bytes literais).
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return err('invalid_body', 'Não foi possível ler o corpo da requisição.', 400);
  }

  // 2. Verify signature. CRÍTICO (CLAUDE.md §7.4) — falha fechada.
  const signature = request.headers.get('stripe-signature');
  const verify = verifyStripeSignature(rawBody, signature);
  if (!verify.ok) {
    if (verify.code === 'no_secret') {
      // 500 = config do servidor (não do cliente Stripe). Stripe re-entrega
      // até o operator configurar.
      return err('config_error', verify.message, 500);
    }
    // no_signature / invalid_signature → 401.
    return err('signature_invalid', verify.message, 401);
  }
  const event = verify.event;

  // 3. Resolve workspace_id.
  let workspaceId: string | null = null;
  try {
    workspaceId = await resolveWorkspaceId(event);
  } catch (e) {
    reportNonFatal('stripe.webhook.resolveWorkspace', e);
    return err('lookup_error', 'Falha ao resolver workspace.', 500);
  }
  if (!workspaceId) {
    // Evento de billing de customer sem mapping local. Acontece se:
    //  - admin criou subscription manualmente no Stripe Dashboard sem metadata
    //  - workspace foi deletado mas customer Stripe sobreviveu
    // 200 evita re-entrega infinita; logamos pra investigação.
    reportNonFatal('stripe.webhook.unknownWorkspace', null, {
      eventId: event.id,
      eventType: event.type,
    });
    return ok({ ok: true, skipped: true, action: 'unknown_workspace' });
  }

  // 4 + 5 dentro da tx.
  try {
    const result = await withWorkspace(workspaceId, async (tx) => {
      // Idempotência (mesmo padrão M9#3 uazapi).
      const existing = await tx.webhookEvent.findUnique({
        where: { source_externalId: { source: 'stripe', externalId: event.id } },
        select: { id: true, processedAt: true },
      });

      let webhookEventId: string;
      if (existing) {
        if (existing.processedAt) {
          return { idempotent: true, action: 'already_processed' as const };
        }
        webhookEventId = existing.id;
      } else {
        const created = await tx.webhookEvent.create({
          data: {
            workspaceId: workspaceId!,
            source: 'stripe',
            externalId: event.id,
            payload: event as unknown as Prisma.InputJsonValue,
            signatureValid: true,
          },
          select: { id: true },
        });
        webhookEventId = created.id;
      }

      // Dispatch por tipo de evento.
      const handlerArgs = { tx, workspaceId: workspaceId!, event };
      let handlerResult;
      switch (event.type) {
        case 'checkout.session.completed':
          handlerResult = await handleCheckoutSessionCompleted(handlerArgs);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          handlerResult = await handleSubscriptionUpserted(handlerArgs);
          break;
        case 'customer.subscription.deleted':
          handlerResult = await handleSubscriptionDeleted(handlerArgs);
          break;
        case 'invoice.payment_succeeded':
          handlerResult = await handleInvoicePaymentSucceeded(handlerArgs);
          break;
        case 'invoice.payment_failed':
          handlerResult = await handleInvoicePaymentFailed(handlerArgs);
          break;
        default:
          // Evento que NÃO precisamos tratar (price.updated, customer.updated, etc).
          // Marca como processado pra Stripe não re-entregar.
          handlerResult = {
            ok: true as const,
            action: `ignored_${event.type}`,
          };
      }

      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
      });

      return {
        idempotent: false,
        action: 'action' in handlerResult ? handlerResult.action : 'unknown',
      };
    });

    return ok({
      ok: true,
      idempotent: result.idempotent,
      action: result.action,
    });
  } catch (e) {
    reportNonFatal('stripe.webhook.dispatch', e, {
      eventId: event.id,
      eventType: event.type,
      workspaceId,
    });
    // 500 → Stripe re-entrega até 3 dias. Idempotência garante que reprocessar
    // não duplica.
    return err('processing_error', `Falha ao processar evento: ${(e as Error).message}`, 500);
  }
}

/**
 * Resolve `workspace_id` a partir do evento. Estratégia em camadas:
 *  1. `session.metadata.workspace_id` (checkout.session.completed)
 *  2. `subscription.metadata.workspace_id` (customer.subscription.*)
 *  3. Lookup por `stripe_customer_id` em `stripe_customers` (fallback —
 *     invoice events, edge cases)
 *
 * Retorna `null` se nenhuma camada resolveu — caller marca skipped.
 *
 * **Cross-tenant select:** roda FORA de `withWorkspace` (não sabemos o
 * workspace ainda). `select` estreito previne expansão acidental.
 */
async function resolveWorkspaceId(event: import('stripe').default.Event): Promise<string | null> {
  // Camada 1+2: metadata direta no objeto do evento.
  const obj = event.data.object as {
    metadata?: Record<string, string> | null;
    customer?: string | { id: string };
    subscription?: string | { id: string } | null;
  };
  const directMeta = obj.metadata;
  if (directMeta && typeof directMeta.workspace_id === 'string' && directMeta.workspace_id) {
    return directMeta.workspace_id;
  }

  // Camada 3: lookup via stripe_customer_id.
  const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
  if (!customerId) return null;

  const customer = await prisma.stripeCustomer.findFirst({
    where: { stripeCustomerId: customerId },
    select: { workspaceId: true },
  });
  return customer?.workspaceId ?? null;
}
