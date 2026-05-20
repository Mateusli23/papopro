/**
 * Lógica pura do trial de 7 dias sem cartão (M12#2).
 *
 * Sem `'server-only'`, sem Prisma — importável em smoke, Server Components e
 * nas queries. As leituras de banco (`getBillingState`, `getTrialState`)
 * ficam em `queries.ts`; o job de avisos em `app/api/cron/trial-warnings`.
 *
 * **Modelo do trial**: o workspace NÃO tem subscription Stripe durante o
 * trial (sem cartão). O estado vive em `workspaces.trial_ends_at`. A
 * expiração é lazy — `getActivePlan` (`lib/limits.ts`) compara `now` com
 * `trialEndsAt` ao vivo; não há job de downgrade. Durante o trial o
 * workspace tem acesso equivalente ao Pro.
 */
import { addDays } from 'date-fns';

/** Duração do trial. PRD §7.7 / CLAUDE.md §7.7 — 7 dias sem cartão. */
export const TRIAL_DURATION_DAYS = 7;

const ONE_DAY_MS = 86_400_000;

/**
 * `none`  — workspace nunca teve trial (`trial_ends_at` NULL).
 * `active` — trial em andamento (`now < trial_ends_at`).
 * `expired` — trial acabou (`now >= trial_ends_at`).
 */
export type TrialStatus = 'none' | 'active' | 'expired';

export interface TrialState {
  status: TrialStatus;
  /** Fim do trial. `null` quando `status='none'`. */
  endsAt: Date | null;
  /** Dias inteiros restantes (`ceil`). `≥1` enquanto ativo; `0` se expirado/none. */
  daysLeft: number;
}

/**
 * `trialEndsAtFrom` — calcula o fim do trial a partir de um instante de
 * referência (a criação do workspace). `createWorkspaceAction` chama com
 * `new Date()`.
 */
export function trialEndsAtFrom(reference: Date): Date {
  return addDays(reference, TRIAL_DURATION_DAYS);
}

/**
 * `computeTrialState` — puro: dado `trial_ends_at` (ou `null`) e o instante
 * atual, devolve o estado do trial. Testável sem DB.
 */
export function computeTrialState(trialEndsAt: Date | null, now: Date): TrialState {
  if (!trialEndsAt) {
    return { status: 'none', endsAt: null, daysLeft: 0 };
  }
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { status: 'expired', endsAt: trialEndsAt, daysLeft: 0 };
  }
  return {
    status: 'active',
    endsAt: trialEndsAt,
    daysLeft: Math.ceil(remainingMs / ONE_DAY_MS),
  };
}

/**
 * Qual aviso de trial expirando o job diário deve enviar.
 *  - `d1` — trial a ≤1 dia do fim, aviso D-1 ainda não enviado.
 *  - `d2` — trial a ≤2 dias do fim, aviso D-2 ainda não enviado.
 *  - `null` — nada a enviar.
 */
export type TrialWarning = 'd2' | 'd1';

export interface TrialWarningInput {
  trialEndsAt: Date;
  now: Date;
  /** `workspaces.trial_warn_d2_sent_at` — `null` = ainda não enviado. */
  d2SentAt: Date | null;
  /** `workspaces.trial_warn_d1_sent_at`. */
  d1SentAt: Date | null;
}

/**
 * `pickTrialWarning` — decide qual aviso enviar, **no máximo 1 por execução**.
 *
 * D-1 tem precedência sobre D-2: se o job atrasou e o workspace já está a ≤1
 * dia sem nunca ter recebido D-2, manda direto o D-1 (mais urgente) e pula o
 * D-2 — não faz sentido avisar "faltam 2 dias" quando falta menos de 1.
 *
 * Trial já expirado → `null` (o downgrade pra Free é lazy, sem aviso).
 */
export function pickTrialWarning(input: TrialWarningInput): TrialWarning | null {
  const remainingMs = input.trialEndsAt.getTime() - input.now.getTime();
  if (remainingMs <= 0) return null;
  if (remainingMs <= ONE_DAY_MS && !input.d1SentAt) return 'd1';
  if (remainingMs <= 2 * ONE_DAY_MS && !input.d2SentAt) return 'd2';
  return null;
}
