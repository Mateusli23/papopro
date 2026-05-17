/**
 * Enforcement de limites por plano (M12#4).
 *
 * Free → 50 leads ativos + 2 membros (incluindo convites pending).
 * Pro  → ilimitado (Number.POSITIVE_INFINITY).
 *
 * **Fonte de verdade do plano**: ausência de Subscription com status
 * active/past_due = free. Mesma regra do `features/billing/queries.ts`.
 *
 * **API**:
 *  - `canAddLead(workspaceId, opts?)` / `canAddMember(workspaceId, opts?)`
 *    — gate pra Server Actions. Aceita `tx` opcional pra rodar dentro da
 *    mesma transação do caller (atômico com o INSERT subsequente).
 *  - `getWorkspaceUsage(workspaceId)` — snapshot pra UI (banners + página
 *    /settings/billing).
 *
 * **Por que contar convites pending no limite de membros**: senão Owner
 * com 2 slots manda 5 convites; quando aceitam, o slot estourou
 * silenciosamente. Contar pending = bloqueio na hora do convite, UX
 * imediato.
 *
 * **Por que `status='ativo' AND deletedAt IS NULL` em leads**: leads
 * arquivados/deletados não ocupam slot — caso contrário workspace ficaria
 * permanentemente bloqueado pelo histórico.
 */
import 'server-only';

import { type Prisma } from '@papopro/db';

import { withWorkspace } from '@/lib/supabase/with-workspace';

export type Plan = 'free' | 'pro';

/**
 * Limites por plano. `Number.POSITIVE_INFINITY` no Pro deixa
 * `current + increment > limit` sempre `false` (matemática limpa, sem
 * `if (plan === 'pro') skip`).
 */
export const PLAN_LIMITS: Record<Plan, { leads: number; members: number }> = {
  free: { leads: 50, members: 2 },
  pro: { leads: Number.POSITIVE_INFINITY, members: Number.POSITIVE_INFINITY },
};

export interface LimitState {
  plan: Plan;
  /** Quantidade atual contada no banco. */
  current: number;
  /** Limite do plano (Infinity no Pro). */
  limit: number;
  /** `max(limit - current, 0)`. `Infinity` no Pro — UI formata como "ilimitado". */
  remaining: number;
  /** `current >= limit`. Sempre `false` no Pro. */
  atLimit: boolean;
  /** `current >= limit * 0.9`. Trigger pro banner amarelo (90%+). */
  nearLimit: boolean;
}

export type CanAddResult =
  | { ok: true; state: LimitState }
  | { ok: false; reason: 'plan_limit_reached'; state: LimitState };

export interface WorkspaceUsage {
  plan: Plan;
  leads: LimitState;
  members: LimitState;
}

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * `getActivePlan` — resolve plano via contagem de subscriptions ativas.
 * Mais leve que `getBillingState` (1 query, sem StripeCustomer).
 */
async function getActivePlan(tx: Prisma.TransactionClient, workspaceId: string): Promise<Plan> {
  const activeCount = await tx.subscription.count({
    where: { workspaceId, status: { in: ['active', 'past_due'] } },
  });
  return activeCount > 0 ? 'pro' : 'free';
}

async function countActiveLeads(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  return tx.lead.count({
    where: { workspaceId, status: 'ativo', deletedAt: null },
  });
}

async function countMembersAndPending(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  const [members, pending] = await Promise.all([
    tx.workspaceMember.count({ where: { workspaceId } }),
    tx.invitation.count({ where: { workspaceId, status: 'pending' } }),
  ]);
  return members + pending;
}

/**
 * `computeLimitState` — helper puro pra montar LimitState a partir de
 * `plan + current + limit`. Extraído pra testar via smoke sem mock de DB.
 */
export function computeLimitState(plan: Plan, current: number, limit: number): LimitState {
  const remaining =
    limit === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(limit - current, 0);
  return {
    plan,
    current,
    limit,
    remaining,
    atLimit: current >= limit,
    nearLimit: limit !== Number.POSITIVE_INFINITY && current >= Math.floor(limit * 0.9),
  };
}

// ─── canAdd gates ──────────────────────────────────────────────────────────

interface CanAddOpts {
  /** Reusa transação do caller. Quando omitido, abre `withWorkspace` novo. */
  tx?: Prisma.TransactionClient;
  /** Quantos slots o caller pretende ocupar. Default 1. Usado por importLeads. */
  increment?: number;
}

/**
 * `canAddLead` — verifica se workspace pode criar mais N leads (default 1).
 *
 * Retorna sempre `LimitState` (mesmo em sucesso) pra UI poder mostrar quanto
 * sobrou pós-ação (ex: "47/50 ocupados").
 */
