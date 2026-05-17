'use server';

/**
 * Server Actions de Billing (M12#1).
 *
 * 2 mutations: criar Checkout Session (botão "Assinar Pro") e criar Portal
 * Session (botão "Gerenciar assinatura", onde o usuário cancela). Ambas
 * só pra Owner — billing tem implicação financeira.
 *
 * **Pattern idiomático M8/M9/M10:**
 *   Zod safeParse → requireRole(['Owner']) → withWorkspace(tx) → audit log
 *   MESMA tx → revalidatePath. Chamadas Stripe FORA da tx (rede lenta).
 *
 * **Decisão arquitetural:** todo o resto usa Server Action; só o webhook
 * Stripe (`/api/webhooks/stripe`) é Route Handler. Motivação:
 *  - Webhook precisa do raw body pra verificar assinatura HMAC (Server
 *    Action recebe FormData/objeto parseado — perdemos os bytes literais).
 *  - Webhook recebe POST cross-origin do Stripe — não tem sessão Supabase,
 *    rola fora do middleware de auth.
 */

import { revalidatePath } from 'next/cache';

import type Stripe from 'stripe';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { getStripe } from '@/lib/stripe/client';
import { planToPriceId } from '@/lib/stripe/plans';
import { withWorkspace } from '@/lib/supabase/with-workspace';

import {
  checkoutSessionInputSchema,
  portalSessionInputSchema,
  type CheckoutSessionInput,
  type PortalSessionInput,
} from './schemas';

export type CheckoutActionResult = { ok: true; url: string } | { ok: false; error: string };

export type PortalActionResult = { ok: true; url: string } | { ok: false; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recupera ou cria um Stripe Customer pro workspace.
 *
 * Idempotente: se já existe row em `stripe_customers` pro workspace, retorna
 * o ID existente. Senão, cria customer no Stripe + persiste localmente na
 * MESMA tx (evita customer-órfão no Stripe se a tx der rollback).
 *
 * **Por que email do user (não do workspace).** Workspace não tem email
 * canônico. Stripe usa o email pra send de fatura, portal magic link, etc.
 * Email do Owner é o que faz sentido — em multi-Owner futuro, refatoramos.
 */
async function getOrCreateStripeCustomer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  args: { workspaceId: string; workspaceName: string; userEmail: string },
): Promise<string> {
  const existing = await tx.stripeCustomer.findUnique({
    where: { workspaceId: args.workspaceId },
    select: { stripeCustomerId: true },
  });
  if (existing) return existing.stripeCustomerId;

  // Cria no Stripe FORA da tx — chamada de rede.
  const customer = await getStripe().customers.create({
    email: args.userEmail,
    name: args.workspaceName,
    metadata: { workspace_id: args.workspaceId },
  });

  await tx.stripeCustomer.create({
    data: {
      workspaceId: args.workspaceId,
      stripeCustomerId: customer.id,
      email: args.userEmail,
    },
  });

  return customer.id;
}

function getAppUrl(): string {
  // NEXT_PUBLIC_APP_URL é canônico (definido em .env.local.example). Fallback
  // pra localhost só em dev — em produção a env deve estar setada.
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

// ============================================================================
// createCheckoutSessionAction — botão "Assinar Pro"
// ============================================================================

export async function createCheckoutSessionAction(
  input: CheckoutSessionInput,
): Promise<CheckoutActionResult> {
  const parsed = checkoutSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { plan } = parsed.data;

  const auth = await requireRole(['Owner'], {
    forbiddenMessage: 'Apenas o Owner pode contratar planos.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, userEmail, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  // Resolve priceId ANTES da tx — erro de config falha barato e claro.
  let priceId: string;
  try {
    priceId = planToPriceId(plan);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // Workspace pra Stripe customer name (já carregado em requireRole? Não —
  // pegamos rápido aqui).
  let workspaceName: string;
  try {
    workspaceName = await withWorkspace(workspaceId, async (tx) => {
      const ws = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      return ws?.name ?? 'PapoPro Workspace';
    });
  } catch (err) {
    reportNonFatal('billing.checkout.workspaceName', err);
    workspaceName = 'PapoPro Workspace';
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await withWorkspace(workspaceId, async (tx) => {
      const customerId = await getOrCreateStripeCustomer(tx, {
        workspaceId,
        workspaceName,
        userEmail,
      });

      // Audit ANTES de criar a session — assim mesmo se Stripe falhar, fica o
      // registro do clique. Mas Stripe não cria customer duplicado (idempotência
      // via `getOrCreateStripeCustomer`).
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'checkout_initiated',
          entityType: 'subscription',
          entityId: null,
          changes: { plan, priceId },
          ipAddress,
          userAgent,
        },
      });

      const appUrl = getAppUrl();

      // Chamada Stripe FORA do escopo do .auditLog.create acima — `getStripe`
      // não é transacional (rede). Dentro do withWorkspace tx só pra ter o
      // mesmo escopo do customer get-or-create.
      return getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/settings/billing?checkout=success`,
        cancel_url: `${appUrl}/settings/billing?checkout=cancel`,
        // Metadata em DUAS camadas pra robustez do webhook:
        //  - session.metadata: chega em `checkout.session.completed`
        //  - subscription_data.metadata: chega em `customer.subscription.*`
        // Stripe NÃO propaga session.metadata pra subscription automaticamente.
        metadata: { workspace_id: workspaceId, user_id: userId },
        subscription_data: {
          metadata: { workspace_id: workspaceId, user_id: userId },
        },
        // Pré-popula email no checkout (UX) — não trava edit.
        client_reference_id: workspaceId,
      });
    });
  } catch (err) {
    reportNonFatal('billing.checkout.create', err);
    return {
      ok: false,
      error: `Não foi possível iniciar o checkout: ${(err as Error).message}`,
    };
  }

  if (!session.url) {
    return { ok: false, error: 'Stripe retornou session sem URL — tente novamente.' };
  }

  // revalidate path NÃO é estritamente necessário (caller vai redirecionar pro
  // Stripe), mas garante que se o user voltar pra /settings/billing antes do
  // webhook chegar, ele veja o estado fresh.
  revalidatePath('/settings/billing');

  return { ok: true, url: session.url };
}

// ============================================================================
// createPortalSessionAction — botão "Gerenciar assinatura"
// ============================================================================

export async function createPortalSessionAction(
  input: PortalSessionInput = {},
): Promise<PortalActionResult> {
  const parsed = portalSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner'], {
    forbiddenMessage: 'Apenas o Owner pode gerenciar a assinatura.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId } = auth.ctx;

  let customerId: string | null = null;
  try {
    customerId = await withWorkspace(workspaceId, async (tx) => {
      const customer = await tx.stripeCustomer.findUnique({
        where: { workspaceId },
        select: { stripeCustomerId: true },
      });
      return customer?.stripeCustomerId ?? null;
    });
  } catch (err) {
    reportNonFatal('billing.portal.lookup', err);
    return { ok: false, error: 'Não foi possível carregar dados de billing.' };
  }

  if (!customerId) {
    return {
      ok: false,
      error: 'Workspace ainda não tem assinatura — faça o primeiro upgrade pra acessar o portal.',
    };
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/settings/billing`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    reportNonFatal('billing.portal.create', err);
    return {
      ok: false,
      error: `Não foi possível abrir o portal de pagamento: ${(err as Error).message}`,
    };
  }
}
