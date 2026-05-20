/**
 * Enforcement de limites por plano (M12#4 + M11#7).
 *
 * Free → 50 leads ativos + 2 membros (incluindo convites pending) + 1
 *        agente IA ativo.
 * Pro  → leads/membros ilimitados (Number.POSITIVE_INFINITY) + 3 agentes IA
 *        ativos.
 *
 * **`activeAgents` é o único limite finito no Pro** (M11#7) — o teto de 3
 * vem do PRD (glossário "Agente IA"); leads/membros continuam ilimitados.
 * O gate "agente exige plano pago" (Free=0) fica pra M12#3, quando o tier
 * Pro IA passar a existir no billing — hoje o enum `SubscriptionPlan` só
 * tem `pro`, então Free ganha 1 agente como gostinho do recurso.
 *
 * **Fonte de verdade do plano**: ausência de Subscription com status
 * active/past_due = free. Mesma regra do `features/billing/queries.ts`.
 *
 * **API**:
 *  - `canAddLead` / `canAddMember` / `canActivateAgent` (workspaceId, opts?)
 *    — gate pra Server Actions. Aceita `tx` opcional pra rodar dentro da
 *    mesma transação do caller (atômico com o INSERT/UPDATE subsequente).
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

import { computeTrialState } from '@/features/billing/trial';
import { withWorkspace } from '@/lib/supabase/with-workspace';

export type Plan = 'free' | 'pro';

/**
 * Limites por plano. `Number.POSITIVE_INFINITY` em leads/members no Pro
 * deixa `current + increment > limit` sempre `false` (matemática limpa, sem
 * `if (plan === 'pro') skip`).
 *
 * `activeAgents` é finito nos dois planos (Free 1, Pro 3) — `computeLimitState`
 * trata limite finito sem caso especial; só não cai no branch de "ilimitado".
 */
export const PLAN_LIMITS: Record<Plan, { leads: number; members: number; activeAgents: number }> = {
  free: { leads: 50, members: 2, activeAgents: 1 },
  pro: {
    leads: Number.POSITIVE_INFINITY,
    members: Number.POSITIVE_INFINITY,
    activeAgents: 3,
  },
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
  activeAgents: LimitState;
}

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * `getActivePlan` — resolve o plano EFETIVO pra fins de limites (M12#2).
 *
 * Precedência:
 *  1. Subscription ativa/past_due → `pro` (pago).
 *  2. Trial em andamento (`now < trial_ends_at`) → `pro` (trial = acesso Pro).
 *  3. Senão → `free`.
 *
 * O trial mapeia pra `pro` de propósito: assim toda a lógica de limites e
 * banners (M11#7/M12#4) fica idêntica entre trial e Pro pago. A distinção
 * "trial vs pago" é do billing (`getBillingState`), não dos limites.
 */
async function getActivePlan(tx: Prisma.TransactionClient, workspaceId: string): Promise<Plan> {
  const [activeCount, workspace] = await Promise.all([
    tx.subscription.count({
      where: { workspaceId, status: { in: ['active', 'past_due'] } },
    }),
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { trialEndsAt: true },
    }),
  ]);
  if (activeCount > 0) return 'pro';
  if (computeTrialState(workspace?.trialEndsAt ?? null, new Date()).status === 'active') {
    return 'pro';
  }
  return 'free';
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
 * `countActiveAgents` — agentes IA com `status='active'` no workspace
 * (M11#7). `testing`/`paused` não ocupam slot — o cap é sobre quantos
 * estão de fato atendendo conversas reais. Soft-deletados fora.
 */
async function countActiveAgents(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  return tx.aiAgent.count({
    where: { workspaceId, status: 'active', deletedAt: null },
  });
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

/**
 * `canActivateAgent` — verifica se workspace pode deixar +1 agente IA
 * `active` (M11#7). Conta só `status='active'`; chamar ao **ligar** um
 * agente que ainda não estava ativo.
 *
 * Caller passa `tx` pra rodar atômico com o `UPDATE status='active'` —
 * sem isso, 2 cliques simultâneos no último slot do Free passariam os dois
 * (mesma race que `canAddLead` evita no INSERT).
 *
 * **Idempotência é responsabilidade do caller**: se o agente já está
 * `active`, NÃO chame o gate (re-save de draft não consome slot). O gate
 * sempre assume "vai ligar +1".
 */
export async function canActivateAgent(
  workspaceId: string,
  opts?: CanAddOpts,
): Promise<CanAddResult> {
  const increment = opts?.increment ?? 1;

  const run = async (tx: Prisma.TransactionClient): Promise<CanAddResult> => {
    const [plan, current] = await Promise.all([
      getActivePlan(tx, workspaceId),
      countActiveAgents(tx, workspaceId),
    ]);
    const limit = PLAN_LIMITS[plan].activeAgents;
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
 * 1 round-trip via `withWorkspace`, counts em paralelo.
 *
 * `activeAgents` alimenta o banner de `/agents` (M11#7). `/settings/billing`
 * ainda não renderiza esse campo — integração na comparação Free×Pro fica
 * pra M12#3 (quando o tier Pro IA existir).
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  return withWorkspace(workspaceId, async (tx) => {
    const [plan, leadsCount, membersCount, agentsCount] = await Promise.all([
      getActivePlan(tx, workspaceId),
      countActiveLeads(tx, workspaceId),
      countMembersAndPending(tx, workspaceId),
      countActiveAgents(tx, workspaceId),
    ]);
    return {
      plan,
      leads: computeLimitState(plan, leadsCount, PLAN_LIMITS[plan].leads),
      members: computeLimitState(plan, membersCount, PLAN_LIMITS[plan].members),
      activeAgents: computeLimitState(plan, agentsCount, PLAN_LIMITS[plan].activeAgents),
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
  activeAgents: LimitStateUI;
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
    activeAgents: toLimitStateUI(usage.activeAgents),
  };
}

/**
 * `limitReachedMessage` — copy padronizado pros toast/banner.
 *
 * `leads`/`members`: Pro é a saída (uso ilimitado). `agents`: Pro também
 * tem teto (3), então a mensagem é plan-aware — no Free o caminho é assinar
 * o Pro; no Pro, pausar um agente.
 */
export function limitReachedMessage(
  kind: 'leads' | 'members' | 'agents',
  state: LimitState,
): string {
  if (kind === 'agents') {
    if (state.plan === 'free') {
      return `Limite do plano Free atingido (${state.current}/${state.limit} agente ativo). Assine o Pro pra ativar até ${PLAN_LIMITS.pro.activeAgents} agentes ao mesmo tempo.`;
    }
    return `Limite de agentes ativos atingido (${state.current}/${state.limit}). Pause um agente antes de ativar outro.`;
  }
  const label = kind === 'leads' ? 'leads ativos' : 'membros';
  return `Limite do plano Free atingido (${state.current}/${state.limit} ${label}). Assine o Pro pra liberar uso ilimitado.`;
}