export async function canAddLead(workspaceId: string, opts?: CanAddOpts): Promise<CanAddResult> {
  const increment = opts?.increment ?? 1;

  const run = async (tx: Prisma.TransactionClient): Promise<CanAddResult> => {
    const [plan, current] = await Promise.all([
      getActivePlan(tx, workspaceId),
      countActiveLeads(tx, workspaceId),
    ]);
    const limit = PLAN_LIMITS[plan].leads;
    const state = computeLimitState(plan, current, limit);

    if (current + increment > limit) {
      return { ok: false, reason: 'plan_limit_reached', state };
    }
    return { ok: true, state };
  };

  if (opts?.tx) return run(opts.tx);
  return withWorkspace(workspaceId, run);
}

/**
 * `canAddMember` — verifica se workspace pode adicionar +1 membro (convite
 * pending ou aceito direto). Conta `WorkspaceMember + pending Invitation`.
 */
export async function canAddMember(workspaceId: string, opts?: CanAddOpts): Promise<CanAddResult> {
  const increment = opts?.increment ?? 1;

  const run = async (tx: Prisma.TransactionClient): Promise<CanAddResult> => {
    const [plan, current] = await Promise.all([
      getActivePlan(tx, workspaceId),
      countMembersAndPending(tx, workspaceId),
    ]);
    const limit = PLAN_LIMITS[plan].members;
    const state = computeLimitState(plan, current, limit);

    if (current + increment > limit) {
      return { ok: false, reason: 'plan_limit_reached', state };
    }
    return { ok: true, state };
  };

  if (opts?.tx) return run(opts.tx);
  return withWorkspace(workspaceId, run);
}

// ─── UI snapshot ───────────────────────────────────────────────────────────

/**
 * `getWorkspaceUsage` — snapshot pra renderizar banners + /settings/billing.
 * 1 round-trip via `withWorkspace`, 4 counts em paralelo.
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  return withWorkspace(workspaceId, async (tx) => {
    const [plan, leadsCount, membersCount] = await Promise.all([
      getActivePlan(tx, workspaceId),
      countActiveLeads(tx, workspaceId),
      countMembersAndPending(tx, workspaceId),
    ]);
    return {
      plan,
      leads: computeLimitState(plan, leadsCount, PLAN_LIMITS[plan].leads),
      members: computeLimitState(plan, membersCount, PLAN_LIMITS[plan].members),
    };
  });
}

/**
 * `formatLimit` — formata limite pra UI (`50` ou `'ilimitado'`).
 */
export function formatLimit(limit: number): string {
  return limit === Number.POSITIVE_INFINITY ? 'ilimitado' : String(limit);
}

/**
 * Versão serializável de `LimitState` pra atravessar boundary RSC → Client.
 * `Number.POSITIVE_INFINITY` pode causar surpresas na Flight serialization;
 * traduzimos pra `null` + flag explícita `isUnlimited`. UI consome o `null`
 * como "ilimitado".
 */
export interface LimitStateUI {
  plan: Plan;
  current: number;
  /** `null` = ilimitado (Pro). Caso contrário inteiro positivo. */
  limit: number | null;
  isUnlimited: boolean;
  atLimit: boolean;
  nearLimit: boolean;
  /** 0-100. `0` quando ilimitado (nada pra preencher). */
  percent: number;
}

export interface WorkspaceUsageUI {
  plan: Plan;
  leads: LimitStateUI;
  members: LimitStateUI;
}

export function toLimitStateUI(state: LimitState): LimitStateUI {
  const isUnlimited = state.limit === Number.POSITIVE_INFINITY;
  const percent =
    isUnlimited || state.limit === 0
      ? 0
      : Math.min(100, Math.round((state.current / state.limit) * 100));
  return {
    plan: state.plan,
    current: state.current,
    limit: isUnlimited ? null : state.limit,
    isUnlimited,
    atLimit: state.atLimit,
    nearLimit: state.nearLimit,
    percent,
  };
}

export function toWorkspaceUsageUI(usage: WorkspaceUsage): WorkspaceUsageUI {
  return {
    plan: usage.plan,
    leads: toLimitStateUI(usage.leads),
    members: toLimitStateUI(usage.members),
  };
}

/**
 * `LIMIT_REACHED_MESSAGE` — copy padronizado pros toast/banner. Inclui
 * CTA de upgrade pra UX consistente entre lead/member.
 */
export function limitReachedMessage(kind: 'leads' | 'members', state: LimitState): string {
  const label = kind === 'leads' ? 'leads ativos' : 'membros';
  return `Limite do plano Free atingido (${state.current}/${state.limit} ${label}). Assine o Pro pra liberar uso ilimitado.`;
}
