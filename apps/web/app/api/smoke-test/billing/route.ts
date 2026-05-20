/**
 * Smoke test de Billing (M12#1).
 *
 * Valida contratos puros: schemas Zod, mapping de price→plan, extração de
 * workspace_id do evento Stripe, mapeamento de status. **Zero hit em Stripe
 * API** — fixtures inline.
 *
 * Lifecycle end-to-end (checkout → webhook → subscription criada → cancel)
 * fica em validação manual via Stripe CLI: `stripe listen --forward-to
 * localhost:3000/api/webhooks/stripe`.
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/billing` → `{summary,
 * results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { AuditAction, SubscriptionPlan, SubscriptionStatus } from '@papopro/db';

import { checkoutSessionInputSchema } from '@/features/billing/schemas';
import {
  getCurrentPeriod,
  getFirstPriceId,
  getWorkspaceIdFromMetadata,
  mapStripeStatus,
} from '@/features/billing/webhook/extract';
import {
  PLAN_LIMITS,
  computeLimitState,
  formatLimit,
  limitReachedMessage,
  toLimitStateUI,
} from '@/lib/limits';
import { priceIdToPlan } from '@/lib/stripe/plans';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── Audit actions extension ─────────────────────────────────────────────
  let t = run('audit-actions-m12', results);
  const M12_AUDIT_ACTIONS = [
    'checkout_initiated',
    'subscription_activated',
    'subscription_canceled',
    'payment_succeeded',
    'payment_failed',
  ] as const;
  t('audit_action contém os 5 valores de billing', () => {
    const present = Object.values(AuditAction);
    const missing = M12_AUDIT_ACTIONS.filter((v) => !present.includes(v as AuditAction));
    return missing.length === 0 || `faltam: ${missing.join(', ')}`;
  });

  // ── SubscriptionPlan / SubscriptionStatus enums ─────────────────────────
  t = run('enums-m12', results);
  t('SubscriptionPlan tem "pro"', () => {
    return Object.values(SubscriptionPlan).includes('pro' as SubscriptionPlan);
  });
  t('SubscriptionStatus tem 5 valores esperados', () => {
    const expected = ['active', 'past_due', 'canceled', 'unpaid', 'incomplete'];
    const present = Object.values(SubscriptionStatus);
    const missing = expected.filter((v) => !present.includes(v as SubscriptionStatus));
    return missing.length === 0 || `faltam: ${missing.join(', ')}`;
  });

  // ── checkoutSessionInputSchema ──────────────────────────────────────────
  t = run('schemas-m12', results);
  t('checkoutSessionInputSchema aceita plan="pro"', () => {
    const r = checkoutSessionInputSchema.safeParse({ plan: 'pro' });
    return r.success || JSON.stringify(r.error.issues);
  });
  t('checkoutSessionInputSchema rejeita plan inválido', () => {
    return !checkoutSessionInputSchema.safeParse({ plan: 'enterprise' }).success;
  });
  t('checkoutSessionInputSchema rejeita props extras (strict)', () => {
    return !checkoutSessionInputSchema.safeParse({ plan: 'pro', extra: 'x' }).success;
  });
  t('checkoutSessionInputSchema rejeita plan ausente', () => {
    return !checkoutSessionInputSchema.safeParse({}).success;
  });

  // ── priceIdToPlan ──────────────────────────────────────────────────────
  // Em smoke local sem env var, retorna null pra qualquer ID. Verificamos só
  // o contrato — se env var estiver setada, ela DEVE bater. Quando env var
  // ausente, qualquer ID retorna null (graceful).
  t = run('plans-m12', results);
  t('priceIdToPlan retorna null pra ID desconhecido', () => {
    return priceIdToPlan('price_definitely_not_set_in_env_xxxxxxxxxx') === null;
  });
  t('priceIdToPlan retorna null pra string vazia', () => {
    return priceIdToPlan('') === null;
  });
  t('priceIdToPlan retorna "pro" se STRIPE_PRICE_PRO_MONTHLY === input', () => {
    const envPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!envPriceId) {
      // Sem env var setada, smoke não testa o caminho happy — só skip + nota.
      return true; // contrato cumprido (retornaria null se chamasse aqui).
    }
    return priceIdToPlan(envPriceId) === 'pro';
  });

  // ── getWorkspaceIdFromMetadata ─────────────────────────────────────────
  t = run('webhook-extract-m12', results);
  t('extrai workspace_id de metadata válida', () => {
    const wsId = '11111111-2222-4333-8444-555555555555';
    const out = getWorkspaceIdFromMetadata({ workspace_id: wsId });
    return out === wsId || `recebi ${out}`;
  });
  t('retorna null pra metadata sem workspace_id', () => {
    return getWorkspaceIdFromMetadata({ other: 'x' }) === null;
  });
  t('retorna null pra metadata null', () => {
    return getWorkspaceIdFromMetadata(null) === null;
  });
  t('retorna null pra workspace_id vazio', () => {
    return getWorkspaceIdFromMetadata({ workspace_id: '' }) === null;
  });

  // ── mapStripeStatus ────────────────────────────────────────────────────
  t = run('webhook-status-map-m12', results);
  t('active → active', () => mapStripeStatus('active') === 'active');
  t('trialing → active (MVP sem trial)', () => mapStripeStatus('trialing') === 'active');
  t('paused → active (Stripe paused é collection pause)', () => {
    return mapStripeStatus('paused') === 'active';
  });
  t('past_due → past_due', () => mapStripeStatus('past_due') === 'past_due');
  t('canceled → canceled', () => mapStripeStatus('canceled') === 'canceled');
  t('incomplete_expired → canceled', () => {
    return mapStripeStatus('incomplete_expired') === 'canceled';
  });
  t('unpaid → unpaid', () => mapStripeStatus('unpaid') === 'unpaid');
  t('incomplete → incomplete', () => mapStripeStatus('incomplete') === 'incomplete');

  // ── getCurrentPeriod ───────────────────────────────────────────────────
  t = run('webhook-period-m12', results);
  t('getCurrentPeriod extrai do primeiro item da subscription', () => {
    const fakeSub = {
      items: {
        data: [
          {
            current_period_start: 1700000000, // 2023-11-14T22:13:20Z
            current_period_end: 1702592000, // 2023-12-14T22:13:20Z
          },
        ],
      },
    } as unknown as import('stripe').default.Subscription;
    const { start, end } = getCurrentPeriod(fakeSub);
    const startOk = start.getTime() === 1700000000 * 1000;
    const endOk = end.getTime() === 1702592000 * 1000;
    return (startOk && endOk) || `start=${start.toISOString()} end=${end.toISOString()}`;
  });
  t('getCurrentPeriod usa fallback quando items.data vazio', () => {
    const fakeSub = { items: { data: [] } } as unknown as import('stripe').default.Subscription;
    const { start, end } = getCurrentPeriod(fakeSub);
    // Fallback: end ~30d depois de start.
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays === 30 || `diff=${diffDays} dias`;
  });

  // ── getFirstPriceId ────────────────────────────────────────────────────
  t = run('webhook-price-extract-m12', results);
  t('getFirstPriceId pega do primeiro item', () => {
    const fakeSub = {
      items: {
        data: [{ price: { id: 'price_xyz' } }, { price: { id: 'price_ignored' } }],
      },
    } as unknown as import('stripe').default.Subscription;
    return getFirstPriceId(fakeSub) === 'price_xyz';
  });
  t('getFirstPriceId retorna null sem items', () => {
    const fakeSub = { items: { data: [] } } as unknown as import('stripe').default.Subscription;
    return getFirstPriceId(fakeSub) === null;
  });
  t('getFirstPriceId retorna null sem price no item', () => {
    const fakeSub = {
      items: { data: [{ price: undefined }] },
    } as unknown as import('stripe').default.Subscription;
    return getFirstPriceId(fakeSub) === null;
  });

  // ── PLAN_LIMITS / computeLimitState / toLimitStateUI (M12#4) ───────────
  t = run('plan-limits-m12-4', results);
  t('PLAN_LIMITS.free.leads === 50', () => PLAN_LIMITS.free.leads === 50);
  t('PLAN_LIMITS.free.members === 2', () => PLAN_LIMITS.free.members === 2);
  t('PLAN_LIMITS.pro.leads é Infinity', () => {
    return PLAN_LIMITS.pro.leads === Number.POSITIVE_INFINITY;
  });
  t('PLAN_LIMITS.pro.members é Infinity', () => {
    return PLAN_LIMITS.pro.members === Number.POSITIVE_INFINITY;
  });

  t = run('limit-state-m12-4', results);
  t('computeLimitState marca atLimit quando current === limit', () => {
    const s = computeLimitState('free', 50, 50);
    return s.atLimit === true && s.remaining === 0;
  });
  t('computeLimitState marca atLimit quando current > limit (downgrade case)', () => {
    const s = computeLimitState('free', 60, 50);
    return s.atLimit === true;
  });
  t('computeLimitState marca nearLimit em 90%', () => {
    const s = computeLimitState('free', 45, 50); // 45/50 = 90%
    return s.nearLimit === true && s.atLimit === false;
  });
  t('computeLimitState não marca nearLimit em 80%', () => {
    const s = computeLimitState('free', 40, 50);
    return s.nearLimit === false;
  });
  t('computeLimitState com plano pro nunca está atLimit (Infinity)', () => {
    const s = computeLimitState('pro', 9999, Number.POSITIVE_INFINITY);
    return s.atLimit === false && s.nearLimit === false;
  });
  t('computeLimitState remaining = 0 quando current >= limit', () => {
    const s = computeLimitState('free', 51, 50);
    return s.remaining === 0;
  });

  t = run('limit-ui-m12-4', results);
  t('toLimitStateUI converte Infinity em limit=null + isUnlimited=true', () => {
    const ui = toLimitStateUI(computeLimitState('pro', 100, Number.POSITIVE_INFINITY));
    return ui.limit === null && ui.isUnlimited === true && ui.percent === 0;
  });
  t('toLimitStateUI calcula percent correto em Free', () => {
    const ui = toLimitStateUI(computeLimitState('free', 25, 50));
    return ui.percent === 50 && ui.isUnlimited === false;
  });
  t('toLimitStateUI percent não passa de 100', () => {
    const ui = toLimitStateUI(computeLimitState('free', 75, 50));
    return ui.percent === 100;
  });
  t('formatLimit retorna "ilimitado" pra Infinity', () => {
    return formatLimit(Number.POSITIVE_INFINITY) === 'ilimitado';
  });
  t('formatLimit retorna número como string', () => {
    return formatLimit(50) === '50';
  });
  t('limitReachedMessage menciona "leads ativos" pra kind=leads', () => {
    const msg = limitReachedMessage('leads', computeLimitState('free', 50, 50));
    return msg.includes('leads ativos') && msg.includes('50/50');
  });
  t('limitReachedMessage menciona "membros" pra kind=members', () => {
    const msg = limitReachedMessage('members', computeLimitState('free', 2, 2));
    return msg.includes('membros') && msg.includes('2/2');
  });

  // ── activeAgents limit (M11#7) ──────────────────────────────────────────
  t = run('agent-limits-m11-7', results);
  t('PLAN_LIMITS.free.activeAgents === 1', () => PLAN_LIMITS.free.activeAgents === 1);
  t('PLAN_LIMITS.pro.activeAgents === 3', () => PLAN_LIMITS.pro.activeAgents === 3);
  t('PLAN_LIMITS.pro.activeAgents NÃO é Infinity (cap finito no Pro)', () => {
    return PLAN_LIMITS.pro.activeAgents !== Number.POSITIVE_INFINITY;
  });
  t('computeLimitState free 1/1 → atLimit, remaining 0', () => {
    const s = computeLimitState('free', 1, 1);
    return s.atLimit === true && s.remaining === 0;
  });
  t('computeLimitState free 0/1 → não atLimit, remaining 1', () => {
    const s = computeLimitState('free', 0, 1);
    return s.atLimit === false && s.remaining === 1;
  });
  t('computeLimitState pro 2/3 → não atLimit, remaining 1', () => {
    const s = computeLimitState('pro', 2, 3);
    return s.atLimit === false && s.remaining === 1;
  });
  t('computeLimitState pro 3/3 → atLimit (Pro tem teto de agentes)', () => {
    return computeLimitState('pro', 3, 3).atLimit === true;
  });
  t('limitReachedMessage agents/free menciona Pro + contagem', () => {
    const msg = limitReachedMessage('agents', computeLimitState('free', 1, 1));
    return (msg.includes('Pro') && msg.includes('1/1')) || msg;
  });
  t('limitReachedMessage agents/pro manda pausar (sem upgrade)', () => {
    const msg = limitReachedMessage('agents', computeLimitState('pro', 3, 3));
    return (msg.includes('Pause') && msg.includes('3/3')) || msg;
  });
  t('toLimitStateUI agents pro 3/3 → limit finito, isUnlimited false, percent 100', () => {
    const ui = toLimitStateUI(computeLimitState('pro', 3, 3));
    return ui.limit === 3 && ui.isUnlimited === false && ui.percent === 100;
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const allOk = failed === 0;

  return NextResponse.json(
    {
      summary: { total: results.length, passed, failed, allOk },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
